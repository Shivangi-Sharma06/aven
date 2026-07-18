const streamDetails = [
  ['ASSET', 'USDC'],
  ['DEPOSIT', '2,500.00'],
  ['RATE', '$0.002314 / SECOND'],
  ['RECIPIENT', 'GDQ4...92A'],
]

export default function HowItWorks() {
  return (
    <section className="aven-section how-section" id="how-it-works">
      <div className="section-kicker">01 / HOW IT WORKS</div>
      <div className="section-layout">
        <div>
          <h2>
            FROM AGREEMENT
            <br />
            TO PAYMENT.
            <br />
            TO PROOF.
          </h2>
        </div>
        <div className="section-visual steps-grid">
          <article className="step-panel">
            <span>STEP 01</span>
            <h3>FUND THE WORK</h3>
            <p>
              The client locks the agreed budget in a Stellar smart contract and sets
              a rate for active work time.
            </p>
            <dl className="data-list">
              {streamDetails.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="step-panel">
            <span>STEP 02</span>
            <h3>TRACK ACTIVE WORK</h3>
            <p>
              The worker runs the Aven npm package. It records active time and Git
              metadata, then calculates the exact session payment.
            </p>
            <div className="stream-line" aria-hidden="true">
              <span>SENDER</span>
              <div>
                <i />
              </div>
              <span>RECIPIENT</span>
            </div>
          </article>
          <article className="step-panel">
            <span>STEP 03</span>
            <h3>REVIEW. RELEASE. RECORD.</h3>
            <p>
              The client reviews the session. Once approved or timed out, the worker
              releases the exact reserved amount and Aven mints an attestation.
            </p>
            <div className="proof-stack" aria-label="Stream completion flow">
              <strong>WORK FUNDED</strong>
              <strong>NPM SESSION SUBMITTED</strong>
              <strong>CLIENT APPROVED</strong>
              <strong>✓ ATTESTED ON STELLAR</strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
