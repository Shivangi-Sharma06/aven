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
              The client locks the agreed budget in a Stellar smart contract, then sets
              the schedule and checkpoints.
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
            <h3>PROGRESS UNLOCKS PAYMENT</h3>
            <p>
              Earnings accrue as the work moves forward. Checkpoints keep both sides
              aligned before more funds become available.
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
            <h3>APPROVE. RECORD. REPEAT.</h3>
            <p>
              The worker submits a checkpoint. Once approved, Aven records who worked,
              who paid, and what was completed as an on-chain attestation.
            </p>
            <div className="proof-stack" aria-label="Stream completion flow">
              <strong>WORK FUNDED</strong>
              <strong>CHECKPOINT SUBMITTED</strong>
              <strong>CLIENT APPROVED</strong>
              <strong>✓ ATTESTED ON STELLAR</strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
