import type { BridgeMessage, OutboundMessage } from "./types";

export const ALLOWED_ORIGIN =
  typeof location !== "undefined" && location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://nanatri-js-sdk.georgemaevsky.workers.dev";

export type MessageHandler = (message: BridgeMessage) => void;

export function sendMessage(target: Window, message: OutboundMessage): void {
  target.postMessage(message, ALLOWED_ORIGIN);
}

export function createMessageListener(
  handler: MessageHandler
): (event: MessageEvent) => void {
  return function listener(event: MessageEvent): void {
    if (event.origin !== ALLOWED_ORIGIN) return;
    const data = event.data as BridgeMessage;
    if (!data || typeof data.version !== "string") return;
    handler(data);
  };
}
