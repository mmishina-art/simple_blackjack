"""
生成 AI で描いた敵の絵を、ゲームで使う形に変える（src/ui/art/enemies/<id>.webp）。
  python3 tools/enemy-art.py <元の画像> <敵の ID> [しきい値]
- 背景の黒のうち、画像の外側からつながっている部分だけを透明にする（体の中の暗い所は残す）。
  翼の陰影などの暗い所へ、細いすき間から入り込まないよう、背景の候補を一度細らせてから外側とつながる所を探し、
  そのあと元の太さに戻す（すき間が CHANNEL ピクセルより細いところは、背景として扱わない）。
- 横 800 ピクセルに縮め、WebP（品質 82）で保存する。Pillow（pip install pillow）が必要。
"""
import collections, sys
from PIL import Image, ImageChops, ImageFilter

CHANNEL = 9

def flood_from_border(mask: Image.Image) -> Image.Image:
    """mask（255 = 背景の候補）のうち、画像のふちとつながる部分だけを 255 にする。"""
    w, h = mask.size
    m = mask.load()
    out = bytearray(w * h)
    q = collections.deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        i = y * w + x
        if out[i] or m[x, y] == 0:
            continue
        out[i] = 255
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not out[ny * w + nx]:
                q.append((nx, ny))
    return Image.frombytes('L', (w, h), bytes(out))

def main(src: str, enemy_id: str, threshold: int = 10) -> None:
    im = Image.open(src).convert('RGB')
    # 背景の候補: いちばん明るい色の成分が、しきい値以下（ほぼ黒）
    r, g, b = im.split()
    brightest = ImageChops.lighter(ImageChops.lighter(r, g), b)
    cand = brightest.point(lambda v: 255 if v <= threshold else 0)
    thin = cand.filter(ImageFilter.MinFilter(CHANNEL))           # 細いすき間を切る
    reach = flood_from_border(thin).filter(ImageFilter.MaxFilter(CHANNEL))  # 外側とつながる所を、元の太さに戻す
    bg = ImageChops.multiply(reach, cand)                          # もとの候補の中だけ
    alpha = ImageChops.invert(bg).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    w, h = im.size
    out = out.resize((800, round(800 * h / w)), Image.LANCZOS)
    dest = f'src/ui/art/enemies/{enemy_id}.webp'
    out.save(dest, quality=82)
    print(dest, out.size)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], *(int(a) for a in sys.argv[3:4]))
