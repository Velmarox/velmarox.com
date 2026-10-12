# Cuts Clack Arena's face icons and enemy cats out of their source art and writes them into
# docs/games/clack-arena/play/:
#   icons/<name>.png         face icons from Franuka's Fantasy RPG Icon Pack (art/fantasy-rpg-icons/, CC BY 4.0),
#                            kept at their native 16x16; the game scales them up without smoothing.
#   ui/item-<id>.png, @2     item icons from the same pack, 3x and 2x, so A.px() can draw them like GUI pieces.
#   ui/cat-<enemy>.png       the enemy's cat (All Cats pack, art/all-cats-3/), first idle frame, 3x and @2 at 2x,
#                            so A.px() can draw it like any other GUI piece.
#   ui/cat-<enemy>-idle@2.png the whole idle loop as one strip at 2x, for the animated cats on the map cards.
#   ui/coin.png, coin@2.png  the chip icon: first frame of the coin spin (art/coins/coin-spin.png, 5 frames of 16x16),
#                            3x and 2x; ui/coin-spin@2.png is the whole spin at 2x, for the reward screen.
# Only the source files the game uses are kept in art/. Run from the repo root:  python3 tools/build_arena_art.py
from PIL import Image
import os

PLAY = 'docs/games/clack-arena/play'

# Face icon name (A.FACE_TYPES[..].icon, or a face's own icon) -> source file.
ICONS = {
    'claw': '12-steel-sword', 'arrow': '32-steel-arrow', 'shield': '56-steel-shield', 'heart': '82-healing-potion',
    'flame': '141-fire', 'thorns': 'spells-81-thorn-whip', 'skull': '137-skull', 'crown': '270-crown',
}

# Item id (A.ITEM_ICON) -> source file in the same pack.
ITEMS = {'chalk': '259-pencil', 'talc': '105-pouch'}

# Enemy id (A.ENEMIES) -> cat. Each sheet is an idle loop of 32x32 frames side by side.
CATS = {
    'pips': 'white', 'glassjaw': 'bluecollar', 'twins': 'siamese', 'tumbler': 'tiger',
    'ironmike': 'vampire', 'house': 'egypt',
}

os.makedirs(f'{PLAY}/icons', exist_ok=True)
for name, src in ICONS.items():
    Image.open(f'art/fantasy-rpg-icons/{src}.png').convert('RGBA').save(f'{PLAY}/icons/{name}.png', optimize=True)

for item, src in ITEMS.items():
    im = Image.open(f'art/fantasy-rpg-icons/{src}.png').convert('RGBA')
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(f'{PLAY}/ui/item-{item}.png', optimize=True)
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f'{PLAY}/ui/item-{item}@2.png', optimize=True)

for enemy, cat in CATS.items():
    sheet = Image.open(f'art/all-cats-3/{cat}-idle.png').convert('RGBA')
    n = sheet.width // sheet.height
    frames = [sheet.crop((k * sheet.height, 0, (k + 1) * sheet.height, sheet.height)) for k in range(n)]
    # One box that fits the cat in every frame, so the loop doesn't jitter.
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    first = frames[0]
    first.resize((w * 3, h * 3), Image.NEAREST).save(f'{PLAY}/ui/cat-{enemy}.png', optimize=True)
    first.resize((w * 2, h * 2), Image.NEAREST).save(f'{PLAY}/ui/cat-{enemy}@2.png', optimize=True)
    strip = Image.new('RGBA', (w * n, h))
    for k, f in enumerate(frames): strip.paste(f, (k * w, 0))
    strip.resize((w * n * 2, h * 2), Image.NEAREST).save(f'{PLAY}/ui/cat-{enemy}-idle@2.png', optimize=True)
    print(f'cat-{enemy}: {cat}, {n} frames of {w}x{h}')
coin = Image.open('art/coins/coin-spin.png').convert('RGBA')
cell = coin.height
coin.crop((0, 0, cell, cell)).resize((cell * 3, cell * 3), Image.NEAREST).save(f'{PLAY}/ui/coin.png', optimize=True)
coin.crop((0, 0, cell, cell)).resize((cell * 2, cell * 2), Image.NEAREST).save(f'{PLAY}/ui/coin@2.png', optimize=True)
coin.resize((coin.width * 2, cell * 2), Image.NEAREST).save(f'{PLAY}/ui/coin-spin@2.png', optimize=True)
print(len(ICONS), 'icons,', len(ITEMS), 'items,', len(CATS), 'cats and the coin written to', PLAY)
