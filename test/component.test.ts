import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NanatriButtonElement } from "../src/component";
import { ALLOWED_ORIGIN } from "../src/bridge";

// Register once for all tests
if (!customElements.get("nanatri-button")) {
  customElements.define("nanatri-button", NanatriButtonElement);
}

function createElement(attrs: Record<string, string> = {}): NanatriButtonElement {
  const el = document.createElement("nanatri-button") as NanatriButtonElement;
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

describe("NanatriButtonElement registration", () => {
  it("is registered as nanatri-button custom element", () => {
    expect(customElements.get("nanatri-button")).toBe(NanatriButtonElement);
  });

  it("can be created via document.createElement", () => {
    const el = document.createElement("nanatri-button");
    expect(el).toBeInstanceOf(NanatriButtonElement);
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
      label: "Save",
      color: "#ff0000",
      "text-color": "#000000",
    });
    document.body.appendChild(el);

    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("label=Save");
    expect(src).toContain("color=%23ff0000");
    expect(src).toContain("textColor=%23000000");

    document.body.removeChild(el);
  });

  it("uses default values when optional attributes are absent", () => {
    const el = createElement();
    document.body.appendChild(el);

    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("color=%235956E9");

    document.body.removeChild(el);
  });

  it("updates iframe src when attribute changes", () => {
    const el = createElement({ label: "Save" });
    document.body.appendChild(el);

    el.setAttribute("label", "Add to list");
    const src = el.shadowRoot!.querySelector("iframe")!.src;
    expect(src).toContain("label=Add+to+list");

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
    el.addEventListener("nanatri-button:clicked", listener);

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
    el.addEventListener("nanatri-button:clicked", listener);

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
  let el: NanatriButtonElement;

  beforeEach(() => {
    el = createElement({ "merchant-id": "test-merchant" });
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (el.isConnected) document.body.removeChild(el);
  });

  it("dispatches nanatri-button:clicked on BUTTON_CLICKED", () => {
    const spy = vi.fn();
    el.addEventListener("nanatri-button:clicked", spy);
    dispatch("BUTTON_CLICKED");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("dispatches nanatri-button:opened when modal opens", () => {
    const spy = vi.fn();
    el.addEventListener("nanatri-button:opened", spy);
    dispatch("BUTTON_CLICKED");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("dispatches nanatri-button:signed-in with detail on USER_SIGNED_IN", () => {
    const spy = vi.fn();
    el.addEventListener("nanatri-button:signed-in", spy);
    dispatch("USER_SIGNED_IN", { userId: "user_abc" });
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ userId: "user_abc" });
  });

  it("dispatches nanatri-button:added with detail on PRODUCT_ADDED", () => {
    const spy = vi.fn();
    el.addEventListener("nanatri-button:added", spy);
    dispatch("PRODUCT_ADDED", { userId: "user_abc" });
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ userId: "user_abc" });
  });

  it("dispatches nanatri-button:failed with detail on ADD_FAILED", () => {
    const spy = vi.fn();
    el.addEventListener("nanatri-button:failed", spy);
    dispatch("ADD_FAILED", { error: "Not found", code: "NOT_FOUND" });
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });

  it("dispatches nanatri-button:closed on MODAL_CLOSED", () => {
    dispatch("BUTTON_CLICKED");
    const spy = vi.fn();
    el.addEventListener("nanatri-button:closed", spy);
    dispatch("MODAL_CLOSED");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("Modal lifecycle", () => {
  let el: NanatriButtonElement;

  beforeEach(() => {
    el = createElement({ "merchant-id": "test-merchant" });
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

  it("removes modal backdrop from shadow root on MODAL_CLOSED", () => {
    dispatch("BUTTON_CLICKED");
    expect(el.shadowRoot!.querySelectorAll("div").length).toBeGreaterThan(0);
    dispatch("MODAL_CLOSED");
    expect(el.shadowRoot!.querySelectorAll("div[style*='fixed']").length).toBe(0);
  });

  it("does not open a second modal if already open", () => {
    dispatch("BUTTON_CLICKED");
    const backdropCount = el.shadowRoot!.querySelectorAll("div").length;
    dispatch("BUTTON_CLICKED");
    expect(el.shadowRoot!.querySelectorAll("div").length).toBe(backdropCount);
  });

  it("dispatches nanatri-button:closed when modal closes after PRODUCT_ADDED", () => {
    dispatch("BUTTON_CLICKED");
    const spy = vi.fn();
    el.addEventListener("nanatri-button:closed", spy);
    dispatch("PRODUCT_ADDED", { userId: "user_abc" });
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
    el.addEventListener("nanatri-button:clicked", spy);

    document.body.removeChild(el);
    dispatch("BUTTON_CLICKED");

    expect(spy).not.toHaveBeenCalled();
  });
});
