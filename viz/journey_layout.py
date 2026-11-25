"""Panorama layout: layer frames (a stop + its nearest k tokens) are stitched into one fixed 2D map through the tokens they share.

layout(R, DT, DS, M) -> dict
  R  [L,n]  stop-token distance (1-cosine)      DT [n,n] token-token      DS [L,L] stop-stop
  M  [L,n]  bool; is the token among that stop's nearest k. M[l] must mark the smallest values of R[l].
Returns: X [n,2] tokens, S [L,2] stops, h [L] common distance removed, rho [L,n] target = R-h, prec [L] hit rate
  h[l] = max(0, min_j R[l,j] - RHO0): one scale, one number removed per layer -> the order and differences of neighbours are kept;
  in a layer that already has a close neighbour (the embedding) h=0 and distances stay as they are.
Method: Isomap start (graph shortest paths + classical MDS) -> equal-priority stress (member rings, non-members outside).
A [L-1] (optional): angle between consecutive stops (rad); on the map the target step is c*A (weight ws).
wn: Sammon-style weight; pairs with a small raw distance (such as the token itself) are more reliable and weigh more.
wb: bending penalty (difference of consecutive unit steps).
K [L] bool + wr: at these stops the order of the nearest TOP tokens is kept (the r-th neighbour must be at least GAP closer
than every token farther than it; ties in R do not push each other).
Deterministic for a given seed."""
import torch

RHO0, MARGIN, TOP, GAP = 0.02, 0.06, 5, 0.004

def precision(S, X, M):
    d = torch.cdist(S, X); out = []
    for l in range(len(S)):
        k = int(M[l].sum()); out.append(M[l][d[l].topk(k, largest=False).indices].float().mean().item())
    return out

def order_acc(S, X, R, top=3):
    """Per stop (is the nearest one right, share of the true first `top` tokens that are in the map's first `top`)."""
    d = torch.cdist(S, X); out = []
    for l in range(len(S)):
        a, b = R[l].topk(top, largest=False).indices.tolist(), d[l].topk(top, largest=False).indices.tolist()
        out.append((a[0] == b[0], len(set(a) & set(b)) / top))
    return out

def _isomap(G):
    N = len(G); G = G.clone()
    for k in range(N): G = torch.minimum(G, G[:, k:k + 1] + G[k:k + 1, :])
    J = torch.eye(N) - 1.0 / N
    w, U = torch.linalg.eigh(-0.5 * J @ G ** 2 @ J)
    P = U[:, -2:] * w[-2:].clamp_min(0).sqrt()
    for c in range(2):  # fix the sign
        if P[P[:, c].abs().argmax(), c] < 0: P[:, c] *= -1
    return P

def _graph(R, DT, DS, M, A, c):
    L, n = R.shape
    rho = (R - (R.min(1).values - RHO0).clamp_min(0)[:, None]).clamp_min(0)
    G = torch.full((L + n, L + n), 1e6); G.fill_diagonal_(0)
    G[:L, L:] = torch.where(M, rho, G[:L, L:]); G[L:, :L] = G[:L, L:].T
    G[L:, L:] = torch.minimum(G[L:, L:], DT)
    for l in range(L - 1): G[l, l + 1] = G[l + 1, l] = min(float(G[l, l + 1]), max(float(DS[l, l + 1]), 0.05)) if A is None else c * float(A[l])
    return G

