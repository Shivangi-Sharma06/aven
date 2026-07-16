import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requestId, submitJob } from "./stellar.ts";
import { JobStore } from "./jobs.ts";
import type { JobRecord, StreamJob } from "./types.ts";
import { verifyWork, type VerificationResult } from "./verify.ts";

const mandateAddress = required("AGENT_MANDATE_ADDRESS");
const agentSecret = required("AGENT_SECRET_KEY");
const hmacSecret = required("RUNNER_HMAC_SECRET");
if (hmacSecret.length < 32) throw new Error("RUNNER_HMAC_SECRET must be at least 32 characters.");

const port = Number(process.env.PORT ?? 8787);
const store = new JobStore(process.env.RUNNER_DATA_FILE ?? "./data/jobs.json");
const jobRoutePrefix = "/jobs/";
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
    if (request.method === "GET" && request.url?.startsWith(jobRoutePrefix)) {
      const jobId = decodeURIComponent(request.url.slice(jobRoutePrefix.length));
      if (!jobId) return json(response, 400, { error: "jobId is required" });
      const key = `${mandateAddress}:${requestId(jobId).toString("hex")}`;
      const record = store.get(key);
      if (!record) return json(response, 404, { error: "Job not found" });
      return json(response, 200, record);
    }
    if (request.method !== "POST" || request.url !== "/jobs") {
      return json(response, 404, { error: "Not found" });
    }

    const payload = await body(request);
    if (!authenticated(payload, request.headers["x-aven-signature"] as string | undefined)) {
      return json(response, 401, { error: "Invalid job signature" });
    }
    const job = JSON.parse(payload.toString("utf8")) as StreamJob;
    if (typeof job.jobId !== "string" || !job.jobId.trim()) {
      return json(response, 400, { error: "jobId is required" });
    }
    if (job.workType !== "code" && job.workType !== "creative") {
      return json(response, 400, { error: "workType must be either code or creative" });
    }
    if (typeof job.artifactUrl !== "string" || !job.artifactUrl.trim()) {
      return json(response, 400, { error: "artifactUrl is required" });
    }
    if (job.baselineUrl !== undefined && typeof job.baselineUrl !== "string") {
      return json(response, 400, { error: "baselineUrl must be a string" });
    }

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

    record.state = "verifying";
    record.workType = job.workType;
    record.updatedAt = new Date().toISOString();
    await store.put(key, record);

    let verificationResult: VerificationResult;
    try {
      verificationResult = await verifyWork(job);
    } catch (error) {
      record.state = "failed";
      record.failureReason = error instanceof Error ? error.message : String(error);
      record.verificationFlags = ["verification_error"];
      record.verificationScore = 0;
      record.updatedAt = new Date().toISOString();
      await store.put(key, record);
      return json(response, 422, record);
    }

    record.verificationScore = verificationResult.score;
    record.evidenceHash = verificationResult.evidenceHash;
    record.verificationSummary = verificationResult.summary;
    record.verificationFlags = verificationResult.flags;
    record.updatedAt = new Date().toISOString();
    await store.put(key, record);

    if (!verificationResult.approved && job.workType === "code") {
      record.state = "failed";
      record.failureReason = `Verification failed: ${verificationResult.flags.join(", ")}`;
      record.updatedAt = new Date().toISOString();
      await store.put(key, record);
      return json(response, 422, record);
    }

    const forceOwnerApproval = job.workType === "creative";
    try {
      record.state = "submitting";
      record.attempts += 1;
      record.updatedAt = new Date().toISOString();
      await store.put(key, record);
      Object.assign(record, await submitJob(mandateAddress, agentSecret, job, forceOwnerApproval));
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
