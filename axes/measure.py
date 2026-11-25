"""Yönleri eğitim yarısında etiketle, test yarısında sına. Ölçütler ölçümden önce sabitlendi:
geçer = test AUC >= .90 VE P@n (n=min(50,test pozitifi)) >= .50 (taban oranı <= .2 ise; değilse >= .95). Etiket için testte >= 15 pozitif."""
import sys, os, json, time, torch
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
import core as c, labels
from safetensors import safe_open
from transformers import AutoTokenizer
M = os.path.join(H, "..", "model"); tok = AutoTokenizer.from_pretrained(M)
with safe_open(os.path.join(M, "model.safetensors"), "pt") as f: E = f.get_tensor("model.embed_tokens.weight")
IDS = tok.convert_ids_to_tokens(list(range(E.shape[0])))
def load():
    keep, B, L = labels.build(IDS); X = E[keep].float(); tr = c.split_groups(B); return keep, B, L, X, tr
def evalset(S, tr, L, shuf=None):
    """Her eksen için eğitimde en iyi (etiket, uç); test puanı. shuf: etiketleri arka plan içinde, yarı içinde karıştır."""
    names = list(L); D = S.shape[1]; R = {}
    for half, m in (("tr", tr), ("te", ~tr)):
        A = torch.zeros(D, len(names)); Pp = torch.zeros(D, len(names)); Pn = Pp.clone(); N = torch.zeros(len(names)); base = N.clone()
        bgs = {}
        for l, k in enumerate(names): bgs.setdefault(L[k][0].numpy().tobytes(), []).append(l)
        for ls in bgs.values():
            ok = L[names[ls[0]]][0] & m; Y = torch.stack([L[names[l]][1][ok] for l in ls], 1)
            if shuf is not None: Y = Y[torch.randperm(len(Y), generator=shuf)]
            s = S[ok]; n = Y.sum(0).clamp(1, 50); A[:, ls] = c.auc_matrix(s, Y).float(); Pp[:, ls] = c.prec_at(s, Y, n); Pn[:, ls] = c.prec_at(-s, Y, n); N[ls] = Y.sum(0).float(); base[ls] = Y.float().mean(0)
        R[half] = (A, Pp, Pn, N, base)
    A, Pp, Pn, N, b = R["tr"]; At, Pt, Pnt, Nt, bt = R["te"]; use = (N >= 15) & (Nt >= 15)
    auc = torch.stack([A, 1 - A]); p = torch.stack([Pp, Pn]); need = torch.where(b <= .2, .5, .95)
    score = (torch.minimum(auc / .9, torch.ones(1)) * torch.minimum(p / need, torch.ones(1)) + .01 * auc + .01 * p); score[:, :, ~use] = -1
    out = []
    for d in range(D):
        sgn, l = divmod(int(score[:, d].argmax()), len(names)); a = float(At[d, l] if sgn == 0 else 1 - At[d, l]); q = float((Pt if sgn == 0 else Pnt)[d, l])
        out.append(dict(d=d, sgn=1 - 2 * sgn, lab=names[l], auc=a, p=q, base=float(bt[l]), ok=a >= .9 and q >= (.5 if bt[l] <= .2 else .95)))
    return out
if __name__ == "__main__":
    t0 = time.time(); keep, B, L, X, tr = load(); L = {k: (torch.tensor(a), torch.tensor(b)) for k, (a, b) in L.items()}
    print("token", len(keep), "egitim", int(tr.sum()), "etiket", len(L), {k: int((a & b).sum()) for k, (a, b) in L.items()})
    m, U, w = c.whiten(X[tr].double()); print("PCA pay", [round(float(w[:k].sum() / w.sum()), 3) for k in (1, 2, 10, 50, 100, 300)])
    Wh = (U / w.sqrt()).float(); m = m.float(); Z = (X - m) @ Wh; ms = {"ham": X - m, "pca": Z}
    g = torch.Generator().manual_seed(9); ms["rastgele-ham"] = (X - m) @ torch.linalg.qr(torch.randn(640, 640, generator=g))[0]
    ms["rastgele-beyaz"] = Z @ torch.linalg.qr(torch.randn(640, 640, generator=g))[0]
    Ws = []
    for s in range(3):
        W, it, lim = c.fastica(Z[tr], s, 300); Ws.append(W); print("ica", s, it, f"{lim:.4f}", f"{time.time()-t0:.0f}s", flush=True)
    torch.save(dict(W=Ws, Wh=Wh, m=m, keep=keep), os.path.join(H, "ica.pt"))
    st = torch.minimum(c.match(Ws[0], Ws[1]), c.match(Ws[0], Ws[2])); g2 = torch.linalg.qr(torch.randn(640, 640, generator=g))[0]
    print("kararli >.9:", int((st > .9).sum()), ">.7:", int((st > .7).sum()), "rastgele en buyuk esleme", float(c.match(Ws[0], g2).max()))
    ms["ica"] = Z @ Ws[0].T; res = {"stab": st.tolist()}
    for k, S in ms.items():
        r = evalset(S, tr, L); sh = [sum(x["ok"] for x in evalset(S, tr, L, torch.Generator().manual_seed(i))) for i in range(3)]
        res[k] = r; print(k, "gecen", sum(x["ok"] for x in r), "farkli etiket", len({x["lab"] for x in r if x["ok"]}), "karistirilmis", sh, f"{time.time()-t0:.0f}s", flush=True)
    json.dump(res, open(os.path.join(H, "result.json"), "w"), ensure_ascii=False)
