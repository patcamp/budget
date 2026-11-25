import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { clearDraft, readDraft, writeDraft } from "./draftStorage";

const KEY = "budget:test-draft";

beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  });
});

afterEach(() => {
  clearDraft(KEY);
});

describe("draftStorage", () => {
  it("round-trips a draft object", () => {
    writeDraft(KEY, { amount: "12.50", description: "coffee" });
    expect(readDraft<{ amount: string; description: string }>(KEY)).toEqual({
      amount: "12.50",
      description: "coffee",
    });
  });

  it("returns null for a missing key", () => {
    expect(readDraft(KEY)).toBeNull();
  });

  it("clears a stored draft", () => {
    writeDraft(KEY, { amount: "1" });
    clearDraft(KEY);
    expect(readDraft(KEY)).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    sessionStorage.setItem(KEY, "{not-json");
    expect(readDraft(KEY)).toBeNull();
  });
});
