"""Embedding görselleştirici sunucusu.  server.py [port] [--host ADRES]
Varsayılan yalnızca bu bilgisayar (127.0.0.1); ağdaki cihazlar için --host 0.0.0.0. İnternete açmak için tasarlanmadı."""
import argparse, math, json, sys, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import journey_layout, modelfiles
MODEL = os.path.join(HERE, "..", "model")
ARGS = None
if __name__ == "__main__":  # model indirmeden önce: hatalı bayrak ya da --help hemen yanıtlanır
    ap = argparse.ArgumentParser(description="Gemma 3 embedding görselleştirici")
    ap.add_argument("port", nargs="?", type=int, default=8791)
    ap.add_argument("--host", default="127.0.0.1", help="ağa açmak için 0.0.0.0")
    ARGS = ap.parse_args()
try: modelfiles.ensure(MODEL)
except modelfiles.ModelError as e: sys.exit(str(e))
from safetensors import safe_open
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained(MODEL)
with safe_open(os.path.join(MODEL, "model.safetensors"), "pt") as f:
    E = f.get_tensor("model.embed_tokens.weight")  # bf16 [262144, 640]
V = E.shape[0]

import re, torch
CH = 32768
NORMS = torch.cat([E[s:s + CH].float().norm(dim=1) for s in range(0, V, CH)]).clamp_min(1e-9)
IDS = tok.convert_ids_to_tokens(list(range(V)))
LETTER = torch.tensor([bool(re.fullmatch("▁?[A-Za-z]+", t or "")) for t in IDS])

def ref_of(t):
    return "_" + t[1:] if t.startswith("▁") else "=" + t

def base(t): return t.lstrip("▁").lower()

def between(ids, k, letters_only, hide_variants):
    """Capalarin (ids) 'arasinda' kalan tokenlar: her capaya birden yakin olanlar.
    Skor = capalara kosinuslarin en kucugu (maximin), yani hepsine birden yakinlik."""
    A = E[ids].float(); A = A / A.norm(dim=1, keepdim=True)
    S = torch.cat([(E[s:s + CH].float() @ A.T) / NORMS[s:s + CH, None] for s in range(0, V, CH)])  # [V, n]
    score = S.min(dim=1).values
    score[ids] = -2.0
    if letters_only: score = torch.where(LETTER, score, torch.full_like(score, -2.0))
    bases = {base(IDS[i]) for i in ids}
    out = []
    for j in score.topk(600).indices.tolist():
        b = base(IDS[j])
        if hide_variants and (b in bases or (b.endswith("s") and b[:-1] in bases)): continue
        out.append({"token": IDS[j], "id": j, "ref": ref_of(IDS[j]), "cos": [round(x, 4) for x in S[j].tolist()]})
        if len(out) == k: break
    return {"anchors": [{"token": IDS[i], "id": i, "ref": ref_of(IDS[i])} for i in ids], "pts": out}

def neighbors(i, k, letters_only):
    """i'nin kosinus olarak en yakin k tokeni + 2B yerlesim.
    Merkeze (i) uzaklik = 1 - kosinus (tam); aci = klasik MDS'in (tum ikili 1-kosinus uzakliklarindan) verdigi yon."""
    v = E[i].float()
    sims = torch.cat([E[s:s + CH].float() @ v for s in range(0, V, CH)]) / NORMS / NORMS[i]
    if letters_only: sims = torch.where(LETTER, sims, torch.full_like(sims, -2.0))
    sims[i] = -2.0
    ids = [i] + sims.topk(k).indices.tolist()
    X = E[ids].float(); X = X / X.norm(dim=1, keepdim=True)
    D = (1 - X @ X.T).clamp_min(0)
    n = len(ids); J = torch.eye(n) - 1.0 / n
    w, U = torch.linalg.eigh(-0.5 * J @ (D ** 2) @ J)
    P = U[:, -2:] * w[-2:].clamp_min(0).sqrt()
    d = P[1:] - P[0]; ang = torch.atan2(d[:, 1], d[:, 0])
    pts = [{"token": IDS[j], "id": j, "ref": ref_of(IDS[j]), "cos": round(1 - D[0, a + 1].item(), 4),
            "r": round(D[0, a + 1].item(), 4), "ang": round(ang[a].item(), 4)} for a, j in enumerate(ids[1:])]
    return {"query": {"token": IDS[i], "id": i, "ref": ref_of(IDS[i])}, "pts": pts}


