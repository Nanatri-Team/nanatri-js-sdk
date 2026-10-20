import { ALLOWED_ORIGIN, sendMessage } from "./bridge";
import { createModal, openModal, closeModal, ModalElements } from "./modal";
import { FloatingTooltip } from "./tooltip";
import type {
  BridgeMessage,
  NanatriButtonSignedInDetail,
  NanatriButtonAddedDetail,
  NanatriButtonFailedDetail,
} from "./types";

const FORM_FRAME_SRC = `${ALLOWED_ORIGIN}/frames/form/index.html`;

const OBSERVED_ATTRIBUTES = [
  "merchant-id",
  "item-id",
  "item-title",
  "item-image",
  "item-price",
  "item-currency",
  "label",
  "color",
  "text-color",
  "width",
  "height",
  "lang",
] as const;

// Shared behavior for every Nanatri button variant — opening the modal, the whole
// postMessage bridge, INIT/loading/added state. Variants (the labeled button vs. the
// icon-only heart button) differ only in which small iframe renders the clickable control
// itself and its default size; each subclass just points at its own frame.
// Shown under the labeled button on hover and keyboard focus (see FloatingTooltip).
const TOOLTIP_TEXT: Record<string, string> = {
  en: "Add to NANATRI and start crowdfunding",
  ka: "დაამატე NANATRI-ში და დაიწყე თანხის შეგროვება",
};

