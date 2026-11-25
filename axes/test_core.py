import sys, os, unittest, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core as c
class T(unittest.TestCase):
    def test_ica_known_sources(self):
        g = torch.Generator().manual_seed(1); n = 20000
        S = torch.stack([torch.rand(n, generator=g) - .5, torch.randn(n, generator=g)**3, torch.sign(torch.randn(n, generator=g))*-torch.rand(n, generator=g).log()], 1).double()
        X = S @ torch.randn(3, 3, generator=g, dtype=torch.double)
        m, U, w = c.whiten(X); Z = (X - m) @ U / w.sqrt(); W, it, lim = c.fastica(Z, 0)
        R = torch.corrcoef(torch.cat([(Z @ W.T).T, S.T]))[:3, 3:].abs()
        self.assertTrue((R.max(1).values > .98).all(), R); self.assertEqual(len(set(R.argmax(1).tolist())), 3)
        self.assertTrue(torch.allclose(W @ W.T, torch.eye(3, dtype=torch.double), atol=1e-8))
    def test_whiten(self):
        X = torch.randn(5000, 4, dtype=torch.double) @ torch.randn(4, 4, dtype=torch.double); m, U, w = c.whiten(X)
        self.assertTrue(torch.allclose(torch.cov(((X - m) @ U / w.sqrt()).T), torch.eye(4, dtype=torch.double), atol=1e-8)); self.assertTrue((w[:-1] >= w[1:]).all())
    def test_auc(self):
        S = torch.tensor([[1., 3], [2, 2], [3, 1], [4, 0]]); Y = torch.tensor([[0], [0], [1], [1]]).bool()
        self.assertEqual(c.auc_matrix(S, Y).tolist(), [[1.], [0.]])
        self.assertEqual(c.auc_matrix(torch.ones(4, 1), Y).item(), .5)
    def test_auc_brute_force(self):
        S = torch.randint(0, 5, (40, 2)).float(); Y = torch.rand(40, 3) > .6; A = c.auc_matrix(S, Y)
        for d in range(2):
            for l in range(3):
                p, n = S[Y[:, l], d], S[~Y[:, l], d]; D = p[:, None] - n[None]
                self.assertAlmostEqual(A[d, l].item(), ((D > 0).double() + .5 * (D == 0).double()).mean().item(), 9)
    def test_prec(self):
        S = torch.tensor([[4.], [3], [2], [1]]); Y = torch.tensor([[1, 0], [0, 1], [1, 1], [0, 0]]).bool()
        self.assertEqual(c.prec_at(S, Y, [1, 2]).tolist(), [[1., .5]])
    def test_split(self):
        k = ["a", "b", "a"] + [str(i) for i in range(2000)]; s = c.split_groups(k); self.assertEqual(s[0], s[2]); self.assertTrue(.45 < s.float().mean() < .55)
if __name__ == "__main__": unittest.main()
