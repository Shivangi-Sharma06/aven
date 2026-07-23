const integrationSteps = [
  ['01', 'FUND', 'Create an escrow-backed agreement.'],
  ['02', 'VERIFY', 'Submit npm-tracked active work.'],
  ['03', 'RELEASE', 'Pay and record the proof.'],
] as const

export default function Developers() {
  return (
    <section className="aven-section developers-section" id="developers">
      <div className="section-kicker">06 / DEVELOPERS</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>BUILD WORK INTO YOUR PRODUCT.</h2>
          <p className="section-copy">
            Fund assignments, verify npm-tracked sessions, release exact payments,
            and return portable reputation through one Stellar-native workflow.
          </p>
        </div>

        <div className="section-visual developer-terminal">
          <div className="developer-terminal__row developer-terminal__row--header">
            <span>INTEGRATION BLUEPRINT</span>
            <strong>AVEN WORK LAYER</strong>
          </div>

          <div className="developer-terminal__flow">
            {integrationSteps.map(([number, title, description]) => (
              <div key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            ))}
          </div>

          <pre className="developer-terminal__code">{`createStream({ recipient, budget, rate })
submitWorkSession({ streamId, activeSeconds })`}</pre>

          <div className="developer-terminal__row developer-terminal__row--result">
            <span>OUTPUT</span>
            <strong>PAYMENT + ATTESTATION + REPUTATION</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
