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

// The shop is closed: /shop/ shows a big COMING SOON and the home page hides its shop row.
// To open it, set SHOP_OPEN to true and fill PRODUCTS. The original sample products are saved in
// _saved/shop/products.js at the top of the repo (not published) to copy back in as a starting point.
window.SHOP_OPEN = false;

window.PRODUCTS = [
];
