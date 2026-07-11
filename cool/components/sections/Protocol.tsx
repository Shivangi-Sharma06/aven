export default function Protocol() {
  return (
    <section className="aven-section protocol-section" id="protocol">
      <div className="section-kicker">05 / PROTOCOL</div>
      <div className="section-layout">
        <div>
          <h2>
            THREE CONTRACTS.
            <br />
            ONE ECONOMIC PRIMITIVE.
          </h2>
        </div>
        <div className="section-visual protocol-stack">
          <article>
            <span>STREAM CONTRACT</span>
            <p>
              Accepts deposits, tracks payment streams and calculates earned balances.
            </p>
            <code>earned = (current_time - start_time) × rate_per_second</code>
          </article>
          <article>
            <span>ATTESTATION CONTRACT</span>
            <p>
              Creates a permanent credential representing the completed economic
              relationship.
            </p>
            <code>sender · recipient · total paid · duration · category · proof</code>
          </article>
          <article>
            <span>REPUTATION CONTRACT</span>
            <p>Reputation is computed from raw attestation history.</p>
            <code>NEVER STORED. ALWAYS RECOMPUTED.</code>
          </article>
        </div>
      </div>
    </section>
  )
}
