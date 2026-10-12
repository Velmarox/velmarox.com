# Draws the app icon (a pixel-art crimson die with the player's yellow outline) and the installer's sidebar art.
# Writes build/icon.png, build/icon.ico and build/sidebar.bmp. Run from desktop/clack-arena:  python3 scripts/art.py
from PIL import Image, ImageDraw, ImageFont
import os

OUT = 'build'
FONT = '../../docs/games/clack-arena/play/ui/ThaleahFat.ttf'
YEL, RED, RED_D, RED_L, INK, BG = (245, 228, 0), (200, 16, 46), (138, 8, 30), (232, 64, 84), (255, 255, 255), (11, 11, 13)

def die32():
    """32x32 pixel die: front face, a top and right side for depth, five white pips, yellow outline."""
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # outline (yellow) around the whole silhouette
    d.polygon([(3, 9), (9, 3), (29, 3), (29, 23), (23, 29), (3, 29)], fill=YEL)
    # top face and right side
    d.polygon([(5, 9), (10, 5), (27, 5), (22, 9)], fill=RED_L)
    d.polygon([(23, 10), (27, 6), (27, 22), (23, 26)], fill=RED_D)
    # front face
    d.rectangle([5, 10, 22, 27], fill=RED)
    d.line([(5, 10), (22, 10)], fill=RED_L)
    # five pips, 2x2 each with a dark shadow pixel
    for x, y in [(8, 13), (17, 13), (12, 17), (8, 22), (17, 22)]:
        d.rectangle([x, y, x + 2, y + 2], fill=INK)
        d.point((x + 2, y + 2), fill=(220, 210, 215))
    return im

os.makedirs(OUT, exist_ok=True)
base = die32()
big = base.resize((256, 256), Image.NEAREST)
big.save(f'{OUT}/icon.png')
sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [base.resize((s, s), Image.NEAREST) for s in sizes]
imgs[-1].save(f'{OUT}/icon.ico', sizes=[(s, s) for s in sizes], append_images=imgs[:-1])

# Installer sidebar, 164x314 (what NSIS shows on the welcome and finish pages).
W, H = 164, 314
sb = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(sb)
def stripes(y, h):
    for x in range(-h, W + h, 12):
        d.polygon([(x, y + h), (x + 6, y + h), (x + 6 + h, y), (x + h, y)], fill=YEL)
stripes(0, 8); stripes(H - 8, 8)
sb.paste(base.resize((96, 96), Image.NEAREST), ((W - 96) // 2, 46), base.resize((96, 96), Image.NEAREST))
f_big, f_small = ImageFont.truetype(FONT, 32), ImageFont.truetype(FONT, 16)
def center(text, y, font, fill):
    w = d.textlength(text, font=font); d.text(((W - w) / 2 + 2, y + 2), text, font=font, fill=(0, 0, 0)); d.text(((W - w) / 2, y), text, font=font, fill=fill)
center('CLACK', 160, f_big, (242, 242, 244)); center('ARENA', 192, f_big, (255, 42, 67))
center('You are a die.', 236, f_small, (154, 154, 166))
center('VRX GAMES', 280, f_small, YEL)
sb.save(f'{OUT}/sidebar.bmp')
print('icon.png, icon.ico, sidebar.bmp written')
