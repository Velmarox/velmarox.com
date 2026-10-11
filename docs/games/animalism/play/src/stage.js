// ---------------------------------------------------------------------------
// Stage: backdrop, foreground layer, colour grade.
//
// SCALE. The tileset is drawn for a character about 95px tall - its lamp posts
// are 269px, and a real lamp is ~2.6x a person. Animal is 48px, so at 1:1 the
// scenery dwarfed him. The backdrop is therefore pre-halved by
// tools/make_backdrop.py (box filter, so the 1px window frames survive), which
// puts a lamp at ~134px = 2.8x his height. Game logic is untouched by this -
// only these constants moved.
//
// The halved art's pavement runs y 568 (far edge) .. 594 (kerb top), and the
// belt is anchored to 568, so:
//
//     halved art y 568  ->  screen y 122   (BELT_TOP)
//
// FOREGROUND. Kerbside lamp posts and tree trunks stand in front of the
// action. As part of the backdrop they drew behind the characters, so Animal
// appeared to stand on top of a lamp post. They live in their own transparent
// layer now, drawn after the actors.
//
// WRAPPING. The halved backdrop is only 2165px wide but levels are longer, so
// it repeats - every other copy mirrored, which makes the joins seamless
// because each edge meets itself.
// ---------------------------------------------------------------------------

const BG_W = 2165, BG_H = 694;
const BG_SRC_Y = 568 - BELT_TOP;         // = 446, the art row drawn at screen 0

// The belt depth of the foreground props (lamp posts / tree trunks). Their
// bases sit at halved-art y ~606 = screen 160 = z 38. Actors nearer than this
// draw OVER the layer, actors behind it are occluded - before the belt was
// deepened this didn't matter, afterwards the lamps wrongly covered anyone
// standing in the street in front of them.
const FG_Z = 38;

const Stage = {
  img: null,
  fg: null,

  init(bg, fg) { this.img = bg; this.fg = fg; },

  // With a wrapping backdrop the camera is bounded by the level, not the art.
  maxCamX(level) { return Infinity; },

  // Draws `img` scrolled to worldX, repeating with every other copy mirrored.
  _wrapped(ctx, img, worldX) {
    const P = BG_W * 2;
    let sx = 0;
    let wx = ((worldX % P) + P) % P;
    while (sx < VW) {
      const second = wx >= BG_W;
      const local = second ? wx - BG_W : wx;
      const w = Math.min(BG_W - local, VW - sx);
      if (w <= 0) break;
      if (!second) {
        ctx.drawImage(img, local, BG_SRC_Y, w, VH, sx, 0, w, VH);
      } else {
        // mirrored copy: sample from the far side and flip it
        ctx.save();
        ctx.translate(sx + w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, BG_W - local - w, BG_SRC_Y, w, VH, 0, 0, w, VH);
        ctx.restore();
      }
      sx += w;
      wx = (wx + w) % P;
    }
  },

  draw(ctx, camX, level) {
    this._wrapped(ctx, this.img, Math.round(camX + (level.bgX || 0)));

    if (level.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = level.tint;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
  },

  // Called after the actors so kerbside props occlude them.
  drawForeground(ctx, camX, level) {
    if (!this.fg) return;
    this._wrapped(ctx, this.fg, Math.round(camX + (level.bgX || 0)));
  },

  // Colour grade over everything, so actors sit in the same light.
  drawGrade(ctx, level) {
    if (!level.grade) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = level.grade;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  },

  drawBeltDebug(ctx) {
    ctx.strokeStyle = 'rgba(255,0,128,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, BELT_TOP + 0.5); ctx.lineTo(VW, BELT_TOP + 0.5);
    ctx.moveTo(0, BELT_BOTTOM + 0.5); ctx.lineTo(VW, BELT_BOTTOM + 0.5);
    ctx.stroke();
  },
};
