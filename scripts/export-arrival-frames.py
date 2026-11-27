"""Enhance every arrival frame without changing the cut or reframing the source."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageFilter, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path("arrival-frame-artwork"))
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
masters = args.output / "8k-300dpi"
compact = root / "public/arrival"
desktop = root / "public/arrival-hd"
for folder in (masters, compact, desktop):
    folder.mkdir(parents=True, exist_ok=True)

with ZipFile(args.source) as source:
    frames = [source.read(f"ezgif-frame-{i:03d}.jpg") for i in range(1, 51)]

def export(item):
    index, data = item
    name = f"{index:03d}"
    with Image.open(BytesIO(data)) as original:
        frame = ImageOps.exif_transpose(original).convert("RGB")
    if frame.size != (1280, 720):
        raise ValueError(f"Frame {name} has unexpected dimensions {frame.size}")

    # Use identical, restrained sharpening on every frame to avoid flicker.
    cleaned = frame.filter(ImageFilter.UnsharpMask(radius=1.2, percent=72, threshold=5))
    for folder, size, quality in ((compact, (1280, 720), 88), (desktop, (2560, 1440), 86)):
        cleaned.resize(size, Image.Resampling.LANCZOS).save(folder / f"{name}.webp", quality=quality, method=4)
    path = masters / f"{name}.jpg"
    cleaned.resize((7680, 4320), Image.Resampling.LANCZOS).save(path, quality=93, dpi=(300, 300), progressive=True)
    with Image.open(path) as result:
        assert result.size == (7680, 4320) and result.info["dpi"] == (300, 300)
    return name

with ThreadPoolExecutor(max_workers=3) as pool:
    for name in pool.map(export, enumerate(frames, 1)):
        print(f"Verified frame {name}", flush=True)

with ZipFile(args.output / "rubberwala-scroll-frames-8k-300dpi.zip", "w") as archive:
    for path in sorted(masters.glob("*.jpg")):
        archive.write(path, path.relative_to(args.output))
print("Verified all 50 master frames and packaged them.", flush=True)
