import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// drizzle-orm 0.36+ overloads conflict between connectionString and config object — cast to satisfy
export const db = drizzle(pool as never, { schema });
