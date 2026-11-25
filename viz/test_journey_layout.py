import sys, os, unittest, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import journey_layout as jl

def scene(L=4, k=5, shared=2, gap=0.0):
    """A known scene in the plane: stops side by side, consecutive frames share tokens; gap = common out-of-plane part."""
    g = torch.Generator().manual_seed(1)
    S = torch.stack([torch.arange(L) * 0.5, torch.zeros(L)], 1).float()
    X = torch.cat([S[l] + 0.28 * torch.randn(k, 2, generator=g).clamp(-1, 1) for l in range(L)])
    R = torch.cdist(S, X) + gap; M = torch.zeros_like(R, dtype=torch.bool)
    for l in range(L): M[l, R[l].topk(k, largest=False).indices] = True
    return R, torch.cdist(X, X), torch.cdist(S, S), M

class T(unittest.TestCase):
    def test_planar_scene_recovered(self):
        o = jl.layout(*scene()); self.assertGreaterEqual(sum(o["prec"]) / 4, 0.95)
    def test_offset_removed_one_number_per_layer(self):
        R, DT, DS, M = scene(gap=0.7); o = jl.layout(R, DT, DS, M)
        torch.testing.assert_close(o["rho"], R - o["h"][:, None]); self.assertTrue((o["h"] > 0.4).all())
        self.assertGreaterEqual(sum(o["prec"]) / 4, 0.9)
    def test_no_offset_when_close_neighbor(self):
        R, DT, DS, M = scene(); R[0, 0] = 0.0; self.assertEqual(float(jl.layout(R, DT, DS, M, steps=5)["h"][0]), 0.0)
    def test_disjoint_frames_finite(self):
        R = torch.full((2, 6), 1.0); M = torch.zeros(2, 6, dtype=torch.bool); M[0, :3] = True; M[1, 3:] = True; R[M] = 0.8
        o = jl.layout(R, 1 - torch.eye(6), 1 - torch.eye(2), M)
        self.assertTrue(torch.isfinite(o["X"]).all() and torch.isfinite(o["S"]).all()); self.assertEqual(o["prec"], [1.0, 1.0])
    def test_deterministic(self):
        a, b = jl.best(*scene()), jl.best(*scene()); torch.testing.assert_close(a["X"], b["X"])
class P(unittest.TestCase):
    def test_slerp_unit_equal_angle_and_contains_layers(self):
        V = torch.randn(4, 20, generator=torch.Generator().manual_seed(0)); V = V / V.norm(dim=1, keepdim=True)
        P, ts, A = jl.slerp_stops(V, 0.15)
        torch.testing.assert_close(P.norm(dim=1), torch.ones(len(P)))
        torch.testing.assert_close(torch.acos((P[1:] * P[:-1]).sum(1).clamp(-1, 1)), A, atol=2e-3, rtol=0)
        for l in range(4): torch.testing.assert_close(P[ts.index(float(l))], V[l], atol=1e-5, rtol=0)
        self.assertEqual(ts, sorted(ts))
    def test_slerp_same_vectors_finite(self):
        V = torch.ones(2, 4) / 2; P, ts, A = jl.slerp_stops(V, 0.15)
        self.assertTrue(torch.isfinite(P).all()); self.assertEqual(ts, [0.0, 0.5, 1.0])
    def test_small_raw_distance_wins_conflict(self):
        # the same token is at raw 0 from stop 0 and raw 0.75 from stop 1 (0.02 after the common part); the stops must be apart -> the token stays at stop 0
        R = torch.tensor([[0.0, 0.4, 0.4, 0.4, 1.0, 1.0], [0.75, 1.0, 1.0, 1.0, 0.78, 0.78]])
        M = torch.tensor([[1, 1, 1, 1, 0, 0], [1, 0, 0, 0, 1, 1]]).bool()
        o = jl.layout(R, 1 - torch.eye(6), 1 - torch.eye(2), M, A=torch.tensor([2.0]), ws=10.0)
        d = torch.cdist(o["S"], o["X"]); self.assertLess(float(d[0, 0]), 0.1); self.assertLess(float(d[0, 0]), float(d[1, 0]))
    def test_order_acc_counts(self):
        S = torch.zeros(1, 2); X = torch.tensor([[1., 0], [2, 0], [3, 0], [4, 0]])
        self.assertEqual(jl.order_acc(S, X, torch.tensor([[.1, .2, .3, .4]])), [(True, 1.0)])
        self.assertEqual(jl.order_acc(S, X, torch.tensor([[.4, .1, .2, .3]])), [(False, 2 / 3)])
    def test_rank_term_orders_close_neighbors(self):
        # 8 neighbours at almost equal distances, all far from each other: in 2D only the term keeps their order
        n = 8; R = (0.9 + 0.005 * torch.arange(n))[None]; DT = 0.8 * (1 - torch.eye(n)); DS = torch.zeros(1, 1); M = torch.ones(1, n, dtype=torch.bool)
        o = jl.layout(R, DT, DS, M, K=torch.tensor([True]), wr=1.0)
        d = torch.cdist(o["S"], o["X"])[0]; self.assertEqual(d.topk(5, largest=False).indices.tolist(), [0, 1, 2, 3, 4])
    def test_rank_term_ties_do_not_push(self):
        R = torch.tensor([[.5, .5, .5]]); DT = 0.3 * (1 - torch.eye(3)); M = torch.ones(1, 3, dtype=torch.bool); K = torch.tensor([True])
        a = jl.layout(R, DT, torch.zeros(1, 1), M, steps=100); b = jl.layout(R, DT, torch.zeros(1, 1), M, steps=100, K=K, wr=1.0)
        self.assertTrue(torch.allclose(a["X"], b["X"], atol=1e-4))
    def test_bend_penalty_straightens(self):
        R, DT, DS, M = scene(L=5); A = torch.full((4,), 1.0)
        def turn(wb):
            S = jl.layout(R, DT, DS, M, A=A, ws=10.0, wb=wb)["S"]; d = S[1:] - S[:-1]; d = d / d.norm(dim=1, keepdim=True); return float((d[1:] - d[:-1]).norm())
        self.assertLessEqual(turn(1.0), turn(0.0) + 1e-3)
    def test_map_steps_follow_angles(self):
        R, DT, DS, M = scene(L=4); A = torch.tensor([0.5, 2.0, 0.5])
        d = (lambda S: (S[1:] - S[:-1]).norm(dim=1))(jl.layout(R, DT, DS, M, A=A, ws=1000.0)["S"])
        torch.testing.assert_close(d, 0.2 * A, atol=0.03, rtol=0)
unittest.main()
