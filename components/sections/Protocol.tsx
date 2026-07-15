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
              Holds the budget, tracks earned value, and enforces checkpoint-based
              withdrawal limits.
            </p>
            <code>earned = (current_time - start_time) × rate_per_second</code>
          </article>
          <article>
            <span>ATTESTATION CONTRACT</span>
            <p>
              Turns each finalized checkpoint into a permanent record of paid,
              client-confirmed work.
            </p>
            <code>client · worker · amount · period · category · confirmation</code>
          </article>
          <article>
            <span>REPUTATION CONTRACT</span>
            <p>Reads verified work history and computes a transparent reputation score.</p>
            <code>NO REVIEWS. NO HIDDEN RANKING. JUST VERIFIED HISTORY.</code>
          </article>
        </div>
      </div>
    </section>
  )
}
