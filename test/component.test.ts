import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PayButtonElement } from "../src/component";
import { ALLOWED_ORIGIN } from "../src/bridge";

// Register once for all tests
if (!customElements.get("pay-button")) {
  customElements.define("pay-button", PayButtonElement);
}

function createElement(attrs: Record<string, string> = {}): PayButtonElement {
  const el = document.createElement("pay-button") as PayButtonElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function dispatch(type: string, data: Record<string, unknown> = {}): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: ALLOWED_ORIGIN,
      data: { type, version: "1", ...data },
    })
  );
}

describe("PayButtonElement registration", () => {
  it("is registered as pay-button custom element", () => {
    expect(customElements.get("pay-button")).toBe(PayButtonElement);
  });

  it("can be created via document.createElement", () => {
    const el = document.createElement("pay-button");
    expect(el).toBeInstanceOf(PayButtonElement);
  });
});

describe("Shadow DOM", () => {
  it("attaches an open shadow root", () => {
    const el = createElement();
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot!.mode).toBe("open");
  });

  it("renders a button iframe inside shadow root", () => {
    const el = createElement();
    document.body.appendChild(el);
    const iframe = el.shadowRoot!.querySelector("iframe");
    expect(iframe).not.toBeNull();
    document.body.removeChild(el);
  });
});

describe("Attributes → iframe src", () => {
  it("reflects label, color, text-color in button iframe src", () => {
    const el = createElement({
      label: "Buy now",
      color: "#ff0000",
      "text-color": "#000000",
    });
    document.body.appendChild(el);

    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("label=Buy+now");
    expect(src).toContain("color=%23ff0000");
    expect(src).toContain("textColor=%23000000");

    document.body.removeChild(el);
  });

  it("uses default values when optional attributes are absent", () => {
    const el = createElement();
    document.body.appendChild(el);

    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("label=Pay+now");
    expect(src).toContain("color=%231a1a2e");

    document.body.removeChild(el);
  });

  it("updates iframe src when attribute changes", () => {
    const el = createElement({ label: "Pay" });
    document.body.appendChild(el);

    el.setAttribute("label", "Donate");
    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("label=Donate");

    document.body.removeChild(el);
  });

  it("reflects width and height onto iframe style", () => {
    const el = createElement({ width: "300px", height: "60px" });
    document.body.appendChild(el);

    const iframe = el.shadowRoot!.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.style.width).toBe("300px");
    expect(iframe.style.height).toBe("60px");

    document.body.removeChild(el);
  });
});

describe("postMessage origin validation", () => {
  it("ignores messages from a wrong origin", () => {
    const el = createElement();
    document.body.appendChild(el);

    const listener = vi.fn();
    el.addEventListener("pay-button:click", listener);

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://attacker.com",
        data: { type: "BUTTON_CLICKED", version: "1" },
      })
    );

    expect(listener).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it("ignores messages missing the version field", () => {
    const el = createElement();
    document.body.appendChild(el);

    const listener = vi.fn();
    el.addEventListener("pay-button:click", listener);

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ALLOWED_ORIGIN,
        data: { type: "BUTTON_CLICKED" },
      })
    );

    expect(listener).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });
});

describe("Custom events from correct-origin messages", () => {
  let el: PayButtonElement;

  beforeEach(() => {
    el = createElement({ "api-key": "k_test", amount: "9.99" });
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (el.isConnected) document.body.removeChild(el);
  });

  it("dispatches pay-button:click on BUTTON_CLICKED", () => {
    const spy = vi.fn();
    el.addEventListener("pay-button:click", spy);
    dispatch("BUTTON_CLICKED");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("dispatches pay-button:open when modal opens", () => {
    const spy = vi.fn();
    el.addEventListener("pay-button:open", spy);
    dispatch("BUTTON_CLICKED");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("dispatches pay-button:success with detail on PAYMENT_SUCCESS", () => {
    const spy = vi.fn();
    el.addEventListener("pay-button:success", spy);
    dispatch("PAYMENT_SUCCESS", {
      amount: "9.99",
      currency: "USD",
      transactionId: "txn_xyz",
    });
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ amount: "9.99", currency: "USD", transactionId: "txn_xyz" });
  });

  it("dispatches pay-button:error with detail on PAYMENT_ERROR", () => {
    const spy = vi.fn();
    el.addEventListener("pay-button:error", spy);
    dispatch("PAYMENT_ERROR", { error: "Card declined", code: "DECLINED" });
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ error: "Card declined", code: "DECLINED" });
  });

  it("dispatches pay-button:close on CLOSE_MODAL", () => {
    // First open, then close
    dispatch("BUTTON_CLICKED");
    const spy = vi.fn();
    el.addEventListener("pay-button:close", spy);
    dispatch("CLOSE_MODAL");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("Modal lifecycle", () => {
  let el: PayButtonElement;

  beforeEach(() => {
    el = createElement({ "api-key": "k_test", amount: "9.99" });
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (el.isConnected) document.body.removeChild(el);
  });

  it("appends modal backdrop to shadow root on BUTTON_CLICKED", () => {
    expect(el.shadowRoot!.querySelectorAll("div").length).toBe(0);
    dispatch("BUTTON_CLICKED");
    expect(el.shadowRoot!.querySelectorAll("div").length).toBeGreaterThan(0);
  });

  it("removes modal backdrop from shadow root on CLOSE_MODAL", () => {
    dispatch("BUTTON_CLICKED");
    expect(el.shadowRoot!.querySelectorAll("div").length).toBeGreaterThan(0);
    dispatch("CLOSE_MODAL");
    expect(el.shadowRoot!.querySelectorAll("div[style*='fixed']").length).toBe(0);
  });

  it("does not open a second modal if already open", () => {
    dispatch("BUTTON_CLICKED");
    const backdropCount = el.shadowRoot!.querySelectorAll("div").length;
    dispatch("BUTTON_CLICKED");
    expect(el.shadowRoot!.querySelectorAll("div").length).toBe(backdropCount);
  });

  it("dispatches pay-button:close when modal closes after PAYMENT_SUCCESS", () => {
    dispatch("BUTTON_CLICKED");
    const spy = vi.fn();
    el.addEventListener("pay-button:close", spy);
    dispatch("PAYMENT_SUCCESS", {
      amount: "9.99",
      currency: "USD",
      transactionId: "txn_abc",
    });
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("disconnectedCallback — no memory leaks", () => {
  it("removes the window message listener on disconnect", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const el = createElement();
    document.body.appendChild(el);
    document.body.removeChild(el);

    const calls = removeSpy.mock.calls.filter(([event]) => event === "message");
    expect(calls.length).toBeGreaterThanOrEqual(1);

    removeSpy.mockRestore();
  });

  it("no longer fires custom events after being disconnected", () => {
    const el = createElement();
    document.body.appendChild(el);

    const spy = vi.fn();
    el.addEventListener("pay-button:click", spy);

    document.body.removeChild(el);
    dispatch("BUTTON_CLICKED");

    expect(spy).not.toHaveBeenCalled();
  });
});
