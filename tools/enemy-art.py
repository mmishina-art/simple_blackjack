"""
生成 AI で描いた敵の絵を、ゲームで使う形に変える（src/ui/art/enemies/<id>.webp）。
  python3 tools/enemy-art.py <元の画像> <敵の ID>
- 背景の黒のうち、画像の外側からつながっている部分だけを透明にする（体の中の暗い所は残す）。
- 横 800 ピクセルに縮め、WebP（品質 82）で保存する。Pillow（pip install pillow）が必要。
"""
import collections, sys
from PIL import Image, ImageFilter

def main(src: str, enemy_id: str, threshold: int = 14) -> None:
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q = collections.deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i] or max(px[x, y]) > threshold:
            continue
        bg[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx]:
                q.append((nx, ny))
    alpha = Image.frombytes('L', (w, h), bytes(0 if b else 255 for b in bg)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    out = out.resize((800, round(800 * h / w)), Image.LANCZOS)
    dest = f'src/ui/art/enemies/{enemy_id}.webp'
    out.save(dest, quality=82)
    print(dest, out.size)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
