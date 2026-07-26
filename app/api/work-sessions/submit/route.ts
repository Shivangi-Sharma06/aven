import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import { verifyReport } from "@/lib/work-verifier";
import { recordVerifiedWork } from "@/lib/work-stream-verifier";
import type { WorkSession, WorkSessionReport } from "@/lib/work-session";
import { STREAM_CONTRACT_ID } from "@/lib/contracts";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateCliRequest,
  calculateSettlementSeconds,
  calculateSessionPaymentUnits,
  formatAmountUnits,
  getAvailableUnits,
  getOnchainStream,
  ratePerSecondUnits,
  validateWorkSessionReport,
} from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REPORT_BYTES = 512 * 1024;

export async function POST(request: Request) {
  try {
    const token = await authenticateCliRequest(request, "submit_session");
    if (!token) return apiError("A valid CLI token is required.", 401);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REPORT_BYTES) return apiError("The report must be 512 KB or smaller.", 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_REPORT_BYTES) return apiError("The report must be 512 KB or smaller.", 413);
    const report = JSON.parse(raw) as WorkSessionReport;
    validateWorkSessionReport(report);

    const existing = await getSession(report.session.sessionId);
    if (existing) {
      if (!addressesEqual(existing.workerAddress, token.walletAddress)) {
        return apiError("This session belongs to another worker.", 403);
      }
      // Allow retry for sessions that never completed the full flow.
      // This includes VERIFYING (on-chain timed out), SUBMITTED (reverted),
      // and VERIFICATION_COMPLETE (already done — return it).
      if (existing.status === "VERIFICATION_COMPLETE") {
        return NextResponse.json({ sessionId: existing.id, status: existing.status, session: existing });
      }
      // Fall through to re-run verification for VERIFYING or SUBMITTED.
    }

    const stream = await getOnchainStream(report.session.streamId);
    if (!stream) return apiError("The referenced stream was not found.", 404);
    if (!addressesEqual(report.session.workerAddress, token.walletAddress)) {
      return apiError("The report worker does not match the authorized CLI wallet.", 403);
    }
    if (!addressesEqual(stream.recipient, token.walletAddress)) {
      return apiError("The authorized CLI wallet is not this stream's recipient.", 403);
    }
    if (stream.status !== "active" && stream.status !== "paused") {
      return apiError("Work sessions can only be submitted to active or paused streams.", 409);
    }
    if (report.paymentRequest.asset !== stream.asset) {
      return apiError("The report asset does not match the stream asset.");
    }
    const availableUnits = await getAvailableUnits(stream.id);
    const projectEnded = report.session.projectEnded === true;
    const remainingEscrowUnits =
      stream.totalDepositedUnits - stream.totalWithdrawnUnits;
    if (projectEnded && availableUnits !== remainingEscrowUnits) {
      return apiError(
        "Resolve every pending or reserved work-session payment before submitting the final project session.",
        409,
      );
    }
    const calculatedUnits = projectEnded
      ? availableUnits
      : calculateSessionPaymentUnits(
          stream,
          report.session.activeSeconds,
          availableUnits,
        );
    if (calculatedUnits <= 0n) {
      return apiError(
        projectEnded
          ? "No unreserved escrow remains to complete this project."
          : "No escrow remains for this session's tracked active time.",
        409,
      );
    }
    const settlementSeconds = projectEnded
      ? calculateSettlementSeconds(stream, availableUnits)
      : undefined;
    report.paymentRequest = {
      requestedAmount: formatAmountUnits(calculatedUnits),
      asset: stream.asset,
      calculation: projectEnded
        ? "remaining_escrow_via_settlement_seconds"
        : "active_time_x_stream_rate",
      ratePerSecond: formatAmountUnits(ratePerSecondUnits(stream)),
      billableSeconds: report.session.activeSeconds,
      settlementSeconds: settlementSeconds?.toString(),
    };
    // Excluded paths are useful in the worker's private local report, but the
    // dashboard only needs the aggregate privacy counts. Do not persist their
    // names server-side.
    report.changes.changedFiles = report.changes.changedFiles.filter(
      (file) => file.includedInVerification,
    );

    const now = new Date().toISOString();

    // Create or reuse the session.
    const isRetry = existing != null;
    let session: WorkSession;

    if (!isRetry) {
      session = addTimelineEvent(
        {
          id: report.session.sessionId,
          contractId: STREAM_CONTRACT_ID,
          streamId: stream.id,
          workerAddress: stream.recipient,
          clientAddress: stream.sender,
          status: "SUBMITTED",
          report,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
          timeline: [],
        },
        "SUBMITTED",
        "worker",
        "Work-session report submitted.",
      );
      await putSession(session);
    } else {
      existing.report = report;
      existing.updatedAt = now;
      addTimelineEvent(existing, "SUBMITTED", "system", "Retrying verification after previous failure.");
      await putSession(existing);
      session = existing;
    }

    // Static verification (always runs, fast/safe).
    const verification = verifyReport(report);
    session.verificationFlags = verification.flags;
    session.verificationSummary = verification.summary;

    // On-chain verify_work via the verifier keypair. This creates the
    // WithdrawalRecord with "Pending" status, which is required because the
    // deployed contract blocks the legacy request_withdrawal when a verifier
    // is configured (Error #32 = VerificationRequired).
    addTimelineEvent(session, "VERIFYING", "system", "Calling verify_work on-chain via verifier.");
    await putSession(session);

    let onchain;
    try {
      onchain = await recordVerifiedWork({
        streamId: stream.id,
        sessionId: session.id,
        amountUnits: calculatedUnits,
        report,
      });
    } catch (onchainError: any) {
      const errorMessage = onchainError?.message ?? String(onchainError);
      addTimelineEvent(
        session,
        "SUBMITTED",
        "system",
        `On-chain verification failed: ${errorMessage}. Resubmit to retry.`,
      );
      session.verificationError = errorMessage;
      await putSession(session);
      return apiError(`On-chain verification failed: ${errorMessage}`, 502);
    }

    session.verifierTxHash = onchain.transactionHash;
    session.reportDigest = onchain.reportDigest;
    session.reviewDeadlineLedger = onchain.reviewDeadlineLedger;

    addTimelineEvent(session, "VERIFICATION_COMPLETE", "system", verification.summary);
    await putSession(session);

    return NextResponse.json({ sessionId: session.id, status: session.status, session }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError("The request body is not valid JSON.");
    return apiError(error);
  }
}