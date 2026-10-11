// ---------------------------------------------------------------------------
// Enemies.
//
// Two things make a brawler crowd feel fair rather than cheap:
//   1. ATTACK TOKENS - only a couple of enemies may commit to an attack at
//      once. The rest circle. Without this, four enemies all swing at the same
//      frame and the fight becomes unreadable.
//   2. TELEGRAPHS - every attack has a windup during which the enemy is
//      visibly wound up and stationary. Longer windup = heavier enemy.
// ---------------------------------------------------------------------------

// BALANCE NOTE. The first pass was too soft: a dumb bot that never blocked or
// spaced could finish all three rounds without losing a single life. The
// windups were the main culprit - 22 ticks (0.37s) for a punk meant you could
// watch it decide to punch and stroll away. These are tightened to the point
// where the telegraph is still readable but you have to actually react, and
// the recovery is short enough that they come back at you.
//
// Difficulty comes from pressure and timing, NOT from HP bloat - damage
// sponges are tedious, not hard. HP is unchanged; aggression is not.
const ENEMY_TYPES = {
  // DAMAGE PASS. Raised 1.5x once the spin kick stopped being free off the
  // punch button. Measured: bumping damage on its own barely moved anything
  // (a masher went from 0.1 deaths a run to 0.8) because the problem was never
  // how hard they hit - it was that they almost never got to swing. With the
  // finisher gated behind a deliberate heavy they do get to swing, and this is
  // what makes each one land properly. Past ~1.5x the returns flatten off.
  punk: {
    skin: 'renegade', hp: 26, spd: 0.98, spdz: 0.68, atk: 'punch',
    windup: 13, recover: 15, dmg: 12, kbx: 1.5, reach: 26, score: 100,
    dizzyHits: 3, knockResist: 0,
  },
  bruiser: {
    skin: 'soldier', hp: 54, spd: 0.72, spdz: 0.46, atk: 'kick',
    windup: 24, recover: 20, dmg: 23, kbx: 2.0, reach: 29, score: 250,
    dizzyHits: 5, knockResist: 0.65, bodyW: 19,
  },
  runner: {
    skin: 'hood', hp: 18, spd: 1.45, spdz: 1.05, atk: 'punch',
    windup: 9, recover: 20, dmg: 11, kbx: 1.3, reach: 24, score: 150,
    dizzyHits: 2, knockResist: 0, backoff: 22,
  },

  // THE BOSS. Slow, enormous reach, and he does not flinch: knockResist 1 means
  // the heavy attack can never knock him down, so the crowd-control answer that
  // works on a bruiser does nothing here and the fight has to be won on spacing
  // and the punish window after his haymaker. He still dizzies - eight hits
  // inside the window instead of five - which is the only way to get a free run
  // at him. HP is high because he is the last thing in the game, but the damage
  // is what actually threatens you: 26 is over a quarter of Animal's bar.
  boss: {
    skin: 'brute', hp: 460, spd: 0.60, spdz: 0.40, atk: 'haymaker',
    windup: 34, recover: 30, dmg: 26, kbx: 2.8, reach: 44, score: 5000,
    dizzyHits: 8, knockResist: 1, poise: true, bodyW: 30, bodyH: 78,
    boss: true, name: 'JOSH BENSON',
  },
};

// Enemy attacks, timed to the extracted sheets. Both sheets are guard-first,
// so frame 0 is the arm still cocked and every active frame is a pose that
// visibly reaches: punch is guard-extend-recover (active on the extension),
// kick is guard-extend-followthrough (active on both extended frames).
const ENEMY_MOVES = {
  punch: { anim: 'punch', dur: [5, 6, 5], drift: [0, 0.7, 0],   frames: [1], w: 18 },
  kick:  { anim: 'kick',  dur: [5, 6, 6], drift: [0, 0.8, 0.2], frames: [1, 2], w: 20 },
  // The boss's charged haymaker: three frames of the fist visibly winding up
  // and glowing before anything is active, then one frame that hits like a
  // truck, then a long recovery. That shape IS the fight - the telegraph is
  // enormous and completely uncancellable, so every opening you get is one he
  // handed you. x/zt override the defaults because he is twice everyone's size
  // and a hitbox scaled for a punk would look like it missed by a mile.
  haymaker: {
    anim: 'punch',
    dur:   [7, 8, 8, 5, 10, 9],
    drift: [0, 0, 0, 1.4, 2.6, 0],
    frames: [4], w: 34, x: 22, zt: 19,
  },
};

let _eid = 0;

