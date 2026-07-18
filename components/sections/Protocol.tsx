export default function Protocol() {
  return (
    <section className="aven-section protocol-section" id="protocol">
      <div className="section-kicker">05 / PROTOCOL</div>
      <div className="section-layout">
        <div>
          <h2>
            TRUST, BUILT INTO
            <br />
            THE PAYMENT.
          </h2>
        </div>
        <div className="section-visual protocol-stack">
          <article>
            <span>STREAM CONTRACT</span>
            <p>
              Holds the budget and verifies each npm work session against active time
              and the agreed rate.
            </p>
            <code>payment = npm_active_seconds × rate_per_second</code>
          </article>
          <article>
            <span>ATTESTATION CONTRACT</span>
            <p>
              Turns every released work session—and one final project completion—into
              permanent, verifiable records.
            </p>
            <code>client · worker · amount · period · category · confirmation</code>
          </article>
          <article>
            <span>REPUTATION CONTRACT</span>
            <p>Computes one stable score when a funded project is fully completed.</p>
            <code>NO REVIEWS. NO HIDDEN RANKING. JUST VERIFIED HISTORY.</code>
          </article>
        </div>
      </div>
    </section>
  )
}
