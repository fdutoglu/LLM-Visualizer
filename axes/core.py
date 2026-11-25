"""Core of the axis measurement (pure functions; needs no model).
fastica(Z, seed): whitened Z [n,d] -> orthogonal W [d,d]; sources Z@W.T (symmetric FastICA, logcosh).
auc_matrix(S, Y): S [n,d] scores, Y [n,L] bool -> AUC [d,L] (average rank for ties).
prec_at(S, Y, k): label share among the first k[l] tokens at the '+' end of each axis [d,L].
split_groups(keys, seed): the same key is always in the same half; True = training."""
import hashlib
import torch

def whiten(X):
    m = X.mean(0); C = (X - m).T @ (X - m) / (len(X) - 1)
    w, U = torch.linalg.eigh(C); w, U = w.flip(0), U.flip(1)
    return m, U, w

def _orth(W):
    w, U = torch.linalg.eigh(W @ W.T)
    return U @ torch.diag(w.rsqrt()) @ U.T @ W

def fastica(Z, seed=0, iters=200, tol=1e-4):
    n, d = Z.shape; g = torch.Generator().manual_seed(seed)
    W = _orth(torch.randn(d, d, generator=g, dtype=Z.dtype)); lim = 1.
    for it in range(iters):
        N = torch.zeros_like(W); h = torch.zeros(d, dtype=Z.dtype)
        for a in range(0, n, 20000):
            z = Z[a:a + 20000]; t = torch.tanh(z @ W.T); N += t.T @ z; h += (1 - t * t).sum(0)
        W1 = _orth(N / n - (h / n)[:, None] * W)
        lim = float(((W1 * W).sum(1).abs() - 1).abs().max()); W = W1
        if lim < tol: break
    return W, it + 1, lim

def ranks(x):
    """Ascending average rank (from 1)."""
    v, inv, c = torch.unique(x, return_inverse=True, return_counts=True)
    e = c.cumsum(0); return (e.double() - (c.double() - 1) / 2)[inv]

def auc_matrix(S, Y):
    Y = Y.double(); np_ = Y.sum(0); nn = len(Y) - np_; out = []
    for j in range(S.shape[1]):
        out.append((ranks(S[:, j]) @ Y - np_ * (np_ + 1) / 2) / (np_ * nn))
    return torch.stack(out)

def prec_at(S, Y, k):
    K = int(max(k)); o = S.topk(K, dim=0).indices; c = Y.float()[o].cumsum(0)
    return torch.stack([c[int(k[l]) - 1, :, l] / int(k[l]) for l in range(Y.shape[1])], 1)

def split_groups(keys, seed="0"):
    return torch.tensor([hashlib.sha256((seed + k).encode()).digest()[0] < 128 for k in keys])

def match(A, B):
    """Two sets of directions with unit rows: the best |cosine| in B for each row of A."""
    return (A @ B.T).abs().max(1).values