import threading
_LM = None; _LMLOCK = threading.Lock()
def lm():
    global _LM
    with _LMLOCK:
        if _LM is None:
            from transformers import AutoModelForCausalLM
            try: m = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32)
            except TypeError: m = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32)
            _LM = m.eval()
    return _LM

def ctx(text, layer, k, letters_only):
    """Cumle icin her onek konumunda gizli durumun (odak) en yakin tokenlari + ortak 2B yerlesim."""
    m = lm()
    enc = tok(text, return_tensors="pt", truncation=True, max_length=48)
    with torch.no_grad():
        out = m(**enc, output_hidden_states=True)
        hs = out.hidden_states; nl = len(hs) - 1
        layer = max(0, min(nl, layer))
        H = hs[layer][0]
        if layer < nl: H = m.model.norm(H)
    ids = enc["input_ids"][0].tolist()
    toks = tok.convert_ids_to_tokens(ids)
    start = 1 if toks and toks[0] == tok.bos_token else 0
    H = H[start:].float(); ids = ids[start:]; toks = toks[start:]
    Hn = H / H.norm(dim=1, keepdim=True).clamp_min(1e-9)
    n = len(ids); steps = []; nnset = []
    for t in range(n):
        h = H[t]
        logits = torch.cat([E[s:s + CH].float() @ h for s in range(0, V, CH)])
        p = torch.softmax(logits, 0)
        cos = logits / h.norm().clamp_min(1e-9) / NORMS
        sc = torch.where(LETTER, cos, torch.full_like(cos, -2.0)) if letters_only else cos
        top = sc.topk(k).indices.tolist()
        steps.append({"tok": toks[t], "id": ids[t], "nn": [{"i": j, "cos": round(cos[j].item(), 4), "p": round(p[j].item(), 5)} for j in top]})
        nnset += top
    nn_ids = list(dict.fromkeys(nnset))
    return {"tokens": toks, "steps": steps, "layer": layer, "nlayers": nl}   # eski gorunum: harita yok (istemci artik /api/ctx3 kullanir)