def layout(R, DT, DS, M, steps=1500, wt=0.002, wp=0.3, noise=0.0, seed=0, A=None, ws=0.0, c=0.2, wn=30.0, wb=0.0, init=None, K=None, wr=0.0):
    L, n = R.shape
    rmin = R.min(1).values
    h = (rmin - RHO0).clamp_min(0); rho = (R - h[:, None]).clamp_min(0)
    rmax = torch.stack([rho[l][M[l]].max() for l in range(L)])
    P = _isomap(_graph(R, DT, DS, M, A, c)) if init is None else init
    if noise: P = P + noise * torch.randn(P.shape, generator=torch.Generator().manual_seed(seed))
    Q = P.clone().requires_grad_(True)
    if K is not None and wr:
        kt = min(TOP, n); Rk = R[K]; ti = Rk.topk(kt, largest=False).indices
        far = (Rk[:, None, :] > torch.gather(Rk, 1, ti)[:, :, None]).float() / torch.arange(1, kt + 1)[None, :, None]  # [Lk,kt,n]
    opt = torch.optim.Adam([Q], lr=0.02); sch = torch.optim.lr_scheduler.CosineAnnealingLR(opt, steps, 0.0005)
    Mf = M.float(); wm = 1 + wn * (0.1 / (R + 0.1)) ** 2; lim = (rmax + MARGIN)[:, None]
    wT = 1 / (DT + 0.2); tri = torch.triu(torch.ones(n, n), 1)
    with torch.enable_grad():
        for t in range(steps):
            opt.zero_grad(); S, X = Q[:L], Q[L:]
            ds = (((S[:, None] - X[None]) ** 2).sum(-1) + 1e-6).sqrt()
            dx = (((X[:, None] - X[None]) ** 2).sum(-1) + 1e-6).sqrt()
            ramp = min(1.0, t / (steps * 0.4))  # push from non-members grows gradually so that tokens can pass through each other
            loss = (Mf * wm * (ds - rho) ** 2).sum() + ramp * ((1 - Mf) * (lim - ds).clamp_min(0) ** 2).sum() * 2.0
            loss = loss + wt * (tri * wT * (dx - DT) ** 2).sum() + wp * (tri * (0.05 - dx).clamp_min(0) ** 2).sum()
            if A is not None: loss = loss + ws * ((((S[1:] - S[:-1]) ** 2).sum(-1) + 1e-6).sqrt() - c * A).pow(2).sum()
            if A is not None and wb and L > 2:
                D = (S[1:] - S[:-1]) / (c * A[:, None].clamp_min(0.02)); loss = loss + wb * (D[1:] - D[:-1]).pow(2).sum()
            if K is not None and wr:
                dk = ds[K]; loss = loss + wr * ramp * (far * (torch.gather(dk, 1, ti)[:, :, None] + GAP - dk[:, None, :]).clamp_min(0)).sum()
            loss.backward(); opt.step(); sch.step()
    Q = Q.detach(); S, X = Q[:L], Q[L:]; err = ((torch.cdist(S, X) - rho) * Mf).abs().sum(1) / Mf.sum(1)
    return {"X": X, "S": S, "h": h, "rho": rho, "prec": precision(S, X, M), "err": err}

def slerp_stops(V, step):
    """V [K,d] unit vectors -> (P [L,d] unit, ts [L] layer position, A [L-1] angle). The stretch between each pair of V
    is split on the shortest arc into equal parts of ~step radians (at least 2, i.e. at least one point in each stretch); the V are kept as they are."""
    P, ts, A = [], [], []
    for l in range(len(V) - 1):
        th = torch.acos((V[l] @ V[l + 1]).clamp(-1, 1)); N = max(2, round(float(th) / step))
        w = V[l + 1] - (V[l] @ V[l + 1]) * V[l]; w = w / w.norm().clamp_min(1e-9)
        for s in range(N):
            P.append(torch.cos(th * s / N) * V[l] + torch.sin(th * s / N) * w); ts.append(l + s / N); A.append(float(th) / N)
    return torch.stack(P + [V[-1]]), ts + [float(len(V) - 1)], torch.tensor(A)

def best(R, DT, DS, M, A=None, K=None, wr=0.0):
    """Four fixed starts; the one with the highest hit rate (plus the order accuracy at the K stops if K is given)."""
    init = _isomap(_graph(R, DT, DS, M, A, 0.2))
    run = lambda nz, s: layout(R, DT, DS, M, wt=0.001, noise=nz, seed=s, A=A, ws=10.0, wb=0.1, init=init, K=K, wr=wr)
    def score(o):
        v = sum(o["prec"]) / len(o["prec"])
        if K is not None: t = order_acc(o["S"][K], o["X"], R[K]); v += sum(a + b for a, b in t) / len(t)
        return v
    return max((run(nz, s) for nz, s in ((0, 0), (0.1, 0), (0.1, 1), (0.1, 2))), key=score)
