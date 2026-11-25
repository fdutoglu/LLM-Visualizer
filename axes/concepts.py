"""Concept directions: the difference b-a. One pair is left out (leave-one-out) and the direction comes from the others.
hits: is b the token nearest to a+direction (Latin, without a). baseline: nearest to a alone (direction=0);
other: the same a and b but with the directions of the other sets. cos: mean cosine with the left-out difference, with a shuffled-pairing baseline.
single_axis: sign hits on the left-out pair of the raw axis whose sign is most consistent over the training pairs."""
import sys, os, json, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure as M, labels
P = {"male→female": "king queen man woman boy girl father mother brother sister son daughter uncle aunt husband wife actor actress prince princess he she grandfather grandmother nephew niece",
"singular→plural": "cat cats dog dogs car cars book books house houses tree trees child children man men city cities country countries woman women foot feet hand hands word words",
"present→past": "walk walked go went see saw take took give gave make made play played write wrote run ran think thought want wanted eat ate say said find found",
"adjective→comparative": "big bigger small smaller fast faster slow slower old older young younger strong stronger weak weaker high higher low lower long longer short shorter good better bad worse",
"country→capital": "France Paris Germany Berlin Italy Rome Spain Madrid Japan Tokyo China Beijing Russia Moscow Egypt Cairo Greece Athens Turkey Ankara Portugal Lisbon Poland Warsaw Austria Vienna Ireland Dublin",
"country→nationality": "France French Germany German Italy Italian Spain Spanish Japan Japanese China Chinese Russia Russian Egypt Egyptian Greece Greek Turkey Turkish Portugal Portuguese Poland Polish Austria Austrian Ireland Irish",
"lowercase→Capitalized": "king King house House city City water Water music Music power Power school School family Family world World time Time money Money game Game",
"Eng→Fr": "house maison water eau dog chien cat chat king roi day jour night nuit woman femme man homme book livre school école world monde city ville life vie",
"positive→negative": "good bad happy sad love hate beautiful ugly success failure win lose rich poor right wrong best worst strong weak safe dangerous easy difficult"}
keep, B, L, X, tr = M.load(); del X
lat = torch.tensor([i for i, t in zip(keep, B) if M.IDS[i].startswith("▁") and M.IDS[i][1:].isalpha()]); pos = {int(i): j for j, i in enumerate(lat)}
G = M.E[lat].float(); G = G - G.mean(0); N = G / G.norm(dim=1, keepdim=True); idx = {M.IDS[int(i)][1:]: j for j, i in enumerate(lat)}
pr = {}
for k, s in P.items():
    w = s.split(); q = [(idx.get(a), idx.get(b)) for a, b in zip(w[::2], w[1::2])]; miss = [p for p, x in zip(zip(w[::2], w[1::2]), q) if None in x]
    pr[k] = [x for x in q if None not in x]
    if miss: print("not a single token:", k, miss)
D = {k: torch.stack([G[b] - G[a] for a, b in q]) for k, q in pr.items()}; cos = torch.nn.functional.cosine_similarity
out = {}
for k, q in pr.items():
    n = len(q); A = torch.tensor([a for a, _ in q]); Bt = torch.tensor([b for _, b in q]); hit = base = rnd = ax = 0; nr = 0; cs = []
    def near(v, a, b): s = N @ v; s[a] = -9; return int(s.argmax()) == b
    for i in range(n):
        o = [j for j in range(n) if j != i]; d = D[k][o].mean(0); a, b = q[i]
        hit += near(G[a] + d, a, b); base += near(G[a], a, b); cs.append(float(cos(d, D[k][i], 0)))
        for k2 in D:
            if k2 != k: rnd += near(G[a] + D[k2].mean(0), a, b); nr += 1
        tt = D[k][o]; e = int((tt.mean(0) / tt.std(0)).abs().argmax()); ax += bool(torch.sign(tt[:, e].mean()) == torch.sign(D[k][i, e]))
    g = torch.Generator().manual_seed(0); cn = []
    for _ in range(200):
        pm = torch.randperm(n, generator=g); dd = G[Bt[pm]] - G[A]; i = int(torch.randint(n, (1,), generator=g)); cn.append(float(cos(dd[[j for j in range(n) if j != i]].mean(0), dd[i], 0)))
    e = D[k].mean(0)**2; ee = e.sort(descending=True).values.cumsum(0) / e.sum(); n80 = int((ee < .8).sum()) + 1
    out[k] = dict(n=n, hits=hit, baseline=base, other=round(rnd / nr, 3), cos=round(sum(cs) / n, 3), cos_shuffled=round(sum(cn) / 200, 3), single_axis=ax, axes80=n80, top=[int(x) for x in e.topk(5).indices], top_share=[round(float(x), 3) for x in (e.topk(5).values / e.sum())])
    print(k, out[k], flush=True)
json.dump(out, open(os.path.join(M.H, "concepts.json"), "w"), ensure_ascii=False)
