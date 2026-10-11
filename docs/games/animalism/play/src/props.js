// ---------------------------------------------------------------------------
// Breakable street props, and the pickups they drop.
//
// Props don't block movement - Final Fight's barrels didn't either, and solid
// scenery on a belt turns into a pathing problem for no gain. They exist to
// give you something to hit on the way to the next fight, and to hand back a
// little health for doing it.
//
// Art is pulled from the urban tileset by tools/make_props.py, halved to match
// the backdrop scale. Debris takes each prop's own dominant colours, so a
// smashed bin throws bin-coloured bits.
// ---------------------------------------------------------------------------

// Cell grid of assets/props/props.png: one ROW per prop type, column 0 is the
// intact sprite and the rest are its destruction frames. Built by
// tools/make_props.py from the supplied destructibles sheet at NATIVE scale
// (halving made them toy-sized). Signs/signposts and the chest are excluded.
// Sizes are honest now: the source sheet had stray pixels far from the art
// that inflated getbbox(), which floated sprites off their baselines and
// detached the shadows. make_props.py takes a robust bbox and scales 2x.
const PROP_CELL = { w: 84, h: 66, cols: 5 };
const PROP_DEFS = [
  { name: 'barrel',   row: 0, w: 28, h: 32, hp: 1, breaks: 4 },
  { name: 'crate',    row: 1, w: 26, h: 32, hp: 1, breaks: 4 },
  { name: 'stone',    row: 2, w: 22, h: 22, hp: 2, breaks: 4 },
];
const BREAK_TICKS = 4;         // ticks per destruction frame
const PROP_BY_NAME = {};
for (const d of PROP_DEFS) PROP_BY_NAME[d.name] = d;

const PROP_SCORE = 50;
const DROP_HEAL = 15;

// What a smashed prop leaves behind. Weighted so health is common and the two
// power-ups are a treat rather than a given.
//
// Django is the 1UP, and the only way to get one - lives are never awarded on
// score. That makes him the rarest thing in the game on purpose: a run's worth
// of extra lives has to be found in the street, not accumulated by grinding
// bins for points. At 0.015 you smash roughly seventy props per Django.
const DROP_TABLE = [
  { kind: 'health', p: 0.34 },
  { kind: 'grippy', p: 0.13 },
  { kind: 'django', p: 0.015 },
];

const POWERUP_CELL = { w: 21, h: 20 };
const POWERUP_INDEX = { grippy: 0, django: 1 };

const GRIPPY_TICKS = 600;      // 10s of heavier hands
const GRIPPY_MULT = 1.7;

// Shown over Animal's head the FIRST time each pickup type is collected in a
// run - the game never explains items in text anywhere else, so the one-time
// note is the whole tutorial.
const PICKUP_NOTES = {
  health: ['HEALTH', '+15 HP'],
  grippy: ['IRON GRIP', '1.7X DAMAGE FOR 10 SECONDS'],
  // kept to ~30 characters: game.js clamps this note to 76px either side of
  // Animal so it stays on screen at the level edges
  django: ['DJANGO', '1UP - AND EVERY DUDE GOES DOWN'],
};

let propSheet = null;
let powerupSheet = null;
function initProps(img, puImg) { propSheet = img; powerupSheet = puImg; }

function rollDrop() {
  let r = Math.random();
  for (const d of DROP_TABLE) {
    if (r < d.p) return d.kind;
    r -= d.p;
  }
  return null;
}

class Prop {
  constructor(name, x, z) {
    const d = PROP_BY_NAME[name] || PROP_DEFS[0];
    this.d = d;
    this.x = x;
    this.z = z;
    this.hp = d.hp;
    this.dead = false;        // true once the break animation has finished
    this.breaking = false;
    this.bf = 0;              // break frame
    this.bt = 0;
    this.hitT = 0;
    this.shakeT = 0;
  }

  // Still occupies space (and is drawn) while the break plays out.
  get gone() { return this.dead; }
  get hittable() { return !this.breaking && !this.dead; }

  get screenY() { return BELT_TOP + this.z; }

  // Generous on purpose: these are scenery, and whiffing on a bin feels bad.
  hurtbox() {
    const w = this.d.w + 6;
    return { x0: this.x - w / 2, x1: this.x + w / 2, z: this.z, y: 0, h: this.d.h };
  }

  hit(spec, game) {
    if (!this.hittable) return false;
    this.hp -= 1;
    this.hitT = 6;
    this.shakeT = 8;
    if (this.hp > 0) {
      Sfx.propHit();
      return true;
    }
    // Play the artist's destruction frames rather than just throwing particles.
    this.breaking = true;
    this.bf = 0;
    this.bt = 0;
    game.score += PROP_SCORE;
    Sfx.propBreak();
    Fx.shake(1.8, 7);
    const kind = rollDrop();
    if (kind) game.pickups.push(new Pickup(this.x, this.z, kind));
    return true;
  }

