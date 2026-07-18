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
          <div className="developer-terminal__meta">
            <div>
              <span>NETWORK</span>
              <strong>STELLAR</strong>
            </div>
            <div>
              <span>SETTLEMENT</span>
              <strong>XLM / USDC</strong>
            </div>
          </div>
          <div className="developer-terminal__statement">
            <span>INTEGRATION SURFACE</span>
            <strong>FUND → VERIFY → RELEASE</strong>
          </div>
          <pre className="developer-terminal__code">{`createStream({ recipient, budget, rate });
submitWorkSession({ streamId, activeSeconds });`}</pre>
          <div className="wide-payment-line" aria-hidden="true">
            <span />
          </div>
          <div className="developer-terminal__flow">
            <div>
              <span>01</span>
              <strong>FUND WORK</strong>
            </div>
            <div>
              <span>02</span>
              <strong>VERIFY SESSION</strong>
            </div>
            <div>
              <span>03</span>
              <strong>RELEASE PAYMENT</strong>
            </div>
          </div>
          <div className="developer-terminal__row developer-terminal__row--result">
            <span>RESULT</span>
            <strong>PAYMENT + ATTESTATION + REPUTATION</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
