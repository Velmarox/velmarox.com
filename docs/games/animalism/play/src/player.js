// ---------------------------------------------------------------------------
// Animal - the player.
//
// States: idle walk run crouch_in crouch attack jump hurt down getup dead
// ---------------------------------------------------------------------------

const WALK_SPD = 1.5;
const WALK_SPD_Z = 1.05;
const RUN_SPD = 2.65;
const JUMP_VY = 6.2;
const DBLTAP_WINDOW = 14;      // ticks to register a run

// ---------------------------------------------------------------------------
// Blocking.
//
// Its own held button rather than "hold back", because back is how you walk
// away on a belt and the two would fight each other constantly.
//
// A blocked hit costs you BLOCK_CHIP of its damage and nothing else: no hurt
// animation, no knockdown, no pile-on counter.
//
// You CAN punish straight out of the guard - the attack check runs before this
// one and block is not `busy` - but the instant you swing you are in 'attack'
// and not guarding, so it is a real trade rather than a free one. That plus
// chip damage is what stops turtling: standing still behind the guard loses on
// a long enough timer, and against the boss, who has poise and cannot be
// stagger-locked, choosing when to drop it is the whole fight.
//
// Only from the front. Getting hit in the back while guarding is a full hit,
// which is what keeps a crowd dangerous even when you are holding block.
const BLOCK_CHIP = 0.22;
const BLOCK_PUSH = 0.35;       // fraction of the hit's knockback still applied

// Lives are awarded by exactly one thing - finding a Django - and never by
// score, so there is no threshold to grind toward and no way to bank a stack
// of revives by farming bins. The ceiling only has to cover a very lucky run;
// the HUD draws a pip per life from x132 and runs out of room around ten.
const START_LIVES = 3;
const MAX_LIVES = 9;

class Player extends Actor {
  constructor(x, z) {
    super('animal', x, z);
    this.maxhp = 100; this.hp = 100;
    this.lives = START_LIVES;
    this.score = 0;
    this.bodyW = 17; this.bodyH = 46;

    this.move = null;           // active move from MOVES
    this.moveKey = null;
    this.moveT = 0;             // ticks since move started
    this.comboQueued = null;      // move key the next link should start, or null
    this.hitSet = new Set();

    this.tapDir = 0; this.tapT = 0; this.running = false;
    this.stepPhase = -1;
    this.respawnT = 0;
    this.grippyT = 0;          // Iron Grip damage boost, in ticks
  }

  get dmgMult() { return this.grippyT > 0 ? GRIPPY_MULT : 1; }

  get busy() {
    return this.state === 'attack' || this.state === 'hurt' ||
           this.state === 'down' || this.state === 'getup' || this.state === 'dead';
  }

