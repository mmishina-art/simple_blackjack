"""
生成 AI で描いた絵を、ゲームで使う形に変える（WebP）。名前で、置き場所と処理が決まる:
  python3 tools/art.py <元の画像> <名前> [しきい値]
  - 敵の ID（slime など）      → src/ui/art/enemies/<ID>.webp   … 背景を透明に、横 800
  - title                      → src/ui/art/title.webp          … 背景を透明に、横 900
  - stage1〜stage3            → src/ui/art/stages/<名前>.webp  … そのまま（不透明）、横 1280
  - scene_shop など（scene_*） → src/ui/art/scenes/<shop など>.webp … そのまま（不透明）、横 1200
- 透明にするとき: 背景の黒のうち、画像の外側からつながっている部分だけを透明にする（体の中の暗い所は残す）。
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

def target(name: str) -> tuple[str, int, bool]:
    """(保存先, 横の大きさ, 背景を透明にするか)"""
    if name == 'title':
        return 'src/ui/art/title.webp', 900, True
    if name.startswith('stage'):
        return f'src/ui/art/stages/{name}.webp', 1280, False
    if name.startswith('scene_'):
        return f'src/ui/art/scenes/{name[len("scene_"):]}.webp', 1200, False
    return f'src/ui/art/enemies/{name}.webp', 800, True

def main(src: str, name: str, threshold: int = 10) -> None:
    dest, width, cutout = target(name)
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if not cutout:
        out = im.resize((width, round(width * h / w)), Image.LANCZOS)
        out.save(dest, quality=80)
        print(dest, out.size)
        return
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
    out = out.resize((width, round(width * h / w)), Image.LANCZOS)
    out.save(dest, quality=82)
    print(dest, out.size)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], *(int(a) for a in sys.argv[3:4]))
