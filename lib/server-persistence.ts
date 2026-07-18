import "server-only";

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

export const sharedRedis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

const deployment =
  process.env.AVEN_DATA_NAMESPACE?.trim() ||
  process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID?.trim() ||
  "local";

export const dataNamespace = `aven:${deployment}`;

export function assertProductionPersistence() {
  if (process.env.NODE_ENV === "production" && !sharedRedis) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
    );
  }
}
