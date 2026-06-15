let _currentProduct = null;

const CATEGORY_LABELS = {
  christmas: "Christmas", birthday: "Birthday", valentine: "Valentine's",
  "fathers-day": "Father's Day", "mothers-day": "Mother's Day", baby: "New Baby",
  sympathy: "Sympathy & Pet Loss", "get-well": "Get Well Soon",
  "thinking-of-you": "Thinking of You", "st-patricks": "St Patrick's", general: "General",
};

function placeholderSvg(title) {
  const safe = String(title).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
  const lines = safe.match(/.{1,22}/g) || [safe];
  const textRows = lines.slice(0, 3).map((l, i) =>
    `<text x="50%" y="${50 + i * 18}" dominant-baseline="middle" text-anchor="middle" fill="#2E7396" font-size="13" font-family="Georgia,serif">${l}</text>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#FFF8EE" rx="8"/><rect x="20" y="20" width="360" height="460" fill="none" stroke="#5FC0E6" stroke-width="2" stroke-dasharray="6 4" rx="6"/><text x="50%" y="36%" dominant-baseline="middle" text-anchor="middle" fill="#15719B" font-size="48">&#128062;</text>${textRows}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) { window.location = "index.html"; return; }

  let result = null;
  try {
    result = await fetchProduct(id);
  } catch (e) {
    window.location = "index.html"; return;
  }
  if (!result) { window.location = "index.html"; return; }

  const product = result.product;
  const mediaEntry = result.mediaEntry;
  if (!product.image) product.image = placeholderSvg(product.title);
  _currentProduct = product;

  document.title = `${product.title} — Nelson's Stor`;
  document.querySelector('meta[name="description"]').content = product.description;

  const catLabel = CATEGORY_LABELS[product.category] || product.category;
  document.getElementById("bc-cat").textContent = catLabel;
  document.getElementById("bc-title").textContent = product.title;

  const wrap = document.getElementById("product-detail-wrap");
  wrap.innerHTML = `
    <div class="product-page">
      <div class="product-page-inner">
        <div class="product-gallery">
          <div class="gallery-main" id="gallery-main">
            <img id="gallery-main-img" src="${esc(product.image)}" alt="${esc(product.title)}" fetchpriority="high" />
          </div>
          <div class="gallery-thumbs" id="gallery-thumbs"></div>
        </div>
        <div class="product-detail">
          <p class="product-detail__cat">${esc(catLabel)}${product.is_bundle ? " · Bundle" : ""}</p>
          <h1 class="product-detail__title">${esc(product.title)}</h1>
          <p class="product-detail__price">£${Number(product.price_gbp).toFixed(2)}</p>
          <p class="product-detail__desc">${esc(product.description)}</p>
          <div class="product-specs">
            <span class="spec-chip">Size: ${esc(product.size)}</span>
            <span class="spec-chip">${esc(product.gsm)}gsm card</span>
            <span class="spec-chip">Envelope included</span>
            <span class="spec-chip">Blank inside</span>
          </div>

          <div class="bundle-row">
            <span class="qty-label">Buy as a bundle</span>
            <div class="bundle-presets" id="bundle-presets">
              <button type="button" class="bundle-chip active" data-qty="1">1</button>
              <button type="button" class="bundle-chip" data-qty="2">2</button>
              <button type="button" class="bundle-chip" data-qty="5">5</button>
              <button type="button" class="bundle-chip" data-qty="10">10</button>
              <button type="button" class="bundle-chip" data-qty="20">20</button>
              <button type="button" class="bundle-chip" data-qty="50">50</button>
              <button type="button" class="bundle-chip" data-qty="100">100</button>
            </div>
          </div>

          <div class="qty-row">
            <span class="qty-label">Quantity</span>
            <div class="qty-ctrl">
              <button id="qty-minus" type="button" aria-label="Decrease quantity">−</button>
              <input id="qty-input" type="number" value="1" min="1" max="100" readonly aria-label="Quantity" />
              <button id="qty-plus" type="button" aria-label="Increase quantity">+</button>
            </div>
            <span class="qty-subtotal" id="qty-subtotal"></span>
          </div>

          <button class="btn-primary" id="add-to-basket-btn" type="button">
            ${svgIcon("cart")} Add to Basket
          </button>

          <div id="add-confirm" class="add-confirm">
            ${svgIcon("check")} Added to basket! <a href="cart.html">View basket →</a>
          </div>

          <div class="free-card-promise">
            ${svgIcon("gift")} <span><strong>Every order includes a surprise free card from Nelson.</strong> It's his way of saying thanks.</span>
          </div>

          <div class="free-card-promise" style="margin-top:0.5rem">
            ${svgIcon("truck")} <span>Each card printed fresh and dispatched within <strong>2–3 working days</strong>.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const addBtn = document.getElementById("add-to-basket-btn");
  if (product.stock_qty === 0) {
    addBtn.disabled = true;
    addBtn.classList.add("btn-soldout");
    addBtn.innerHTML = `${svgIcon("cart")} Sold out`;
  } else {
    addBtn.addEventListener("click", addToBasket);
  }

  buildGallery(product, mediaEntry);
  updateNudge();
  updateSubtotal();
}

function buildGallery(product, mediaEntry) {
  const images = (mediaEntry && mediaEntry.images && mediaEntry.images.length)
    ? mediaEntry.images : [product.image];
  const video = mediaEntry && mediaEntry.video ? mediaEntry.video : null;
  const poster = images[0];

  setMainImage(images[0], product.title);

  const thumbs = document.getElementById("gallery-thumbs");
  if (images.length <= 1 && !video) { thumbs.style.display = "none"; return; }

  let html = "";
  images.forEach((src, i) => {
    html += `<button class="gallery-thumb${i === 0 ? " active" : ""}" type="button" data-type="image" data-src="${esc(src)}" aria-label="View image ${i + 1}">
      <img src="${esc(src)}" alt="${esc(product.title)} view ${i + 1}" loading="lazy" />
    </button>`;
  });
  if (video) {
    html += `<button class="gallery-thumb gallery-thumb--video" type="button" data-type="video" data-src="${esc(video)}" data-poster="${esc(poster)}" aria-label="Play product video">
      <img src="${esc(poster)}" alt="Play video" loading="lazy" />
      <span class="gallery-play">${svgIcon("play")}</span>
    </button>`;
  }
  thumbs.innerHTML = html;

  thumbs.querySelectorAll(".gallery-thumb img").forEach((img) => {
    img.addEventListener("error", function handler() {
      img.removeEventListener("error", handler);
      img.style.opacity = 0;
    });
  });

  thumbs.querySelectorAll(".gallery-thumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      thumbs.querySelectorAll(".gallery-thumb").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.type === "video") {
        setMainVideo(btn.dataset.src, btn.dataset.poster);
      } else {
        setMainImage(btn.dataset.src, product.title);
      }
    });
  });
}

function setMainImage(src, title) {
  const main = document.getElementById("gallery-main");
  main.innerHTML = `<img id="gallery-main-img" src="${esc(src)}" alt="${esc(title)}" />`;
  const img = document.getElementById("gallery-main-img");
  img.addEventListener("error", function handler() {
    img.removeEventListener("error", handler);
    img.src = placeholderSvg(title);
  });
}

function setMainVideo(src, poster) {
  const main = document.getElementById("gallery-main");
  main.innerHTML = `<video id="gallery-main-video" src="${esc(src)}" poster="${esc(poster)}" controls autoplay muted playsinline loop></video>`;
}

function getQty() {
  return parseInt(document.getElementById("qty-input").value, 10) || 1;
}

function updateNudge() {
  const currentCartCount = cartCount();
  const qty = getQty();
  const total = currentCartCount + qty;
  const nudge = document.getElementById("postage-nudge");
  if (!nudge) return;
  if (currentCartCount >= 4 || total >= 4) {
    nudge.classList.remove("visible");
    return;
  }
  const need = 4 - total;
  if (need <= 2) {
    document.getElementById("nudge-count").textContent = need;
    nudge.classList.add("visible");
  } else {
    nudge.classList.remove("visible");
  }
}

// Clamp to 1–100, sync the bundle chips + live subtotal.
function setQty(n) {
  const q = Math.max(1, Math.min(100, parseInt(n, 10) || 1));
  const input = document.getElementById("qty-input");
  if (input) input.value = q;
  document.querySelectorAll(".bundle-chip").forEach((c) =>
    c.classList.toggle("active", parseInt(c.dataset.qty, 10) === q)
  );
  updateSubtotal();
  updateNudge();
}

function updateSubtotal() {
  const el = document.getElementById("qty-subtotal");
  if (!el || !_currentProduct) return;
  const q = getQty();
  el.textContent = q > 1 ? `£${(Number(_currentProduct.price_gbp) * q).toFixed(2)} total` : "";
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest && e.target.closest(".bundle-chip");
  if (chip) { setQty(chip.dataset.qty); return; }
  if (e.target.id === "qty-minus") setQty(getQty() - 1);
  if (e.target.id === "qty-plus") setQty(getQty() + 1);
});

function addToBasket() {
  if (!_currentProduct) return;
  addItem(_currentProduct, getQty());
  const confirm = document.getElementById("add-confirm");
  confirm.classList.add("visible");
  setTimeout(() => confirm.classList.remove("visible"), 4000);
  updateNudge();
}

document.addEventListener("DOMContentLoaded", initProductPage);
