export interface ModalElements {
  backdrop: HTMLDivElement;
  container: HTMLDivElement;
  formIframe: HTMLIFrameElement;
}

export function createModal(formSrc: string): ModalElements {
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
  formIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  formIframe.setAttribute("title", "Secure Payment Form");
  formIframe.style.cssText = "width:100%;height:520px;border:none;display:block;";

  container.appendChild(formIframe);
  backdrop.appendChild(container);

  return { backdrop, container, formIframe };
}

export function openModal(
  root: ShadowRoot,
  elements: ModalElements,
  onBackdropClick: () => void
): void {
  injectKeyframes(root);
  root.appendChild(elements.backdrop);
  // Only close when clicking the dark backdrop itself, not the card
  elements.backdrop.addEventListener("click", (e) => {
    if (e.target === elements.backdrop) onBackdropClick();
  });
  document.body.style.overflow = "hidden";
}

export function closeModal(root: ShadowRoot, elements: ModalElements): void {
  if (elements.backdrop.isConnected) {
    root.removeChild(elements.backdrop);
  }
  document.body.style.overflow = "";
}

// Inject once per shadow root
function injectKeyframes(root: ShadowRoot): void {
  if (root.querySelector("#nanatri-keyframes")) return;
  const style = document.createElement("style");
  style.id = "nanatri-keyframes";
  style.textContent = `
    @keyframes nanatri-fade-in { from { opacity:0 } to { opacity:1 } }
    @keyframes nanatri-slide-up { from { transform:translateY(16px);opacity:0 } to { transform:translateY(0);opacity:1 } }
  `;
  root.insertBefore(style, root.firstChild);
}
