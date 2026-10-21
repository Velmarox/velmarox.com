// Touch controls for phones and tablets, held sideways. Twin-stick: a finger anywhere on the
// left half puts a move stick under it; the right half is an aim stick, and he attacks while
// it's pushed. Buttons for dash, swap and reload sit along the bottom; the abilities and
// powers sit top right, showing their cooldowns. Square, like the rest of the interface.
//
// input.js reads state() every step and take() for the one-shot presses.

import { ABILITIES, POWERS } from '../content/cards.js';

const REACH = 56;       // how far, in pixels, a stick can be pushed
const DEAD = 0.18;      // a push shorter than this share of REACH does nothing
const FIRE = 0.35;      // the aim stick attacks once pushed past this share

export function createTouchControls(host) {
  const root = document.createElement('div');
  root.id = 'touch';
  root.hidden = true;
  root.innerHTML = `
    <div class="tzone left" data-zone="move"></div>
    <div class="tzone right" data-zone="aim"></div>
    <div class="tstick move" hidden><i></i></div>
    <div class="tstick aim" hidden><i></i></div>
    <div class="tcards">
      ${[0, 1, 2].map((i) => `<button type="button" class="tbtn ability" data-press="ability" data-slot="${i}"><span></span><b></b></button>`).join('')}
      ${[0, 1, 2].map((i) => `<button type="button" class="tbtn power" data-press="power" data-slot="${i}"><span></span></button>`).join('')}
    </div>
    <div class="tbar">
      <button type="button" class="tbtn" data-press="swap">Swap</button>
      <button type="button" class="tbtn" data-press="reload">Reload</button>
      <button type="button" class="tbtn dash" data-press="dash">Dash</button>
    </div>
    <button type="button" class="tbtn pause" data-press="pause" aria-label="Pause">II</button>`;
  host.append(root);

  const sticks = {
    move: { el: root.querySelector('.tstick.move'), id: null, ox: 0, oy: 0, x: 0, y: 0 },
    aim: { el: root.querySelector('.tstick.aim'), id: null, ox: 0, oy: 0, x: 0, y: 0 },
  };
  let queued = fresh();
  let lastAim = null;
  let touched = false;
  function fresh() { return { dash: false, swap: 0, reload: false, ability: [false, false, false], power: [false, false, false], pause: false }; }

  function place(stick) {
    stick.el.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
    stick.el.firstElementChild.style.transform = `translate(${stick.x * REACH}px, ${stick.y * REACH}px)`;
  }

  // Sticks: the first finger down in a zone owns that stick until it lifts.
  root.addEventListener('pointerdown', (e) => {
    touched = true;
    const zone = e.target.dataset?.zone;
    const button = e.target.closest('[data-press]');
    if (button) {
      e.preventDefault();
      const kind = button.dataset.press;
      const slot = Number(button.dataset.slot);
      if (kind === 'ability' || kind === 'power') queued[kind][slot] = true;
      else if (kind === 'swap') queued.swap = 1;
      else queued[kind] = true;
      button.classList.add('down');
      setTimeout(() => button.classList.remove('down'), 120);
      return;
    }
    if (!zone) return;
    e.preventDefault();
    const stick = sticks[zone];
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    stick.ox = e.clientX;
    stick.oy = e.clientY;
    stick.x = stick.y = 0;
    stick.el.hidden = false;
    place(stick);
    root.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    for (const stick of Object.values(sticks)) {
      if (stick.id !== e.pointerId) continue;
      let dx = (e.clientX - stick.ox) / REACH;
      let dy = (e.clientY - stick.oy) / REACH;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      stick.x = dx;
      stick.y = dy;
      place(stick);
    }
  });
  const lift = (e) => {
    for (const stick of Object.values(sticks)) {
      if (stick.id !== e.pointerId) continue;
      stick.id = null;
      stick.x = stick.y = 0;
      stick.el.hidden = true;
    }
  };
  root.addEventListener('pointerup', lift);
  root.addEventListener('pointercancel', lift);
  // No long-press menu, no text selection, no page scroll while playing.
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  const reading = (stick) => {
    const len = Math.hypot(stick.x, stick.y);
    return len < DEAD ? { x: 0, y: 0, len: 0 } : { x: stick.x, y: stick.y, len };
  };

  return {
    // Whether a finger has been on the controls since they were last shown.
    touched: () => touched,
    show(on) {
      root.hidden = !on;
      if (!on) { for (const stick of Object.values(sticks)) { stick.id = null; stick.x = stick.y = 0; stick.el.hidden = true; } queued = fresh(); }
    },
    // Movement, and the aim with whether he's attacking. The aim stays where it was let go.
    state() {
      const move = reading(sticks.move);
      const aim = reading(sticks.aim);
      if (aim.len > 0) lastAim = Math.atan2(aim.y, aim.x);
      return { moveX: move.x, moveY: move.y, aim: lastAim, fire: aim.len >= FIRE };
    },
    take() { const out = queued; queued = fresh(); return out; },
    // Labels and cooldowns on the ability and power buttons.
    update(sim) {
      root.querySelectorAll('.tbtn.ability').forEach((el, i) => {
        const a = sim.abilities[i];
        el.hidden = !a;
        if (!a) return;
        const ready = a.cd <= 0;
        el.classList.toggle('ready', ready);
        el.querySelector('span').textContent = ABILITIES[a.id].name;
        el.querySelector('b').style.width = `${ready ? 100 : (1 - a.cd / ABILITIES[a.id].cooldown) * 100}%`;
      });
      root.querySelectorAll('.tbtn.power').forEach((el, i) => {
        const p = sim.powers[i];
        el.hidden = !p;
        if (p) el.querySelector('span').textContent = POWERS[p].name;
      });
    },
  };
}
