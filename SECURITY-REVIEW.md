# Security review

**Review date:** 2026-10-06

## Dependency audit

The project dependency trees were audited with:

- `npm audit --omit=dev --audit-level=moderate`
- `npm audit --json`
- `uvx pip-audit -r backend/requirements.txt`

Results:

- JavaScript production dependencies: **0 known vulnerabilities**
- Full JavaScript dependency tree: **0 known vulnerabilities across 480 resolved dependencies**
- Python requirements: **no known vulnerabilities reported**

`backend/requirements.txt` uses open-ended minimum versions and the backend has no committed Python lockfile. This is a reproducibility and supply-chain hardening concern, not a currently reported vulnerability. Pinning and lockfile generation should be handled as a separate deployment change after reviewing the supported runtime versions.

## Finding

### Medium — raw upstream errors exposed to users

The application previously copied provider exception messages into browser payloads and UI messages. Those messages could include upstream URLs, HTTP statuses, implementation details, or future library-specific paths.

Affected surfaces included live weather status, ward snapshot notes, hospital fallback notes, and refresh failures.

### Remediation

- Detailed errors are now logged server-side with a stable `[JalNiti]` context.
- Browser-visible errors and fallback notes use generic messages.
- The live weather server function normalizes provider failures before they cross the server boundary.
- The UI no longer renders `Error.message` or raw stale-provider details.

The application continues to preserve last-known-good weather readings and
snapshot fallback behavior, so availability is not reduced by sanitization.

## Validation

- Production build passed after remediation.
- Editor diagnostics reported no errors in the changed source files.
- Repository-wide lint still reports pre-existing CRLF/Prettier diagnostics.
