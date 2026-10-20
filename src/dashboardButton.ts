import { DASHBOARD_URL } from "./config";
import { createNanatriIcon } from "./nanatriIcon";

const OBSERVED_ATTRIBUTES = ["label", "locale", "color", "text-color", "width", "height"] as const;

// Default label per locale attribute; an explicit label attribute overrides it.
const DEFAULT_LABELS: Record<string, string> = {
  en: "View NANATRI",
  ka: "ნახე NANATRI",
};

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
        /* Design spec: hugs its content (159 × 44 with the default label). */
        gap: 8px;
        width: 100%;
        height: 100%;
        padding: 12px 20px;
        border-radius: 44px;
        border-bottom: 2px solid rgba(0, 0, 0, 0.15);
        cursor: pointer;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto,
                     "Noto Sans Georgian", Arial, sans-serif;
        font-size: 16px;
        line-height: 18px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
        transition: background 0.15s ease, transform 0.1s ease,
                    box-shadow 0.15s ease, opacity 0.15s ease;
      }
      button:hover {
        box-shadow: 0 4px 14px rgba(67, 67, 178, 0.35);
        opacity: 0.94;
      }
      button:active { box-shadow: none; }
      svg { flex-shrink: 0; }
    `;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.labelEl = document.createElement("span");
    this.button.append(createNanatriIcon(20), this.labelEl);
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
    const color = this.attr("color", "#6161D1"); // surface/action
    const textColor = this.attr("text-color", "#ffffff");
    const width = this.attr("width");
    const height = this.attr("height");

    this.button.style.backgroundColor = color;
    this.button.style.color = textColor;
    if (width) this.style.width = width;
    if (height) this.style.height = height;

    const locale = this.attr("locale", "en");
    const label = this.attr("label") || DEFAULT_LABELS[locale] || DEFAULT_LABELS.en;
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
