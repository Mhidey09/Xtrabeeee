# Contact sheet: python3 tools/sheet.py dir  -> dir/sheetN.png (8 frames per sheet, 2 columns)
import sys, glob
from PIL import Image, ImageDraw
d = sys.argv[1]
fs = sorted(glob.glob(f'{d}/t*.png'))
for k in range(0, len(fs), 8):
    sheet = Image.new('RGB', (1280, 1440), 'white')
    for i, f in enumerate(fs[k:k + 8]):
        im = Image.open(f).resize((640, 360)); ImageDraw.Draw(im).text((8, 8), f.split('/')[-1], fill='red')
        sheet.paste(im, ((i % 2) * 640, (i // 2) * 360))
    sheet.save(f'{d}/sheet{k // 8}.png')
