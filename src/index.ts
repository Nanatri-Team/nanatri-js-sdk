import { NanatriButtonElement, NanatriHeartButtonElement } from "./component";
import { NanatriDashboardButtonElement } from "./dashboardButton";

export { NanatriButtonElement, NanatriHeartButtonElement, NanatriDashboardButtonElement };
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
  if (!customElements.get("nanatri-dashboard-button")) {
    customElements.define("nanatri-dashboard-button", NanatriDashboardButtonElement);
  }
}
