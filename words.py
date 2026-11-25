import sys, torch
from safetensors import safe_open
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("model")
with safe_open("model/model.safetensors","pt") as f: E = f.get_tensor("model.embed_tokens.weight").float()
for w in ["king","queen","▁king","▁queen","King","Queen","▁King","▁Queen"]:
    i = tok.convert_tokens_to_ids(w)
    print(f"{w!r:10} id={i} unk={i==tok.unk_token_id}" + (f" norm={E[i].norm():.3f} ilk5={[round(x,4) for x in E[i][:5].tolist()]}" if i!=tok.unk_token_id else ""))
a,b = tok.convert_tokens_to_ids("▁king"), tok.convert_tokens_to_ids("▁queen")
print("cos(king,queen) =", torch.cosine_similarity(E[a],E[b],dim=0).item())
En = torch.nn.functional.normalize(E,dim=1)
for w,i in (("king",a),("queen",b)):
    s = En@En[i]; t = s.topk(8).indices.tolist()
    print(w,"en yakin:",[(tok.convert_ids_to_tokens(j),round(s[j].item(),3)) for j in t[1:]])
