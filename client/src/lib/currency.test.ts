import { describe, expect, it } from "vitest";
import { formatINR, formatINRForExport } from "./currency";

describe("INR currency formatting", () => {
  it("formats lakh-grouped values with the rupee symbol", () => {
    expect(formatINR(150000)).toBe("₹1,50,000");
  });

  it("uses the same INR presentation for exports", () => {
    expect(formatINRForExport("1299.00")).toBe("₹1,299");
  });

  it("renders missing values as zero without producing NaN", () => {
    expect(formatINR(undefined)).toBe("₹0");
  });
});
