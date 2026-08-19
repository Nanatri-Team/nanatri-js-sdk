export interface ModalElements {
  backdrop: HTMLDivElement;
  container: HTMLDivElement;
  formIframe: HTMLIFrameElement;
}

export function createModal(formSrc: string, sandbox = "allow-scripts allow-same-origin allow-forms"): ModalElements {
  const backdrop = document.createElement("div");
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "background:rgba(0,0,0,0.55)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "z-index:999999",
    "animation:nanatri-fade-in 0.15s ease",
  ].join(";");

  const container = document.createElement("div");
  container.style.cssText = [
    "background:#ffffff",
    "border-radius:12px",
    "width:440px",
    "max-width:95vw",
    "overflow:hidden",
    "box-shadow:0 20px 60px rgba(0,0,0,0.3)",
    "animation:nanatri-slide-up 0.2s ease",
  ].join(";");

  const formIframe = document.createElement("iframe");
  formIframe.src = formSrc;
  formIframe.setAttribute("sandbox", sandbox);
  formIframe.setAttribute("title", "Secure Payment Form");
  formIframe.style.cssText = "width:100%;height:520px;border:none;display:block;transition:height 0.25s ease;";

  container.appendChild(formIframe);
  backdrop.appendChild(container);

  return { backdrop, container, formIframe };
}

export function openModal(
  elements: ModalElements,
  onBackdropClick: () => void
): void {
  injectKeyframes();
  // Mounted directly on document.body — deliberately NOT inside the button's own shadow
  // root or any other in-page container. A `position:fixed` element is only positioned
  // relative to the viewport if no ancestor establishes a containing block for it (which
  // `transform`/`filter`/`contain`/`will-change` all do), and its z-index only wins against
  // siblings within its own stacking context. A merchant's page can put either of those on
  // some ancestor of wherever the widget happens to be embedded — mounting here instead
  // means neither can ever trap, clip, or reposition the modal.
  document.body.appendChild(elements.backdrop);
  // Only close when clicking the dark backdrop itself, not the card
  elements.backdrop.addEventListener("click", (e) => {
    if (e.target === elements.backdrop) onBackdropClick();
  });
  document.body.style.overflow = "hidden";
}

export function closeModal(elements: ModalElements): void {
  if (elements.backdrop.isConnected) {
    elements.backdrop.remove();
  }
  document.body.style.overflow = "";
}

// Injected once into the document, not per shadow root — the modal now lives in the light
// DOM (document.body), so one shared <style> covers every button instance on the page.
function injectKeyframes(): void {
  if (document.getElementById("nanatri-keyframes")) return;
  const style = document.createElement("style");
  style.id = "nanatri-keyframes";
  style.textContent = `
    @keyframes nanatri-fade-in { from { opacity:0 } to { opacity:1 } }
    @keyframes nanatri-slide-up { from { transform:translateY(16px);opacity:0 } to { transform:translateY(0);opacity:1 } }
  `;
  document.head.appendChild(style);
}
