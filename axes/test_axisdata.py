import torch, axisdata as a
NO = dict(sgn=1, lab="renk", auc=.5, p=.1, base=.01, ok=False); OK = dict(NO, sgn=-1, auc=.95, p=.8, ok=True)
E = {1: (.3, list("abcd")), -1: (.95, list("wxyz"))}
def test_intrusion_end_first():
    r = a.axis_record(7, .95, NO, E); A, B = r["ends"]
    assert (r["id"], r["flip"], A["ok"], B["ok"], A["name"], A["label"]) == (7, -1, True, False, "w, x, y", None)
def test_unstable_never_ok():
    assert not any(e["ok"] for e in a.axis_record(0, .9, OK, E)["ends"])
def test_label_only_on_its_end():
    r = a.axis_record(0, .95, OK, {1: (.95, list("abc")), -1: (.2, list("xyz"))}); A, B = r["ends"]
    assert r["flip"] == -1 and A["label"] == "renk" and A["auc"] == .95 and B["label"] is None and B["auc"] is None and A["ok"] and B["ok"]
def test_tie_deterministic():
    assert a.axis_record(0, .1, NO, {1: (.2, ["a"]), -1: (.2, ["b"])})["flip"] == 1
def test_top_ends():
    assert a.top_ends(torch.tensor([3., -5, 9, 0]), 2) == ([2, 0], [1, 3])
def test_score():
    assert a.score(torch.tensor([2., 3]), torch.tensor([1., 1]), torch.tensor([[1., 0], [0, -2]])).tolist() == [1, -4]
if __name__ == "__main__":
    n = 0
    for k, f in list(globals().items()):
        if k.startswith("test_"): f(); n += 1
    print(n, "gecti")
