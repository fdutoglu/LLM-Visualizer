"""Model dosyalarını hazırlar: eksikse Unsloth'un açık Hugging Face kopyasından, sabit bir sürümden, anahtarsız indirir.

Eksen verisi (axes.json, axes.pt) bu sürümün ağırlıklarından üretildi; sürüm değişirse onlar da yeniden üretilmelidir."""
import hashlib, os

REPO, REVISION = "unsloth/gemma-3-270m-it", "23cf460f6bb16954176b3ddcc8d4f250501458a9"
FILES = {  # ad: (bayt, sha256)
    "added_tokens.json": (35, "50b2f405ba56a26d4913fd772089992252d7f942123cc0a034d96424221ba946"),
    "chat_template.jinja": (1654, "af95fbef33b76a50e5f463ff9766f85ce84f5849d915c4bd6c1619d852ac3231"),
    "config.json": (1374, "2706d3533059c6e1086badab27cc234e8ca2228975c3f73eeaef7f57cb5ec1db"),
    "generation_config.json": (233, "be9e552870ff18a6c6beb0f6811030509c040d641e6972ce53c2fb540bbb4ba0"),
    "model.safetensors": (536223056, "700b710a9a99c295ed546647aa81cacf9f81f4c573ea2be613a0e2517a44afab"),
    "special_tokens_map.json": (670, "45a857d8a2495d0be30a5d2d6de03278195eb028b6e0b8efc248bfa697d65f05"),
    "tokenizer.json": (33384568, "4667f2089529e8e7657cfb6d1c19910ae71ff5f28aa7ab2ff2763330affad795"),
    "tokenizer.model": (4689074, "1299c11d7cf632ef3b4e11937501358ada021bbdf7c47638d13c0ee982f2e79c"),
    "tokenizer_config.json": (1157090, "be2182df1ad0ea735d336418896eb06e5cc2f59136e7aaeac5de2ec2197742ac"),
}

class ModelError(Exception):
    """Kullanıcıya gösterilecek, düz metin hata."""

def missing(d, files=FILES):
    """d klasöründe bulunmayan ya da boyutu tutmayan dosyaların adları (FILES sırasıyla). Ağ kullanmaz."""
    def ok(n):
        p = os.path.join(d, n)
        return os.path.isfile(p) and os.path.getsize(p) == files[n][0]
    return [n for n in files if not ok(n)]

def sha256(path):
    with open(path, "rb") as f: return hashlib.file_digest(f, "sha256").hexdigest()

def hub_fetch(d, names):
    """names dosyalarını sabit sürümden d'ye indirir. Anahtar göndermez."""
    from huggingface_hub import snapshot_download
    snapshot_download(REPO, revision=REVISION, local_dir=d, allow_patterns=names, token=False)

def ensure(d, fetch=hub_fetch, files=FILES, say=print):
    """d içinde model tam ise hiçbir şey yapmaz (ağa çıkmaz). Değilse eksikleri fetch(d, adlar) ile indirir,
    boyut ve sha256 denetler. İndirilen dosya adlarını döndürür. Olmazsa ModelError.
    Özeti tutmayan, yeni indirilmiş dosya silinir ki sonraki açılış yeniden indirsin."""
    need = missing(d, files)
    if not need: return []
    say("Model indiriliyor: %s (%d dosya, %.0f MB). Yalnızca ilk açılışta." % (REPO, len(need), sum(files[n][0] for n in need) / 1e6), flush=True)
    try:
        os.makedirs(d, exist_ok=True)
        fetch(d, need)
    except Exception as e:
        raise ModelError("Model indirilemedi (%s: %s). İnternet bağlantısını ve boş diski denetleyip yeniden başlatın; eksik dosyalar yeniden istenir." % (type(e).__name__, e)) from e
    left = missing(d, files)
    if left: raise ModelError("İndirme eksik kaldı: " + ", ".join(left) + ". Bu dosyaları " + os.path.abspath(d) + " içinden silip yeniden başlatın.")
    bad = [n for n in need if sha256(os.path.join(d, n)) != files[n][1]]
    for n in bad: os.remove(os.path.join(d, n))
    if bad: raise ModelError("İndirilen dosyanın özeti tutmadı: " + ", ".join(bad) + ". Yeniden başlatınca tekrar indirilecek.")
    say("Model hazır.", flush=True)
    return need
