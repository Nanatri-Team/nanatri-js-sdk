import { ALLOWED_ORIGIN, sendMessage } from "./bridge";
import { createModal, openModal, closeModal, ModalElements } from "./modal";
import type {
  BridgeMessage,
  NanatriButtonSignedInDetail,
  NanatriButtonAddedDetail,
  NanatriButtonFailedDetail,
} from "./types";

const BUTTON_FRAME_SRC = `${ALLOWED_ORIGIN}/frames/button/index.html`;
const FORM_FRAME_SRC = `${ALLOWED_ORIGIN}/frames/form/index.html`;

const OBSERVED_ATTRIBUTES = [
  "merchant-id",
  "label",
  "color",
  "text-color",
  "width",
  "height",
  "lang",
] as const;

export class NanatriButtonElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  private readonly shadow: ShadowRoot;
  private readonly buttonIframe: HTMLIFrameElement;
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
    this.buttonIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    this.buttonIframe.setAttribute("title", "Nanatri Button");
    this.buttonIframe.setAttribute("scrolling", "no");
    this.buttonIframe.style.cssText = "border:none;display:block;overflow:hidden;";

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.buttonIframe);
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
      this.buttonIframe.style.visibility = "";
      this.updateIframeSrc();
      this.updateIframeSize();
      this.attachMessageListener();
    });
  }

  disconnectedCallback(): void {
    this.removeMessageListener();
    if (this.isModalOpen && this.modalElements) {
      closeModal(this.shadow, this.modalElements);
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
      console.error("[nanatri-js-sdk] merchant-id is a required attribute on <nanatri-button>.");
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
    const params = new URLSearchParams({
      lang:      this.attr("lang", "en"),
      color:     this.attr("color", "#5956E9"),
      textColor: this.attr("text-color", "#ffffff"),
    });
    if (this.getAttribute("label")) params.set("label", this.attr("label"));
    this.buttonIframe.src = `${BUTTON_FRAME_SRC}?${params}`;
  }

  private updateIframeSize(): void {
    const w = this.attr("width", "200px");
    const h = this.attr("height", "48px");
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
        this.dispatchCustomEvent("nanatri-button:signed-in", detail);
        break;
      }

      case "PRODUCT_ADDED": {
        const detail: NanatriButtonAddedDetail = {
          userId: msg.userId as string,
        };
        this.sendLoadingToForm(false);
        this.dispatchCustomEvent("nanatri-button:added", detail);
        this.closePaymentModal();
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
    }
  }

  private openModal(): void {
    if (this.isModalOpen) return;

    const params = new URLSearchParams({
      color:     this.attr("color", "#5956E9"),
      textColor: this.attr("text-color", "#ffffff"),
      lang:      this.attr("lang", "en"),
    });
    const formSrc = `${FORM_FRAME_SRC}?${params}`;

    this.modalElements = createModal(formSrc, "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");

    openModal(this.shadow, this.modalElements, () => this.closePaymentModal());

    this.isModalOpen = true;
    this.dispatchCustomEvent("nanatri-button:opened");

    this.modalElements.formIframe.addEventListener(
      "load",
      () => {
        if (this.modalElements?.formIframe.contentWindow) {
          sendMessage(this.modalElements.formIframe.contentWindow, {
            type: "INIT",
            version: "1",
            color:     this.attr("color", "#5956E9"),
            textColor: this.attr("text-color", "#ffffff"),
            label:     this.attr("label", ""),
          });
        }
      },
      { once: true }
    );
  }

  private closePaymentModal(): void {
    if (!this.isModalOpen || !this.modalElements) return;
    closeModal(this.shadow, this.modalElements);
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
