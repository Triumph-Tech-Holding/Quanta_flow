import type { Express } from "express";
import { createApp } from "../../src/app";

let cached: Express | null = null;

export async function getTestApp(): Promise<Express> {
  if (cached) return cached;
  const { app } = await createApp();
  cached = app;
  return app;
}
