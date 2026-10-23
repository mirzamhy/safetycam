# SafetyCam

Website yang mendeteksi apakah pekerja konstruksi memakai APD (helm, rompi, sarung tangan, sepatu safety, kacamata).
Model YOLO11n dilatih dengan dataset [Construction-PPE](https://docs.ultralytics.com/datasets/detect/construction-ppe/) dan berjalan langsung di browser lewat onnxruntime-web. Foto dan video tidak dikirim ke server.

## Struktur

- `training/`: script training, evaluasi, dan export model. Lihat [training/README.md](training/README.md).
- `web/`: website statis (HTML, CSS, JS tanpa build step).

## Alur

1. Training: `cd training && python train.py`
2. Evaluasi: `python evaluate.py`
3. Export ke website: `python export.py`. Hasilnya `web/model/best.onnx`, `classes.json`, dan `metrics.json`.
4. Jalankan website lokal: `cd web && python -m http.server 5180`, lalu buka http://localhost:5180
5. Test logika web: `cd web && npm test`

## Deploy (Vercel)

Import repo di Vercel, set **Root Directory** ke `web`, framework **Other**, tanpa build command.
Pastikan `web/model/best.onnx` ikut di-commit (sekitar 10 MB).

## Lisensi

Ultralytics YOLO11 dan dataset Construction-PPE berlisensi AGPL-3.0, jadi repo ini juga open source di bawah AGPL-3.0.
