/**
 * Vercel serverless entry for ALL /api/* routes.
 * vercel.json rewrites /api/:path* → this /api function.
 */
import app from "../server/app.js";

export default function handler(req, res) {
  const forwarded = req.headers["x-forwarded-uri"] || req.headers["x-invoke-path"];
  if (typeof forwarded === "string" && forwarded.startsWith("/api/")) {
    const qIndex = (req.url || "").indexOf("?");
    const query = qIndex >= 0 ? req.url.slice(qIndex) : "";
    const pathOnly = forwarded.split("?")[0];
    req.url = `${pathOnly}${query}`;
  }
  return app(req, res);
}
