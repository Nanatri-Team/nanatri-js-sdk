import { PayButtonElement } from "./component";

export { PayButtonElement };
export type {
  PayButtonAttributes,
  PayButtonSuccessDetail,
  PayButtonErrorDetail,
  BridgeMessage,
  OutboundMessage,
  InboundMessage,
} from "./types";

if (typeof customElements !== "undefined" && !customElements.get("pay-button")) {
  customElements.define("pay-button", PayButtonElement);
}
