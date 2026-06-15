function placeholderSvg(title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#F5E8D2" rx="6"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#C8973A" font-size="28">&#128062;</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function renderCart() {
  const cart = getCart();
  const wrap = document.getElementById("cart-wrap");
  const count = cartCount();
  const total = cartTotal();
  const postage = count >= 4 ? 0 : 1.5;
  const grandTotal = total + postage;
  const toFree = 4 - count;

  if (cart.length === 0) {
    wrap.innerHTML = `
      <div class="cart-empty">
        <p>Your basket is empty — Nelson is waiting to help!</p>
        <a href="index.html" class="btn-primary" style="display:inline-flex;width:auto;padding:0.85em 2em">Browse all cards</a>
      </div>
    `;
    return;
  }

  const itemsHtml = cart.map((item) => `
    <div class="cart-item" data-id="${esc(item.id)}">
      <img class="cart-item__img" src="${esc(item.image)}" alt="${esc(item.title)}" data-fallback-title="${esc(item.title)}" />
      <div class="cart-item__info">
        <div class="cart-item__title">${esc(item.title)}</div>
        <div class="cart-item__unit">£${Number(item.price_gbp).toFixed(2)} each · ${esc(item.size || "")}</div>
        <div class="cart-item__controls">
          <div class="qty-ctrl">
            <button type="button" data-act="dec" data-id="${esc(item.id)}" aria-label="Decrease quantity">−</button>
            <input type="number" value="${Number(item.qty)}" min="1" max="20" readonly aria-label="Quantity" />
            <button type="button" data-act="inc" data-id="${esc(item.id)}" aria-label="Increase quantity">+</button>
          </div>
          <button class="cart-item__remove" type="button" data-act="remove" data-id="${esc(item.id)}">Remove</button>
        </div>
      </div>
      <div class="cart-item__subtotal">£${(Number(item.price_gbp) * Number(item.qty)).toFixed(2)}</div>
    </div>
  `).join("");

  const thresholdMsg = toFree > 0 && toFree <= 3
    ? `<div class="postage-threshold-msg">${svgIcon("sparkles")} Add ${toFree} more card${toFree > 1 ? "s" : ""} for <strong>free UK postage</strong>!</div>`
    : "";

  const postageRow = postage === 0
    ? `<div class="summary-row postage-free"><span>UK Postage</span><span>FREE</span></div>`
    : `<div class="summary-row"><span>UK Postage</span><span>£${postage.toFixed(2)}</span></div>`;

  wrap.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">${itemsHtml}</div>
      <aside class="cart-summary">
        <h2>Order summary</h2>
        <div class="summary-row"><span>Cards (${count})</span><span>£${total.toFixed(2)}</span></div>
        ${postageRow}
        <hr class="summary-divider" />
        <div class="summary-total"><span>Total</span><span>£${grandTotal.toFixed(2)}</span></div>
        ${thresholdMsg}
        <button class="btn-primary" id="checkout-btn" type="button">
          ${svgIcon("lock")} Checkout securely
        </button>
        <a href="index.html" class="btn-secondary mt-2" style="display:flex;margin-top:0.75rem">
          ← Keep shopping
        </a>
        <p class="stripe-badge">${svgIcon("lock")} Secure checkout by Stripe</p>
        <div class="free-card-promise mt-2" style="font-size:0.8rem;margin-top:0.75rem">
          ${svgIcon("gift")} <span>Every order includes a <strong>surprise free card</strong> from Nelson.</span>
        </div>
      </aside>
    </div>
  `;

  wrap.querySelectorAll(".cart-item__img").forEach((img) => {
    img.addEventListener("error", function handler() {
      img.removeEventListener("error", handler);
      img.src = placeholderSvg(img.dataset.fallbackTitle || "");
    });
  });

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", goToCheckout);
}

// Event delegation for qty + remove (CSP-friendly, no inline handlers)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (btn.dataset.act === "remove") {
    removeItem(id);
    renderCart();
  } else if (btn.dataset.act === "dec" && item) {
    updateQty(id, item.qty - 1);
    renderCart();
  } else if (btn.dataset.act === "inc" && item) {
    updateQty(id, item.qty + 1);
    renderCart();
  }
});

document.addEventListener("DOMContentLoaded", renderCart);
