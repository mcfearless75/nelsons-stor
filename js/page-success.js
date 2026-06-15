// Clear the basket once an order is confirmed
document.addEventListener("DOMContentLoaded", () => {
  if (typeof clearCart === "function") clearCart();
});
