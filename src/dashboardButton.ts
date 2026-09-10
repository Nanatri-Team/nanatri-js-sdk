import { DASHBOARD_URL } from "./config";

const OBSERVED_ATTRIBUTES = ["label", "color", "text-color", "width", "height"] as const;

// A plain redirect button — unlike NanatriBaseButtonElement's variants, it has no form flow or
// merchant verification to isolate in an iframe, so it renders directly into its own shadow root.
export class NanatriDashboardButtonElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  private readonly button: HTMLButtonElement;
  private readonly labelEl: HTMLSpanElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { display: inline-block; line-height: 0; }
      button {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 100%;
        min-width: 180px;
        min-height: 48px;
        padding: 0 20px;
        border-radius: 8px;
        cursor: pointer;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto,
                     "Noto Sans Georgian", Arial, sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.01em;
        white-space: nowrap;
        transition: background 0.15s ease, transform 0.1s ease,
                    box-shadow 0.15s ease, opacity 0.15s ease;
      }
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(89, 86, 233, 0.35);
        opacity: 0.92;
      }
      button:active { transform: translateY(0); box-shadow: none; }
      .arrow { transition: transform 0.15s ease; }
      button:hover .arrow { transform: translateX(2px); }
    `;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.labelEl = document.createElement("span");
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    this.button.append(this.labelEl, arrow);
    this.button.addEventListener("click", () => this.handleClick());

    shadow.append(style, this.button);
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private attr(name: string, fallback = ""): string {
    return this.getAttribute(name) ?? fallback;
  }

  private render(): void {
    const color = this.attr("color", "#5956E9");
    const textColor = this.attr("text-color", "#ffffff");
    const width = this.attr("width");
    const height = this.attr("height");

    this.button.style.backgroundColor = color;
    this.button.style.color = textColor;
    if (width) this.style.width = width;
    if (height) this.style.height = height;

    const label = this.attr("label", "Go to Dashboard");
    this.button.setAttribute("aria-label", label);
    this.labelEl.textContent = label;
  }

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent("nanatri-dashboard-button:clicked", { bubbles: true, composed: true })
    );
    window.open(DASHBOARD_URL, "_blank", "noopener");
  }
}
