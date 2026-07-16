"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, FileCode2, FileText, Image as ImageIcon, ShieldCheck, Upload } from "lucide-react";
import styles from "./WorkVerificationConsole.module.css";

type WorkType = "code" | "creative";

type VerificationResult = {
  score: number;
  evidenceHash: string;
  summary: string;
  flags: string[];
  approved: boolean;
  reportStatus: "completed" | "unavailable" | "not_applicable";
  workType: WorkType;
  artifactName: string;
  baselineName?: string;
  verifiedAt: string;
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  empty_artifact: "The submission is empty or too short to demonstrate meaningful work.",
  no_structural_change: "The submission does not show meaningful structural change from its baseline.",
  recycled_content: "The Groq report found that the submission substantially repackages existing work.",
  test_regression: "The submission contains fewer structural definitions than its baseline.",
  low_novelty: "Semantic novelty was scored below the minimum signal level.",
  verification_error: "A verification tool could not complete its check.",
  phash_identical: "The submitted image is perceptually identical to its baseline.",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePicker({
  id,
  label,
  note,
  file,
  accept,
  required,
  onChange,
}: {
  id: string;
  label: string;
  note: string;
  file: File | null;
  accept: string;
  required?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className={styles.fileField}>
      <div className={styles.fieldHeading}>
        <span>{label}</span>
        <small>{required ? "Required" : "Optional"}</small>
      </div>
      <input
        className={styles.fileInput}
        id={id}
        type="file"
        accept={accept}
        required={required}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <label className={styles.fileTarget} htmlFor={id}>
        <Upload aria-hidden="true" size={22} strokeWidth={1.5} />
        <span>{file ? file.name : "Choose a file"}</span>
        <small>{file ? formatBytes(file.size) : note}</small>
      </label>
    </div>
  );
}

export function WorkVerificationConsole() {
  const [workType, setWorkType] = useState<WorkType>("code");
  const [artifact, setArtifact] = useState<File | null>(null);
  const [baseline, setBaseline] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  const accept = useMemo(
    () =>
      workType === "code"
        ? ".js,.mjs,.ts,.tsx,.py,.rs,.go"
        : ".txt,.md,.html,.png,.jpg,.jpeg,.webp,.gif",
    [workType],
  );

  function selectWorkType(next: WorkType) {
    setWorkType(next);
    setArtifact(null);
    setBaseline(null);
    setResult(null);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!artifact) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const payload = new FormData();
      payload.set("workType", workType);
      payload.set("artifact", artifact);
      if (baseline) payload.set("baseline", baseline);
      const response = await fetch("/api/work-verification", { method: "POST", body: payload });
      const body = (await response.json()) as VerificationResult | { error?: string };
      if (!response.ok || !("score" in body)) {
        throw new Error("error" in body && body.error ? body.error : "Verification could not complete.");
      }
      setResult(body);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copyHash() {
    if (!result) return;
    await navigator.clipboard.writeText(result.evidenceHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const status = !result
    ? null
    : result.workType === "creative"
      ? { label: "Owner review required", tone: styles.review }
      : result.approved
        ? { label: "Verification passed", tone: styles.passed }
        : { label: "Payment blocked", tone: styles.blocked };

  return (
    <div className={styles.console}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>PROOF OF WORK / HUMAN + AGENT</span>
        <h2>Verify the work before money moves.</h2>
        <p>
          Upload work directly from your device. Aven performs static analysis and evidence checks
          without executing submitted code. No wallet or agent key is required for this preflight.
        </p>
      </header>

      <div className={styles.process} aria-label="Verification process">
        <div><span>01</span><strong>Upload</strong><small>Artifact and optional baseline</small></div>
        <div><span>02</span><strong>Analyze</strong><small>Static parsers and evidence tools</small></div>
        <div><span>03</span><strong>Decide</strong><small>Pass, block, or owner review</small></div>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formHeader}>
          <div>
            <span className={styles.eyebrow}>01 / WORK TYPE</span>
            <h3>What kind of work are you checking?</h3>
          </div>
          <div className={styles.typeSwitch} role="radiogroup" aria-label="Work type">
            <button
              className={workType === "code" ? styles.selected : ""}
              type="button"
              role="radio"
              aria-checked={workType === "code"}
              onClick={() => selectWorkType("code")}
            >
              <FileCode2 aria-hidden="true" size={18} /> Code
            </button>
            <button
              className={workType === "creative" ? styles.selected : ""}
              type="button"
              role="radio"
              aria-checked={workType === "creative"}
              onClick={() => selectWorkType("creative")}
            >
              <ImageIcon aria-hidden="true" size={18} /> Creative
            </button>
          </div>
        </div>

        <div className={styles.fileGrid}>
          <FilePicker
            id="work-artifact"
            label="Submitted work"
            note={workType === "code" ? "JS, TS, Python, Rust, or Go" : "Text, Markdown, or image"}
            file={artifact}
            accept={accept}
            required
            onChange={setArtifact}
          />
          <FilePicker
            id="work-baseline"
            label="Before-work baseline"
            note="Upload the original version for comparison"
            file={baseline}
            accept={accept}
            onChange={setBaseline}
          />
        </div>

        <div className={styles.toolLedger}>
          <div><ShieldCheck size={17} /><span>Every file</span><strong>SHA-256 evidence</strong></div>
          {workType === "code" ? (
            <>
              <div><FileCode2 size={17} /><span>Safety boundary</span><strong>Code is never executed</strong></div>
              <div><FileText size={17} /><span>JS / TS / Python</span><strong>Syntax + AST comparison</strong></div>
            </>
          ) : (
            <>
              <div><FileText size={17} /><span>Writing</span><strong>Word and paragraph delta</strong></div>
              <div><ImageIcon size={17} /><span>Images</span><strong>Pixel-level pHash</strong></div>
            </>
          )}
        </div>

        <div className={styles.submitRow}>
          <p>
            When configured, code or writing is sent to Groq to generate the comparison report.
            Images stay on the verifier. Your agent&apos;s wallet secret is never needed here.
          </p>
          <button type="submit" disabled={!artifact || busy}>
            {busy ? <><span className={styles.spinner} /> Verifying real work…</> : "Run verification →"}
          </button>
        </div>
      </form>

      {error && <div className={styles.error} role="alert"><strong>Verification stopped.</strong>{error}</div>}

      {result && status && (
        <section className={styles.result} ref={resultRef} aria-live="polite">
          <div className={styles.resultHeader}>
            <div>
              <span className={styles.eyebrow}>VERIFICATION RECORD / {result.artifactName}</span>
              <h3>{status.label}</h3>
            </div>
            <span className={`${styles.status} ${status.tone}`}>{status.label}</span>
          </div>

          <div className={styles.resultGrid}>
            <div className={styles.scoreBlock}>
              <span>Composite signal</span>
              <strong>{result.score}</strong>
              <small>/ 100</small>
              <div className={styles.scoreTrack}><span style={{ width: `${result.score}%` }} /></div>
            </div>
            <div className={styles.decisionBlock}>
              <span>Decision</span>
              <strong>
                {result.workType === "creative"
                  ? "A human owner must approve creative work."
                  : result.approved
                    ? "Eligible to continue to payment policy checks."
                    : "Do not submit a payment stream for this work."}
              </strong>
              <p>This manual record does not create a payment or an on-chain attestation.</p>
            </div>
          </div>

          <div className={styles.summary}>
            <span>Verification summary</span>
            <p>{result.summary}</p>
          </div>

          <div className={styles.checks}>
            <div><span>Evidence hash</span><strong>Completed</strong></div>
            <div>
              <span>Deterministic checks</span>
              <strong>{result.workType === "code" ? "Syntax + structure" : "Text / image analysis"}</strong>
            </div>
            <div>
              <span>Groq report</span>
              <strong className={result.reportStatus === "unavailable" ? styles.unavailable : ""}>
                {result.reportStatus === "completed"
                  ? "Completed"
                  : result.reportStatus === "not_applicable"
                    ? "Not applicable"
                    : "Unavailable — add Groq key"}
              </strong>
            </div>
          </div>

          <div className={styles.hashRow}>
            <div><span>SHA-256 / RAW ARTIFACT BYTES</span><code>{result.evidenceHash}</code></div>
            <button type="button" onClick={copyHash} aria-label="Copy evidence hash">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className={styles.flags}>
            <span>Verification flags</span>
            {result.flags.length === 0 ? (
              <p className={styles.noFlags}>No blocking or informational flags.</p>
            ) : (
              <ul>
                {result.flags.map((flag) => (
                  <li key={flag}><code>{flag}</code><span>{FLAG_DESCRIPTIONS[flag] ?? "Verifier signal recorded."}</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <aside className={styles.boundary}>
        <span className={styles.eyebrow}>WHAT HAPPENS NEXT</span>
        <div>
          <strong>Human worker</strong>
          <p>Use this result as a preflight record. Payment still follows the normal stream and owner approval flow.</p>
        </div>
        <div>
          <strong>AI agent worker</strong>
          <p>An AI agent can submit its own work through the same verifier and receive payment through a normal stream where its wallet is the recipient.</p>
        </div>
      </aside>
    </div>
  );
}
