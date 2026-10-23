"""Download Construction-PPE into training/datasets/ and write a local dataset yaml.

Keeps the dataset inside this project, independent of the global
Ultralytics `datasets_dir` setting (which may point to another machine's path).
"""

from pathlib import Path

import yaml
from ultralytics.utils import ROOT as ULTRA_ROOT
from ultralytics.utils.downloads import safe_download

ROOT = Path(__file__).resolve().parent
DATASETS_DIR = ROOT / "datasets"
DEFAULT_DATA = "construction-ppe.yaml"


def prepare(data: str = DEFAULT_DATA) -> str:
    """Return a yaml path usable by Ultralytics.

    For the built-in construction-ppe.yaml: download into training/datasets/
    (once) and return a local yaml with an absolute path. Any other value
    (custom yaml) is returned unchanged.
    """
    if data != DEFAULT_DATA:
        return data

    builtin = ULTRA_ROOT / "cfg" / "datasets" / DEFAULT_DATA
    cfg = yaml.safe_load(builtin.read_text(encoding="utf-8"))
    dataset_root = DATASETS_DIR / cfg["path"]

    if not (dataset_root / cfg["val"]).exists():
        print(f"Download dataset ke {DATASETS_DIR} ...")
        DATASETS_DIR.mkdir(parents=True, exist_ok=True)
        safe_download(url=cfg["download"], dir=DATASETS_DIR, unzip=True, delete=True)
        if not (dataset_root / cfg["val"]).exists():
            raise SystemExit(f"Download selesai tapi folder {dataset_root / cfg['val']} tidak ada.")

    local = {
        "path": str(dataset_root),
        "train": cfg["train"],
        "val": cfg["val"],
        "test": cfg["test"],
        "names": cfg["names"],
    }
    local_yaml = DATASETS_DIR / "construction-ppe-local.yaml"
    local_yaml.write_text(yaml.safe_dump(local, sort_keys=False), encoding="utf-8")
    return str(local_yaml)