abstract class NanatriBaseButtonElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  protected abstract readonly buttonFrameSrc: string;
  protected abstract readonly defaultWidth: string;
  protected abstract readonly defaultHeight: string;
  protected abstract readonly frameTitle: string;
  protected readonly showTooltip: boolean = false;

  private readonly shadow: ShadowRoot;
  private readonly buttonIframe: HTMLIFrameElement;
  private tooltip: FloatingTooltip | null = null;
  private modalElements: ModalElements | null = null;
  private isModalOpen = false;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private verified = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `:host { display: inline-block; line-height: 0; }`;

    this.buttonIframe = document.createElement("iframe");
    // The click happens in this frame, so it is the one that opens the sign-in popup
    // (allow-popups) or, in redirect mode, sends the shop's tab to the dashboard
    // (allow-top-navigation-by-user-activation).
    this.buttonIframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    );
    this.buttonIframe.setAttribute("scrolling", "no");
    this.buttonIframe.style.cssText = "border:none;display:block;overflow:hidden;";

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.buttonIframe);

    // Hovering the button frame counts as hovering this element; focus comes from Tab.
    this.addEventListener("mouseenter", () => this.showTooltipNow());
    this.addEventListener("mouseleave", () => this.tooltip?.hide());
    this.addEventListener("focusin", () => this.showTooltipNow());
    this.addEventListener("focusout", () => this.tooltip?.hide());
  }

  private tooltipText(): string {
    return TOOLTIP_TEXT[this.attr("lang", "en")] ?? TOOLTIP_TEXT.en;
  }

  private showTooltipNow(): void {
    if (!this.showTooltip || !this.verified || this.isModalOpen) return;
    this.tooltip ??= new FloatingTooltip();
    this.tooltip.show(this, this.tooltipText());
  }

  connectedCallback(): void {
    this.buttonIframe.style.visibility = "hidden";
    this.verifyMerchant().then((ok) => {
      if (!this.isConnected) return;
      if (!ok) {
        this.dispatchCustomEvent("nanatri-button:error", {
          error: "Merchant not registered",
          code: "MERCHANT_NOT_VERIFIED",
        });
        return;
      }
      this.verified = true;
      this.buttonIframe.setAttribute("title", this.frameTitle);
      this.buttonIframe.style.visibility = "";
      this.updateIframeSrc();
      this.updateIframeSize();
      this.attachMessageListener();
    });
  }

  disconnectedCallback(): void {
    this.removeMessageListener();
    this.tooltip?.destroy();
    this.tooltip = null;
    if (this.isModalOpen && this.modalElements) {
      closeModal(this.modalElements);
    }
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (oldValue === newValue) return;
    if (name === "merchant-id") {
      this.verified = false;
      this.buttonIframe.style.visibility = "hidden";
      this.removeMessageListener();
      this.connectedCallback();
      return;
    }
    if (!this.verified) return;
    this.updateIframeSrc();
    this.updateIframeSize();
  }

  private async verifyMerchant(): Promise<boolean> {
    const merchantId = this.attr("merchant-id");
    if (!merchantId) {
      console.error("[nanatri-js-sdk] merchant-id is a required attribute on the Nanatri button element.");
      return false;
    }

    // TODO: replace mock with real call when backend is ready
    // const res = await fetch(
    //   `${ALLOWED_ORIGIN}/api/v1/merchants/verify?merchantId=${encodeURIComponent(merchantId)}`
    // );
    // const data = await res.json();
    // return data.verified === true;

    return Promise.resolve(true);
  }

  private attr(name: string, fallback = ""): string {
    return this.getAttribute(name) ?? fallback;
  }

  private updateIframeSrc(): void {
    // The tooltip is drawn outside this element, so screen readers get its text from here.
    if (this.showTooltip) this.buttonIframe.setAttribute("aria-description", this.tooltipText());

    const params = new URLSearchParams({
      lang:         this.attr("lang", "en"),
      // For redirect mode, which starts in this frame.
      merchantSlug: this.attr("merchant-id"),
      itemId:       this.attr("item-id"),
    });
    // Colours only when the shop sets them; otherwise the frame keeps the Nanatri design.
    if (this.getAttribute("color")) params.set("color", this.attr("color"));
    if (this.getAttribute("text-color")) params.set("textColor", this.attr("text-color"));
    if (this.getAttribute("label")) params.set("label", this.attr("label"));
    this.buttonIframe.src = `${this.buttonFrameSrc}?${params}`;
  }

  private updateIframeSize(): void {
    const w = this.attr("width", this.defaultWidth);
    const h = this.attr("height", this.defaultHeight);
    this.buttonIframe.style.width = w;
    this.buttonIframe.style.height = h;
    this.style.width = w;
    this.style.height = h;
  }

  private attachMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      if (event.origin !== ALLOWED_ORIGIN) return;
      const fromButton = event.source === this.buttonIframe.contentWindow;
      const fromForm = !!this.modalElements && event.source === this.modalElements.formIframe.contentWindow;
      if (!fromButton && !fromForm) return;
      const data = event.data as BridgeMessage;
      if (!data || typeof data.version !== "string") return;
      this.handleMessage(data);
    };
    window.addEventListener("message", this.messageListener);
  }

  private removeMessageListener(): void {
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }
  }

  private handleMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case "BUTTON_CLICKED":
        this.dispatchCustomEvent("nanatri-button:clicked");
        this.openModal();
        break;

      case "USER_SIGNED_IN": {
        const detail: NanatriButtonSignedInDetail = {
          userId: msg.userId as string,
        };
        // The form shows an in-modal confirmation screen instead of us navigating
        // away — stay on the merchant page and leave the modal open.
        this.dispatchCustomEvent("nanatri-button:signed-in", detail);
        break;
      }

      case "PRODUCT_ADDED": {
        const detail: NanatriButtonAddedDetail = {
          userId: msg.userId as string,
          itemId: msg.itemId as string | undefined,
        };
        this.sendLoadingToForm(false);
        this.sendAddedToButton(true);
        this.dispatchCustomEvent("nanatri-button:added", detail);
        // Modal stays open showing the form's success screen; it closes when the
        // user dismisses it (MODAL_CLOSED).
        break;
      }

      case "ADD_FAILED": {
        const detail: NanatriButtonFailedDetail = {
          error: msg.error as string,
          code: msg.code as string,
        };
        this.sendLoadingToForm(false);
        this.dispatchCustomEvent("nanatri-button:failed", detail);
        break;
      }

      case "MODAL_CLOSED":
        this.closePaymentModal();
        break;

      case "RESIZE_MODAL": {
        const height = msg.height as number;
        if (this.modalElements && typeof height === "number" && height > 0) {
          this.modalElements.formIframe.style.height = `${height}px`;
        }
        break;
      }
    }
  }

  private openModal(): void {
    this.tooltip?.hide();
    if (this.isModalOpen) return;

    const params = new URLSearchParams({
      color:        this.attr("color", "#5956E9"),
      textColor:    this.attr("text-color", "#ffffff"),
      lang:         this.attr("lang", "en"),
      merchantSlug: this.attr("merchant-id"),
      itemId:       this.attr("item-id"),
      itemTitle:    this.attr("item-title"),
      itemImage:    this.attr("item-image"),
      itemPrice:    this.attr("item-price"),
      itemCurrency: this.attr("item-currency"),
    });
    const formSrc = `${FORM_FRAME_SRC}?${params}`;

    this.modalElements = createModal(formSrc, "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation");

    openModal(this.modalElements, () => this.closePaymentModal());

    this.isModalOpen = true;
    this.dispatchCustomEvent("nanatri-button:opened");

    this.modalElements.formIframe.addEventListener(
      "load",
      () => {
        if (this.modalElements?.formIframe.contentWindow) {
          sendMessage(this.modalElements.formIframe.contentWindow, {
            type:         "INIT",
            version:      "1",
            color:        this.attr("color", "#5956E9"),
            textColor:    this.attr("text-color", "#ffffff"),
            label:        this.attr("label", ""),
            merchantSlug: this.attr("merchant-id"),
            itemId:       this.attr("item-id"),
            itemTitle:    this.attr("item-title"),
            itemImage:    this.attr("item-image"),
            itemPrice:    this.attr("item-price"),
            itemCurrency: this.attr("item-currency"),
          });
        }
      },
      { once: true }
    );
  }

  private closePaymentModal(): void {
    if (!this.isModalOpen || !this.modalElements) return;
    closeModal(this.modalElements);
    this.modalElements = null;
    this.isModalOpen = false;
    this.dispatchCustomEvent("nanatri-button:closed");
  }

  private sendLoadingToForm(loading: boolean): void {
    if (this.modalElements?.formIframe.contentWindow) {
      sendMessage(this.modalElements.formIframe.contentWindow, {
        type: "SET_LOADING",
        version: "1",
        loading,
      });
    }
  }

  // Lets the button iframe itself react (e.g. the heart button fills in) — harmless no-op
  // for variants whose frame doesn't listen for SET_ADDED, like the labeled button.
  private sendAddedToButton(added: boolean): void {
    if (this.buttonIframe.contentWindow) {
      sendMessage(this.buttonIframe.contentWindow, {
        type: "SET_ADDED",
        version: "1",
        added,
      });
    }
  }

  private dispatchCustomEvent(name: string, detail?: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail: detail ?? null,
      })
    );
  }
}

export class NanatriButtonElement extends NanatriBaseButtonElement {
  protected readonly buttonFrameSrc = `${ALLOWED_ORIGIN}/frames/button/index.html`;
  protected readonly defaultWidth = "200px";
  protected readonly defaultHeight = "48px";
  protected readonly frameTitle = "Nanatri Button";
  protected readonly showTooltip = true;
}

// Icon-only "add to wishlist" heart, for placements (product cards, image overlays) where a
// full labeled button doesn't fit. Same modal/flow as <nanatri-button> — see
// NanatriBaseButtonElement — just a different clickable control.
export class NanatriHeartButtonElement extends NanatriBaseButtonElement {
  protected readonly buttonFrameSrc = `${ALLOWED_ORIGIN}/frames/heart-button/index.html`;
  protected readonly defaultWidth = "44px";
  protected readonly defaultHeight = "44px";
  protected readonly frameTitle = "Nanatri Wishlist Heart Button";
}
