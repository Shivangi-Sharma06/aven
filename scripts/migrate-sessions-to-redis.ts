#!/usr/bin/env node
/**
 * scripts/migrate-sessions-to-redis.ts
 *
 * One-time migration: reads data/work-sessions.json and writes each session
 * to Upstash Redis under the configured AVEN_DATA_NAMESPACE.
 *
 * Usage:
 *   # Dry run (default – no writes):
 *   npx ts-node --esm scripts/migrate-sessions-to-redis.ts
 *
 *   # Execute the migration:
 *   npx ts-node --esm scripts/migrate-sessions-to-redis.ts --execute
 *
 * Never migrates CLI secrets or AVEN_VERIFIER_SECRET.
 */

import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Load .env.local manually (ts-node doesn't auto-load it)
// ---------------------------------------------------------------------------
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: join(process.cwd(), ".env.local") });

import { Redis } from "@upstash/redis";
import type { WorkSession } from "../lib/work-session.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DRY_RUN = !process.argv.includes("--execute");
const DATA_FILE = join(process.cwd(), "data", "work-sessions.json");

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const namespace =
  process.env.AVEN_DATA_NAMESPACE?.trim() ||
  process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID?.trim() ||
  "local";

const redisKey = `aven:${namespace}:work-sessions`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isValidSession(value: unknown): value is WorkSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<WorkSession>;
  return (
    typeof s.id === "string" &&
    s.id.trim().length > 0 &&
    typeof s.streamId === "string" &&
    typeof s.workerAddress === "string" &&
    typeof s.clientAddress === "string" &&
    typeof s.status === "string" &&
    typeof s.createdAt === "string" &&
    typeof s.updatedAt === "string"
  );
}

function isNewerOrEqual(existing: WorkSession, incoming: WorkSession): boolean {
  return existing.updatedAt >= incoming.updatedAt;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nAven Session Migration`);
  console.log(`Mode:      ${DRY_RUN ? "DRY RUN (pass --execute to write)" : "EXECUTE"}`);
  console.log(`Namespace: ${namespace}`);
  console.log(`Redis key: ${redisKey}`);
  console.log(`Source:    ${DATA_FILE}\n`);

  if (!DRY_RUN && (!redisUrl || !redisToken)) {
    console.error(
      "ERROR: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env.local",
    );
    process.exit(1);
  }

  // Read source file
  let raw: string;
  try {
    raw = await readFile(DATA_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No data/work-sessions.json found. Nothing to migrate.");
      return;
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as { version: number; sessions: unknown[] };
  if (!Array.isArray(parsed.sessions)) {
    throw new Error("data/work-sessions.json has an unexpected format.");
  }

  // Backup
  const backupPath = `${DATA_FILE}.bak.${Date.now()}`;
  if (!DRY_RUN) {
    await copyFile(DATA_FILE, backupPath);
    console.log(`Backup written to: ${backupPath}`);
  } else {
    console.log(`Would backup to: ${backupPath}`);
  }

  // Connect Redis
  const redis = !DRY_RUN && redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

  let inserted = 0;
  let skipped = 0;
  let rejected = 0;

  for (const raw of parsed.sessions) {
    if (!isValidSession(raw)) {
      console.warn("  REJECT invalid session:", JSON.stringify(raw).slice(0, 120));
      rejected++;
      continue;
    }

    const session = raw;

    if (redis) {
      // Check if a newer record already exists in Redis
      const existing = await redis.hget<WorkSession>(redisKey, session.id);
      if (existing && isNewerOrEqual(existing, session)) {
        console.log(`  SKIP  [${session.id}] Redis record is newer or equal`);
        skipped++;
        continue;
      }
      await redis.hset(redisKey, { [session.id]: session });
      console.log(`  INSERT [${session.id}] ${session.status}`);
      inserted++;
    } else {
      // Dry-run: just log what would happen
      console.log(`  WOULD INSERT [${session.id}] ${session.status} (${session.updatedAt})`);
      inserted++;
    }
  }

  console.log(`\nSummary`);
  console.log(`  ${DRY_RUN ? "Would insert" : "Inserted"}:  ${inserted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Rejected:  ${rejected}`);
  if (DRY_RUN) {
    console.log("\nDRY RUN complete. Pass --execute to write to Redis.\n");
  } else {
    console.log("\nMigration complete.\n");
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
