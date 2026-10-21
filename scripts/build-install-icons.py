"""Rasterize the original embedded seal for OS icon compatibility; no logo changes."""
from pathlib import Path
from PIL import Image
import base64, io, re
root=Path(__file__).resolve().parent.parent
source=(root/'forma-seal.svg').read_text()
raw=base64.b64decode(re.search(r'data:image/jpeg;base64,([^\"]+)',source)[1])
image=Image.open(io.BytesIO(raw)).convert('RGB')
for size in (180,192,512):
    image.resize((size,size),Image.Resampling.LANCZOS).save(root/'icons'/f'forma-{size}.png',optimize=True)
