// Newsletter signup (no inline handlers — CSP-friendly)
function handleEmailSignup(e) {
  e.preventDefault();
  e.target.innerHTML =
    '<p style="color:var(--gold-light);font-weight:600">Thanks! Nelson will be in touch.</p>';
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".email-form");
  if (form) form.addEventListener("submit", handleEmailSignup);
});
