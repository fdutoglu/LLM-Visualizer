"""Visualizer data from the measurement outputs: viz/axes.json (records + both ends) and viz/axes.pt (m, P; end A is positive)."""
import json, os, torch, measure as M, axisdata as a
H = M.H; R = json.load(open(H + "/result.json")); I = json.load(open(H + "/intrude.json"))["ica"]; st = torch.load(H + "/ica.pt")
ends = {}
for d, s, p, w in I: ends.setdefault(d, {})[s] = (p, w)
P = st["Wh"] @ st["W"][0].T; m, keep = st["m"], st["keep"]; lab = {x["d"]: x for x in R["ica"]}
rec = [a.axis_record(d, R["stab"][d], lab[d], ends[d]) for d in range(640)]
P = P * torch.tensor([float(r["flip"]) for r in rec]); X = M.E[keep].float()
for lo in range(0, 640, 32):
    S = (X - m) @ P[:, lo:lo + 32]
    for j in range(S.shape[1]):
        for e, ix in zip(rec[lo + j]["ends"], a.top_ends(S[:, j], 24)): e["top"] = [[int(keep[i]), M.IDS[keep[i]], round(float(S[i, j]), 2)] for i in ix]
out = os.path.join(H, "..", "viz"); json.dump(rec, open(out + "/axes.json", "w"), ensure_ascii=False)
torch.save(dict(m=m, P=P.contiguous(), keep=torch.as_tensor(keep)), out + "/axes.pt")
print("axes", len(rec), "tested", sum(any(e["ok"] for e in r["ends"]) for r in rec), "both ends", sum(all(e["ok"] for e in r["ends"]) for r in rec))
for r in rec:
    if r["ends"][0]["ok"]: print(r["id"], r["ends"][0]["name"], end=" | ")