  // ---- input -----------------------------------------------------------
  handleInput() {
    const I = Input;

    // ---- attacks ----
    if (I.pressed.light || I.pressed.heavy) {
      const heavy = I.pressed.heavy;
      if (this.state === 'attack') {
        // Buffer the next link if we're past this move's cancel point. WHICH
        // button was pressed is what picks the link, so the third input decides
        // between the standing kick and the spin kick.
        if (this.move.cancel >= 0 && this.moveT >= this.move.cancel) {
          const link = heavy ? this.move.onHeavy : this.move.onLight;
          if (link) this.comboQueued = link;
        }
      } else if (this.y > 0) {
        this.startMove('air');
      } else if (this.state === 'crouch' || this.state === 'crouch_in') {
        this.startMove('low');
      } else if (!this.busy) {
        // Heavy from neutral is the standing kick, never the spin kick - that
        // one has to be earned off the end of the jab chain.
        this.startMove(heavy ? 'kick' : 'light');
      }
    }

    // ---- jump ----
    if (I.pressed.jump && !this.busy && this.y === 0) {
      this.vy = JUMP_VY;
      this.y = 0.01;
      this.setState('jump');
      this.setAnim('jump', { restart: true, loop: false });
      Sfx.jump();
      Fx.dust(this.x, BELT_TOP + this.z, this.facing);
    }

    if (this.busy || this.y > 0) return;

    // ---- block: held, grounded, and it beats crouch to the punch ----
    // Turning is still allowed while guarding - left/right swing his facing
    // without moving him - because a belt puts enemies on both sides and
    // having to drop the guard to turn round would make it useless in a crowd.
    if (I.held.block) {
      if (this.state !== 'block') {
        this.setState('block');
        // Held on one frame, not looped. stance IS his near-a-threat idle, so
        // the breathing loop would look identical to just standing there;
        // frozen on the tightest guard frame it reads as braced.
        this.setAnim('stance', { restart: true, loop: false });
        this.frame = 1;
      }
      if (I.held.left) this.facing = -1;
      if (I.held.right) this.facing = 1;
      // vx is left alone and decayed in the update switch instead. Zeroing it
      // here would wipe the shove takeHit puts on a guarded hit before it ever
      // reached integrate(), and blocking a haymaker would move him not at all.
      this.vz = 0;
      return;
    }
    if (this.state === 'block') this.setState('idle');

    // ---- crouch: its own button (Shift/C, pad B) - Down is pure movement ----
    if (I.held.crouch) {
      if (this.state !== 'crouch' && this.state !== 'crouch_in') {
        this.setState('crouch_in');
        this.setAnim('crouch', { restart: true, loop: false });
      }
      this.vx = 0; this.vz = 0;
      return;
    }
    if (this.state === 'crouch' || this.state === 'crouch_in') this.setState('idle');

    // ---- run detection (double tap) ----
    let dir = 0;
    if (I.held.left) dir = -1;
    if (I.held.right) dir = 1;
    if (I.pressed.left || I.pressed.right) {
      const d = I.pressed.right ? 1 : -1;
      if (this.tapDir === d && this.tapT > 0) this.running = true;
      else { this.tapDir = d; this.tapT = DBLTAP_WINDOW; }
    }
    if (this.tapT > 0) this.tapT--;
    if (dir === 0 || (this.running && dir !== this.tapDir)) this.running = false;

    // ---- move ----
    let dz = 0;
    if (I.held.up) dz -= 1;
    if (I.held.down) dz += 1;

    const spd = this.running ? RUN_SPD : WALK_SPD;
    this.vx = dir * spd;
    this.vz = this.running ? 0 : dz * WALK_SPD_Z;   // can't change lane at a sprint
    if (dir !== 0) this.facing = dir;

    if (dir !== 0 || dz !== 0) {
      this.setState(this.running ? 'run' : 'walk');
      this.setAnim(this.running ? 'run' : 'walk');
    } else {
      this.setState('idle');
      this.setAnim(this.nearThreat ? 'stance' : 'idle');
    }
  }

  startMove(key) {
    const m = MOVES[key];
    this.move = m; this.moveKey = key; this.moveT = 0;
    this.comboQueued = null;
    this.hitSet.clear();
    this.setState('attack');
    this.setAnim(m.anim, { restart: true, loop: false, dur: m.dur });
    if (m.sfx === 'whiff_heavy') Sfx.whiffHeavy(); else Sfx.whiff();
    if (this.y === 0) { this.vx = 0; this.vz = 0; }
  }

  // ---- per-tick --------------------------------------------------------
  update(bounds, threatNear) {
    this.nearThreat = threatNear;
    if (this.hurtT > 0) this.hurtT--;
    if (this.invuln > 0) this.invuln--;
    if (this.grippyT > 0) this.grippyT--;
    this.stateT++;

    if (this.state === 'dead') {
      this.advanceAnim();
      this.vx *= 0.86;
      this.integrate(bounds);
      return;
    }

    this.handleInput();

    switch (this.state) {
      case 'attack': {
        this.moveT++;
        const d = this.move.drift;
        const drift = d ? d[Math.min(this.frame, d.length - 1)] : 0;
        if (this.y === 0) this.vx = this.facing * drift;
        this.advanceAnim();
        if (this.animDone) {
          if (this.comboQueued) {
            this.startMove(this.comboQueued);
          } else {
            this.move = null; this.moveKey = null;
            this.setState(this.y > 0 ? 'jump' : 'idle');
            if (this.y > 0) this.setAnim('jump', { loop: false });
          }
        }
        break;
      }
      case 'jump':
        // hold the airborne frame rather than finishing the animation early
        if (this.frame < 3) this.advanceAnim();
        else if (this.vy < -1 && this.frame < ANIM.jump.frames - 1) this.advanceAnim();
        break;
      case 'crouch_in':
        this.advanceAnim();
        if (this.animDone) { this.setState('crouch'); this.setAnim('crouch_stance'); }
        break;
      case 'crouch':
        this.advanceAnim();
        break;
      case 'block':
        // deliberately no advanceAnim - the guard frame is held, see handleInput
        this.vx *= 0.78;
        this.vz = 0;
        break;
      case 'hurt':
        this.vx *= 0.88;
        this.advanceAnim();
        if (this.animDone) { this.setState('idle'); this.invuln = 14; }
        break;
      case 'down':
        this.vx *= 0.90;
        this.advanceAnim();
        if (this.animDone && this.stateT > 34) {
          this.setState('getup');
          this.setAnim('getup', { restart: true, loop: false });
        }
        break;
      case 'getup':
        this.vx = 0;
        this.advanceAnim();
        if (this.animDone) { this.setState('idle'); this.invuln = 40; }
        break;
      default:
        this.advanceAnim();
        // footstep dust on the two contact frames of the walk/run cycle
        if ((this.state === 'walk' || this.state === 'run')) {
          const contact = (this.frame === 1 || this.frame === 4);
          if (contact && this.stepPhase !== this.frame) {
            this.stepPhase = this.frame;
            Fx.dust(this.x, BELT_TOP + this.z, this.facing);
            Sfx.step();
          } else if (!contact) this.stepPhase = -1;
        }
        break;
    }

    this.integrate(bounds);
  }

