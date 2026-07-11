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
            WORK.
            <br />
            PAID IN REAL TIME.
            <br />
            PROVEN FOREVER.
          </h2>
        </div>
        <div className="section-visual steps-grid">
          <article className="step-panel">
            <span>STEP 01</span>
            <h3>CREATE A STREAM</h3>
            <p>
              A sender deposits funds into a Soroban smart contract and defines the
              payment rate.
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
            <h3>MONEY FLOWS</h3>
            <p>
              The recipient earns continuously as time passes and can withdraw the
              earned balance at any moment.
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
            <h3>WORK BECOMES PROOF</h3>
            <p>
              When the stream completes, Aven creates a permanent Work Attestation
              containing the participants, payment, duration and work category.
            </p>
            <div className="proof-stack" aria-label="Stream completion flow">
              <strong>ACTIVE STREAM</strong>
              <strong>STREAM COMPLETE</strong>
              <strong>WORK ATTESTATION</strong>
              <strong>✓ VERIFIED ON STELLAR</strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
