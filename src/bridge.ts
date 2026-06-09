import type { BridgeMessage, OutboundMessage } from "./types";

const FALLBACK_ORIGIN = "https://nanatri-js-sdk.georgemaevsky.workers.dev";

function detectOrigin(): string {
  if (typeof document === "undefined") return FALLBACK_ORIGIN;
  const scripts = document.querySelectorAll<HTMLScriptElement>("script[src]");
  for (const script of Array.from(scripts)) {
    if (script.src.includes("sdk")) {
      try {
        return new URL(script.src).origin;
      } catch {
        // ignore malformed URLs
      }
    }
  }
  return FALLBACK_ORIGIN;
}

export const ALLOWED_ORIGIN = detectOrigin();

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