_RUN = threading.Lock()
def ctx3(text, layer=None, k=8):
    """Her token icin 2 nokta: gomme (giris) ve son katman cikisi (son norm sonrasi, tahmini belirleyen vektor).
    Her noktanin yerel uzayi: en yakin k token, merkeze uzaklik r = 1 - kosinus (tam), aci = yerel klasik MDS.
    Noktalarin kendi aralarindaki global 2B yerlesimi de doner."""
    m = lm(); k = max(1, min(30, k))
    enc = tok(text, return_tensors="pt", truncation=True, max_length=48)
    nl = len(m.model.layers)
    with _RUN, torch.no_grad(): out = m(**enc, output_hidden_states=True)
    ids = enc["input_ids"][0].tolist(); toks = tok.convert_ids_to_tokens(ids)
    st = 1 if toks and toks[0] == tok.bos_token else 0
    emb = out.hidden_states[0][0].float()[st:]
    fin = out.hidden_states[-1][0].float()[st:]          # HF: son eleman zaten son normdan gecmis
    toks = toks[st:]; n = len(toks)
    V2 = torch.cat([emb, fin]); X = V2 / V2.norm(dim=1, keepdim=True).clamp_min(1e-9)
    N = 2 * n; D = (1 - X @ X.T).clamp_min(0); D.fill_diagonal_(0)
    J = torch.eye(N) - 1.0 / N
    w, U = torch.linalg.eigh(-0.5 * J @ (D ** 2) @ J)
    P = U[:, -2:] * w[-2:].clamp_min(0).sqrt()
    for _ in range(300):                                        # SMACOF
        d = torch.cdist(P, P).clamp_min(1e-9)
        B = -D / d; B.fill_diagonal_(0); B = B - torch.diag(B.sum(1))
        P = B @ P / N
    d = torch.cdist(P, P); stress = (((D - d) ** 2).sum() / (D ** 2).sum().clamp_min(1e-12)).sqrt().item()
    P = P - P.mean(0)
    def local(vec, self_id=None):
        h = vec.float(); c = torch.cat([E[a:a + CH].float() @ h for a in range(0, V, CH)]) / h.norm().clamp_min(1e-9) / NORMS
        top = c.topk(k).indices.tolist()
        Y = torch.cat([h[None], E[top].float()]); Y = Y / Y.norm(dim=1, keepdim=True).clamp_min(1e-9)
        Dl = (1 - Y @ Y.T).clamp_min(0); nn_ = len(top) + 1; Jl = torch.eye(nn_) - 1.0 / nn_
        wl, Ul = torch.linalg.eigh(-0.5 * Jl @ (Dl ** 2) @ Jl)
        Q = Ul[:, -2:] * wl[-2:].clamp_min(0).sqrt(); dq = Q[1:] - Q[0]; ang = torch.atan2(dq[:, 1], dq[:, 0])
        return [[tok.convert_ids_to_tokens(j), round(c[j].item(), 3), round(Dl[0, a + 1].item(), 4), round(ang[a].item(), 4)] for a, j in enumerate(top)]
    cs = lambda a, b: round(torch.nn.functional.cosine_similarity(a, b, dim=0).item(), 4)
    steps = []
    for t in range(n):
        pt = lambda o: [round(P[o * n + t, c].item(), 4) for c in range(2)]
        steps.append({"tok": toks[t], "e": pt(0), "f": pt(1),
                      "nne": local(emb[t]), "nnf": local(fin[t]),
                      "def": round(D[t, n + t].item(), 3), "cef": cs(emb[t], fin[t]),
                      "ne": round(emb[t].norm().item(), 1), "nf": round(fin[t].norm().item(), 1)})
    return {"tokens": toks, "steps": steps, "layer": nl, "nlayers": nl, "stress": round(stress, 4)}

def traj(text, t, k=12):
    """Bir tokenin gomme noktasindan son katman cikisina katman katman yolu (logit lens: son normdan gecmis hali).
    Sabit bir cerceve: son cikisa en yakin k token + tokenin kendisi; cerceve klasik MDS ile 2B, her katmandaki nokta
    cerceveye Gower dis-ornek izdusumuyle yerlestirilir (kosinus uzakliklari)."""
    m = lm(); k = max(3, min(30, k))
    enc = tok(text, return_tensors="pt", truncation=True, max_length=48)
    with _RUN, torch.no_grad(): out = m(**enc, output_hidden_states=True)
    ids = enc["input_ids"][0].tolist(); toks = tok.convert_ids_to_tokens(ids)
    st = 1 if toks and toks[0] == tok.bos_token else 0
    n = len(ids) - st
    if not 0 <= t < n: return {"error": "token yok"}
    hs = out.hidden_states; nl = len(hs) - 1
    with torch.no_grad():
        vecs = [hs[0][0, st + t].float()] + [m.model.norm(hs[l][0, st + t]).float() for l in range(1, nl)] + [hs[nl][0, st + t].float()]
    def cosall(h): return torch.cat([E[a:a + CH].float() @ h for a in range(0, V, CH)]) / h.norm().clamp_min(1e-9) / NORMS
    cf = cosall(vecs[-1]); frame = cf.topk(k).indices.tolist(); own = ids[st + t]
    if own not in frame: frame.append(own)
    F = E[frame].float(); F = F / F.norm(dim=1, keepdim=True).clamp_min(1e-9)
    D = (1 - F @ F.T).clamp_min(0); D.fill_diagonal_(0); nn_ = len(frame); J = torch.eye(nn_) - 1.0 / nn_
    Bm = -0.5 * J @ (D ** 2) @ J; w, U = torch.linalg.eigh(Bm); w2 = w[-2:].clamp_min(1e-9); U2 = U[:, -2:]
    X = U2 * w2.sqrt(); b = torch.diag(Bm)
    layers = []
    for l, v in enumerate(vecs):
        vn = v / v.norm().clamp_min(1e-9); d2 = (1 - F @ vn).clamp_min(0) ** 2
        y = 0.5 * (U2.T @ (b - d2)) / w2.sqrt()
        c = cosall(v); tp = c.topk(3).indices.tolist()
        layers.append({"p": [round(y[0].item(), 4), round(y[1].item(), 4)], "cos": round(c[own].item(), 3),
                       "top": [[tok.convert_ids_to_tokens(j), round(c[j].item(), 3)] for j in tp]})
    return {"tok": toks[st + t], "frame": tok.convert_ids_to_tokens(frame), "fx": [[round(X[i, 0].item(), 4), round(X[i, 1].item(), 4)] for i in range(nn_)],
            "own": frame.index(own), "layers": layers}

