import hashlib, os, tempfile, unittest
import modelfiles as m

A, B = b"aaaa", b"bbbbbb"
FILES = {n: (len(x), hashlib.sha256(x).hexdigest()) for n, x in (("a.json", A), ("b.bin", B))}
DATA = {"a.json": A, "b.bin": B}

class T(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = os.path.join(self.t.name, "model"); self.calls = []
    def tearDown(self): self.t.cleanup()
    def put(self, n, x):
        os.makedirs(self.d, exist_ok=True)
        with open(os.path.join(self.d, n), "wb") as f: f.write(x)
    def fetch(self, data):
        def go(d, names):
            self.calls.append(list(names))
            for n in names:
                if n in data: self.put(n, data[n])
        return go
    def run_(self, fetch): return m.ensure(self.d, fetch, FILES, say=lambda *a, **k: None)

    def test_tam_ise_ag_yok(self):
        for n, x in DATA.items(): self.put(n, x)
        self.assertEqual(self.run_(self.fetch({})), []); self.assertEqual(self.calls, [])
    def test_klasor_yoksa_hepsi(self):
        self.assertEqual(self.run_(self.fetch(DATA)), ["a.json", "b.bin"]); self.assertEqual(m.missing(self.d, FILES), [])
    def test_yalniz_eksik(self):
        self.put("a.json", A); self.run_(self.fetch(DATA)); self.assertEqual(self.calls, [["b.bin"]])
    def test_yarim_dosya_eksik_sayilir(self):
        self.put("a.json", A); self.put("b.bin", B[:2]); self.assertEqual(m.missing(self.d, FILES), ["b.bin"])
    def test_ag_hatasi(self):
        def boom(d, n): raise OSError("baglanti yok")
        with self.assertRaisesRegex(m.ModelError, "baglanti yok"): self.run_(boom)
    def test_eksik_kalirsa(self):
        with self.assertRaisesRegex(m.ModelError, "b.bin"): self.run_(self.fetch({"a.json": A}))
    def test_ozet_tutmazsa_silinir(self):
        with self.assertRaisesRegex(m.ModelError, "b.bin"): self.run_(self.fetch({"a.json": A, "b.bin": b"xxxxxx"}))
        self.assertEqual(m.missing(self.d, FILES), ["b.bin"])
    def test_surum_sabit(self):
        self.assertRegex(m.REVISION, "^[0-9a-f]{40}$"); self.assertEqual(len(m.FILES), 9)

if __name__ == "__main__": unittest.main()
