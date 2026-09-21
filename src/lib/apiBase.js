/**
 * Central API base for all frontend → backend calls.
 *
 * Same-origin (Vercel production / Vite proxy): returns "/api"
 * Absolute origin only (http://localhost:3001): appends "/api"
 * Full prefix (http://localhost:3001/api or https://x.vercel.app/api): used as-is
 *
 * Never hardcode localhost in production. Leave VITE_API_URL empty on Vercel.
 */
export function getApiBase() {
  const raw = String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "");

  if (!raw) return "/api";

  // Guard against accidental production localhost
  if (
    import.meta.env.PROD &&
    /localhost|127\.0\.0\.1/i.test(raw)
  ) {
    console.warn(
      "[api] VITE_API_URL points to localhost in production; using same-origin /api instead."
    );
    return "/api";
  }

  // http://host:port  →  http://host:port/api
  if (/^https?:\/\/[^/]+$/i.test(raw)) {
    return `${raw}/api`;
  }

  return raw;
}

/** Build a full URL for an API path like "/admin/login" or "exam/start". */
export function apiUrl(path) {
  const base = getApiBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
