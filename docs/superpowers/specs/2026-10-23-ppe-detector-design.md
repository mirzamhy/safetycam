# PPE Detector — Design Spec

Date: 2026-10-23
Goal: public portfolio website that detects construction worker safety gear (PPE) in photos and live webcam, and reports a compliance status.

## Decisions

- Purpose: portfolio / public demo.
- Dataset: Ultralytics Construction-PPE (`construction-ppe.yaml`, auto-download). 11 classes:
  `helmet, gloves, vest, boots, goggles, none, Person, no_helmet, no_goggle, no_gloves, no_boots`.
- Model: YOLO11n (smallest, fast in browser).
- Training: local, CPU (laptop has AMD Radeon 780M, no CUDA). Google Colab T4 is the fallback if CPU training is too slow; output files are identical.
- Inference: fully in the browser via `onnxruntime-web`. No backend server. User images never leave the device.
- Hosting: static site on Vercel (free).
- License: Ultralytics is AGPL-3.0, so the repo is public / open source.

## Pipeline

1. `training/train.py` — trains YOLO11n on `construction-ppe.yaml`, imgsz 640, default 50 epochs (configurable via CLI args), saves `runs/.../weights/best.pt`.
2. `training/evaluate.py` — runs validation on the test split; saves mAP50, mAP50-95, per-class AP, confusion matrix image into `training/results/`.
3. `training/export.py` — exports `best.pt` to ONNX (opset 12, static 640x640, no NMS inside graph), copies to `web/model/best.onnx`, and writes `web/model/classes.json` with class names in index order.

## Web app (`web/`)

Plain HTML + JS (ES modules), no build step.

- `index.html` — two tabs: **Upload Foto** and **Webcam**; confidence threshold slider (default 0.35); sample images to click; result canvas; compliance summary panel.
- `detector.js` — loads ONNX session (WebGPU if available, else WASM); preprocess (letterbox to 640, RGB, /255, NCHW float32); postprocess output `[1, 4+11, 8400]`: transpose, filter by confidence, class-wise NMS (IoU 0.45), map boxes back to original image coordinates. Exposes `detect(imageSource) -> [{cls, name, score, box:[x1,y1,x2,y2]}]`.
- `compliance.js` — pure function `assess(detections) -> {status, violations, counts}`:
  - any `no_*` class present → status `VIOLATION`, violations counted per type (e.g. "2 tanpa helm").
  - else if `Person` present → status `SAFE`.
  - else → status `NO_WORKER`.
  Counting is per image; PPE is not matched to individual persons (the `no_*` classes already encode violations).
- `draw.js` — draws boxes: red for `no_*`, green for PPE items, grey for `Person`/`none`; label with name + score.
- Webcam loop: `getUserMedia`, run detect on each frame with `requestAnimationFrame`, skip a frame while previous inference is still running. Show FPS.
- UI text in Bahasa Indonesia.

## Error handling

- Model fails to load → visible error message with retry button.
- Webcam permission denied / no camera → message, upload tab still works.
- Non-image upload → rejected with message.

## Testing

- `compliance.js` unit tests (Node built-in `node --test`) for SAFE / VIOLATION / NO_WORKER cases and violation counting.
- Postprocess (NMS, box rescale) unit tests with a small synthetic tensor.
- Parity check: one test image run through Python Ultralytics `best.pt` and through the browser `best.onnx`; detection count and classes should match (manual check, documented in README).

## Deliverables

- Trained `best.pt` and `best.onnx`.
- `training/results/` metrics for README.
- Deployed Vercel URL.
- README: demo link, screenshots, metrics table, how to retrain.

## Out of scope

- Video file upload.
- Per-person PPE association / tracking.
- User accounts, storing detections, alerts.
