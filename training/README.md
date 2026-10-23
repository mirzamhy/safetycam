# Training model Safety Cam

Model YOLO11n untuk mendeteksi APD pekerja konstruksi, dilatih dengan dataset
[Construction-PPE](https://docs.ultralytics.com/datasets/detect/construction-ppe/).
Dataset (sekitar 180 MB) terdownload otomatis ke `training/datasets/` saat training pertama kali.
Lokasinya tidak bergantung pada setting global Ultralytics, jadi aman di mesin mana pun.

Kelas: `helmet, gloves, vest, boots, goggles, none, Person, no_helmet, no_goggle, no_gloves, no_boots`

## 1. Setup

Python 3.10 sampai 3.13 (paling aman 3.11 atau 3.12).

```bash
cd training
python -m venv .venv
```

Aktifkan venv:
- Windows: `.venv\Scripts\activate`
- Linux/Mac: `source .venv/bin/activate`

```bash
pip install -r requirements.txt
```

Kalau mesinnya punya GPU NVIDIA, install PyTorch versi CUDA dulu (lihat https://pytorch.org/get-started/locally/), baru `pip install -r requirements.txt`.

## 2. Tes cepat (sekitar 2–5 menit)

Pastikan semua jalan sebelum training penuh:

```bash
python train.py --quick
```

## 3. Training penuh

```bash
python train.py
```

Opsi yang sering dipakai:

| Opsi | Arti |
|---|---|
| `--epochs 100` | jumlah epoch (default 50) |
| `--device 0` | pakai GPU NVIDIA pertama; `cpu` untuk paksa CPU |
| `--batch 32` | batch lebih besar kalau VRAM cukup; `-1` = otomatis (GPU) |
| `--model yolo11s.pt` | model lebih besar, lebih akurat, lebih lambat di browser |
| `--cache` | simpan gambar di RAM, training lebih cepat |
| `--resume` | lanjutkan training yang terputus |

Perkiraan waktu 50 epoch: GPU T4 atau RTX sekitar 20–40 menit, CPU sekitar 3–5 jam.

Hasil akhir: `weights/best.pt`.

## 4. Evaluasi

```bash
python evaluate.py
```

Isi `results/`: `metrics.md` (tabel siap tempel ke README), `metrics.json`, confusion matrix, dan kurva PR.

## 5. Coba ke gambar sendiri

```bash
python predict.py --source foto.jpg
```

## 6. Export untuk website

```bash
python export.py
```

Menghasilkan `../web/model/best.onnx` dan `../web/model/classes.json`.

## Pindah mesin

File yang perlu dibawa balik dari mesin training: `weights/best.pt`. Bawa juga `results/` kalau mau metriknya.
Export ONNX bisa dijalankan di mesin mana saja, tidak perlu GPU.

## Google Colab

Upload folder `training/` ke Colab, lalu:

```python
%cd training
!pip install -r requirements.txt
!python train.py --device 0 --batch 32
!python evaluate.py
!python export.py
```

Download `weights/best.pt`, `results/`, dan `../web/model/`.
