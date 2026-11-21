import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export type LabelSize = "compact" | "standard";
export type LabelAsset = {
  assetId: string;
  name: string;
  categoryName?: string | null;
  locationName?: string | null;
  serialNumber?: string | null;
  purchaseDate?: Date | string | null;
};
export type LabelRecord = { asset: LabelAsset; qr: { qrDataUrl?: string | null } | null | undefined };

// Shared by the studio, downloaded sheets and isolated print document.
export const qrLabelStyles = `
.asset-label{box-sizing:border-box;flex-shrink:0;overflow:hidden;border:.25mm solid #d5d9dc;border-radius:2mm;background:#fff;color:#14181b;font-family:Arial,sans-serif;display:flex;flex-direction:column;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.asset-label *{box-sizing:border-box}
.asset-label.standard{width:60mm;height:40mm}
.asset-label.compact{width:35mm;height:35mm}
.asset-label-header{height:9mm;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;background:#14181b;color:#fff}
.asset-label-brand{min-width:0;flex:1;padding:1mm 2mm}.asset-label-brand img{display:block;width:39mm;height:4.5mm;object-fit:cover;object-position:center;transform:scale(1.32)}
.asset-label-brand small{display:block;font-size:3.8pt;white-space:nowrap;margin-top:.5mm;color:#c9cdd0}
.asset-label-tag{align-self:stretch;width:14mm;display:flex;align-items:center;justify-content:center;text-align:center;background:#e20d1a;font-size:8pt;font-weight:800;line-height:1.1}
.asset-label-body{flex:1;min-height:0;display:flex;align-items:center;gap:1mm;padding:1.5mm}
.asset-label-qr{width:24mm;height:24mm;flex-shrink:0;object-fit:contain;background:white}
.asset-label-details{flex:1;min-width:0;align-self:stretch;padding-top:.4mm;overflow:hidden}
.asset-label-id{background:#e20d1a;color:#fff;border-radius:1mm;padding:1mm;font-family:monospace;font-weight:800;overflow-wrap:anywhere;font-size:7pt;line-height:1.05}
.asset-label-id small{display:block;font:700 4pt Arial,sans-serif;margin-bottom:.5mm}
.asset-label-name{font-size:6pt;font-weight:800;line-height:1.15;margin:.8mm 0;border-bottom:.2mm solid #d5d9dc;padding-bottom:.6mm;overflow:hidden;max-height:4.8mm}
.asset-label-fields{display:grid;grid-template-columns:9mm 1fr;gap:.5mm;font-size:4.7pt;line-height:1.15;margin:0}
.asset-label-fields dt{color:#626a70}.asset-label-fields dd{margin:0;font-weight:700;overflow-wrap:anywhere;max-height:3.8mm;overflow:hidden}
.asset-label-footer{height:4mm;flex-shrink:0;background:#14181b;color:white;display:flex;align-items:center;justify-content:space-between;font-size:5pt;font-weight:bold;padding:0 2mm}
.asset-label-footer span:last-child{color:white}
.compact .asset-label-header{height:7mm}.compact .asset-label-brand{padding:1mm}.compact .asset-label-brand img{width:23mm;height:4mm}.compact .asset-label-tag{width:9mm;font-size:6pt}
.compact .asset-label-body{flex-direction:column;justify-content:center;gap:.2mm;padding:.4mm 1mm}.compact .asset-label-qr{width:20.5mm;height:20.5mm}.compact .asset-label-id{padding:.5mm 1mm;font-size:6pt;text-align:center;max-width:100%;max-height:4mm;overflow:hidden}.compact .asset-label-footer{height:3mm;justify-content:center;font-size:4.8pt;padding:0 .5mm}
`;

export function AssetQrLabel({ asset, qr, size, logoUrl = "/iims-logo-white.png" }: LabelRecord & { size: LabelSize; logoUrl?: string }) {
  const purchaseDate = asset.purchaseDate ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(asset.purchaseDate)) : "—";
  return <article className={`asset-label ${size}`} aria-label={`${size} label for ${asset.assetId}`}>
    <header className="asset-label-header"><div className="asset-label-brand"><img src={logoUrl} alt="CKA Birla Group | IIMS" />{size === "standard" && <small>Innovative Infra &amp; Mining Solutions Limited</small>}</div><div className="asset-label-tag">ASSET<br />TAG</div></header>
    <div className="asset-label-body">
      {qr?.qrDataUrl ? <img className="asset-label-qr" src={qr.qrDataUrl} alt={`QR code for ${asset.assetId}`} /> : <div className="asset-label-qr">QR unavailable</div>}
      {size === "compact" ? <div className="asset-label-id">{asset.assetId}</div> : <div className="asset-label-details"><div className="asset-label-id"><small>ASSET TAG NO.</small>{asset.assetId}</div><p className="asset-label-name">{asset.name}</p><dl className="asset-label-fields"><dt>Category</dt><dd>{asset.categoryName || "—"}</dd><dt>Location</dt><dd>{asset.locationName || "—"}</dd><dt>Serial no.</dt><dd>{asset.serialNumber || "—"}</dd><dt>Purchased</dt><dd>{purchaseDate}</dd></dl></div>}
    </div>
    <footer className="asset-label-footer">{size === "compact" ? <span>Scan QR · Property of IIMS</span> : <><span>PROPERTY OF IIMS</span><span>Scan QR for asset details</span></>}</footer>
  </article>;
}

export function buildQrLabelDocument(records: LabelRecord[], size: LabelSize, origin: string) {
  const labels = records.map(record => renderToStaticMarkup(<AssetQrLabel {...record} size={size} logoUrl={new URL("/iims-logo-white.png", origin).href} />)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>IIMS asset labels</title><style>${qrLabelStyles}
@page{size:A4;margin:10mm}body{margin:0;background:white}.label-sheet{display:flex;flex-wrap:wrap;align-content:flex-start;gap:3mm}@media screen{body{padding:10mm}}
</style></head><body><div class="label-sheet">${labels}</div></body></html>`;
}

export async function printQrLabelDocument(html: string) {
  const frame = document.createElement("iframe");
  frame.title = "Print asset labels";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;";
  // Keep the frame until printing finishes; removing it early can cancel printing.
  const remove = () => frame.remove();
  frame.onload = async () => {
    const target = frame.contentWindow;
    if (!target) { remove(); return; }
    await Promise.all(Array.from(target.document.images).map(img => img.decode().catch(() => undefined)));
    target.addEventListener("afterprint", remove, { once: true });
    target.focus();
    target.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
