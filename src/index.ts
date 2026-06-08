import { NanatriButtonElement } from "./component";

export { NanatriButtonElement };
export type {
  NanatriButtonAttributes,
  NanatriButtonSignedInDetail,
  NanatriButtonAddedDetail,
  NanatriButtonFailedDetail,
  BridgeMessage,
  OutboundMessage,
  InboundMessage,
} from "./types";

if (typeof customElements !== "undefined" && !customElements.get("nanatri-button")) {
  customElements.define("nanatri-button", NanatriButtonElement);
}
