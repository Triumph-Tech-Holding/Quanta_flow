import { db } from "../db";
import { users } from "@workspace/db";
import { iaBrainService, type IInsightResponse } from "./iaBrainService";
import { emitToUser } from "../socket";

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const seenByUser = new Map<string, Set<string>>();
let timer: NodeJS.Timeout | null = null;
let running = false;

function fingerprint(i: IInsightResponse): string {
  return `${i.contactId}:${i.severity}`;
}

async function scanOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const allUsers = await db.select({ id: users.id }).from(users);

    for (const u of allUsers) {
      try {
        const insights = await iaBrainService.generateInsights(u.id);
        const seen = seenByUser.get(u.id) || new Set<string>();
        const currentFps = new Set<string>();
        const newCriticals: IInsightResponse[] = [];

        for (const ins of insights) {
          const fp = fingerprint(ins);
          currentFps.add(fp);
          if (ins.severity === "alta" && !seen.has(fp)) {
            newCriticals.push(ins);
          }
        }

        // Emit each new critical insight individually
        for (const ins of newCriticals) {
          emitToUser(u.id, "brain:new-insight", {
            id: ins.id,
            contactId: ins.contactId,
            contactName: ins.contactName,
            severity: ins.severity,
            title: ins.title,
            description: ins.description,
            score: ins.score,
            hoursSinceLastContact: ins.hoursSinceLastContact,
            generatedAt: ins.generatedAt,
          });
        }

        // Aggregated summary if any new criticals
        if (newCriticals.length > 0) {
          emitToUser(u.id, "brain:scan-complete", {
            newCriticals: newCriticals.length,
            totalInsights: insights.length,
            generatedAt: new Date().toISOString(),
          });
          console.log(`[brain-worker] User ${u.id}: ${newCriticals.length} new critical insight(s) emitted`);
        }

        seenByUser.set(u.id, currentFps);
      } catch (err: any) {
        console.error(`[brain-worker] user ${u.id} scan failed:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error("[brain-worker] scan failed:", err?.message || err);
  } finally {
    running = false;
  }
}

export function startBrainWorker(): void {
  if (timer) return;
  console.log(`[brain-worker] started (every ${SCAN_INTERVAL_MS / 1000}s)`);
  // Initial seed scan after 30s to let DB warm up
  setTimeout(() => { void scanOnce(); }, 30 * 1000);
  timer = setInterval(() => { void scanOnce(); }, SCAN_INTERVAL_MS);
}

export function stopBrainWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[brain-worker] stopped");
  }
}

export async function triggerBrainScanNow(): Promise<void> {
  await scanOnce();
}
