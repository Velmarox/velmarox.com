// Clack Arena: what everything is. Faces, the player's starting die, the enemies and their signature dice,
// consumables, relics, the Forge's stamps and the Tavern's prices. Rules live in rules.js; this file is only data.
window.ARENA = window.ARENA || {};

(() => {
  const A = window.ARENA;

  // A face is { t: type, v: value } plus optional icon/name overrides (The House's Jackpot is a Strike with a crown).
  A.FACE_TYPES = {
    strike: { name: 'Strike', icon: 'claw', color: '#ff2a43', valued: true, text: (v) => `Deal ${v}.` },
    guard: { name: 'Guard', icon: 'shield', color: '#4fa3ff', valued: true, text: (v) => `Block ${v} Strike damage this turn. Pierce goes through.` },
    pierce: { name: 'Pierce', icon: 'arrow', color: '#ff8a1f', valued: true, text: (v) => `Deal ${v}. Goes straight through Guard.` },
    mend: { name: 'Mend', icon: 'heart', color: '#3ddc84', valued: true, text: (v) => `Heal ${v} pips.` },
    charge: { name: 'Charge', icon: 'flame', color: '#f5e400', valued: false, text: () => 'Next turn, the number on your face is doubled.' },
    thorn: { name: 'Thorn', icon: 'thorns', color: '#b98cff', valued: true, text: (v) => `If a Strike or Pierce hurts you this turn, the attacker takes ${v}.` },
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

  // Stops on the map. icon: a GUI piece from ui/ (Pixel UI pack 3).
  A.NODES = {
    fight: { name: 'Fight', icon: 'btn-red', text: 'A die looking for trouble. Win chips, maybe an item.' },
    elite: { name: 'Elite', icon: 'shield-red', text: 'A hard fight. Win a relic.' },
    forge: { name: 'Forge', icon: 'rank-orange', text: 'Engrave a face, sand off a Skull, or grow.' },
    tavern: { name: 'Tavern', icon: 'coin', text: 'Spend chips on items, relics and pips.' },
    rest: { name: 'Rest', icon: 'btn-green', text: 'Repair some pips.' },
    boss: { name: 'The House', icon: 'crest-red', text: 'The boss of the Green Felt.' },
  };
  A.ITEM_ICON = { nudge: 'chevron', chalk: 'gem-cyan', talc: 'gem-green', lead: 'gem-orange' };
  A.RELIC_ICON = 'rank-cyan';

  // The four beats a turn resolves in: key, name, what happens in it (shown under the phase strip and on the rules page).
  A.TURN_ORDER = [
    ['clack', 'Clack', 'Hard hits while the dice tumbled. Already dealt.'],
    ['guard', 'Guard', 'Guard goes up before anything hits.'],
    ['hits', 'Hits', 'Strikes hit Guard first. Pierce goes through. Heals and Charge.'],
    ['thorn', 'Thorn', 'Thorns hurt whoever got a Strike or Pierce through.'],
  ];

  // What a die's weight, bounce and Clack modifiers mean, as tags on its panel. phys: { mass, bounce }; clack: { deal, take }.
  A.traits = (phys = {}, clack = {}) => {
    const t = [], P = { ...A.PHYS, ...phys }, n = (x) => (x > 0 ? '+' : '−') + Math.abs(x);
    if (P.mass >= 1.4) t.push(['Heavy', 'Shoves other dice out of its way and barely moves when they hit it.']);
    else if (P.mass <= 0.7) t.push(['Light', 'Gets knocked a long way when another die hits it.']);
    if (P.bounce >= 1.4) t.push(['Bouncy', 'Bounces high and far: long, wild throws that run into things.']);
    else if (P.bounce <= 0.75) t.push(['Low bounce', 'Lands fast and stays close to where it was thrown.']);
    if (clack.deal) t.push([`Clack ${n(clack.deal)}`, `Its Clacks deal ${Math.abs(clack.deal)} ${clack.deal > 0 ? 'more' : 'less'} damage.`]);
    if (clack.take) t.push([`Takes ${n(clack.take)}`, `Clacks against it deal ${Math.abs(clack.take)} ${clack.take > 0 ? 'more' : 'less'} damage.`]);
    return t;
  };

  // The rules sheet: every term the game uses, in one place.
  A.GLOSSARY = [
    ['Your throw', 'Press on your die and pull back like a slingshot. Let go to throw it the other way. Longer pull, harder throw. You can press anywhere in the yellow zone to throw from there. (Settings can switch this to dragging the way you want to throw.)'],
    ['Faces', 'The face that ends up on top is what your die does this turn. Tap any face, on a die panel or on the map, to read it.'],
    ['Clack', "Hit an enemy die hard while it's tumbling and it takes damage straight away: 1 for a solid hit, 2 for a hard one, 3 for a smash. Their dice can Clack you too."],
    ['Pinned', 'A die left leaning on another die does nothing this turn. The die holding it up gets +1 to its face.'],
    ['Guard and Pierce', 'Guard soaks Strike damage for this turn only. Pierce goes straight through it. Guard left over at the end of the turn is gone.'],
    ['Thorn', 'If the other side gets a Strike or Pierce through to you this turn, they take the Thorn number back. Clacks and blocked hits don\'t set it off.'],
    ['Charge', 'Next turn, the first face with a number on that side is doubled: Strike 3 hits for 6, Guard 2 blocks 4.'],
    ['Weight and bounce', 'Dice are not all the same. Heavy dice shove others aside, light ones get knocked around, bouncy ones go far. The grey tags on a die\'s panel say which; tap them to read.'],
    ['Previews', 'Some enemies try several throws in secret against yours and keep the best one. You see the ones they threw away as faint red paths.'],
    ['Odds', 'Every face on a die is equally likely. A d4 shows each face 1 time in 4; a d6, 1 in 6. The bars under each die show the odds by kind of face.'],
    ['Pips and chips', 'Pips are your health. Chips are money for the Tavern.'],
  ];

  // What you can pick before a run: your die's colour, its number colour, its finish (A.FINISHES) and the tray, all from
  // what the game already has. The colours come from Clack Attack's dice templates; the trays are Clack Attack's.
  A.DIE_COLORS = [
    ['#c8102e', 'Caltrop red'], ['#f1ead8', 'Ivory'], ['#1d1b22', 'Obsidian'], ['#ff5fa2', 'Pink'], ['#d4a73a', 'Gold'],
    ['#8fd3ff', 'Frost'], ['#6b4bd6', 'Violet'], ['#3f5a2e', 'Moss'], ['#4f7f78', 'Floodwater'], ['#9c5a34', 'Rust'],
    ['#2b3a7a', 'Night blue'], ['#7a7570', 'Stone'],
  ];
  A.INK_COLORS = [['#ffffff', 'White'], ['#2a2320', 'Ink black'], ['#e2b84f', 'Gold'], ['#9fe3ff', 'Ice'], ['#ff8a1f', 'Orange'], ['#b98cff', 'Lilac']];
  A.FINISH_NAMES = { matte: 'Matte', satin: 'Satin', glossy: 'Glossy', metal: 'Metal', pearl: 'Pearl', glass: 'Glass' };
  A.TRAYS = ['Green_Felt', 'Magenta_Felt', 'Fantasy_Tavern', 'Arctic_Ice', 'Autumn_Harvest', 'Candy_Sweet', 'Celestial_Angel',
    'Cosmic_Space', 'Cyberpunk', 'Egyptian_Gold', 'Eldritch_Horror', 'Forest_Druid', 'Gothic_Vampire', 'Nineties', 'Retro_8Bit',
    'SciFi_Mech', 'Sea_Pirate', 'Steampunk'];
  A.trayPic = (id) => `/tools/clack-attack/play/Table/Trays/${id}.jpg`;
  A.trayName = (id) => id.replace('_', ' ').replace('SciFi', 'Sci-Fi').replace('Retro 8Bit', 'Retro 8-bit');
  A.STYLE_DEFAULT = { color: '#c8102e', ink: '#ffffff', finish: 'satin', tray: 'Green_Felt' };

  A.SETTINGS_DEFAULT = { aim: 'sling', arrow: true, sound: true, reduceMotion: false, fast: false, tips: true };

  A.PRICES = { consumable: 7, relic: 18, mend: 5 };
  A.MEND_AMOUNT = 6;
  A.REST_SHARE = 0.4;
})();
