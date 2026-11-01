// Mejora progresiva: botón de copiar en los bloques de código de la documentación.
document.querySelectorAll(".doc pre").forEach((block) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copiar";
  button.className = "copy";
  button.style.cssText =
    "position:absolute;top:8px;right:8px;font:inherit;font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid #24282e;background:#16191d;color:#9aa1ab;cursor:pointer";
  block.style.position = "relative";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(block.querySelector("code")?.textContent ?? "");
      button.textContent = "Copiado";
      setTimeout(() => (button.textContent = "Copiar"), 1500);
    } catch {
      button.textContent = "No se pudo";
    }
  });
  block.appendChild(button);
});