class Enemy extends Actor {
  constructor(typeKey, x, z) {
    const t = ENEMY_TYPES[typeKey];
    super(t.skin, x, z);
    this.id = ++_eid;
    this.typeKey = typeKey;
    this.t = t;
    this.hp = t.hp; this.maxhp = t.hp;
    this.bodyW = t.bodyW || 16; this.bodyH = t.bodyH || 44;

    const m = ENEMY_MOVES[t.atk] || ENEMY_MOVES.kick;
    this.move = {
      anim: m.anim,
      dur: m.dur,
      drift: m.drift,
      hit: {
        frames: m.frames, x: m.x || 13, w: m.w, zt: m.zt || 15,
        dmg: t.dmg, kbx: t.kbx, lift: 0, hitstop: t.boss ? 7 : 4, heavy: false,
      },
    };
    this.hitSet = new Set();

    this.hasToken = false;
    // Which side to circle to. Decided on the fly against the player's facing
    // in think(), so the crowd works both sides instead of all queueing up in
    // front of you where one combo covers everything.
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.flank = Math.random() < 0.55;
    this.zWant = z;
    this.thinkT = 0;
    this.recentHits = [];
    this.barT = 0;             // how long to keep the damage bar visible
    this.fade = 1;

    this.setState('approach');
    this.setAnim('walk');
  }

  get busy() {
    return ['windup', 'attack', 'recover', 'hurt', 'stunned', 'down', 'getup', 'dead'].includes(this.state);
  }
  get alive() { return this.state !== 'dead'; }

  update(game, player, bounds) {
    if (this.hurtT > 0) this.hurtT--;
    if (this.barT > 0) this.barT--;
    this.stateT++;

    switch (this.state) {
      case 'approach': this.think(game, player); break;
      case 'hover':    this.think(game, player); break;

      case 'windup': {
        this.vx = 0; this.vz = 0;
        this.faceToward(player);
        this.setAnim('stance');
        this.advanceAnim();
        if (this.stateT >= this.t.windup) {
          this.setState('attack');
          this.hitSet.clear();
          this.setAnim(this.move.anim, { restart: true, loop: false, dur: this.move.dur });
          Sfx.whiff();
        }
        break;
      }
      case 'attack': {
        const d = this.move.drift[Math.min(this.frame, this.move.drift.length - 1)];
        this.vx = this.facing * d;
        this.vz = 0;
        this.advanceAnim();
        if (this.animDone) { this.setState('recover'); this.setAnim('stance'); }
        break;
      }
      case 'recover': {
        this.vx *= 0.8; this.vz = 0;
        this.advanceAnim();
        if (this.stateT >= this.t.recover) {
          game.releaseToken(this);
          // runners hop back out of range after committing
          if (this.t.backoff) { this.zWant = Math.random() * BELT_DEPTH; this.side = -this.side; }
          this.setState('approach');
        }
        break;
      }
      case 'hurt': {
        this.vx *= 0.86; this.vz = 0;
        this.advanceAnim();
        if (this.animDone) { this.setState('approach'); }
        break;
      }
      case 'stunned': {
        this.vx *= 0.9; this.vz = 0;
        this.advanceAnim();
        if (this.stateT > 100) { this.recentHits.length = 0; this.setState('approach'); }
        break;
      }
      case 'down': {
        this.vx *= 0.9;
        this.advanceAnim();
        if (this.animDone && this.stateT > 40) {
          this.setState('getup');
          this.setAnim('getup', { restart: true, loop: false });
        }
        break;
      }
      case 'getup': {
        this.vx = 0;
        this.advanceAnim();
        if (this.animDone) { this.setState('approach'); this.invuln = 10; }
        break;
      }
      case 'dead': {
        this.vx *= 0.9;
        this.advanceAnim();
        if (this.stateT > 60) {
          this.fade -= 0.04;
          if (this.fade <= 0) this.removeMe = true;
        }
        break;
      }
    }

    if (this.invuln > 0) this.invuln--;
    this.integrate(bounds);
  }

  faceToward(p) { this.facing = p.x < this.x ? -1 : 1; }

  think(game, player) {
    if (!player || player.state === 'dead') {
      this.vx = 0; this.vz = 0; this.setAnim('stance'); this.advanceAnim(); return;
    }
    this.thinkT--;
    if (this.thinkT <= 0) {
      this.thinkT = 30 + Math.floor(Math.random() * 40);
      // flankers try to get behind you rather than stand where you're looking
      if (this.flank) this.side = -player.facing;
      // pick a fresh lane to sit in; slight bias toward the player's lane
      this.zWant = Math.max(0, Math.min(BELT_DEPTH,
        player.z + (Math.random() * 2 - 1) * 18));
    }

    this.faceToward(player);
    const dx = player.x - this.x;
    const adx = Math.abs(dx);
    const dz = player.z - this.z;
    const inLane = Math.abs(dz) <= 11;

    // Ask for a token from well outside striking range. The token is
    // permission to COMMIT - closing the distance and lining up the lane are
    // part of the commitment, so requiring reach/lane here would deadlock
    // against the standoff distance kept below and nobody would ever attack.
    if (!this.hasToken && adx < 150 && player.state !== 'dead') {
      game.requestToken(this);
    }

    if (this.hasToken) {
      // committed: close in on the player's lane, then swing
      const tz = player.z;
      this.vz = Math.abs(tz - this.z) > 2 ? Math.sign(tz - this.z) * this.t.spdz : 0;
      if (adx > this.t.reach) {
        this.vx = Math.sign(dx) * this.t.spd;
        this.setAnim('walk');
      } else {
        this.vx = 0;
        if (inLane) { this.setState('windup'); return; }
      }
    } else {
      // circling: crowd in closer than before, so waiting your turn still
      // feels like being surrounded rather than politely queued
      const standoff = 40 + (this.side > 0 ? 12 : 0) + (this.t.backoff || 0);
      const targetX = player.x + this.side * standoff;
      const ddx = targetX - this.x;
      this.vx = Math.abs(ddx) > 5 ? Math.sign(ddx) * this.t.spd * 0.85 : 0;
      this.vz = Math.abs(this.zWant - this.z) > 3 ? Math.sign(this.zWant - this.z) * this.t.spdz : 0;
      this.setAnim(this.vx || this.vz ? 'walk' : 'stance');
    }
    this.advanceAnim();
  }