  update() {
    if (this.hitT > 0) this.hitT--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.breaking) {
      this.bt++;
      if (this.bt >= BREAK_TICKS) {
        this.bt = 0;
        this.bf++;
        if (this.bf >= this.d.breaks) { this.breaking = false; this.dead = true; }
      }
    }
  }

  draw(ctx, camX) {
    if (this.dead || !propSheet) return;
    const d = this.d;
    const col = this.breaking ? 1 + this.bf : 0;
    const jitter = this.shakeT > 0 ? (this.shakeT % 2 ? 1 : -1) : 0;
    // Whole cells are blitted while breaking, because the debris frames are
    // wider than the intact sprite and would otherwise be clipped.
    const cw = PROP_CELL.w, ch = PROP_CELL.h;
    const sx = Math.round(this.x - camX - cw / 2) + jitter;
    const sy = Math.round(this.screenY - ch);
    ctx.drawImage(propSheet, col * cw, d.row * ch, cw, ch, sx, sy, cw, ch);
    if (this.hitT > 3 && !this.breaking) {
      // flash only the intact silhouette
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(this.x - camX - d.w / 2) + jitter,
                   Math.round(this.screenY - d.h), d.w, d.h);
      ctx.globalAlpha = 1;
    }
  }

  drawShadow(ctx, camX) {
    if (this.dead || this.breaking) return;
    // Sized to the sprite's actual footprint and nudged a pixel below the
    // baseline, same treatment as the actors - the old one was a sliver
    // floating at the barrel's midline once the art got bigger.
    const sx = Math.round(this.x - camX);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(sx, Math.round(this.screenY) + 1, this.d.w * 0.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Health drop. Drawn rather than spritesheeted - it's a 9x8 box, art would be
// more trouble than it's worth.
// ---------------------------------------------------------------------------
class Pickup {
  constructor(x, z, kind) {
    this.x = x; this.z = z;
    this.kind = kind || 'health';
    this.power = this.kind !== 'health';
    this.y = 12; this.vy = 1.7;
    this.landed = false;
    this.life = this.power ? 780 : 600;
    this.dead = false;
    this.t = Math.random() * 100;
  }

  // Power-ups hover above the ground and bob; health just drops and sits.
  get hover() { return this.power && this.landed ? 12 + Math.sin(this.t / 11) * 2.5 : 0; }
  get screenY() { return BELT_TOP + this.z - this.y - this.hover; }

  update(player, game) {
    this.t++;
    if (!this.landed) {
      this.y += this.vy;
      this.vy -= 0.28;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.landed = true; }
    }
    this.life--;
    if (this.life <= 0) { this.dead = true; return; }
    if (!player || player.state === 'dead') return;
    const reach = this.power ? 16 : 14;
    if (Math.abs(player.x - this.x) < reach && Math.abs(player.z - this.z) < 13 && player.y < 34) {
      this.dead = true;
      this.collect(player, game);
    }
  }

  collect(player, game) {
    // first time this run: stat note over his head
    if (!game.seenPickups[this.kind]) {
      game.seenPickups[this.kind] = true;
      game.statNote = { lines: PICKUP_NOTES[this.kind] || [this.kind.toUpperCase()], t: 160 };
    }
    if (this.kind === 'health') {
      const before = player.hp;
      player.hp = Math.min(player.maxhp, player.hp + DROP_HEAL);
      Fx.popup(this.x, this.screenY - 14, '+' + (player.hp - before), '#8dffa4');
      Sfx.pickup();
      return;
    }
    if (this.kind === 'grippy') {
      // heavier hands for a while - the whole point of a grip trainer
      player.grippyT = GRIPPY_TICKS;
      Fx.popup(this.x, this.screenY - 16, 'IRON GRIP!', '#ffe15a');
      Fx.shake(1.6, 8);
      Sfx.powerUp();
      return;
    }
    if (this.kind === 'django') {
      // Django turns up: the 1UP, and every man on the street goes down.
      let n = 0;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        game.releaseToken(e);
        e.setState('down');
        e.setAnim('death', { restart: true, loop: false });
        e.vx = (e.x < player.x ? -1 : 1) * 2.4;
        e.vy = 2.6; e.y = 0.01;
        e.hp = Math.max(1, e.hp - 8);
        e.barT = 140;
        n++;
      }
      player.lives = Math.min(MAX_LIVES, player.lives + 1);
      player.invuln = Math.max(player.invuln, 70);
      Fx.popup(player.x, player.screenY - 54, '1UP!', '#8dffa4');
      Fx.shake(4.2, 20);
      Fx.flash = 4;
      Sfx.powerUp();
      Sfx.bigHit();
      // The banner is the point of finding one - it says hi every time now,
      // whether or not there was anybody standing to knock down.
      game.banner('DJANGO SAYS HI', n > 0 ? n + ' DOWN  -  1UP' : '1UP', 190);
    }
  }

  draw(ctx, camX) {
    if (this.dead) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.screenY);
    if (this.life < 90 && (this.life % 8) < 4) return;     // blink before expiring

    if (!this.power) {
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(sx - 5, sy - 8, 10, 8);
      ctx.fillStyle = '#8dffa4';
      ctx.fillRect(sx - 4, sy - 7, 8, 6);
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(sx - 1, sy - 6, 2, 4);
      ctx.fillRect(sx - 3, sy - 5, 6, 2);
      return;
    }

    const c = POWERUP_CELL;
    const i = POWERUP_INDEX[this.kind] || 0;
    // faint halo so a floating item reads against a busy street
    ctx.fillStyle = this.kind === 'grippy' ? 'rgba(255,225,90,0.16)' : 'rgba(255,180,90,0.16)';
    ctx.beginPath();
    ctx.ellipse(sx, sy - c.h / 2, c.w * 0.62, c.h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    if (powerupSheet) {
      ctx.drawImage(powerupSheet, i * c.w, 0, c.w, c.h,
                    sx - (c.w >> 1), sy - c.h, c.w, c.h);
    }
    // shadow on the ground it's floating over
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, Math.round(BELT_TOP + this.z), 5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
