"""Quick check: run the trained model on images and save annotated copies.

Example:
    python predict.py --source foto.jpg
    python predict.py --source folder_gambar/ --conf 0.35
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent


def parse_args():
    p = argparse.ArgumentParser(description="Run PPE model on images")
    p.add_argument("--source", required=True, help="image file or folder")
    p.add_argument("--weights", default=str(ROOT / "weights" / "best.pt"))
    p.add_argument("--conf", type=float, default=0.35)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default=None)
    return p.parse_args()


def main():
    args = parse_args()
    model = YOLO(args.weights)
    results = model.predict(
        source=args.source,
        conf=args.conf,
        imgsz=args.imgsz,
        device=args.device,
        save=True,
        project=str(ROOT / "runs"),
        name="predict",
        exist_ok=True,
    )
    for r in results:
        counts = {}
        for c in r.boxes.cls.tolist():
            name = r.names[int(c)]
            counts[name] = counts.get(name, 0) + 1
        violations = {k: v for k, v in counts.items() if k.startswith("no_")}
        status = "PELANGGARAN" if violations else ("AMAN" if counts.get("Person") else "TIDAK ADA PEKERJA")
        print(f"{Path(r.path).name}: {status} {counts}")
    print(f"\nGambar beranotasi: {results[0].save_dir if results else '-'}")


if __name__ == "__main__":
    main()
