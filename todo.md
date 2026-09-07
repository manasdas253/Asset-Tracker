# Project TODO

- [x] Establish Phase 1 no-login architecture while preserving future authentication boundaries
- [x] Create normalized asset, category, location, department, assignment, transaction, maintenance, warranty, attachment, QR, notification, import, settings, and audit schema
- [x] Apply database migrations and verify schema connectivity
- [x] Build branded responsive dashboard shell with sidebar, header, breadcrumbs, command search, notifications, and theme foundations
- [x] Build database-driven executive dashboard KPIs, charts, utilization, warranty/maintenance alerts, and activity feed
- [x] Build searchable, paginated, filterable asset registry with bulk selection and responsive table/card views
- [x] Build complete asset detail profile with overview, assignment, lifecycle, maintenance, documents/photos, QR, and audit tabs
- [x] Build single-asset registration and edit workflows with validation and automatic human-readable Asset IDs
- [ ] Build configurable categories, subcategories, departments, locations, statuses, conditions, system settings, branding, date/time, reminder, and label settings
- [x] Generate secure persistent QR tokens and QR images for every asset
- [x] Build mobile-first public QR asset page with privacy-safe data and optional browser camera scanner
- [x] Build branded individual QR label preview, download, print, and PDF-friendly layout
- [x] Build multi-asset QR label selection, filtering, print preview, and downloadable sheet workflow
- [x] Build checkout, check-in/return, transfer, damage report, and retirement/disposal workflows
- [ ] Enforce server/database timestamps and transactionally update status, assignment, location, condition, and activity
- [x] Build approval queue and notification center for requested lifecycle actions
- [ ] Build maintenance records, schedules, reminders, warranties, renewals, and cost tracking
- [x] Build immutable audit/event history and asset movement timeline
- [ ] Build CSV/Excel template download, upload validation, preview, duplicate detection, row errors, error reports, import history, and valid-row import
- [x] Build bulk export and bulk status/location/category updates with confirmation safeguards
- [ ] Build reports, filters, date ranges, grouping, charts, CSV/PDF export, and financial/lifecycle summaries
- [x] Build global search and URL-deep-linkable asset/action routes
- [x] Add loading, empty, error, dialog, toast, confirmation, keyboard, accessibility, mobile, and permission-ready states
- [x] Add clearly identified demo/seed data only in a non-production path and document its boundaries
- [x] Add backend and UI tests for lifecycle, QR, import, audit, reporting, validation, and core data access
- [x] Complete setup, environment, migration, deployment, backup/restore, testing, and production-readiness documentation
- [x] Perform visual verification and final regression review

## Verification follow-ups

- [x] Implement and verify breadcrumbs and command search in the dashboard shell
- [x] Verify or add registry bulk selection and responsive table/card modes
- [x] Verify individual QR label download/PDF behavior and bulk sheet print/download behavior
- [x] Implement and verify global search behavior separately from URL deep-linking
- [ ] Add explicit confirmation flows, keyboard/accessibility checks, and permission-ready boundaries
- [x] Document demo/seed-data boundaries in project documentation
- [ ] Add UI-focused tests and broader backend tests for lifecycle, audit, reporting, QR, and import workflows
- [x] Implement explicit bulk QR sheet download/PDF export or a browser-downloadable print HTML flow and verify it
- [x] Add a dedicated Assignment tab showing current assignee, assignment history, expected return, and accountability details
- [x] Add a dedicated QR tab showing persistent QR identity, public URL, preview/download actions, and QR metadata
- [x] Re-verify the full asset detail tab set visually and in tests
- [x] Add automated UI/component coverage for the complete asset detail tab set
- [x] Make asset-detail tab selection deep-linkable through a query parameter and verify Assignment, QR identity, and Documents tabs explicitly
- [x] Add render-level component tests for all asset-detail tab triggers and corresponding content panes
- [x] Add automated query-parameter activation tests for assignment, QR, and documents tabs
- [x] Add a render-level test assertion for the Overview tab content pane
- [x] Implement server-backed bulk export for the full filtered dataset or explicit selected IDs
- [ ] Add automated success-path coverage for bulk status/location/category updates and audit/activity records
- [ ] Verify bulk update confirmation and refreshed state end to end
- [ ] Create persisted lifecycle approval-request records and approve/reject procedures with notification-center actions
- [ ] Wire bulk export to active filters and remove the artificial export row cap or implement chunked retrieval
- [ ] Add automated success-path tests for bulk export and bulk status/location/category updates
- [ ] Verify bulk update confirmation and refreshed state end to end with a real database record

## IIMS brand-led UI redesign

