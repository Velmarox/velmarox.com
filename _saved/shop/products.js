// THE SHOP. Every product card on /shop/ is built from this.
//
// The shop is a storefront: each Buy button links to wherever the item is actually sold
// (itch.io, Ko-fi, Gumroad, a print-on-demand store ...). No payments run on this site.
//
// Fields:
//   slug, title
//   kind     "Digital", "Soundtrack", "Merch", "Support" ... (makes the filter chips)
//   price    text exactly as shown: "$4.99", "Pay what you want", "Free"
//   blurb    one or two sentences
//   image    square image, 800x800 (put it in docs/shop/img/)
//   link     the store page where it is bought; leave out for "Coming soon"
//   status   "available", "soon" or "sold-out"
//   game     optional game slug; adds a link to that game
//   badge    optional short label on the image: "New", "Limited" ...
//   sample   true = placeholder

window.PRODUCTS = [
  {
    slug: 'sample-supporter-pack', sample: true,
    title: 'Supporter pack', kind: 'Support', price: 'Pay what you want', status: 'available', badge: 'New',
    blurb: 'Placeholder product. Chip in to keep the games free.', link: '#'
  },
  {
    slug: 'sample-neon-drift-ost', sample: true,
    title: 'Animalism soundtrack', kind: 'Soundtrack', price: '$4.99', status: 'available', game: 'animalism',
    blurb: 'Placeholder product. Twelve tracks, MP3 and FLAC.', link: '#'
  },
  {
    slug: 'sample-wallpapers', sample: true,
    title: 'Wallpaper set', kind: 'Digital', price: 'Free', status: 'available',
    blurb: 'Placeholder product. Desktop and phone wallpapers.', link: '#'
  },
  {
    slug: 'sample-sticker-sheet', sample: true,
    title: 'Sticker sheet', kind: 'Merch', price: '$6.00', status: 'soon', badge: 'Limited',
    blurb: 'Placeholder product. Vinyl stickers of every game icon.'
  },
  {
    slug: 'sample-hoard-tee', sample: true,
    title: 'Wyrmhoard tee', kind: 'Merch', price: '$24.00', status: 'sold-out', game: 'keno',
    blurb: 'Placeholder product. Gold dragon on black.', link: '#'
  }
];