  onLand() {
    if (this.state === 'jump' || this.state === 'attack') {
      if (this.state === 'jump') { this.setState('idle'); }
      Sfx.land();
      Fx.dust(this.x, BELT_TOP + this.z, this.facing);
    }
  }

  // ---- damage ----------------------------------------------------------
  takeHit(spec, fromX) {
    if (this.invuln > 0 || this.state === 'down' || this.state === 'getup' || this.state === 'dead') return false;

    // ---- guard ----
    // Only counts if it came at the front. `fromX` is the attacker, so the hit
    // is frontal when the attacker sits on the side he is already facing.
    const frontal = (fromX >= this.x) === (this.facing > 0);
    if (this.state === 'block' && frontal) {
      const chip = Math.max(1, Math.round(spec.dmg * BLOCK_CHIP));
      this.hp -= chip;
      this.hurtT = 5;
      this.vx = (fromX < this.x ? 1 : -1) * spec.kbx * BLOCK_PUSH;
      Sfx.block();
      Fx.guard(this.x + this.facing * 9, this.screenY - 26);
      Fx.shake(1.1, 5);
      if (this.hp <= 0) { this.hp = 0; this.die(); }
      return true;
    }

    this.hp -= spec.dmg;
    this.hurtT = 10;
    const dir = fromX < this.x ? 1 : -1;
    this.facing = -dir;
    Sfx.hurt();
    Fx.shake(2.2, 8);

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }

    // Two enemies standing on either side can otherwise trade hits forever and
    // the hurt animation never lets go of control. The third hit in quick
    // succession always knocks him down, and getup grants invulnerability, so
    // there is a guaranteed way out of any pile-on.
    this.recentHits.push(Game.tick);
    this.recentHits = this.recentHits.filter((t) => Game.tick - t < 120);
    const pileOn = this.recentHits.length >= 3;
    if (pileOn) this.recentHits.length = 0;

    if (spec.heavy || pileOn) {
      this.vx = dir * spec.kbx * 0.8;
      this.vy = spec.lift || 2.2;
      this.y = 0.01;
      this.setState('down');
      this.setAnim('death', { restart: true, loop: false });   // doubles as knockdown
    } else {
      this.vx = dir * spec.kbx * 0.7;
      this.setState('hurt');
      this.setAnim('hurt', { restart: true, loop: false });
    }
    this.move = null;
    return true;
  }

  die() {
    this.setState('dead');
    this.setAnim('death', { restart: true, loop: false });
    this.vx = (this.facing) * -1.4;
    this.vy = 2.4; this.y = 0.01;
    this.move = null;
    Sfx.ko();
    Fx.shake(3.5, 16);
  }

  reviveAt(x, z) {
    this.hp = this.maxhp;
    this.x = x; this.z = z; this.y = 0;
    this.vx = this.vy = this.vz = 0;
    this.setState('idle');
    this.setAnim('idle', { restart: true });
    this.invuln = 90;
    this.move = null;
  }
}
