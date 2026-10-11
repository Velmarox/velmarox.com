// ---------------------------------------------------------------------------
// Belt-scroll actor base.
//
// Coordinate system (classic Final Fight style, no perspective scaling):
//   x  world horizontal, in pixels
//   z  depth along the walkable belt, 0 (far) .. BELT_DEPTH (near)
//   y  height above the belt; 0 = feet down
//
// screenY = BELT_TOP + z - y, so walking "down" moves you toward the camera
// and jumping lifts you off your own shadow.
// ---------------------------------------------------------------------------

// 384x216 keeps Animal at ~22% of screen height, which is the proportion
// Final Fight / Streets of Rage used. Bigger viewport made him look tiny
// against this tileset, which is drawn fairly large.
const VW = 384, VH = 216;

// The backdrop's sidewalk far edge sits at screen y 122 (measured off the
// art). The belt runs from there down onto the road - stopping at the kerb
// left a third of the screen as dead space below the fight, so the invisible
// wall now sits almost at the bottom edge. Street brawlers fight in the
// street.
const BELT_TOP = 122;
const BELT_DEPTH = 84;
const BELT_BOTTOM = BELT_TOP + BELT_DEPTH;   // 206 of 216

const GRAVITY = 0.42;

// Default playback speed (ticks per frame) and looping per animation.
const ANIM_DEF = {
  idle:          { t: 10, loop: true },
  stance:        { t: 6,  loop: true },
  walk:          { t: 5,  loop: true },
  run:           { t: 4,  loop: true },
  punch:         { t: 4,  loop: false },
  kick:          { t: 4,  loop: false },
  spinkick:      { t: 3,  loop: false },
  punch_low:     { t: 5,  loop: false },
  crouch:        { t: 3,  loop: false },
  crouch_stance: { t: 7,  loop: true },
  jump:          { t: 4,  loop: false },
  hurt:          { t: 4,  loop: false },
  stunned:       { t: 6,  loop: true },
  death:         { t: 5,  loop: false },
  getup:         { t: 5,  loop: false },
};

class Actor {
  constructor(skin, x, z) {
    this.skin = skin;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.facing = 1;
    this.hp = 30; this.maxhp = 30;
    this.dead = false;
    this.removeMe = false;

    this.state = 'idle';
    this.stateT = 0;

    this.anim = 'idle';
    this.frame = 0;
    this.animT = 0;
    this.animDur = null;     // per-frame ticks, or null for the anim default
    this.animLoop = true;
    this.animDone = false;

    this.hurtT = 0;          // white-flash timer after taking a hit
    this.invuln = 0;
    this.bodyW = 16;         // hurtbox width
    this.bodyH = 44;
    this.recentHits = [];    // tick stamps of recent hits: dizzy / pile-on logic
  }

  // ---- animation -------------------------------------------------------
  setAnim(key, opts) {
    opts = opts || {};
    if (this.anim === key && !opts.restart) return;
    this.anim = key;
    this.frame = 0;
    this.animT = 0;
    this.animDone = false;
    this.animDur = opts.dur || null;
    this.animLoop = opts.loop !== undefined ? opts.loop : ANIM_DEF[key].loop;
  }

  frameTicks() {
    if (this.animDur) return this.animDur[Math.min(this.frame, this.animDur.length - 1)];
    return ANIM_DEF[this.anim].t;
  }

  advanceAnim() {
    const n = this.animMeta().frames;
    this.animT++;
    if (this.animT >= this.frameTicks()) {
      this.animT = 0;
      if (this.frame < n - 1) {
        this.frame++;
      } else if (this.animLoop) {
        this.frame = 0;
      } else {
        this.animDone = true;
      }
    }
  }

  setState(s) { this.state = s; this.stateT = 0; }

  // Frame geometry for the current animation. Enemy skins carry their own
  // (SKIN_ANIM) because their sheets are nothing like Animal's; his stay in
  // the global ANIM table.
  animMeta() {
    const per = typeof SKIN_ANIM !== 'undefined' && SKIN_ANIM[this.skin];
    return (per && per[this.anim]) || ANIM[this.anim];
  }

