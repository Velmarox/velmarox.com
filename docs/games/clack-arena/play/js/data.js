// Clack Arena: what everything is. Faces, the player's starting die, the enemies and their signature dice,
// consumables, relics, the Forge's stamps and the Tavern's prices. Rules live in rules.js; this file is only data.
window.ARENA = window.ARENA || {};

(() => {
  const A = window.ARENA;

  // A face is { t: type, v: value } plus optional icon/name overrides (The House's Jackpot is a Strike with a crown).
  A.FACE_TYPES = {
    strike: { name: 'Strike', icon: 'claw', color: '#ff2a43', valued: true, text: (v) => `Deal ${v}.` },
    guard: { name: 'Guard', icon: 'shield', color: '#4fa3ff', valued: true, text: (v) => `Block ${v} this round.` },
    pierce: { name: 'Pierce', icon: 'arrow', color: '#ff8a1f', valued: true, text: (v) => `Deal ${v}, ignores Guard.` },
    mend: { name: 'Mend', icon: 'heart', color: '#3ddc84', valued: true, text: (v) => `Heal ${v} pips.` },
    charge: { name: 'Charge', icon: 'flame', color: '#f5e400', valued: false, text: () => 'Your next face is doubled.' },
    thorn: { name: 'Thorn', icon: 'thorns', color: '#b98cff', valued: true, text: (v) => `Whoever hits you this round takes ${v}.` },
    skull: { name: 'Skull', icon: 'skull', color: '#9a9aa6', valued: false, text: () => 'A fumble. Nothing happens.' },
    smooth: { name: 'Smooth', icon: '', color: '#5a5a66', valued: false, text: () => 'Blank. Engrave it at the Forge.' },
  };

  const F = (t, v, extra) => Object.assign({ t, v: v || 0 }, extra || {});
  A.F = F;

  // Dice finishes, from Clack Attack's list (Dice_Tray.js). bgAlpha < 1: see-through body.
  A.FINISHES = {
    matte: { roughness: 1, metalness: 0, env: 0.08 },
    satin: { roughness: 0.55, metalness: 0, env: 0.55, sheen: 1, sheenRoughness: 0.3 },
    glossy: { roughness: 0.25, metalness: 0, env: 1.3, clearcoat: 1, clearcoatRoughness: 0.03 },
    metal: { roughness: 0.3, metalness: 0.55, env: 1.4, clearcoat: 0.6 },   // less mirror than Clack Attack's: the tray's camera sees less of the room
    pearl: { roughness: 0.3, metalness: 0.1, env: 1.2, clearcoat: 0.8, iridescence: 1 },
    glass: { roughness: 0.05, metalness: 0, env: 1.4, clearcoat: 1, clearcoatRoughness: 0.02, bgAlpha: 0.5 },
  };

  // Physics per die. mass and the two factors scale Clack Attack's base contact values.
  A.PHYS = { mass: 1, bounce: 1, grip: 1 };

  A.PLAYER_START = {
    name: 'Caltrop',
    hp: 24,
    die: {
      sides: 4,
      faces: [F('strike', 3), F('strike', 3), F('guard', 2), F('skull')],
      look: { color: '#c8102e', finish: 'satin', ink: '#ffffff' },
    },
  };
  A.PLAYER_OUTLINE = '#f5e400';

  // Enemies. previews: how many throws the enemy tries off-screen (against the throw you locked in) before it
  // keeps the best one for itself. clack: extra Clack damage it deals / takes.
  A.ENEMIES = {
    pips: {
      name: 'Pips', hp: 8, previews: 1, chips: 8,
      line: "I'm all ones. I'm also all yours.", lose: 'Fair.', win: 'Ones add up.',
      dice: [{ sides: 6, faces: Array.from({ length: 6 }, () => F('strike', 1, { icon: 'dot', bare: true })),
        look: { color: '#efe9dc', finish: 'matte', ink: '#22201c' } }],
    },
    glassjaw: {
      name: 'Glassjaw', hp: 10, previews: 1, chips: 10, clack: { deal: 1, take: 1 },
      line: 'Hit me. Go on. See what happens.', lose: 'Worth it.', win: 'Told you.',
      dice: [{ sides: 6, faces: [F('strike', 3), F('strike', 2), F('strike', 2), F('guard', 1), F('skull'), F('skull')],
        look: { color: '#7fd3ff', finish: 'glass', ink: '#ffffff' }, phys: { mass: 0.6, bounce: 1.5, grip: 0.8 } }],
    },
    twins: {
      name: 'Snake Eyes & Boxcars', hp: 12, previews: 1, chips: 12,
      line: 'Two of us. One of you. Do the maths.', lose: 'Snake Eyes. Again.', win: 'Boxcars!',
      dice: [
        { sides: 6, name: 'Snake Eyes', faces: [F('guard', 2), F('guard', 2), F('guard', 1), F('mend', 1), F('strike', 1), F('skull')],
          look: { color: '#1fa35a', finish: 'glass', ink: '#ffffff' } },
        { sides: 6, name: 'Boxcars', faces: [F('strike', 3), F('strike', 2), F('strike', 2), F('strike', 1), F('pierce', 1), F('skull')],
          look: { color: '#d4202c', finish: 'glass', ink: '#ffffff' } },
      ],
    },
    tumbler: {
      name: 'Tumbler', hp: 14, previews: 1, chips: 12,
      line: 'Round and round. Keep up.', lose: 'Dizzy.', win: 'Couldn\'t keep up.',
      dice: [{ sides: 8, faces: [F('strike', 2), F('strike', 2), F('strike', 2), F('pierce', 2), F('charge'), F('guard', 2), F('thorn', 1), F('skull')],
        look: { color: '#8e6ad8', finish: 'pearl', ink: '#ffffff' }, phys: { mass: 1, bounce: 1.6, grip: 0.9 } }],
    },
    ironmike: {
      name: 'Iron Mike', hp: 16, previews: 2, chips: 20, elite: true, clack: { deal: 1, take: -1 },
      line: 'Move.', lose: '...', win: 'Moved you.',
      dice: [{ sides: 6, faces: [F('strike', 3), F('strike', 3), F('strike', 2), F('guard', 2), F('guard', 2), F('skull')],
        look: { color: '#3b3d44', finish: 'metal', ink: '#f2f2f4' }, phys: { mass: 2.2, bounce: 0.7, grip: 1.4 } }],
    },
    house: {
      name: 'The House', hp: 18, previews: 3, chips: 0, boss: true,
      line: "I've already seen how this goes.", lose: 'Count it again.', win: 'The House always does.',
      dice: [{ sides: 12, faces: [F('strike', 3), F('strike', 2), F('strike', 2), F('strike', 2), F('strike', 1), F('guard', 2), F('guard', 2),
        F('pierce', 2), F('mend', 2), F('charge'), F('strike', 5, { icon: 'crown', name: 'Jackpot' }), F('smooth')],
        look: { color: '#d4a83a', finish: 'metal', ink: '#2a1d05' }, phys: { mass: 1.4, bounce: 0.9, grip: 1 } }],
    },
  };
  A.FIGHT_POOL = [['pips', 'glassjaw'], ['glassjaw', 'twins', 'tumbler'], ['twins', 'tumbler']];   // by stage of the run
  A.ELITE_POOL = ['ironmike'];
  A.BOSS = 'house';

  // Consumables: hold 3, each used once. when: 'before' (while aiming) or 'after' (once the dice land).
  A.CONSUMABLES = {
    nudge: { name: 'Nudge', icon: 'N', when: 'after', text: 'After landing, tip your die onto a neighbouring face.' },
    chalk: { name: 'Chalk', icon: 'C', when: 'before', text: 'Mark one face. If it comes up this fight, it triggers twice.' },
    talc: { name: 'Talc', icon: 'T', when: 'after', text: 'Call off the throw. Everyone throws again.' },
    lead: { name: 'Lead Shot', icon: 'L', when: 'before', text: "This throw can't settle on Skull or Smooth." },
  };
  A.MAX_CONSUMABLES = 3;

  A.RELICS = {
    leadcore: { name: 'Lead Core', text: 'Your die is twice as heavy: shove other dice, shrug off their hits (+1 Clack dealt, -1 taken).' },
    rubber: { name: 'Rubber Coat', text: 'Your die bounces much higher. Long, wild throws with lots of Clacks.' },
    snakeoil: { name: 'Snake Oil', text: 'Your Skull faces heal you for 2.' },
    cracked: { name: 'Cracked Shell', text: '+1 on every face with a number. -5 max pips.' },
  };

  // What the Forge offers to engrave (three at random each visit).
  A.STAMPS = [F('strike', 4), F('strike', 3), F('guard', 3), F('pierce', 3), F('mend', 3), F('charge'), F('thorn', 2)];

  A.PRICES = { consumable: 7, relic: 18, mend: 5 };
  A.MEND_AMOUNT = 6;
  A.REST_SHARE = 0.4;
})();
