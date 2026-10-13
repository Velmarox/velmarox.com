// Gear and injuries. Data only; what each one does is in sim/world.js, found by its id.
// Every piece changes what a throw or the guy physically does. None is a percentage bonus.

export const GEAR = {
  sticky: { name: 'Sticky Gloves', text: 'Thrown stuff sticks to the creature it hits and weighs it down.' },
  boots:  { name: 'Heavy Boots',   text: 'You cannot be knocked back or slide on ice. You move slower.' },
  bungee: { name: 'Bungee Cord',   text: 'Thrown stuff snaps back to your hands.' },
  magnet: { name: 'Magnet Glove',  text: 'With empty hands, hold to pull the nearest metal object to you.' },
  spring: { name: 'Spring Arm',    text: 'A full-charge throw keeps all its speed on its first wall bounce.' },
  mitts:  { name: 'Big Mitts',     text: 'Pick up bigger stunned creatures. Your throws are slower.' },
};

export const STARTER_GEAR = ['sticky', 'boots', 'bungee'];
export const GEAR_SLOTS = 3;

export const INJURIES = {
  arm:     { name: 'Bad Arm', text: 'Throws take longer to charge.' },
  limp:    { name: 'Limp',    text: 'You move slower.' },
  rattled: { name: 'Rattled', text: 'Your aim meter is half size.' },
};

export const MAX_INJURIES = 3;
