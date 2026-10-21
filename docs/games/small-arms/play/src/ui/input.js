// Turns keys, mouse, and a controller into one input record per sim step.
//
// Keys and mouse: WASD move, the mouse aims, hold left to attack, Space or right mouse
// dashes, R reloads. Mouse wheel or Tab swaps weapon; 1-4 picks one. Q, E, F are the three
// abilities; Z, X, C use the three stored powers. Arrow keys aim without a mouse.
//
// Controller (standard layout, twin-stick): left stick moves, right stick aims, right
// trigger attacks, left trigger dashes, bumpers swap weapon. A, B, Y are the abilities,
// X reloads, and the D-pad's left, up, and right use the three powers. Start pauses.
// With the right stick at rest, the aim stays where it was; while attacking with it at
// rest, the aim drifts to the nearest creature, so a pad with no right stick still works.

const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const DEAD = 0.25;
const ABILITY_KEYS = ['KeyQ', 'KeyE', 'KeyF'];
const POWER_KEYS = ['KeyZ', 'KeyX', 'KeyC'];

export function createInput(stage, toWorld) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, hold: false, seen: false };
  // One-shot presses, kept until the next sample reads them.
  let queued = { dash: false, reload: false, swap: 0, pick: -1, ability: [false, false, false], power: [false, false, false] };
  const fresh = () => ({ dash: false, reload: false, swap: 0, pick: -1, ability: [false, false, false], power: [false, false, false] });
  let keyAim = null;
  let padAim = null;
  let padWas = {};
  let device = 'keys';
  let waitRelease = false;
  const pressed = [];
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    device = 'keys';
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!e.repeat) queued.dash = true; }
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) queued.swap = 1; }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'KeyR') queued.reload = true;
      const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (digit >= 0) queued.pick = digit;
      const ability = ABILITY_KEYS.indexOf(e.code);
      if (ability >= 0) queued.ability[ability] = true;
      const power = POWER_KEYS.indexOf(e.code);
      if (power >= 0) queued.power[power] = true;
      pressed.push(e.code);
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.hold = false; });

  stage.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true; keyAim = null; device = 'keys'; });
  stage.addEventListener('mousedown', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.seen = true;
    keyAim = null;
    device = 'keys';
    if (e.button === 0) mouse.hold = true;
    if (e.button === 2) queued.dash = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.hold = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('wheel', (e) => { queued.swap = e.deltaY > 0 ? 1 : -1; }, { passive: true });

  // Reads the first connected controller. Returns null if there is none.
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return null;
    const down = (i) => Boolean(pad.buttons[i]?.pressed) || (pad.buttons[i]?.value ?? 0) > 0.35;
    const axis = (i) => (Math.abs(pad.axes[i] ?? 0) > DEAD ? pad.axes[i] : 0);
    const state = {
      x: axis(0), y: axis(1), aimX: axis(2), aimY: axis(3),
      fire: down(PAD.rt), dash: down(PAD.lt), lb: down(PAD.lb), rb: down(PAD.rb),
      a: down(PAD.a), b: down(PAD.b), yb: down(PAD.y), xb: down(PAD.x),
      left: down(PAD.left), up: down(PAD.up), right: down(PAD.right), downPad: down(PAD.down),
      start: down(PAD.start),
    };
    // Menus: the D-pad or left stick moves, A confirms, B backs out.
    state.step = (state.downPad || state.right || state.y > 0.5 || state.x > 0.5 ? 1 : 0) - (state.up || state.left || state.y < -0.5 || state.x < -0.5 ? 1 : 0);
    if (state.x || state.y || state.aimX || state.aimY || state.fire || state.dash || state.a || state.b || state.start || state.lb || state.rb) device = 'pad';
    return state;
  }

  function nearest(sim, within = 12) {
    let best = null;
    let bestD = within;
    for (const e of sim.enemies) {
      const d = Math.hypot(e.x - sim.guy.x, e.y - sim.guy.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  const edge = (pad, key) => pad[key] && !padWas[key];

  return {
    // The aim is a spot on the floor: the cursor, or a point along the arrow keys or stick.
    sample(sim) {
      const g = sim.guy;
      const ax = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      const ay = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      if (ax || ay) keyAim = Math.atan2(ay, ax);
      let target = mouse.seen ? { ...toWorld(mouse.x, mouse.y) } : { x: g.x + 6, y: g.y };
      if (keyAim !== null) target = { x: g.x + Math.cos(keyAim) * 8, y: g.y + Math.sin(keyAim) * 8 };
      const input = {
        moveX: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        moveY: (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0),
        aimX: target.x,
        aimY: target.y,
        fire: mouse.hold || keys.has('Enter'),
        ...queued,
      };
      queued = fresh();

      const pad = readPad();
      if (pad && device === 'pad') {
        // Twin-stick aiming: the right stick sets the aim and it stays put when let go.
        if (pad.aimX || pad.aimY) padAim = Math.atan2(pad.aimY, pad.aimX);
        else if (pad.fire) {
          const foe = nearest(sim);
          if (foe) padAim = Math.atan2(foe.y - g.y, foe.x - g.x);
        }
        if (padAim === null) padAim = pad.x || pad.y ? Math.atan2(pad.y, pad.x) : 0;
        input.aimX = g.x + Math.cos(padAim) * 7;
        input.aimY = g.y + Math.sin(padAim) * 7;
        input.moveX = pad.x;
        input.moveY = pad.y;
        // A trigger still held from a menu doesn't count until it is let go.
        if (!pad.fire) waitRelease = false;
        input.fire = pad.fire && !waitRelease;
        input.dash = edge(pad, 'dash');
        input.reload = edge(pad, 'xb');
        input.swap = edge(pad, 'rb') ? 1 : edge(pad, 'lb') ? -1 : 0;
        input.ability = [edge(pad, 'a'), edge(pad, 'b'), edge(pad, 'yb')];
        input.power = [edge(pad, 'left'), edge(pad, 'up'), edge(pad, 'right')];
        if (edge(pad, 'start')) pressed.push('Escape');
      }
      padWas = pad ?? {};
      return input;
    },
    // For menus: which way the controller was just pushed, and whether it confirmed or backed out.
    menu() {
      const pad = readPad();
      if (!pad) return null;
      const out = {
        step: pad.step !== 0 && !padWas.menuStep ? pad.step : 0,
        confirm: edge(pad, 'a'),
        back: edge(pad, 'b') || edge(pad, 'start'),
      };
      padWas = { ...pad, menuStep: pad.step !== 0 };
      return out;
    },
    // Keys pressed since the last call, for one-shot commands like pause.
    takePressed() { return pressed.splice(0); },
    // 'keys' or 'pad': whichever was touched last, so prompts can show the right buttons.
    device: () => device,
    // Forget anything held, so a click on a menu doesn't carry into the fight.
    reset() {
      keys.clear();
      mouse.hold = false;
      queued = fresh();
      pressed.length = 0;
      waitRelease = true;
      padWas = { ...padWas, a: true, b: true, start: true, dash: true, xb: true, yb: true, lb: true, rb: true, left: true, up: true, right: true };
    },
  };
}
