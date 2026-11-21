# Local authentication and employee asset access

The application uses local MySQL accounts, Node scrypt password hashing (N=131072, r=8, p=1, random per-password salt), and random opaque session cookies. Only the SHA-256 digest of a session token is stored in MySQL. No hosted identity provider is required. Legacy `users`, assets and QR codes are preserved; local accounts live in new tables. Old OAuth sessions are intentionally no longer accepted.

## Deployment

1. Back up MySQL and deploy the generated additive migration `drizzle/0003_local_auth_rbac.sql` using `pnpm.cmd db:migrate`. The existing migration history, including the preceding Sub Asset ID migration, must match the database. Do not use `db:push` as a deployment shortcut; it also generates migrations.
2. Keep `DATABASE_URL` pointing to the existing database. Set `APP_BASE_URL` to the existing permanent HTTPS origin so new QR labels use that address. Existing stored URLs/tokens are not rewritten. Set `TRUST_PROXY_HOPS=1` only behind one trusted reverse proxy; otherwise leave it at 0. Production requires HTTPS.
3. From the trusted server terminal run `pnpm.cmd auth:bootstrap create ADMIN001 "Workspace Admin"`. Save the displayed temporary password privately. This command creates only the first local Admin; there is no web registration/bootstrap endpoint.
4. Sign in at `/login` and set a password of at least 12 characters. A server operator can recover a lost Admin password with `pnpm.cmd auth:bootstrap recover ADMIN001`; this invalidates existing sessions through the password version.
5. Use **Employee access** in the Admin sidebar to register Employee IDs, share temporary passwords, grant individual assets, reset passwords and activate/deactivate employee accounts. Registering an existing active Employee ID links its record without overwriting employee data. Temporary credentials are shown once in the Admin screen, expire after 24 hours, and are never stored in plaintext or audit logs.

Existing inactive employee records also link without changing their status; the new login account stays inactive until an Admin explicitly activates it. Remove obsolete Google OAuth settings and JWT secrets from deployment configuration after rollout. Unused OAuth handlers and the preview auto-login runtime have been removed. The existing storage/integration modules remain available to Admins.

## Access rules

Admins retain all existing modules and actions. Employees can use their profile, password change, scanner and granted asset details. An asset assignment alone does **not** grant access. Grants are independent records and apply to both `/asset/:token` and `/assets/:id`, including direct tRPC requests. QR checkout/damage actions remain available to Admins. Employee asset responses omit documents and private audit/transaction collections.

New accounts and password resets require a password change before any asset/module access. Temporary sessions last at most 15 minutes; normal sessions last eight hours. Password changes rotate the session and invalidate other sessions. Reset/deactivation invalidates sessions immediately on subsequent requests. Every request reloads account and employee status; grants are read on each asset request. The UI clears details when a refresh is denied, and reloads from a clean query cache when signing in or out.

Login attempts are limited by both account and IP using atomic persistent 15-minute windows. Password hashing concurrency is bounded. Cookies are HttpOnly, host-only, SameSite=Lax and Secure in production; API mutations require JSON and a matching browser origin. API responses disable caching. Forwarded client IPs are trusted only according to `TRUST_PROXY_HOPS`.

Security logs record login successes/failures, logout, password changes/resets, QR resolution, granted/denied asset access, registration, activation and permission changes. Admins can view the latest 100 in Employee access; the paginated `auth.audit` API exposes older entries. QR tokens are represented by a digest in audit details; passwords and session tokens are never recorded. Maintain a retention policy for `security_audit_logs`, expired `auth_sessions`, and expired `auth_rate_limits` in database operations.

## Validation

Run `pnpm.cmd check`, `pnpm.cmd test`, `pnpm.cmd build`, and `pnpm.cmd test:auth:integration`. The integration command requires local MySQL credentials able to create/drop a database. It creates a disposable `asset_tracker_auth_test_<timestamp>` database, applies all migrations, exercises the real Express/tRPC/MySQL flows and removes that database. It refuses remote MySQL and never migrates or clears the application database. With no test URL, the integration file skips in the ordinary unit suite.

Security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
