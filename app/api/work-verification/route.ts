import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { verifyWork } from "@/services/work-verifier/src/verify";
import type { VerificationRequest } from "@/services/work-verifier/src/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

function fileExtension(file: File) {
  const extension = extname(file.name).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ".txt";
}

function validateFile(value: FormDataEntryValue | null, label: string, required: true): File;
function validateFile(
  value: FormDataEntryValue | null,
  label: string,
  required: false,
): File | undefined;
function validateFile(value: FormDataEntryValue | null, label: string, required: boolean) {
  if (!(value instanceof File) || !value.name) {
    if (required) throw new Error(`${label} is required.`);
    return undefined;
  }
  if (value.size > MAX_ARTIFACT_BYTES) {
    throw new Error(`${label} must be 5 MB or smaller.`);
  }
  return value;
}

export async function POST(request: Request) {
  let directory: string | undefined;
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ENABLE_MANUAL_VERIFICATION !== "true"
    ) {
      return NextResponse.json(
        {
          error:
            "Manual verification is disabled in production until an authenticated, rate-limited verification worker is configured.",
        },
        { status: 503 },
      );
    }
    const formData = await request.formData();
    const workType = formData.get("workType");
    if (workType !== "code" && workType !== "creative") {
      return NextResponse.json(
        { error: "workType must be either code or creative." },
        { status: 400 },
      );
    }

    let artifact: File;
    let baseline: File | undefined;
    try {
      artifact = validateFile(formData.get("artifact"), "Artifact", true);
      baseline = validateFile(formData.get("baseline"), "Baseline", false);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    directory = await mkdtemp(join(tmpdir(), "aven-manual-verification-"));
    const artifactPath = join(directory, `artifact${fileExtension(artifact)}`);
    await writeFile(artifactPath, Buffer.from(await artifact.arrayBuffer()), { mode: 0o600 });

    let baselinePath: string | undefined;
    if (baseline) {
      baselinePath = join(directory, `baseline${fileExtension(baseline)}`);
      await writeFile(baselinePath, Buffer.from(await baseline.arrayBuffer()), { mode: 0o600 });
    }

    const verificationRequest: VerificationRequest = {
      workType,
      artifactUrl: artifactPath,
      baselineUrl: baselinePath,
    };
    const result = await verifyWork(verificationRequest);

    return NextResponse.json({
      ...result,
      workType,
      artifactName: artifact.name,
      baselineName: baseline?.name,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
