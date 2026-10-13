// Turns keys, mouse, and a controller into one input record per sim step.
// Mouse and keys: WASD move, mouse aims, hold left to grab and charge, right or Space shoves.
// Keyboard only: arrow keys aim, Enter grabs and charges.
// Controller (SNES layout): D-pad moves and aims the way he walks; hold R to plant his
// feet and aim without walking; A or B grabs and charges; X or Y shoves; Start pauses.
// A right stick, if the controller has one, aims on its own.

// Standard browser mapping. On a SNES pad the bottom button is B and the right one is A.
const PAD = { b: 0, a: 1, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const DEAD = 0.35;

export function createInput(stage, toWorld) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, hold: false };
  let shoveQueued = false;
  let keyAim = null;
  let padAim = 0;
  let padWas = {};
  let device = 'keys';
  let waitRelease = false;
  const pressed = [];
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    device = 'keys';
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!e.repeat) shoveQueued = true; }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.push(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.hold = false; });

  stage.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; keyAim = null; device = 'keys'; });
  stage.addEventListener('mousedown', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    keyAim = null;
    device = 'keys';
    if (e.button === 0) mouse.hold = true;
    if (e.button === 2) shoveQueued = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.hold = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // Reads the first connected controller. Returns null if there is none.
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return null;
    const down = (i) => Boolean(pad.buttons[i]?.pressed);
    const axis = (i) => (Math.abs(pad.axes[i] ?? 0) > DEAD ? pad.axes[i] : 0);
    const state = {
      x: (down(PAD.right) ? 1 : 0) - (down(PAD.left) ? 1 : 0) || axis(0),
      y: (down(PAD.down) ? 1 : 0) - (down(PAD.up) ? 1 : 0) || axis(1),
      aimX: axis(2), aimY: axis(3),
      hold: down(PAD.a) || down(PAD.b),
      shove: down(PAD.x) || down(PAD.y),
      plant: down(PAD.r) || down(PAD.l),
      start: down(PAD.start),
      confirm: down(PAD.a) || down(PAD.b),
    };
    if (state.x || state.y || state.hold || state.shove || state.start || state.aimX || state.aimY) device = 'pad';
    return state;
  }

  return {
    // guyPos is in world units. The aim points at the cursor, or along the arrow keys, or
    // the way the controller is pushed.
    sample(guyPos) {
      const ax = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      const ay = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      if (ax || ay) keyAim = Math.atan2(ay, ax);
      const target = toWorld(mouse.x, mouse.y);
      const input = {
        moveX: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        moveY: (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0),
        aimAngle: keyAim ?? Math.atan2(target.y - guyPos.y, target.x - guyPos.x),
        hold: mouse.hold || keys.has('Enter'),
        shove: shoveQueued,
      };
      shoveQueued = false;

      const pad = readPad();
      if (pad && device === 'pad') {
        if (pad.aimX || pad.aimY) padAim = Math.atan2(pad.aimY, pad.aimX);
        else if (pad.x || pad.y) padAim = Math.atan2(pad.y, pad.x);
        input.aimAngle = padAim;
        input.moveX = pad.plant ? 0 : pad.x;
        input.moveY = pad.plant ? 0 : pad.y;
        // A button still held from a menu doesn't count until it is let go.
        if (!pad.hold) waitRelease = false;
        input.hold = pad.hold && !waitRelease;
        input.shove = pad.shove && !padWas.shove;
        if (pad.start && !padWas.start) pressed.push('Escape');
      }
      padWas = pad ?? {};
      return input;
    },
    // For menus: which way the controller was just pushed, and whether it confirmed.
    menu() {
      const pad = readPad();
      if (!pad) return null;
      const step = (pad.y > 0 || pad.x > 0 ? 1 : 0) - (pad.y < 0 || pad.x < 0 ? 1 : 0);
      const out = {
        step: step !== 0 && !padWas.menuStep ? step : 0,
        confirm: pad.confirm && !padWas.confirm,
        back: pad.start && !padWas.start,
      };
      padWas = { ...pad, menuStep: step !== 0 };
      return out;
    },
    // Keys pressed since the last call, for one-shot commands like pause.
    takePressed() { return pressed.splice(0); },
    // 'keys' or 'pad': whichever was touched last, so prompts can show the right buttons.
    device: () => device,
    // Forget anything held, so a click on a menu doesn't carry into the fight.
    reset() { keys.clear(); mouse.hold = false; shoveQueued = false; pressed.length = 0; waitRelease = true; padWas = { ...padWas, confirm: true, start: true, shove: true }; },
  };
}
