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
  apiBaseUrl: string;
}

export interface SetLoadingMessage extends BridgeMessage {
  type: "SET_LOADING";
  loading: boolean;
}

export type OutboundMessage = InitMessage | SetLoadingMessage;

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
}

export interface ProductAddedMessage extends BridgeMessage {
  type: "PRODUCT_ADDED";
  userId: string;
}

export interface AddFailedMessage extends BridgeMessage {
  type: "ADD_FAILED";
  error: string;
  code: string;
}

export interface ModalClosedMessage extends BridgeMessage {
  type: "MODAL_CLOSED";
}

export type InboundMessage =
  | ButtonClickedMessage
  | UserSignedInMessage
  | ProductAddedMessage
  | AddFailedMessage
  | ModalClosedMessage;

// ── Custom-event detail shapes ──────────────────────────────────────────────

export interface NanatriButtonSignedInDetail {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface NanatriButtonAddedDetail {
  userId: string;
}

export interface NanatriButtonFailedDetail {
  error: string;
  code: string;
}