def journey(text, k=20, letters_only=True, by="layer"):
    """Duraklarin ve ara noktalarin en yakin k tokeni, tek sabit 2B haritada (journey_layout).
    by="layer": durak = son tokenin her katmandaki vektoru (logit lens). by="token": durak = her girdi tokeninin
    son katman ciktisi (<bos> haric); nedensel maske sayesinde tek calistirma her onekin sonucunu verir."""
    m = lm(); k = max(3, min(24, k))
    enc = tok(text, return_tensors="pt", truncation=True, max_length=48)
    with _RUN, torch.no_grad(): out = m(**enc, output_hidden_states=True)
    hs = out.hidden_states; nl = len(hs) - 1; ids = enc["input_ids"][0].tolist()
    if by == "token":
        own = ids[1:] if ids[0] == tok.bos_token_id else ids; VN = hs[nl][0, -len(own):].float()
        if not own: raise ValueError("metin bos")
    else:
        own = [ids[-1]] * (nl + 1)
        with torch.no_grad(): VN = torch.stack([hs[0][0, -1].float()] + [m.model.norm(hs[l][0, -1]).float() for l in range(1, nl)] + [hs[nl][0, -1].float()])
    VN, ts, A = journey_layout.slerp_stops(VN / VN.norm(dim=1, keepdim=True).clamp_min(1e-9), 0.157)  # ~9 derece
    tops, meta = [], []
    for a, v in enumerate(VN):
        tid = own[int(ts[a])]
        c = torch.cat([E[b:b + CH].float() @ v for b in range(0, len(E), CH)]) / NORMS
        cc = torch.where(LETTER, c, torch.full_like(c, -2.0)) if letters_only else c
        tp = cc.topk(k).indices.tolist(); tops.append(tp)
        meta.append({"top": [[IDS[x], round(c[x].item(), 3)] for x in tp[:3]], "own": round(c[tid].item(), 3)})
    U = list(dict.fromkeys(x for t in tops for x in t)); idx = {x: a for a, x in enumerate(U)}
    EU = E[U].float(); EU = EU / EU.norm(dim=1, keepdim=True).clamp_min(1e-9)
    DT = (1 - EU @ EU.T).clamp_min(0).fill_diagonal_(0); DS = (1 - VN @ VN.T).clamp_min(0).fill_diagonal_(0)
    Mb = torch.zeros(len(VN), len(U), dtype=torch.bool)
    for l, t in enumerate(tops): Mb[l, [idx[x] for x in t]] = True
    o = journey_layout.best((1 - VN @ EU.T).clamp_min(0), DT, DS, Mb, A, torch.tensor([t % 1 == 0 for t in ts]), 1.0)  # katman duraklarinda sira korunur
    layers = [{"t": round(ts[l], 4), "m": [int(x) for x in Mb[l].tolist()], **meta[l],
               "h": round(o["h"][l].item(), 3), "prec": round(o["prec"][l], 2)} for l in range(len(ts))]
    rd = lambda P: [[round(x, 4) for x in p] for p in P.tolist()]
    return {"by": by, "tok": IDS[own[-1]], "seg": [IDS[x] for x in own] if by == "token" else None, "tokens": [IDS[x] for x in U], "layers": layers, "nl": len(own) - 1, "k": k, "tx": rd(o["X"]), "path": rd(o["S"])}

