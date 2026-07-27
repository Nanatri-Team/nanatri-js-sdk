export interface NanatriButtonAttributes {
  merchantId: string;
  label: string;
  color: string;
  textColor: string;
  width: string;
  height: string;
  lang: string;
}

export interface BridgeMessage {
  type: string;
  version: string;
  [key: string]: unknown;
}

// ── Outbound (parent → iframe) ──────────────────────────────────────────────

export interface InitMessage extends BridgeMessage {
  type: "INIT";
  color: string;
  textColor: string;
  label: string;
  merchantSlug: string;
  itemId: string;
  apiBaseUrl: string;
  dashboardUrl: string;
  // Product display info for the form's success screen, sourced from the merchant's own
  // page rather than fetched — the item's backend snapshot isn't guaranteed to exist yet
  // (import/enrichment is async on the new-user OTP path).
  itemTitle?: string;
  itemImage?: string;
  itemPrice?: string;
  itemCurrency?: string;
}

export interface SetLoadingMessage extends BridgeMessage {
  type: "SET_LOADING";
  loading: boolean;
}

// Parent → button iframe only (the heart button fills in on success; the labeled button
// ignores it — it doesn't listen for this message type at all).
export interface SetAddedMessage extends BridgeMessage {
  type: "SET_ADDED";
  added: boolean;
}

export type OutboundMessage = InitMessage | SetLoadingMessage | SetAddedMessage;

// ── Inbound (iframe → parent) ───────────────────────────────────────────────

export interface ButtonClickedMessage extends BridgeMessage {
  type: "BUTTON_CLICKED";
}

export interface AuthUser {
  id: string;
  phoneNumber?: string;
  displayName?: string;
  accountType: string;
}

export interface UserSignedInMessage extends BridgeMessage {
  type: "USER_SIGNED_IN";
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
  requiresProfileCompletion: boolean;
}

export interface ProductAddedMessage extends BridgeMessage {
  type: "PRODUCT_ADDED";
  userId: string;
  // Only present on the silent-add (returning member) path — the new-user OTP path adds
  // the item asynchronously on the backend, so its id isn't known yet at this point.
  itemId?: string;
}

export interface AddFailedMessage extends BridgeMessage {
  type: "ADD_FAILED";
  error: string;
  code: string;
}

export interface ModalClosedMessage extends BridgeMessage {
  type: "MODAL_CLOSED";
}

// Sent once the form reaches the success screen, which can hold more content (the
// added-item preview, the recently-added list) than the phone/OTP screens ever need.
export interface ResizeModalMessage extends BridgeMessage {
  type: "RESIZE_MODAL";
  height: number;
}

export type InboundMessage =
  | ButtonClickedMessage
  | UserSignedInMessage
  | ProductAddedMessage
  | AddFailedMessage
  | ModalClosedMessage
  | ResizeModalMessage;

// ── Custom-event detail shapes ──────────────────────────────────────────────

export interface NanatriButtonSignedInDetail {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
  requiresProfileCompletion: boolean;
}

export interface NanatriButtonAddedDetail {
  userId: string;
  itemId?: string;
}

export interface NanatriButtonFailedDetail {
  error: string;
  code: string;
}
