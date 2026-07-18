"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAttestation, verifyAttestation, type AttestationObject } from "@/lib/stellar";

export default function VerifyAttestationPage() {
  const params = useParams();
  const attestationId = params.attestation_id as string;
  const router = useRouter();
  const [record, setRecord] = useState<AttestationObject | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([verifyAttestation(attestationId), getAttestation(attestationId)])
      .then(([verified, attestation]) => {
        if (!active) return;
        setValid(verified);
        setRecord(attestation);
      })
      .catch((caught) => {
        if (!active) return;
        setValid(false);
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      active = false;
    };
  }, [attestationId]);

  return (
    <main className="verify-wrap">
      <div className="verify-header">
        <h1 className="verify-title">Verify Work Attestation</h1>
        <p className="verify-sub">Attestation #{attestationId} · Stellar Testnet</p>
      </div>
      {valid === null ? (
        <div className="dash-loading"><div className="dash-spinner" /> Reading contract state…</div>
      ) : valid && record ? (
        <div className="verify-result-card verify-result--valid">
          <div className="verify-result-badge">✅ Verified — Authentic On-Chain Record</div>
          <div className="verify-record">
            <div className="verify-record-title">{record.title}</div>
            <p>{record.amountPaid.toFixed(7)} {record.asset} · {record.kind}</p>
            <code>{record.sender} → {record.recipient}</code>
          </div>
        </div>
      ) : (
        <div className="verify-result-card verify-result--invalid">
          <div className="verify-result-badge">❌ Invalid or missing attestation</div>
          {error && <p>{error}</p>}
        </div>
      )}
      <button className="form-btn" type="button" onClick={() => router.push("/verify")}>
        Verify another
      </button>
    </main>
  );
}