def resolve(q):
    """'king' -> '▁king' (yoksa 'king'); '_king' -> '▁king' birebir; '#9615' -> id; 'king' disinda '=king' -> '▁'siz birebir."""
    q = q.strip()
    if q.startswith("#") and q[1:].isdigit():
        i = int(q[1:]); return i if i < V else None
    if q.startswith("="): cands = [q[1:]]
    elif q.startswith("_"): cands = ["▁" + q[1:]]
    else: cands = ["▁" + q, q]
    for c in cands:
        i = tok.convert_tokens_to_ids(c)
        if i is not None and i != tok.unk_token_id: return i
    return None

_AX = None
def axes_data():
    global _AX
    if _AX is None:
        st = torch.load(os.path.join(HERE, "axes.pt")); rec = json.load(open(os.path.join(HERE, "axes.json"), encoding="utf8"))
        brief = json.dumps([dict(id=r["id"], stab=r["stab"], ends=[dict(ok=e["ok"], name=e["name"], label=e["label"], words=e["words"][:3], intr=e["intr"]) for e in r["ends"]]) for r in rec])
        _AX = (st["m"], st["P"], set(st["keep"].tolist()), rec, brief)
    return _AX

UI = {"/ui/style.css": "text/css; charset=utf-8", "/ui/geo.js": "text/javascript; charset=utf-8", "/ui/app.js": "text/javascript; charset=utf-8"}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else body.encode()
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path); qs = parse_qs(u.query)
        if u.path == "/":
            return self.send(200, open(os.path.join(HERE, "index.html"), "rb").read(), "text/html; charset=utf-8")
        if u.path in UI:
            return self.send(200, open(os.path.join(HERE, u.path[1:]), "rb").read(), UI[u.path])
        if u.path == "/api/word":
            out = []
            for q in qs.get("q", [""])[0].split(","):
                if not q.strip(): continue
                i = resolve(q)
                if i is None: out.append({"query": q.strip(), "error": "sozlukte yok"}); continue
                out.append({"query": q.strip(), "id": i, "token": tok.convert_ids_to_tokens(i),
                            "vec": [round(x, 5) for x in E[i].float().tolist()]})
            return self.send(200, json.dumps(out))
        if u.path == "/api/between":
            names = [s for s in qs.get("q", [""])[0].split(",") if s.strip()]
            ids = [resolve(s) for s in names]
            bad = [n.strip() for n, i in zip(names, ids) if i is None]
            if bad: return self.send(200, json.dumps({"error": "sozlukte yok: " + ", ".join(bad)}))
            ids = list(dict.fromkeys(ids))
            if not 2 <= len(ids) <= 8: return self.send(200, json.dumps({"error": "2 ile 8 arasinda token gerekli"}))
            try: k = max(5, min(100, int(qs.get("k", ["30"])[0])))
            except ValueError: k = 30
            return self.send(200, json.dumps(between(ids, k, qs.get("letters", ["1"])[0] == "1", qs.get("hide", ["1"])[0] == "1")))
        if u.path == "/api/axes":  # q yoksa yon listesi; varsa kelimenin 640 yondeki puani
            m, P, keep, rec, brief = axes_data()
            if "q" not in qs: return self.send(200, brief)
            i = resolve(qs["q"][0])
            if i is None: return self.send(200, json.dumps({"error": "sozlukte yok"}))
            z = (E[i].float() - m) @ P
            return self.send(200, json.dumps({"id": i, "token": IDS[i], "ref": ref_of(IDS[i]), "in": i in keep, "z": [round(v, 3) for v in z.tolist()]}))
        if u.path == "/api/axis":
            try: d = int(qs.get("d", ["-1"])[0])
            except ValueError: d = -1
            rec = axes_data()[3]
            if not 0 <= d < len(rec): return self.send(200, json.dumps({"error": "yon numarasi 0-639 olmali"}))
            return self.send(200, json.dumps(dict(rec[d], ends=[dict(e, top=[[t, s, ref_of(t) if "," not in t and resolve(ref_of(t)) == r else "#%d" % r] for r, t, s in e["top"]]) for e in rec[d]["ends"]])))
        if u.path == "/api/neighbors":
            i = resolve(qs.get("q", [""])[0])
            if i is None: return self.send(200, json.dumps({"error": "sozlukte yok"}))
            try: k = max(5, min(100, int(qs.get("k", ["30"])[0])))
            except ValueError: k = 30
            return self.send(200, json.dumps(neighbors(i, k, qs.get("letters", ["1"])[0] == "1")))
        if u.path == "/api/ctx":
            text = qs.get("q", [""])[0].strip()
            if not text: return self.send(200, json.dumps({"error": "cumle bos"}))
            try: k = max(3, min(30, int(qs.get("k", ["10"])[0])))
            except ValueError: k = 10
            try: layer = int(qs.get("layer", ["99"])[0])
            except ValueError: layer = 99
            return self.send(200, json.dumps(ctx(text, layer, k, qs.get("letters", ["1"])[0] == "1")))
        if u.path == "/api/journey":
            text = qs.get("q", [""])[0].strip()
            if not text: return self.send(200, json.dumps({"error": "cumle bos"}))
            try: kk = int(qs.get("k", ["12"])[0])
            except ValueError: kk = 12
            return self.send(200, json.dumps(journey(text, kk, qs.get("letters", ["1"])[0] == "1", "token" if qs.get("by", [""])[0] == "token" else "layer")))
        if u.path == "/api/traj":
            text = qs.get("q", [""])[0].strip()
            try: tt = int(qs.get("t", ["0"])[0]); kk = int(qs.get("k", ["12"])[0])
            except ValueError: return self.send(200, json.dumps({"error": "t sayi olmali"}))
            return self.send(200, json.dumps(traj(text, tt, kk)))
        if u.path == "/api/ctx3":
            text = qs.get("q", [""])[0].strip()
            if not text: return self.send(200, json.dumps({"error": "cumle bos"}))
            try: layer = int(qs.get("layer", ["1"])[0])
            except ValueError: layer = 1
            return self.send(200, json.dumps(ctx3(text, layer, int(qs.get("k", ["8"])[0]))))
        if u.path == "/api/variants":  # bir kelimenin sozlukteki yazim varyantlari
            w = qs.get("q", [""])[0].strip().lstrip("_=#").lower()
            vs = []
            for c in {w, w.capitalize(), w.upper()}:
                for t in (c, "▁" + c):
                    i = tok.convert_tokens_to_ids(t)
                    if i is not None and i != tok.unk_token_id: vs.append(t.replace("▁", "_"))
            return self.send(200, json.dumps(sorted(vs)))
        self.send(404, "{}")

if __name__ == "__main__":
    srv = ThreadingHTTPServer((ARGS.host, ARGS.port), H)
    print(f"http://{'127.0.0.1' if ARGS.host == '0.0.0.0' else ARGS.host}:{ARGS.port}", flush=True)
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
