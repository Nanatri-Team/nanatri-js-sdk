import { describe, it, expect, vi } from "vitest";
import { createMessageListener, sendMessage, ALLOWED_ORIGIN } from "../src/bridge";
import type { InitMessage } from "../src/types";

describe("createMessageListener", () => {
  it("ignores messages from a wrong origin", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);

    listener(
      new MessageEvent("message", {
        origin: "https://evil.com",
        data: { type: "BUTTON_CLICKED", version: "1" },
      })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores messages with no version field", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);

    listener(
      new MessageEvent("message", {
        origin: ALLOWED_ORIGIN,
        data: { type: "BUTTON_CLICKED" },
      })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores messages where version is not a string", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);

    listener(
      new MessageEvent("message", {
        origin: ALLOWED_ORIGIN,
        data: { type: "BUTTON_CLICKED", version: 1 },
      })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores null/undefined data", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);

    listener(new MessageEvent("message", { origin: ALLOWED_ORIGIN, data: null }));
    listener(new MessageEvent("message", { origin: ALLOWED_ORIGIN, data: undefined }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler for a valid message from the allowed origin", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);
    const msg = { type: "BUTTON_CLICKED", version: "1" };

    listener(new MessageEvent("message", { origin: ALLOWED_ORIGIN, data: msg }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("calls handler for PAYMENT_SUCCESS with correct payload", () => {
    const handler = vi.fn();
    const listener = createMessageListener(handler);
    const msg = {
      type: "PAYMENT_SUCCESS",
      version: "1",
      amount: "49.99",
      currency: "USD",
      transactionId: "txn_abc123",
    };

    listener(new MessageEvent("message", { origin: ALLOWED_ORIGIN, data: msg }));

    expect(handler).toHaveBeenCalledWith(msg);
  });
});

describe("sendMessage", () => {
  it("calls postMessage on the target window with the allowed origin", () => {
    const fakeWindow = { postMessage: vi.fn() } as unknown as Window;
    const msg: InitMessage = {
      type: "INIT",
      version: "1",
      apiKey: "pk_test_123",
      amount: "9.99",
      currency: "USD",
      color: "#1a1a2e",
      textColor: "#ffffff",
      label: "Pay now",
    };

    sendMessage(fakeWindow, msg);

    expect(fakeWindow.postMessage).toHaveBeenCalledOnce();
    expect(fakeWindow.postMessage).toHaveBeenCalledWith(msg, ALLOWED_ORIGIN);
  });

  it("sends SET_LOADING with the allowed origin", () => {
    const fakeWindow = { postMessage: vi.fn() } as unknown as Window;

    sendMessage(fakeWindow, { type: "SET_LOADING", version: "1", loading: true });

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      { type: "SET_LOADING", version: "1", loading: true },
      ALLOWED_ORIGIN
    );
  });
});