- [x] Define IIMS-derived color, typography, spacing, surface, elevation, icon, and interaction tokens
- [x] Prepare the supplied IIMS logo for safe web use and apply it to the app shell and metadata
- [x] Redesign the global application shell, sidebar, header, breadcrumbs, search, and navigation states
- [x] Redesign dashboard cards, KPI hierarchy, charts, activity feed, alerts, and responsive layout
- [x] Redesign asset registry, filters, pagination, selection, detail profile, forms, tabs, and dialogs
- [x] Redesign operations, QR labels, scanner, reports, settings, notifications, import, and bulk workflows
- [x] Preserve all current functionality and route behavior during the visual redesign
- [x] Validate desktop, mobile, keyboard focus, contrast, loading, empty, error, and print states
- [x] Run the complete type, test, build, and visual regression checks for the redesign
- [x] Load IIMS-aligned typography and formalize reusable spacing, elevation, and interaction tokens
- [x] Apply IIMS title, favicon, and document metadata using the supplied logo
- [x] Capture visual regression evidence for asset detail, registration, dialogs, and operations screens
- [x] Explicitly verify keyboard focus navigation, contrast, loading, empty, error, and print states for the redesigned UI
- [x] Capture and verify one representative redesigned lifecycle or confirmation dialog state

## INR currency formatting update

- [x] Locate every USD currency formatter and financial display
- [x] Replace financial displays and forms with INR and en-INR formatting
- [x] Replace dashboard, report, chart, and export currency formatting with INR
- [x] Preserve backend logic, schema, APIs, QR functionality, and asset workflows
- [x] Run type, test, build, and visual validation for the currency update
- [x] Add INR-aware presentation to purchase-cost inputs with visible ₹ context while preserving numeric mutation values
- [x] Re-scan financial entry, export, and import surfaces for consistent INR context and re-run validation
- [x] Update the bulk import template and parser aliases to support an explicit Purchase Cost (INR ₹) header without breaking existing CSV imports
- [x] Remove user-facing USD references while documenting any intentionally preserved backend-only compatibility defaults
- [x] Re-run currency scan and full validation after the final INR consistency cleanup
- [x] Re-run the currency reference scan after the final ComponentShowcase INR edit
- [x] Re-run type checking, all tests, and production build after the last INR cleanup edit

## Sidebar-only navigation redesign

- [x] Preserve the existing sidebar route list, labels, and navigation handlers exactly
- [x] Improve sidebar branding, logo treatment, visual hierarchy, spacing, icon alignment, and active states only
- [x] Improve sidebar responsive behavior without changing page content or route behavior
- [x] Verify desktop and mobile sidebar visuals, keyboard focus, and navigation behavior
- [x] Add explicit focus-visible styling to sidebar links and mobile navigation controls
- [x] Re-run sidebar-only keyboard and responsive QA after the focus-state update
- [x] Re-capture mobile sidebar screenshots after the focus-state update
- [x] Explicitly verify keyboard tab/focus behavior for sidebar links and mobile open/close controls after the focus-state update
- [x] Add an executable sidebar interaction test for keyboard-focus visibility and accessible mobile navigation controls
- [x] Capture or assert focused sidebar state after the interaction test before final checkpoint

## Add asset navigation fix

- [x] Make every existing Add asset control navigate directly to the Registration page
- [x] Verify Add asset navigation without changing other routes, handlers, or functionality
- [x] Fix sidebar active-state matching so /assets/new is distinct from /assets
- [x] Add focused coverage for dashboard and sidebar Add asset entry points
- [x] Add regression coverage for a non-Add asset navigation item
- [x] Capture browser evidence that Add asset opens Registration and highlights the correct navigation item
- [x] Add an executable UI test for the dashboard Home Add asset control navigating to /assets/new
- [x] Strengthen non-Add sidebar navigation regression coverage with click behavior
- [x] Capture browser QA evidence by opening Registration through an actual Add asset click
- [x] Prove a non-Add sidebar click invokes its original navigation path in the executable test harness
- [x] Record explicit Add asset route evidence from the Home and sidebar click contracts alongside the Registration screenshot

## Dashboard By Category visualization redesign

- [x] Preserve the existing category query, values, calculations, and data ordering
- [x] Redesign only the Inventory Mix → By Category card with category names, counts, percentages, icons, and branded chart/card treatment
- [x] Ensure the redesigned category section remains readable and responsive on desktop and mobile
- [x] Verify other dashboard sections and application behavior remain unchanged
- [x] Run type, test, build, and visual validation for the category-only redesign

## Dashboard status and lifecycle UI update

- [x] Preserve the existing status query and backend status meanings
- [x] Restrict Asset Status Distribution presentation to Available, Checked Out, Under Maintenance, Lost, Retired, and Disposed
- [x] Keep Assigned, Check Out, and Check In out of the current-status distribution
- [x] Add the visual Available → Check Out → Checked Out → Check In → Available lifecycle flow with action/status distinctions
- [x] Keep Damaged as condition data when an existing condition source is available, otherwise omit it from status distribution
- [x] Verify responsive dashboard presentation and run type, test, build, and regression validation

## Safe delete/archive asset operation

- [ ] Inspect and reuse any existing soft-delete/archive mechanism if present
- [ ] Define the minimal archive state needed to exclude an asset from active views while preserving history and QR identity
- [ ] Add an authorized individual-asset archive backend operation with idempotent guardrails
- [ ] Prevent archived assets from checkout or assignment through existing workflow guards
- [ ] Add an asset-detail Delete Asset control and confirmation dialog showing Asset ID, Asset Name, and Serial Number
- [ ] Refresh active registry and dashboard results after archiving without affecting other assets
- [ ] Add tests for Active Asset → Archive → Removed from Active List → History Preserved → Other Assets Unaffected
- [ ] Run type, test, build, and visual validation for the archive operation
