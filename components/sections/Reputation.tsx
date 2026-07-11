const reputationRows = [
  ['IDENTITY', 'KARTIKEY.AVEN'],
  ['COMPLETED', '20 STREAMS'],
  ['PAID', '18,420 USDC'],
  ['TIME', '1,284 HOURS'],
  ['CATEGORIES', 'SMART CONTRACTS / FRONTEND / SECURITY / OPEN SOURCE'],
]

export default function Reputation() {
  return (
    <section className="aven-section reputation-section">
      <div className="section-kicker">04 / REPUTATION</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>
            YOUR WORK HISTORY.
            <br />
            OWNED BY YOU.
          </h2>
          <p className="section-copy">
            Aven computes reputation directly from a wallet&apos;s complete
            attestation history.
          </p>
        </div>
        <div className="section-visual reputation-document-card">
          <div className="reputation-document-title">REPUTATION RECORD</div>
          <div className="reputation-document-row reputation-score-row">
            <span>SCORE</span>
            <strong className="reputation-score">842</strong>
          </div>
          {reputationRows.map(([label, value]) => (
            <div className="reputation-document-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <p className="reputation-document-footnote">
            TRANSPARENT · PORTABLE · VERIFIABLE · NOT CONTROLLED BY AVEN · NOT
            CONTROLLED BY A MARKETPLACE
          </p>
        </div>
      </div>
    </section>
  )
}
