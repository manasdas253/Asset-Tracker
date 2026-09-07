import { describe, expect, it } from "vitest";
import { ASSET_DETAIL_TABS } from "./AssetPages";

describe("asset detail tab contract", () => {
  it("includes every required profile surface in stable order", () => {
    expect(ASSET_DETAIL_TABS).toEqual([
      "overview",
      "assignment",
      "qr",
      "lifecycle",
      "maintenance",
      "audit",
      "documents",
    ]);
  });

  it("supports deep-linkable tab values", () => {
    expect(ASSET_DETAIL_TABS.includes("assignment")).toBe(true);
    expect(ASSET_DETAIL_TABS.includes("qr")).toBe(true);
    expect(ASSET_DETAIL_TABS.includes("documents")).toBe(true);
  });
});
