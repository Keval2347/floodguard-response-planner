/**
 * JalNiti — canonical Zod schemas for every external input surface.
 *
 * POLICY: validate first, reject on mismatch — never silently coerce or
 * sanitise. Every server function input and every ScenarioOverrides object
 * must pass through one of these schemas before any logic runs.
 *
 * These schemas are the single source of truth for:
 *   - what types and ranges the server functions accept
 *   - what the what-if simulator will allow
 *   - what the OSRM / OpenTopoData helpers are allowed to receive
 *
 * Do NOT add `.transform()` calls that silently fix invalid data — if the
 * caller sends something wrong, we throw, log, and return 400/422.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ atoms */

/** WGS-84 latitude — strict range, finite, not NaN. */
export const LatSchema = z
  .number({ invalid_type_error: "lat must be a number" })
  .finite("lat must be finite")
  .min(-90, "lat out of range [-90, 90]")
  .max(90, "lat out of range [-90, 90]");

/** WGS-84 longitude — strict range, finite, not NaN. */
export const LonSchema = z
  .number({ invalid_type_error: "lon must be a number" })
  .finite("lon must be finite")
  .min(-180, "lon out of range [-180, 180]")
  .max(180, "lon out of range [-180, 180]");

/**
 * [lat, lon] tuple — used for every coordinate pair we hand to OSRM /
 * OpenTopoData. Rejects arrays of wrong length or out-of-range values.
 */
export const LatLonSchema = z
  .tuple([LatSchema, LonSchema])
  .describe("[lat, lon] WGS-84 coordinate pair");

/**
 * A segment id as produced by the pipeline: "S" followed by 2 digits.
 * Rejects free-text strings that could never be a real segment.
 */
export const SegmentIdSchema = z
  .string()
  .regex(/^S\d{2,5}$/, "segment id must match S followed by 2-5 digits (e.g. S01, S337)");

/* ------------------------------------------------------ server functions */

/**
 * Input schema for getWardData / getHospitals.
 * `refresh` is an explicit boolean — we do not coerce "true"/"1"/etc.
 */
export const RefreshInputSchema = z
  .object({
    refresh: z.boolean().optional().default(false),
  })
  .strict();

export type RefreshInput = z.infer<typeof RefreshInputSchema>;

/**
 * One route pair sent to getRoutes.
 * `key` is an opaque client-generated label; we only enforce its length so
 * it cannot be used as a large-payload injection vector.
 */
export const RoutePairSchema = z
  .object({
    key: z
      .string()
      .min(1, "route key must not be empty")
      .max(120, "route key too long (max 120 chars)")
      .regex(
        /^[\w|.\->,\s\[\]]+$/,
        "route key contains disallowed characters",
      ),
    from: LatLonSchema,
    to: LatLonSchema,
  })
  .strict();

export type RoutePair = z.infer<typeof RoutePairSchema>;

/**
 * Full input for getRoutes. Capped at 20 pairs so one request cannot drive
 * 1000 OSRM calls.
 */
export const RoutesInputSchema = z
  .object({
    pairs: z
      .array(RoutePairSchema)
      .min(1, "pairs must not be empty")
      .max(20, "at most 20 route pairs per request"),
  })
  .strict();

export type RoutesInput = z.infer<typeof RoutesInputSchema>;

/* ------------------------------------------------------- what-if scenario */

/**
 * What-if scenario overrides accepted by the risk model and the optimizer.
 *
 * Bounds are chosen to match the physical reality of the Navrangpura ward:
 *   - rainMm: 0–600 mm/24 h (the all-India 24 h record is 944 mm; 600 is a
 *     reasonable upper bound for a planning tool without being absurd)
 *   - trucksAvailable: 0–50 (ten times the documented fleet assumption)
 *   - shiftMinutes: 30–720 (half an hour … twelve hours)
 *   - drainsCleared / closed: arrays of valid segment ids, no duplicates
 */
export const ScenarioOverridesSchema = z
  .object({
    rainMm: z
      .number({ invalid_type_error: "rainMm must be a number" })
      .finite("rainMm must be finite")
      .min(0, "rainMm must be ≥ 0")
      .max(600, "rainMm must be ≤ 600"),

    // Optional for compatibility with scenarios saved before intensity scoring.
    rain3hMm: z
      .number({ invalid_type_error: "rain3hMm must be a number" })
      .finite("rain3hMm must be finite")
      .min(0, "rain3hMm must be ≥ 0")
      .max(300, "rain3hMm must be ≤ 300")
      .optional(),

    drainsCleared: z
      .array(SegmentIdSchema)
      .max(1000, "drainsCleared cannot exceed the number of ward segments")
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "drainsCleared must not contain duplicate segment ids",
      }),

    closed: z
      .array(SegmentIdSchema)
      .max(1000, "closed cannot exceed the number of ward segments")
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "closed must not contain duplicate segment ids",
      }),

    trucksAvailable: z
      .number({ invalid_type_error: "trucksAvailable must be a number" })
      .int("trucksAvailable must be an integer")
      .min(0, "trucksAvailable must be ≥ 0")
      .max(50, "trucksAvailable must be ≤ 50"),

    shiftMinutes: z
      .number({ invalid_type_error: "shiftMinutes must be a number" })
      .int("shiftMinutes must be an integer")
      .min(30, "shiftMinutes must be ≥ 30")
      .max(720, "shiftMinutes must be ≤ 720"),
  })
  .strict();

export type ScenarioOverridesInput = z.infer<typeof ScenarioOverridesSchema>;

/* -------------------------------------------------- pipeline internal I/O */

/**
 * An array of LatLon points as sent to fetchElevations / fetchTravelMatrix.
 * We cap the count so a bug in the pipeline cannot generate a 10 000-point
 * OSRM request that hits the public rate limit.
 */
export const LatLonArraySchema = z
  .array(LatLonSchema)
  .min(1, "point array must not be empty")
  .max(500, "point array too large (max 500 points)");

/**
 * A URL that may only point to the approved external hosts (ALLOWED_HOSTS) the pipeline is
 * allowed to call. Anything else is rejected before fetch() is called.
 */
const ALLOWED_HOSTS = [
  "overpass-api.de",
  "overpass.private.coffee",
  "overpass.osm.ch",
  "overpass.kumi.systems",
  "api.opentopodata.org",
  "router.project-osrm.org",
  "api.open-meteo.com",
  "api.met.no",
  "api.imd.gov.in",
] as const;

export type AllowedHost = (typeof ALLOWED_HOSTS)[number];

export const AllowedFetchUrlSchema = z
  .string()
  .url("pipeline fetch target must be a valid URL")
  .refine(
    (u) => {
      try {
        const host = new URL(u).hostname;
        return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
      } catch {
        return false;
      }
    },
    { message: `pipeline fetch target must be one of: ${ALLOWED_HOSTS.join(", ")}` },
  );

/* ---------------------------------------------------------- helper types */

/** Parse and throw with a human-readable message on the first invalid field. */
export function parseStrict<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  label: string,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.length ? ` at '${firstIssue.path.join(".")}'` : "";
    throw new Error(`[JalNiti validation] ${label}${path}: ${firstIssue.message}`);
  }
  return result.data;
}
