let CATALOGUE = [];

const CATEGORIES = [
  { slug: "all", label: "All Cards" },
  { slug: "christmas", label: "Christmas" },
  { slug: "birthday", label: "Birthday" },
  { slug: "valentine", label: "Valentine's" },
  { slug: "fathers-day", label: "Father's Day" },
  { slug: "mothers-day", label: "Mother's Day" },
  { slug: "baby", label: "New Baby" },
  { slug: "sympathy", label: "Sympathy & Pet Loss" },
  { slug: "get-well", label: "Get Well Soon" },
  { slug: "thinking-of-you", label: "Thinking of You" },
  { slug: "st-patricks", label: "St Patrick's" },
  { slug: "general", label: "General" },
];

function placeholderSvg(title) {
  const safe = title.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
  const lines = safe.match(/.{1,22}/g) || [safe];
  const textRows = lines
    .slice(0, 3)
    .map(
      (l, i) =>
        `<text x="50%" y="${50 + i * 18}" dominant-baseline="middle" text-anchor="middle" fill="#2E7396" font-size="13" font-family="Georgia,serif">${l}</text>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#FFF8EE" rx="8"/><rect x="20" y="20" width="360" height="460" fill="none" stroke="#5FC0E6" stroke-width="2" stroke-dasharray="6 4" rx="6"/><text x="50%" y="36%" dominant-baseline="middle" text-anchor="middle" fill="#15719B" font-size="48">🐾</text>${textRows}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function handleImgError(img, title) {
  img.onerror = null;
  img.src = placeholderSvg(title);
}

function renderProductGrid(products) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML =
      '<p class="no-results">No cards in this category yet. Check back soon!</p>';
    return;
  }

  grid.innerHTML = products
    .map(
      (p, i) => `
    <a class="product-card${p.stock_qty === 0 ? " product-card--soldout" : ""}" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="product-card__img-wrap">
        <img
          src="${p.image ? esc(p.image) : placeholderSvg(p.title)}"
          alt="${esc(p.title)}"
          loading="${i < 4 ? "eager" : "lazy"}"
          ${i < 4 ? 'fetchpriority="high"' : ""}
          data-fallback-title="${esc(p.title)}"
        />
        ${p.stock_qty === 0 ? '<span class="badge badge--soldout">Sold out</span>' : ""}
        ${p.is_bundle ? '<span class="badge badge--bundle">Bundle</span>' : ""}
        ${p.size === "A6" ? '<span class="badge badge--size">A6</span>' : ""}
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${esc(p.title)}</h3>
        <div class="product-card__meta">
          <span class="product-card__size">${esc(p.size)}</span>
          <span class="product-card__price">£${Number(p.price_gbp).toFixed(2)}</span>
        </div>
      </div>
    </a>
  `
    )
    .join("");

  // Attach image-error fallbacks without inline handlers (CSP-friendly)
  grid.querySelectorAll(".product-card__img-wrap img").forEach((img) => {
    img.addEventListener("error", function handler() {
      img.removeEventListener("error", handler);
      img.src = placeholderSvg(img.dataset.fallbackTitle || "");
    });
  });
}

function buildCategoryNav(activeSlug) {
  const nav = document.getElementById("category-nav");
  if (!nav) return;

  nav.innerHTML = CATEGORIES.map(
    (c) =>
      `<button class="cat-btn${c.slug === activeSlug ? " cat-btn--active" : ""}" data-slug="${c.slug}">${c.label}</button>`
  ).join("");

  nav.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.dataset.slug;
      nav
        .querySelectorAll(".cat-btn")
        .forEach((b) => b.classList.remove("cat-btn--active"));
      btn.classList.add("cat-btn--active");
      const filtered =
        slug === "all"
          ? CATALOGUE.filter((p) => p.active)
          : CATALOGUE.filter((p) => p.active && p.category === slug);
      renderProductGrid(filtered);
      window.scrollTo({ top: nav.offsetTop - 80, behavior: "smooth" });
    });
  });
}

async function initShop() {
  const grid = document.getElementById("product-grid");
  try {
    CATALOGUE = await fetchCatalogue();
  } catch (e) {
    if (grid)
      grid.innerHTML =
        '<p class="no-results">Sorry, we couldn\'t load the cards just now. Please refresh in a moment.</p>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat") || "all";

  buildCategoryNav(cat);
  const filtered =
    cat === "all"
      ? CATALOGUE.filter((p) => p.active)
      : CATALOGUE.filter((p) => p.active && p.category === cat);
  renderProductGrid(filtered);
}

if (document.getElementById("product-grid")) {
  document.addEventListener("DOMContentLoaded", initShop);
}
