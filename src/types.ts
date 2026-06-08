export interface PayButtonAttributes {
  apiKey: string;
  amount: string;
  currency: string;
  label: string;
  color: string;
  textColor: string;
  width: string;
  height: string;
}

export interface BridgeMessage {
  type: string;
  version: string;
  [key: string]: unknown;
}

// ── Outbound (parent → iframe) ──────────────────────────────────────────────

export interface InitMessage extends BridgeMessage {
  type: "INIT";
  apiKey: string;
  amount: string;
  currency: string;
  color: string;
  textColor: string;
  label: string;
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

export interface PaymentSuccessMessage extends BridgeMessage {
  type: "PAYMENT_SUCCESS";
  amount: string;
  currency: string;
  transactionId: string;
}

export interface PaymentErrorMessage extends BridgeMessage {
  type: "PAYMENT_ERROR";
  error: string;
  code: string;
}

export interface CloseModalMessage extends BridgeMessage {
  type: "CLOSE_MODAL";
}

export type InboundMessage =
  | ButtonClickedMessage
  | PaymentSuccessMessage
  | PaymentErrorMessage
  | CloseModalMessage;

// ── Custom-event detail shapes ──────────────────────────────────────────────

export interface PayButtonSuccessDetail {
  amount: string;
  currency: string;
  transactionId: string;
}

export interface PayButtonErrorDetail {
  error: string;
  code: string;
}
