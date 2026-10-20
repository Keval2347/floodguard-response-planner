# Security review

**Review date:** 2026-10-06

## Dependency audit

The project dependency trees were audited with:

- `npm audit --omit=dev --audit-level=moderate`
- `npm audit --json`
- `pip-audit -r backend/requirements.txt`

### Results (2026-10-06, re-confirmed 2026-10-19)

- JavaScript production dependencies: **0 known vulnerabilities**
- Full JavaScript dependency tree: **0 known vulnerabilities across 483 resolved packages**
- Python requirements: **no known vulnerabilities reported**

`backend/requirements.txt` uses open-ended minimum versions and the backend has no committed Python lockfile. This is a reproducibility and supply-chain hardening concern, not a currently reported vulnerability. Pinning and lockfile generation should be handled as a separate deployment change after reviewing the supported runtime versions.

## Secrets scan

**Scan date:** 2026-10-19

Source code and git history were searched for hardcoded credentials using pattern matching (API keys for Google/OpenAI/GitHub/AWS, private keys, password/token assignments).

- **No secrets found in tracked source files.**
- **No `.env`, `.pem`, `.key`, or `credentials.json` files in git history** (only `.env.example` templates are committed).
- `.gitignore` correctly excludes `.env`, `.env.*`, `*.pem`, `*.key`, `*.cert`, `*.crt`, and `credentials.json`.

## Lint audit (ESLint)

**Scan date:** 2026-10-19

ESLint (`npx eslint .`) was run across all TypeScript/TSX files with the project's config (typescript-eslint + react-hooks + react-refresh + Prettier).

- **6 warnings** — all `react-refresh/only-export-components` (non-security cosmetic).
- **8 110 errors** — all `prettier/prettier` CRLF line-ending mismatches (pre-existing, auto-fixable with `--fix`).
- **0 security or logic errors.**

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

---

## Static analysis (SAST)

**Scan date:** 2026-10-15

A Semgrep scan (`semgrep scan --config auto`, 507 community rules, 109 files) identified two blocking findings. Both were remediated and a re-scan confirmed zero remaining findings.

### Finding 1 - dynamic `urllib` use in DEM download (SSRF risk)

`backend/app/data_pipeline/dem_source.py` used `urllib.request.urlretrieve(url, dest)` where `url` was a dynamic value returned by the Earth Engine SDK. `urllib` supports `file://` schemes, so a compromised or unexpected URL could read local files.

**Remediation:**

- Replaced `urllib.request.urlretrieve` with `requests.get(..., stream=True)`.
- Added an explicit `https://` scheme check before the request — any non-HTTPS URL raises `ValueError`.
- Download uses chunked streaming with a 120-second timeout and `raise_for_status()`.

### Finding 2 - Bun `minimumReleaseAge` too low (supply-chain risk)

`bunfig.toml` set `minimumReleaseAge = 86400` (1 day). The Semgrep rule recommends at least 604 800 (7 days) to reduce exposure to newly published malicious packages.

**Remediation:** Increased to `minimumReleaseAge = 604800` (7 days). The `minimumReleaseAgeExcludes` allow-list for `@lovable.dev/*` packages was retained.

## Backend unit tests

**Test runner:** `pytest -q backend/tests/`

| File | Cases | Scope |
| ---- | ----: | ----- |
| `test_schemas.py` | ~30 | Pydantic schema validation contracts |
| `test_config.py` | 3 | YAML config loading and self-consistency |

Schema tests cover:

- **Boundary values:** rainfall 0–600 mm, trucks 0–50, shift 30–720 min, latitude ±90, longitude ±180.
- **Regex-constrained IDs:** segment IDs (`S` + 2–5 digits), depot IDs, ward short names (slug format).
- **Type strictness:** string-for-int rejection, float-for-int rejection via Pydantic `strict=True`.
- **Extra-key rejection:** unknown fields raise `ValidationError`, not silently ignored.
- **Duplicate detection:** repeated segment IDs in drain-cleared lists are rejected.
- **Injection guard:** shell metacharacters (`;`, `$()`, null bytes) in CLI ward arguments are rejected.
- **Semantic cross-field check:** depot truck counts must sum to `fleet.truck_count`.

Config smoke tests verify the YAML loads, CRS prefix is valid, depot-fleet sum is consistent, and output directories are created.
