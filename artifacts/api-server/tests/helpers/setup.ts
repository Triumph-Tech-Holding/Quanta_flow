process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret-for-vitest-only";

// Guard: prevent accidental destructive runs against a non-test database.
// Allow opt-out via TEST_DB_ALLOW_ANY=1 (e.g. Replit dev DB sandbox).
const dbUrl = process.env.DATABASE_URL || "";
const allowAny = process.env.TEST_DB_ALLOW_ANY === "1";
const looksLikeTest = /test|local|replit|neon\.tech|\bdev\b/i.test(dbUrl);
if (!dbUrl) {
  throw new Error("DATABASE_URL is required to run vitest");
}
if (!allowAny && !looksLikeTest) {
  throw new Error(
    "Refusing to run tests against DATABASE_URL that does not look like a test/dev DB. " +
      "Set TEST_DB_ALLOW_ANY=1 to override.",
  );
}