  // ---- physics ---------------------------------------------------------
  integrate(bounds) {
    this.x += this.vx;
    this.z += this.vz;
    if (this.y > 0 || this.vy !== 0) {
      this.y += this.vy;
      this.vy -= GRAVITY;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onLand && this.onLand(); }
    }
    this.z = Math.max(0, Math.min(BELT_DEPTH, this.z));
    if (bounds) this.x = Math.max(bounds[0], Math.min(bounds[1], this.x));
  }

  get screenY() { return BELT_TOP + this.z - this.y; }

  // ---- combat geometry -------------------------------------------------
  hurtbox() {
    return {
      x0: this.x - this.bodyW / 2, x1: this.x + this.bodyW / 2,
      z: this.z, y: this.y, h: this.bodyH,
    };
  }

  // Hitbox for the currently active attack frame, or null.
  activeHitbox(move) {
    if (!move || !move.hit) return null;
    if (!move.hit.frames.includes(this.frame)) return null;
    const h = move.hit;
    const front = this.x + this.facing * h.x;
    return {
      x0: Math.min(front, front + this.facing * h.w),
      x1: Math.max(front, front + this.facing * h.w),
      z: this.z, zt: h.zt, y: this.y, spec: h,
    };
  }

  // ---- drawing ---------------------------------------------------------
  drawShadow(ctx, camX) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(BELT_TOP + this.z);
    const lift = Math.min(1, this.y / 40);
    const w = (this.bodyW * 0.85) * (1 - lift * 0.35);
    const h = Math.max(1.5, 3.2 * (1 - lift * 0.3));
    ctx.fillStyle = `rgba(0,0,0,${0.34 * (1 - lift * 0.45)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, w / 2, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx, camX) {
    const a = this.animMeta();
    const img = SHEETS[this.skin][this.anim];
    if (!img) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.screenY);
    const flashing = this.hurtT > 0 && (this.hurtT % 4) < 2;

    ctx.save();
    ctx.translate(sx, sy);
    if (this.facing < 0) ctx.scale(-1, 1);

    if (flashing) {
      // Tint in an offscreen buffer. Doing 'source-atop' straight onto the
      // main canvas clips against the whole opaque backdrop instead of the
      // sprite, which paints a white block over the scene.
      ctx.drawImage(tintFrame(img, this.frame, a),
                    0, 0, a.fw, a.fh, -a.ax, -a.ay, a.fw, a.fh);
    } else {
      ctx.drawImage(img, this.frame * a.fw, 0, a.fw, a.fh, -a.ax, -a.ay, a.fw, a.fh);
    }
    ctx.restore();
  }
}

// Scratch buffer for the white hit-flash. Reused every frame; sized to the
// largest sprite cell once and left alone after that.
const _tintCv = document.createElement('canvas');
_tintCv.width = 64; _tintCv.height = 64;
const _tintCx = _tintCv.getContext('2d');
_tintCx.imageSmoothingEnabled = false;

function tintFrame(img, frame, a) {
  if (_tintCv.width < a.fw || _tintCv.height < a.fh) {
    _tintCv.width = Math.max(_tintCv.width, a.fw);
    _tintCv.height = Math.max(_tintCv.height, a.fh);
    _tintCx.imageSmoothingEnabled = false;
  }
  _tintCx.globalCompositeOperation = 'source-over';
  _tintCx.clearRect(0, 0, _tintCv.width, _tintCv.height);
  _tintCx.drawImage(img, frame * a.fw, 0, a.fw, a.fh, 0, 0, a.fw, a.fh);
  _tintCx.globalCompositeOperation = 'source-atop';
  _tintCx.fillStyle = 'rgba(255,255,255,0.8)';
  _tintCx.fillRect(0, 0, a.fw, a.fh);
  _tintCx.globalCompositeOperation = 'source-over';
  return _tintCv;
}

// Depth overlap test used for every hit and for body pushing.
function zNear(a, b, tol) { return Math.abs(a.z - b.z) <= tol; }

function boxesOverlap(hb, hurt) {
  if (hb.x1 < hurt.x0 || hb.x0 > hurt.x1) return false;
  if (Math.abs(hb.z - hurt.z) > hb.zt) return false;
  // vertical: attacker and target must share some height
  return Math.abs(hb.y - hurt.y) < 34;
}
