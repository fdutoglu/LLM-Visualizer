"""Axis record (pure functions).
axis_record(d, stab, lab, ends): lab = a result.json row {sgn,lab,auc,p,base,ok}; ends = {+1:(p,[word]), -1:(p,[word])} (raw direction).
 -> {id, flip, stab, ends:[A,B]} ; A = the end that passed the test (otherwise the one with the higher intrusion score), flip = A's raw sign.
 End: {ok, name, label, auc, prec, base, intr, words}. ok = stab>.9 AND (intrusion>=.9 OR a label passed at this end).
 Label fields are filled only at the end where the label passed. name = the label if there is one, otherwise the first 3 words.
top_ends(s, k): s [n] -> (k largest indices, k smallest indices; from the end inwards).
score(v, m, P): unit-variance direction scores of one vector."""
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
