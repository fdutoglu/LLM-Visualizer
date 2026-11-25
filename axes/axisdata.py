"""Eksen kaydı (saf fonksiyonlar).
axis_record(d, stab, lab, ends): lab = result.json satırı {sgn,lab,auc,p,base,ok}; ends = {+1:(p,[kelime]), -1:(p,[kelime])} (ham yön).
 -> {id, flip, stab, ends:[A,B]} ; A = sınavı geçen (yoksa sızdırma puanı yüksek) uç, flip = A'nın ham işareti.
 Uç: {ok, name, label, auc, prec, base, intr, words}. ok = stab>.9 VE (sızdırma>=.9 VEYA bu uçta etiket geçti).
 Etiket alanları yalnız etiketin geçtiği uçta doludur. name = etiket varsa etiket, yoksa ilk 3 kelime.
top_ends(s, k): s [n] -> (en büyük k indeks, en küçük k indeks; uçtan içe).
score(v, m, P): tek vektörün birim varyanslı yön puanları."""
import torch
STAB, INTR = .9, .9
def end(stab, lab, sg, intr):
    p, w = intr; L = lab["ok"] and lab["sgn"] == sg
    return dict(ok=stab > STAB and (p >= INTR or L), name=lab["lab"] if L else ", ".join(w[:3]), label=lab["lab"] if L else None,
                auc=lab["auc"] if L else None, prec=lab["p"] if L else None, base=lab["base"] if L else None, intr=p, words=w)
def axis_record(d, stab, lab, ends):
    e = {s: end(stab, lab, s, ends[s]) for s in (1, -1)}
    f = max((1, -1), key=lambda s: (e[s]["ok"], e[s]["label"] is not None, e[s]["intr"], s))
    return dict(id=d, flip=f, stab=stab, ends=[e[f], e[-f]])
def top_ends(s, k):
    return s.topk(k).indices.tolist(), (-s).topk(k).indices.tolist()
def score(v, m, P):
    return (v.float() - m) @ P
