import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requestId, submitJob } from "./stellar.ts";
import { JobStore } from "./jobs.ts";
import type { JobRecord, StreamJob } from "./types.ts";

const mandateAddress = required("AGENT_MANDATE_ADDRESS");
const agentSecret = required("AGENT_SECRET_KEY");
const hmacSecret = required("RUNNER_HMAC_SECRET");
if (hmacSecret.length < 32) throw new Error("RUNNER_HMAC_SECRET must be at least 32 characters.");

const port = Number(process.env.PORT ?? 8787);
const store = new JobStore(process.env.RUNNER_DATA_FILE ?? "./data/jobs.json");
await store.open();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 64 * 1024) throw new Error("Request body is too large.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function authenticated(payload: Buffer, signature: string | undefined) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", hmacSecret).update(payload).digest();
  const provided = Buffer.from(signature.slice(7), "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { ok: true, network: "stellar:testnet" });
    }
    if (request.method !== "POST" || request.url !== "/jobs") {
      return json(response, 404, { error: "Not found" });
    }

    const payload = await body(request);
    if (!authenticated(payload, request.headers["x-aven-signature"] as string | undefined)) {
      return json(response, 401, { error: "Invalid job signature" });
    }
    const job = JSON.parse(payload.toString("utf8")) as StreamJob;
    if (!job.jobId?.trim()) return json(response, 400, { error: "jobId is required" });

    const key = `${mandateAddress}:${requestId(job.jobId).toString("hex")}`;
    const existing = store.get(key);
    if (existing) return json(response, 200, existing);

    const now = new Date().toISOString();
    const record: JobRecord = {
      mandateAddress,
      requestId: requestId(job.jobId).toString("hex"),
      job,
      state: "received",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    await store.put(key, record);

    try {
      record.state = "submitting";
      record.attempts += 1;
      record.updatedAt = new Date().toISOString();
      await store.put(key, record);
      Object.assign(record, await submitJob(mandateAddress, agentSecret, job));
    } catch (error) {
      record.state = "failed";
      record.failureReason = error instanceof Error ? error.message : String(error);
    }
    record.updatedAt = new Date().toISOString();
    await store.put(key, record);
    return json(response, record.state === "failed" ? 422 : 202, record);
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aven agent runner listening on http://127.0.0.1:${port}`);
});
