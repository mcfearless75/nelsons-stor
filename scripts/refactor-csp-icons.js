// One-off refactor: swap emoji icons for SVG data-icon spans, externalise inline
// scripts, and remove inline on* handlers so a strict CSP (script-src 'self') works.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const wr = (f, c) => fs.writeFileSync(path.join(ROOT, f), c);

const HTML = ["index.html", "product.html", "cart.html", "about.html", "success.html", "cancel.html", "404.html"];

// --- 1. Global: header icons + load icons.js after cart.js ---
for (const f of HTML) {
  let c = rd(f);
  c = c.replace(/<span>🐾<\/span>/g, '<span class="site-logo__icon" data-icon="paw"></span>');
  c = c.replace(/🛒 Basket/g, '<span data-icon="cart"></span> Basket');
  if (c.includes('js/cart.js') && !c.includes('js/icons.js')) {
    c = c.replace('<script src="js/cart.js"></script>', '<script src="js/cart.js"></script>\n<script src="js/icons.js"></script>');
  }
  wr(f, c);
}

// --- 2. Trust strip (index) ---
{
  let c = rd("index.html");
  c = c.replace('<div class="trust-item">⭐ 5.0', '<div class="trust-item"><span data-icon="star"></span> 5.0');
  c = c.replace('<div class="trust-item">🎁 Free UK', '<div class="trust-item"><span data-icon="truck"></span> Free UK');
  c = c.replace('<div class="trust-item">🚀 Dispatched', '<div class="trust-item"><span data-icon="clock"></span> Dispatched');
  c = c.replace('<div class="trust-item">✉️ Surprise', '<div class="trust-item"><span data-icon="gift"></span> Surprise');
  // externalise signup script + remove inline onsubmit
  c = c.replace(/ onsubmit="handleEmailSignup\(event\)"/, "");
  c = c.replace(/<script>\s*\nfunction handleEmailSignup[\s\S]*?<\/script>/, '<script src="js/page-signup.js"></script>');
  wr("index.html", c);
}

// --- 3. product.html: drop inline script -> page-product.js ---
{
  let c = rd("product.html");
  c = c.replace(/<script>\s*\nlet _currentProduct[\s\S]*?<\/script>\s*\n<\/body>/, '<script src="js/page-product.js"></script>\n</body>');
  wr("product.html", c);
}

// --- 4. cart.html: drop inline script -> page-cart.js ---
{
  let c = rd("cart.html");
  c = c.replace(/<script>\s*\nfunction placeholderSvg[\s\S]*?<\/script>\s*\n<\/body>/, '<script src="js/page-cart.js"></script>\n</body>');
  wr("cart.html", c);
}

// --- 5. about.html: remove inline handlers + externalise ---
{
  let c = rd("about.html");
  c = c.replace(/ onsubmit="handleEmailSignup\(event\)"/, "");
  c = c.replace(/ onerror="this\.style\.display='none';this\.parentElement\.querySelector\('\.packaging-placeholder'\)\.style\.display='flex'"/g, "");
  c = c.replace(/<script>\s*\nfunction handleEmailSignup[\s\S]*?<\/script>/, '<script src="js/page-signup.js"></script>\n<script src="js/page-about.js"></script>');
  // prose promise icons
  c = c.replace('🎁 <span><strong>Surprise free card', '<span data-icon="gift"></span> <span><strong>Surprise free card');
  c = c.replace('🚀 <strong>Dispatched within', '<span data-icon="truck"></span> <strong>Dispatched within');
  c = c.replace('📦 <strong>Beautiful packaging', '<span data-icon="package"></span> <strong>Beautiful packaging');
  c = c.replace('🇬🇧 <strong>Free UK postage', '<span data-icon="check"></span> <strong>Free UK postage');
  wr("about.html", c);
}

// --- 6. success.html: externalise + prose icons ---
{
  let c = rd("success.html");
  c = c.replace(/<script>\s*\n\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/, '<script src="js/page-success.js"></script>');
  c = c.replace('🚀 <strong>Dispatched within', '<span data-icon="truck"></span> <strong>Dispatched within');
  c = c.replace('🎁 <strong>Watch out for', '<span data-icon="gift"></span> <strong>Watch out for');
  c = c.replace('✉️ Your cards will arrive', '<span data-icon="mail"></span> Your cards will arrive');
  wr("success.html", c);
}

console.log("Refactor complete.");
