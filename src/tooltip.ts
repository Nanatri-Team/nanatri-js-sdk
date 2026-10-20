// A tooltip mounted on document.body, positioned against an anchor element with position:fixed.
// Rendering it next to the button instead would let any ancestor with overflow:hidden (a product
// card, typically) clip it, whatever its z-index. Own shadow root, so the shop's CSS can't reach it.

const GAP = 10;      // between the anchor and the tooltip
const MARGIN = 8;    // minimum distance from the viewport edges

const STYLES = `
  .tooltip {
    position: fixed;
    z-index: 2147483000;
    max-width: 200px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #1F1F2B;
    color: #ffffff;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Georgian", Arial, sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    text-align: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .tooltip.visible { opacity: 1; }
  .arrow {
    position: absolute;
    left: var(--arrow-x, 50%);
    transform: translateX(-50%);
    border: 6px solid transparent;
  }
  .tooltip.below .arrow { bottom: 100%; border-bottom-color: #1F1F2B; }
  .tooltip.above .arrow { top: 100%; border-top-color: #1F1F2B; }
`;

export class FloatingTooltip {
  private readonly host: HTMLDivElement;
  private readonly box: HTMLDivElement;
  private readonly textEl: HTMLSpanElement;
  private anchor: HTMLElement | null = null;
  private readonly reposition = () => this.place();

  constructor() {
    this.host = document.createElement("div");
    const shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;

    this.box = document.createElement("div");
    this.box.className = "tooltip";
    this.box.setAttribute("role", "tooltip");
    this.textEl = document.createElement("span");
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    this.box.append(this.textEl, arrow);

    shadow.append(style, this.box);
  }

  show(anchor: HTMLElement, text: string): void {
    this.anchor = anchor;
    this.textEl.textContent = text;
    if (!this.host.isConnected) document.body.appendChild(this.host);
    this.place();
    this.box.classList.add("visible");
    // Capture: also catches scrolling inside any scrollable ancestor.
    window.addEventListener("scroll", this.reposition, true);
    window.addEventListener("resize", this.reposition);
  }

  hide(): void {
    this.anchor = null;
    this.box.classList.remove("visible");
    window.removeEventListener("scroll", this.reposition, true);
    window.removeEventListener("resize", this.reposition);
  }

  destroy(): void {
    this.hide();
    this.host.remove();
  }

  // Below the anchor and centred on it; above when there is no room below; kept inside the
  // viewport horizontally, with the arrow still pointing at the anchor.
  private place(): void {
    if (!this.anchor) return;
    const rect = this.anchor.getBoundingClientRect();
    const width = this.box.offsetWidth;
    const height = this.box.offsetHeight;

    const below = rect.bottom + GAP + height <= window.innerHeight - MARGIN || rect.top - GAP - height < MARGIN;
    const top = below ? rect.bottom + GAP : rect.top - GAP - height;

    const centre = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centre - width / 2, MARGIN), window.innerWidth - MARGIN - width);

    this.box.classList.toggle("below", below);
    this.box.classList.toggle("above", !below);
    this.box.style.top = `${Math.round(top)}px`;
    this.box.style.left = `${Math.round(left)}px`;
    this.box.style.setProperty("--arrow-x", `${Math.round(centre - left)}px`);
  }
}
