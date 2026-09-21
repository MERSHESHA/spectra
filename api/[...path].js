/**
 * Vercel catch-all serverless function for all /api/* routes.
 * Uses the same Express app as local development (server/app.js).
 */
import app from "../server/app.js";

export default app;
