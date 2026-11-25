"""Prepares the model files: if missing, downloads them from Unsloth's public Hugging Face copy, at a fixed revision, without a key.

The axis data (axes.json, axes.pt) was produced from this revision's weights; if the revision changes, it must be produced again."""
import hashlib, os

REPO, REVISION = "unsloth/gemma-3-270m-it", "23cf460f6bb16954176b3ddcc8d4f250501458a9"
FILES = {  # name: (bytes, sha256)
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
    """Plain-text error to be shown to the user."""

def missing(d, files=FILES):
    """Names of the files that are not in folder d or have the wrong size (in FILES order). Does not use the network."""
    def ok(n):
        p = os.path.join(d, n)
        return os.path.isfile(p) and os.path.getsize(p) == files[n][0]
    return [n for n in files if not ok(n)]

def sha256(path):
    with open(path, "rb") as f: return hashlib.file_digest(f, "sha256").hexdigest()

def hub_fetch(d, names):
    """Downloads the files in names from the fixed revision into d. Sends no key."""
    from huggingface_hub import snapshot_download
    snapshot_download(REPO, revision=REVISION, local_dir=d, allow_patterns=names, token=False)

def ensure(d, fetch=hub_fetch, files=FILES, say=print):
    """Does nothing (no network) if the model in d is complete. Otherwise downloads what is missing with fetch(d, names)
    and checks size and sha256. Returns the names of the downloaded files. Raises ModelError on failure.
    A newly downloaded file with the wrong hash is deleted so that the next start downloads it again."""
    need = missing(d, files)
    if not need: return []
    say("Downloading the model: %s (%d files, %.0f MB). First start only." % (REPO, len(need), sum(files[n][0] for n in need) / 1e6), flush=True)
    try:
        os.makedirs(d, exist_ok=True)
        fetch(d, need)
    except Exception as e:
        raise ModelError("Could not download the model (%s: %s). Check the internet connection and free disk space, then start again; missing files will be requested again." % (type(e).__name__, e)) from e
    left = missing(d, files)
    if left: raise ModelError("The download is incomplete: " + ", ".join(left) + ". Delete these files from " + os.path.abspath(d) + " and start again.")
    bad = [n for n in need if sha256(os.path.join(d, n)) != files[n][1]]
    for n in bad: os.remove(os.path.join(d, n))
    if bad: raise ModelError("Wrong hash for the downloaded file: " + ", ".join(bad) + ". It will be downloaded again on the next start.")
    say("Model ready.", flush=True)
    return need
