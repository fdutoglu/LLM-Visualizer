# LLM Visualizer

Shows Gemma 3 270M's word vectors and its hidden states inside a sentence, in the browser. The page runs on your own computer.

## Getting started

```bash
git clone https://github.com/fdutoglu/LLM-Visualizer.git
cd LLM-Visualizer
```

Python 3.12 or newer is required (tried with 3.14). Linux / macOS:

```bash
./run.sh
```

Windows (not tried):

```bat
py -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
venv\Scripts\python viz\server.py
```

Then open http://127.0.0.1:8791.

**On the first start** the model is downloaded from [unsloth/gemma-3-270m-it](https://huggingface.co/unsloth/gemma-3-270m-it) into the `model/` folder (about 575 MB). No account or key is needed. The revision is fixed and the SHA-256 hashes of the files are checked. Later starts do not use the internet for the model.

- Another port: `./run.sh 9000`
- To open it from a phone on the same network: `./run.sh --host 0.0.0.0`. There is no login and no request limit; do not expose it to the internet.

## Views

- **Words:** Line, Ring, Color ring, Scatter, Differing dimensions
- **Single word:** Axes, Nearest tokens, In between
- **Sentence:** Sentence focus, Journey: layers, Journey: tokens

**Axes** shows 640 ICA directions extracted from the embedding table. Blue ends passed the stability and meaning tests (91 directions); gray ends did not. Seeing the name of an end does not by itself mean that its meaning is proven.

## Files

- `viz/` server, interface and axis data (`axes.json`, `axes.pt`)
- `axes/` the measurement code that extracts and tests the axes, with its results

Tests:

```bash
venv/bin/python viz/test_modelfiles.py
venv/bin/python viz/test_journey_layout.py
venv/bin/python axes/test_core.py
venv/bin/python axes/test_axisdata.py
node --test viz/ui/test_geo.mjs
```

## License

Gemma is under the [Gemma Terms of Use](https://gemma.ai/resources/terms). The model is not in this repository; by downloading and using it you accept those terms. The axis data is derived from the Gemma weights and is subject to the same terms: [NOTICE](NOTICE), [GEMMA_TERMS.txt](GEMMA_TERMS.txt).
