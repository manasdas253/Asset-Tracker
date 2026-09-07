# By Category Visual QA

The Inventory Mix → By Category card was reviewed on the live database-backed dashboard at desktop and mobile widths after the redesign was restored.

At desktop width, the section shows the IIMS-branded card header, live total-assets badge, category names, existing asset counts, calculated percentages, category-aware icons, progress indicators, and a matching horizontal bar chart. The neighboring dashboard cards remain in their existing positions and visual treatment.

At mobile width, the category card remains readable within the responsive single-column dashboard flow. The category detail rows stack cleanly, the horizontal chart remains visible, and no required category label, count, percentage, or icon is clipped.

Automated validation passed after the redesign with `pnpm check`, 24 passing Vitest tests, and `pnpm build`. The build reports only the existing Vite chunk-size advisory. The redesign changes presentation only: the existing `data.categories` values, `kpis.total` denominator, query, routes, backend, database, APIs, and business logic remain unchanged.
