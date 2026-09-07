# AssetTrack production-readiness notes

AssetTrack is an enterprise asset register with persistent QR identities, database-backed lifecycle visibility, and server-recorded activity history. The current build is intentionally scoped to **Phase 1: no login**. Authentication and authorization boundaries remain available in the template, but the product routes use public procedures until the access model is finalized.

## Local setup

Use Node.js 22 or later and pnpm. Install dependencies with `pnpm install`, run the development server with `pnpm dev`, run the type checker with `pnpm check`, run the test suite with `pnpm test`, and create the deploy bundle with `pnpm build`.

The project expects the managed `DATABASE_URL` connection and the built-in Manus environment variables. Do not commit `.env` files or hard-code credentials. QR public URLs are generated from the request host and are stored with the QR token and data URL so the identity is stable when the asset record changes.

## Database and migrations

The canonical schema is `drizzle/schema.ts`. Generate a migration with `pnpm drizzle-kit generate`, review the resulting SQL for non-destructive changes, and apply it through the project database migration workflow. The current foundation includes assets, catalogs, assignments, transactions, events, maintenance, QR identities, notifications, import jobs/errors, settings, attachments, and audit logs.

Business timestamps are persisted server-side as UTC timestamps. Lifecycle actions update the asset record, create an event, and create an audit entry. Before enabling multi-user production access, wrap these related writes in a database transaction and add role-based procedure guards.

## Demo data boundary

The `asset.seedDemo` procedure creates clearly marked records with `isDemo = 1`, demo activity events, and demo QR identities. It is intended for local evaluation and product walkthroughs only. Production operators should not call the seed procedure. A production hardening pass should remove or admin-gate this procedure before launch and add a safe, separately managed fixture command if a staging dataset is needed.

## Core workflows currently implemented

The current build includes database-driven dashboard KPIs, charts, activity feed, searchable and paginated asset registry, responsive mobile cards, asset creation and editing, persistent QR creation, public QR asset pages, QR checkout and damage flows, lifecycle dialogs, maintenance and warranty visibility, audit timeline, QR label selection and printing, individual QR image download, CSV preview/import with required-column validation and duplicate serial detection, reports CSV export, settings catalog management, notifications, and optional browser camera scanning with a manual token fallback.

Remaining roadmap work is tracked in `todo.md`. The highest-risk production follow-ups are transaction wrapping, approval and permission enforcement, complete import history/error report UI, richer maintenance scheduling, attachments and document storage, bulk update safeguards, reporting filters/PDF output, and formal UI/browser coverage.

## Testing

The baseline suite is in `server/assetRouter.test.ts` and `server/auth.logout.test.ts`. It covers date parsing, money validation, unknown QR lookup, pagination validation, and required-column CSV validation. Run `pnpm test` before each checkpoint. Visual verification should cover `/`, `/assets`, `/assets/:id`, `/assets/new`, `/qr-labels`, `/scan`, `/reports`, and a real `/asset/:token` public URL at desktop and mobile widths.

## Deployment and operations

Use the managed WebDev hosting flow after creating a checkpoint. The application is compatible with the default Node autoscale runtime because it does not depend on an always-on worker. Keep the request lifecycle free of long-running jobs and move future scheduled reminders or asynchronous report generation to the supported background-job path.

Enable database SSL in the connection settings for production. Monitor server logs, browser console errors, and database health. Before destructive schema work, create a checkpoint and take a database backup using the database provider's managed backup facility. Restore the code from a project checkpoint and restore the database from the matching backup; code rollback alone does not restore database rows.

## Phase 1 security checklist

Before exposing the application to real users, disable or restrict demo seeding, add authentication and role checks, validate public QR privacy fields, add rate limiting to public QR actions, enforce CSRF/session protections for authenticated mutation routes, wrap lifecycle writes transactionally, validate and virus-scan uploaded files, and add retention/export policies for audit data.

## Currency presentation compatibility

All user-facing financial amounts in the dashboard, reports, asset detail, create/edit forms, CSV report exports, and import guidance use Indian Rupees with `en-IN` grouping and the `₹` symbol. The existing currency column, legacy stored values, and mutation/API contracts are intentionally preserved for backward compatibility; the presentation layer normalizes displayed purchase costs to INR without changing database structure or asset workflow behavior.
