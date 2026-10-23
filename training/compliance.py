"""Per-worker PPE compliance from YOLO detections.

Every PPE / no_* box is assigned to the Person box that best contains it.
A worker is:
    PELANGGARAN   if any no_* item is assigned to them, or a required item is missing
    AMAN          if every required item is detected on them
    TIDAK JELAS   if a required item is neither seen nor reported missing
                  (e.g. feet out of frame), and nothing else is wrong

Example:
    from ultralytics import YOLO
    import compliance
    r = YOLO("weights/best.pt")("foto.jpg")[0]
    report = compliance.assess(r, required=("helmet", "vest"))
    print(compliance.format_report(report))
"""

from dataclasses import dataclass, field

PERSON = "Person"
PPE_ITEMS = ("helmet", "vest", "gloves", "boots", "goggles")
# missing-PPE class name -> PPE item it negates (dataset uses "no_goggle", singular).
# The dataset has no "no_vest" class; its "none" boxes sit on the torso and co-occur with the
# other no_* labels, so "none" is treated as a missing vest.
MISSING = {"no_helmet": "helmet", "no_gloves": "gloves", "no_boots": "boots", "no_goggle": "goggles", "none": "vest"}
DEFAULT_REQUIRED = ("helmet", "vest")

LABEL_ID = {
    "helmet": "helm",
    "vest": "rompi",
    "gloves": "sarung tangan",
    "boots": "sepatu safety",
    "goggles": "kacamata",
}


@dataclass
class Worker:
    box: tuple  # x1, y1, x2, y2
    conf: float
    worn: set = field(default_factory=set)
    missing: set = field(default_factory=set)  # from no_* detections
    status: str = ""
    reasons: list = field(default_factory=list)


@dataclass
class Report:
    status: str  # PELANGGARAN / AMAN / TIDAK JELAS / TIDAK ADA PEKERJA
    workers: list
    unassigned: list  # (class_name, box) not inside any worker


def _overlap(inner, outer):
    """Fraction of `inner` box area that lies inside `outer`."""
    x1, y1 = max(inner[0], outer[0]), max(inner[1], outer[1])
    x2, y2 = min(inner[2], outer[2]), min(inner[3], outer[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = max(1e-6, (inner[2] - inner[0]) * (inner[3] - inner[1]))
    return inter / area


def _expand(box, ratio):
    """Grow a box by `ratio` of its size on each side (helmets often stick out above the person box)."""
    w, h = box[2] - box[0], box[3] - box[1]
    return (box[0] - w * ratio, box[1] - h * ratio, box[2] + w * ratio, box[3] + h * ratio)


def assess_detections(detections, required=DEFAULT_REQUIRED, min_overlap=0.5, expand=0.1):
    """detections: iterable of (class_name, conf, (x1, y1, x2, y2))."""
    detections = list(detections)
    workers = [Worker(box=tuple(b), conf=c) for n, c, b in detections if n == PERSON]
    unassigned = []

    for name, _, box in detections:
        if name == PERSON or (name not in PPE_ITEMS and name not in MISSING):
            continue  # skips unknown classes
        best, best_score = None, min_overlap
        for w in workers:
            score = _overlap(box, _expand(w.box, expand))
            if score >= best_score:
                best, best_score = w, score
        if best is None:
            unassigned.append((name, tuple(box)))
        elif name in MISSING:
            best.missing.add(MISSING[name])
        else:
            best.worn.add(name)

    for w in workers:
        w.missing -= w.worn  # a confident "worn" detection beats a conflicting no_* box
        for item in sorted(w.missing):
            w.reasons.append(f"tidak memakai {LABEL_ID[item]}")
        unseen = [i for i in required if i not in w.worn and i not in w.missing]
        if w.missing:
            w.status = "PELANGGARAN"
        elif unseen:
            w.status = "TIDAK JELAS"
            w.reasons += [f"{LABEL_ID[i]} tidak terlihat" for i in unseen]
        else:
            w.status = "AMAN"

    statuses = {w.status for w in workers}
    has_unassigned_violation = any(n in MISSING for n, _ in unassigned)
    if "PELANGGARAN" in statuses or has_unassigned_violation:
        status = "PELANGGARAN"
    elif "TIDAK JELAS" in statuses:
        status = "TIDAK JELAS"
    elif workers:
        status = "AMAN"
    else:
        status = "TIDAK ADA PEKERJA"
    return Report(status=status, workers=workers, unassigned=unassigned)


def from_result(result):
    """Convert an Ultralytics Results object to (class_name, conf, box) tuples."""
    b = result.boxes
    return [
        (result.names[int(c)], float(p), tuple(map(float, xyxy)))
        for c, p, xyxy in zip(b.cls.tolist(), b.conf.tolist(), b.xyxy.tolist())
    ]


def assess(result, **kwargs):
    return assess_detections(from_result(result), **kwargs)


def format_report(report):
    lines = [f"Status gambar: {report.status} ({len(report.workers)} pekerja)"]
    for i, w in enumerate(report.workers, 1):
        worn = ", ".join(LABEL_ID[x] for x in sorted(w.worn)) or "-"
        reason = f" | {'; '.join(w.reasons)}" if w.reasons else ""
        lines.append(f"  Pekerja {i}: {w.status} | memakai: {worn}{reason}")
    for name, _ in report.unassigned:
        if name in MISSING:
            lines.append(f"  (di luar kotak pekerja) {name}")
    return "\n".join(lines)


def draw(result, report):
    """Return a BGR image: green box = AMAN, red = PELANGGARAN, orange = TIDAK JELAS."""
    import cv2

    img = result.orig_img.copy()
    colors = {"AMAN": (60, 180, 75), "PELANGGARAN": (40, 40, 220), "TIDAK JELAS": (0, 165, 255)}
    for i, w in enumerate(report.workers, 1):
        x1, y1, x2, y2 = map(int, w.box)
        col = colors[w.status]
        cv2.rectangle(img, (x1, y1), (x2, y2), col, 3)
        text = f"#{i} {w.status}"
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(img, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), col, -1)
        cv2.putText(img, text, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return img
