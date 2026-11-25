import json, sys
from safetensors import safe_open
d = sys.argv[1] if len(sys.argv) > 1 else "model"
cfg = json.load(open(f"{d}/config.json"))
print({k: cfg[k] for k in ("hidden_size","num_hidden_layers","num_attention_heads","num_key_value_heads","head_dim","intermediate_size","vocab_size","sliding_window","max_position_embeddings") if k in cfg})
total = 0
with safe_open(f"{d}/model.safetensors", "pt") as f:
    for k in f.keys():
        s = f.get_slice(k); sh = s.get_shape(); n = 1
        for x in sh: n *= x
        total += n
        if ".layers." not in k or ".layers.0." in k:
            print(f"{k:70s} {str(sh):18s} {s.get_dtype()}")
print("toplam parametre:", total, f"({total/1e6:.1f}M)")
