# LLM Visualizer

Gemma 3 270M'in sözcük vektörlerini ve cümle içindeki gizli durumlarını tarayıcıda gösterir. Sayfa kendi bilgisayarınızda çalışır.

## Başlatma

```bash
git clone https://github.com/fdutoglu/LLM-Visualizer.git
cd LLM-Visualizer
```

Python 3.12 veya üstü gerekir (3.14 ile denendi). Linux / macOS:

```bash
./run.sh
```

Windows (denenmedi):

```bat
py -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
venv\Scripts\python viz\server.py
```

Sonra http://127.0.0.1:8791 adresini açın.

**İlk açılışta** model [unsloth/gemma-3-270m-it](https://huggingface.co/unsloth/gemma-3-270m-it) kaynağından `model/` klasörüne indirilir (yaklaşık 575 MB). Hesap ya da anahtar gerekmez. Sürüm sabittir, dosyaların SHA-256 özeti denetlenir. Sonraki açılışlarda model için internet kullanılmaz.

- Başka port: `./run.sh 9000`
- Aynı ağdaki telefondan açmak için: `./run.sh --host 0.0.0.0`. Giriş ve istek sınırı yoktur; internete açmayın.

## Görünümler

- **Kelimeler:** Çizgi, Halka, Renkli halka, Dağılım, Ayrışan boyutlar
- **Tek kelime:** Eksenler, En yakın tokenlar, Arasındakiler
- **Cümle:** Cümle odağı, Yolculuk: katmanlar, Yolculuk: tokenlar

**Eksenler**, embedding tablosundan çıkarılmış 640 ICA yönünü gösterir. Mavi uçlar kararlılık ve anlam sınavını geçmiştir (91 yön); gri uçlar geçmemiştir. Yalnızca uç adı görmek anlamın kanıtlandığı anlamına gelmez.

## Dosyalar

- `viz/` sunucu, arayüz ve eksen verisi (`axes.json`, `axes.pt`)
- `axes/` eksenleri çıkaran ve sınayan ölçüm kodu ile sonuçları

Testler:

```bash
venv/bin/python viz/test_modelfiles.py
venv/bin/python viz/test_journey_layout.py
venv/bin/python axes/test_core.py
venv/bin/python axes/test_axisdata.py
node --test viz/ui/test_geo.mjs
```

## Lisans

Gemma, [Gemma Kullanım Koşulları](https://gemma.ai/resources/terms) altındadır. Model bu depoda yoktur; indirip kullanarak o koşulları kabul etmiş olursunuz. Eksen verisi Gemma ağırlıklarından türetilmiştir ve aynı koşullara tabidir: [NOTICE](NOTICE), [GEMMA_TERMS.txt](GEMMA_TERMS.txt).
