import { NanatriButtonElement, NanatriHeartButtonElement } from "./component";

export { NanatriButtonElement, NanatriHeartButtonElement };
export type {
  NanatriButtonAttributes,
  NanatriButtonSignedInDetail,
  NanatriButtonAddedDetail,
  NanatriButtonFailedDetail,
  BridgeMessage,
  OutboundMessage,
  InboundMessage,
} from "./types";

if (typeof customElements !== "undefined") {
  if (!customElements.get("nanatri-button")) {
    customElements.define("nanatri-button", NanatriButtonElement);
  }
  if (!customElements.get("nanatri-heart-button")) {
    customElements.define("nanatri-heart-button", NanatriHeartButtonElement);
  }
}
