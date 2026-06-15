const CART_KEY = "nelsons_cart";

// Escape strings before injecting into innerHTML (defence-in-depth for catalogue data).
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addItem(product, qty) {
  const cart = getCart();
  const idx = cart.findIndex((i) => i.id === product.id);
  if (idx > -1) {
    cart[idx] = { ...cart[idx], qty: cart[idx].qty + qty };
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      qty,
      price_gbp: product.price_gbp,
      image: product.image,
      size: product.size,
    });
  }
  saveCart(cart);
}

function removeItem(id) {
  saveCart(getCart().filter((i) => i.id !== id));
}

function updateQty(id, qty) {
  const cart = getCart();
  const idx = cart.findIndex((i) => i.id === id);
  if (idx > -1) {
    if (qty < 1) {
      cart.splice(idx, 1);
    } else {
      cart[idx] = { ...cart[idx], qty };
    }
    saveCart(cart);
  }
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

function cartTotal() {
  return getCart().reduce((sum, i) => sum + i.price_gbp * i.qty, 0);
}

function postageGbp() {
  return cartCount() >= 4 ? 0 : 1.5;
}

function updateCartBadge() {
  const count = cartCount();
  document.querySelectorAll(".cart-badge").forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? "inline-flex" : "none";
  });
}

document.addEventListener("DOMContentLoaded", updateCartBadge);
