Physical Verification uses the existing Scan QR and Audit & verification pages. Scan a QR, open the asset, and select Verified to enter a verification. The existing checkout and damage pages retain their design; the damage form now accepts supporting photos, and checkout requires purpose and expected return.

Verifier name, Employee ID, date, time, location and condition start blank. The server requires those manual values and at least one photo. The verifier does not need an employee-directory record and does not need to match the signed-in account. Existing access is unchanged: this checkout currently grants the Audit & verification page and QR actions to Admin. No account permissions, employee grants or authentication rules were added or changed.

Persistence reuses `asset_events`, `asset_documents`, `audit_logs`, `notification_events`, `app_settings`, and the existing movement tables. No schema migration is needed. Each verification inserts a versioned event, its photos and an audit entry in a single transaction. Photos are compressed JPEG documents, up to four per submission, each within the existing document column size. Failed transactions do not retain partial uploads. Original verification records are never overwritten; admin review notes are additional events.

Locations match after Unicode normalization, trimming, collapsing whitespace and case folding. A missing registered location always flags the verification. Matched records are Verified; mismatches are Flagged and notify Admin. Damaged verification condition also notifies Admin. Verification does not change the operational asset status, condition or registered location. The separate Report Damaged action changes operational status and condition and records a transaction, photos, an audit event and an admin notification. Scanned checkout locks the asset row and accepts only Available assets.

Until an admin starts a named cycle, the current cycle is the calendar year in Asia/Kolkata. Starting a new cycle makes assets Pending for that cycle without changing their operational status or deleting previous records. Each saved record belongs to the cycle active when submitted, independently of the manually supplied observation date. The latest successful verification date and time are derived from successful immutable records, including earlier cycles; backdated entries cannot move that date backwards. A mismatched submission does not advance it.

The admin panel lists every submission in the current cycle and a Pending row for assets without submissions. History mode includes earlier cycles. Filters cover asset/category, employee, location, date range, condition and verification result. Admin review notes preserve the original Flagged result; a corrected verification is a new submission. Excel exports exactly the displayed rows, includes photo document references and links to the matching admin log row, and keeps manual date/time and identifier strings intact. Photos can be viewed and downloaded in the log. Excel photos are links, not embedded images.

Validation commands:

```powershell
pnpm.cmd check
pnpm.cmd test
node scripts/test-verification-integration.mjs
pnpm.cmd build
```

The integration runner creates, migrates and removes its own disposable local MySQL database. It never applies migrations to the application database. Browser preview artifacts under ignored `tmp/physical-verification-browser/` exercise the actual components with fixture API responses, manual form interaction, real browser photo processing and Excel download at mobile and desktop sizes. Backend persistence is tested separately against real MySQL. Physical camera scanning remains unchanged and was not hardware-tested for this change.
