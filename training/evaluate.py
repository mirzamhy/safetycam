"""Evaluate trained weights and save metrics for the README.

Outputs (training/results/):
    metrics.json        overall + per-class numbers
    metrics.md          markdown table, paste into README
    confusion_matrix*.png, PR curves, etc. (from Ultralytics)

Example:
    python evaluate.py
    python evaluate.py --weights weights/best.pt --split val
"""

import argparse
import json
import shutil
from pathlib import Path

from ultralytics import YOLO

import dataset

ROOT = Path(__file__).resolve().parent
RESULTS_DIR = ROOT / "results"


def parse_args():
    p = argparse.ArgumentParser(description="Evaluate PPE model")
    p.add_argument("--weights", default=str(ROOT / "weights" / "best.pt"))
    p.add_argument("--data", default="construction-ppe.yaml")
    p.add_argument("--split", default="test", choices=["test", "val"])
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default=None)
    return p.parse_args()


def run_val(model, args, split):
    return model.val(
        data=dataset.prepare(args.data),
        split=split,
        imgsz=args.imgsz,
        device=args.device,
        plots=True,
        project=str(ROOT / "runs"),
        name=f"eval_{split}",
        exist_ok=True,
    )


def main():
    args = parse_args()
    weights = Path(args.weights)
    if not weights.exists():
        raise SystemExit(f"Weights tidak ditemukan: {weights}. Jalankan train.py dulu.")

    model = YOLO(str(weights))
    split = args.split
    try:
        metrics = run_val(model, args, split)
    except Exception as e:  # dataset without a test split
        if split != "test":
            raise
        print(f"Split 'test' gagal ({e}). Pakai 'val'.")
        split = "val"
        metrics = run_val(model, args, split)

    names = model.names
    box = metrics.box
    per_class = []
    for i, cls_idx in enumerate(box.ap_class_index):
        p, r, ap50, ap = box.class_result(i)
        per_class.append({
            "class": names[int(cls_idx)],
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "mAP50": round(float(ap50), 4),
            "mAP50-95": round(float(ap), 4),
        })

    summary = {
        "weights": str(weights),
        "split": split,
        "precision": round(float(box.mp), 4),
        "recall": round(float(box.mr), 4),
        "mAP50": round(float(box.map50), 4),
        "mAP50-95": round(float(box.map), 4),
        "per_class": per_class,
    }

    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "metrics.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    lines = [
        f"Split: `{split}`",
        "",
        "| Class | Precision | Recall | mAP50 | mAP50-95 |",
        "|---|---|---|---|---|",
        f"| **all** | {summary['precision']:.3f} | {summary['recall']:.3f} | {summary['mAP50']:.3f} | {summary['mAP50-95']:.3f} |",
    ]
    for c in per_class:
        lines.append(f"| {c['class']} | {c['precision']:.3f} | {c['recall']:.3f} | {c['mAP50']:.3f} | {c['mAP50-95']:.3f} |")
    (RESULTS_DIR / "metrics.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    for png in Path(metrics.save_dir).glob("*.png"):
        shutil.copy2(png, RESULTS_DIR / png.name)

    print("\n".join(lines))
    print(f"\nHasil disimpan di {RESULTS_DIR}")


if __name__ == "__main__":
    main()
