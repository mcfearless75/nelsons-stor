// Packaging gallery image fallbacks (no inline handlers — CSP-friendly)
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".packaging-img img").forEach((img) => {
    img.addEventListener("error", function handler() {
      img.removeEventListener("error", handler);
      img.style.display = "none";
      const ph = img.parentElement.querySelector(".packaging-placeholder");
      if (ph) ph.style.display = "flex";
    });
  });
});