  takeHit(spec, fromX, game) {
    if (this.state === 'dead' || this.invuln > 0) return false;
    this.hp -= spec.dmg;
    this.hurtT = 8;
    this.barT = 140;
    const dir = fromX < this.x ? 1 : -1;

    // POISE. This is what stops the game being solved by mashing. The player's
    // jab goes active in 3 ticks, faster than any enemy windup, so if every hit
    // staggered them you could stand still and cancel the entire crowd forever.
    // Once an enemy has COMMITTED - windup or swing - a light hit hurts it but
    // does not stop it. The telegraph is visible and uncancellable, so the
    // answer is to step out of the lane or spend the heavy attack, which does
    // still interrupt. Death always wins over poise.
    // The boss carries poise the whole time, not just while committed. Without
    // it his 12-tick hurt animation is shorter than the player's jab loop, so
    // you could walk up and stagger-lock 460 HP off him without ever being at
    // risk - the exact "solved by mashing" failure the poise rule exists to
    // stop, except worse because he is the last fight in the game. Heavies
    // still interrupt him, so the combo finisher is the answer.
    const committed = this.t.poise ||
                      this.state === 'windup' || this.state === 'attack';
    if (committed && !spec.heavy && this.hp > 0) {
      this.recentHits.push(game.tick);
      this.recentHits = this.recentHits.filter((t) => game.tick - t < 110);
      return true;
    }

    this.facing = -dir;
    this.move && (this.moveT = 0);

    this.recentHits.push(game.tick);
    this.recentHits = this.recentHits.filter((t) => game.tick - t < 110);

    if (this.hp <= 0) {
      this.hp = 0;
      game.releaseToken(this);
      this.setState('dead');
      this.setAnim('death', { restart: true, loop: false });
      this.vx = dir * (spec.kbx * 0.9 + 1.0);
      this.vy = 2.6; this.y = 0.01;
      Sfx.ko();
      Fx.shake(3.0, 14);
      game.onEnemyKilled(this);
      return true;
    }

    const resist = this.t.knockResist;
    const knockDown = spec.heavy && Math.random() >= resist;

    if (knockDown) {
      game.releaseToken(this);
      this.setState('down');
      this.setAnim('death', { restart: true, loop: false });
      this.vx = dir * spec.kbx;
      this.vy = spec.lift || 2.4; this.y = 0.01;
    } else if (this.recentHits.length >= this.t.dizzyHits) {
      game.releaseToken(this);
      this.recentHits.length = 0;
      this.setState('stunned');
      this.setAnim('stunned', { restart: true });
      this.vx = dir * spec.kbx * 0.4;
    } else {
      // hand the token back so a different enemy gets to press the attack
      // while this one is recovering - keeps the crowd feeling alive
      game.releaseToken(this);
      this.setState('hurt');
      this.setAnim('hurt', { restart: true, loop: false });
      this.vx = dir * spec.kbx * (1 - resist * 0.6);
    }
    return true;
  }

  draw(ctx, camX) {
    if (this.fade < 1) ctx.globalAlpha = Math.max(0, this.fade);
    super.draw(ctx, camX);
    ctx.globalAlpha = 1;

    // small damage bar, only while recently hit - keeps the screen quiet.
    // The boss is exempt: his health is the big bar across the top, and a
    // second little one bobbing over his head just reads as a mistake.
    if (!this.t.boss && this.barT > 0 && this.state !== 'dead' && this.hp < this.maxhp) {
      const w = 22;
      const sx = Math.round(this.x - camX - w / 2);
      const sy = Math.round(this.screenY - this.bodyH - 9);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - 1, sy - 1, w + 2, 4);
      ctx.fillStyle = '#c4302b';
      ctx.fillRect(sx, sy, Math.max(0, Math.round(w * this.hp / this.maxhp)), 2);
    }
    // Dizzy marker is baked into the stunned sheet - make_enemies.py draws the
    // orbiting stars on. The packs' daze frames are just a limp stand, which
    // is unreadable when it is the window you are meant to punish.
  }
}
