"""Independent meaning test (word intrusion): 4 words from an end of the axis + 1 intruder from the middle of the same axis.
Does BERT's input embedding (trained independently of Gemma) find the intruder? Chance 1/5. Only '▁lowercase' words in BERT's vocabulary.
No repeated stems (first 4 letters differ), so that suffix or spelling similarity earns no score. 40 trials per end, from the first 12 words."""
import sys, os, json, glob, random, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure as M
from safetensors import safe_open
sn = glob.glob(os.path.expanduser("~/.cache/huggingface/hub/models--bert-base-uncased/snapshots/*"))[0]
bv = {w.rstrip("\n"): i for i, w in enumerate(open(sn + "/vocab.txt", encoding="utf8"))}
with safe_open(sn + "/model.safetensors", "pt") as f: BE = f.get_tensor([k for k in f.keys() if "word_embeddings" in k][0]).float()
st = torch.load(os.path.join(M.H, "ica.pt")); keep, m, Wh = st["keep"], st["m"], st["Wh"]
W = [(j, M.IDS[i][1:]) for j, i in enumerate(keep) if M.IDS[i].startswith("▁") and M.IDS[i][1:].isascii() and M.IDS[i][1:].isalpha() and len(M.IDS[i]) >= 5 and M.IDS[i][1:].islower() and M.IDS[i][1:] in bv]
T = [w for _, w in W]; Xw = M.E[[keep[j] for j, _ in W]].float() - m; Z = Xw @ Wh
Bn = BE[[bv[w] for w in T]]; Bn = Bn - Bn.mean(0); Bn = Bn / Bn.norm(dim=1, keepdim=True)
g = torch.Generator().manual_seed(9); R1 = torch.linalg.qr(torch.randn(640, 640, generator=g))[0]; R2 = torch.linalg.qr(torch.randn(640, 640, generator=g))[0]
S = {"raw": Xw, "pca": Z, "random-raw": Xw @ R1, "random-white": Z @ R2, "ica": Z @ st["W"][0].T, "ica-seed1": Z @ st["W"][1].T}
def score(s, rng):
    o = s.argsort(descending=True).tolist(); top, seen = [], set()
    for i in o:
        if T[i][:4] not in seen: top.append(i); seen.add(T[i][:4])
        if len(top) == 12: break
    mid = o[len(o) // 4:3 * len(o) // 4]; h = 0
    for _ in range(40):
        q = rng.sample(top, 4) + [rng.choice(mid)]; C = Bn[q] @ Bn[q].T; h += int((C.sum(1) - 1).argmin()) == 4
    return h / 40, [T[i] for i in top]
if __name__ == "__main__":
    print("words", len(T)); out = {}
    for k, s in S.items():
        rng = random.Random(1); r = [(d, sg, *score(sg * s[:, d], rng)) for d in range(640) for sg in (1, -1)]; out[k] = r
        best = {}
        for d, sg, p, w in r: best[d] = max(best.get(d, 0), p)
        b = torch.tensor(list(best.values())); a = torch.tensor([x[2] for x in r]); print(k, "mean", round(float(a.mean()), 3), "better end >=.8:", int((b >= .8).sum()), ">=.9:", int((b >= .9).sum()), "/640", flush=True)
    json.dump(out, open(os.path.join(M.H, "intrude.json"), "w"))
