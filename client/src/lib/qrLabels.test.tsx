import { describe, expect, it } from "vitest";
import { buildQrLabelDocument, qrLabelStyles } from "./qrLabels";

const records = [{ asset: { assetId: "IIMS-IT-0012", name: '<script>alert("test")</script>', serialNumber: "SN-001", categoryName: "IT Equipment", locationName: "HQ", purchaseDate: "2026-03-15" }, qr: { qrDataUrl: "data:image/png;base64,test" } }];
describe("physical QR labels", () => {
  it("uses physical dimensions and embeds the persisted QR in both formats", () => {
    expect(qrLabelStyles).toContain("width:60mm;height:40mm");
    expect(qrLabelStyles).toContain("width:35mm;height:35mm");
    for (const size of ["compact", "standard"] as const) {
      const html = buildQrLabelDocument(records, size, "https://assets.example.com");
      expect(html).toContain(`asset-label ${size}`);
      expect(html).toContain(records[0].qr.qrDataUrl);
      expect(html).toContain("https://assets.example.com/iims-logo-white.png");
      expect(html).toContain("IIMS-IT-0012");
      expect(html).not.toContain('<script>alert("test")</script>');
    }
  });
  it("includes asset metadata only in the standard label", () => {
    const standard = buildQrLabelDocument(records, "standard", "https://example.com");
    expect(standard).toContain("IT Equipment");
    expect(standard).toContain("SN-001");
    expect(standard).toContain("15 Mar 2026");
    expect(standard).toContain("&lt;script&gt;");
    expect(buildQrLabelDocument(records, "compact", "https://example.com")).not.toContain("SN-001");
  });
});
