# Symbol art

One WebP per symbol, cut from the "Wildlife Montana" contact sheet and the
Africa medallion by `engine/slice_art.py` (512x512, white surround made
transparent). `engine/export.py` scans this folder and lists what it finds in
`web/gamedata.js`; the page loads only those files and falls back to a CSS
tile for anything missing.

| File            | Symbol    | Notes                                          |
| --------------- | --------- | ---------------------------------------------- |
| `j.webp`        | J         | lowest pay                                     |
| `q.webp`        | Q         |                                                |
| `k.webp`        | K         |                                                |
| `a.webp`        | A         |                                                |
| `giraffe.webp`  | Giraffes  |                                                |
| `zebra.webp`    | Zebras    |                                                |
| `rhino.webp`    | Rhinos    |                                                |
| `elephant.webp` | Elephants |                                                |
| `lion.webp`     | Lions     | highest pay                                    |
| `wild.webp`     | WILD      | expands to full reel; sticky in Free Games     |
| `africa.webp`   | Africa    | scatter - 3/4/5 anywhere = 10/15/20 free games |

To replace any symbol, drop a `png`, `webp` or `jpg` with the same base name
here and run `python -m engine.export`. To re-cut from new source sheets:

    python -m engine.slice_art SHEET.jpg AFRICA.jpg
