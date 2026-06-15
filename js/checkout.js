async function goToCheckout() {
  const cart = getCart();
  if (!cart.length) return;

  const btn = document.getElementById("checkout-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Taking you to checkout…";
  }

  const items = cart.map((i) => ({ id: i.id, quantity: i.qty }));

  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const { url, error } = await res.json();
    if (error) {
      alert("Checkout error: " + error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Checkout securely";
      }
      return;
    }
    if (typeof url === "string" && url.startsWith("https://checkout.stripe.com/")) {
      window.location = url;
    } else {
      alert("Unexpected checkout response. Please try again.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Checkout securely";
      }
    }
  } catch {
    alert("Something went wrong. Please try again.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Checkout securely";
    }
  }
}
