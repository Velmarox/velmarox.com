/* velmarox.com: touch help for the web build. There is no Esc key on a phone, so a tap on the tray clears the dice. */
(() => {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (!touch) return;
  const area = document.querySelector('.tray-area');
  if (area) area.addEventListener('click', () => { if (!document.querySelector('.look-drawer')) RP.diceTray.clear?.(); });
  const lines = document.querySelectorAll('.tray-area .idle p');
  if (lines[1]) lines[1].textContent = matchMedia('(max-width: 700px)').matches
    ? 'Type what to roll below, or tap a dice button.' : 'Type what to roll on the right, or tap a dice button.';
  if (lines[2]) lines[2].textContent = 'Tap the tray to clear the dice.';
})();
