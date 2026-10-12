# Cuts Clack Arena's GUI pieces out of Pixel UI pack 3 (art/pixel-ui-pack-3/, not published) and writes them,
# scaled up with nearest-neighbour so the pixels stay square, to docs/games/clack-arena/play/ui/:
# <name>.png at 3x and <name>@2.png at 2x (pixel art only stays crisp at whole-number sizes).
# Run from the repo root after changing the list:  python3 tools/build_arena_ui.py
from PIL import Image
import os

SRC, OUT = 'art/pixel-ui-pack-3', 'docs/games/clack-arena/play/ui'

# name: (sheet, x, y, w, h). Strips (power, spin) are several frames side by side, cut as one image.
SPRITES = {
    'frame-navy': ('00', 0, 85, 48, 22), 'frame-brown': ('00', 128, 85, 48, 22), 'frame-grey': ('00', 64, 85, 48, 22),
    'slot-navy': ('00', 0, 32, 48, 16), 'slot-brown': ('00', 128, 32, 48, 16),
    'pill-navy': ('00', 16, 18, 31, 12), 'pill-grey': ('00', 80, 18, 31, 12), 'pill-brown': ('00', 144, 18, 31, 12),
    'arrow-l': ('00', 19, 2, 9, 12), 'arrow-r': ('00', 37, 2, 9, 12), 'chevron': ('00', 48, 0, 16, 15),
    'btn-blue': ('00', 196, 0, 18, 16), 'btn-yellow': ('00', 196, 16, 18, 16), 'btn-red': ('00', 196, 32, 18, 16), 'btn-green': ('00', 196, 48, 18, 16),
    'heart': ('00', 114, 114, 12, 12), 'heart-half': ('00', 98, 114, 12, 12), 'heart-empty': ('00', 82, 114, 12, 12),
    'star': ('00', 135, 135, 18, 17), 'star-empty': ('00', 7, 135, 18, 17),
    'rank-orange': ('00', 257, 4, 14, 26), 'rank-green': ('00', 273, 4, 14, 26), 'rank-cyan': ('00', 305, 4, 14, 26),
    'up-green': ('00', 273, 34, 14, 12), 'down-orange': ('00', 257, 50, 14, 12),
    'wings-silver': ('01', 0, 8, 80, 18), 'wings-red': ('01', 0, 104, 80, 18),
    'shield-red': ('01', 82, 4, 44, 40), 'gem-orange': ('01', 86, 56, 36, 32), 'gem-cyan': ('01', 182, 56, 36, 32), 'gem-green': ('01', 134, 56, 36, 32),
    'crest-red': ('01', 80, 100, 80, 40), 'crest-blue': ('01', 176, 100, 80, 40),
    'glow-cyan': ('02', 4, 100, 24, 24), 'glow-purple': ('02', 132, 100, 24, 24), 'glow-orange': ('02', 132, 20, 24, 24), 'glow-green': ('02', 4, 20, 24, 24),
    'power': ('05', 0, 0, 384, 18),      # 8 frames of 48: full (0) to empty (7)
    'spin': ('03', 0, 96, 240, 48),      # 5 frames of 48: a ring of dots emptying
    'pointer': ('07', 3, 211, 11, 11), 'corner': ('07', 4, 179, 8, 9),
}

os.makedirs(OUT, exist_ok=True)
sheets = {}
for name, (sheet, x, y, w, h) in SPRITES.items():
    im = sheets.setdefault(sheet, Image.open(f'{SRC}/{sheet}.png').convert('RGBA')).crop((x, y, x + w, y + h))
    im.resize((w * 3, h * 3), Image.NEAREST).save(f'{OUT}/{name}.png', optimize=True)
    im.resize((w * 2, h * 2), Image.NEAREST).save(f'{OUT}/{name}@2.png', optimize=True)
print(len(SPRITES), 'sprites written to', OUT)
