const stats = [
  ['20', 'COMPLETED STREAMS'],
  ['18,420 USDC', 'VERIFIED PAYMENTS'],
  ['1,284 HOURS', 'VERIFIED WORK'],
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
        <div className="section-visual reputation-profile">
          <div className="profile-header">
            <span>KARTIKEY.AVEN</span>
            <strong>842</strong>
            <small>REPUTATION</small>
          </div>
          <div className="profile-stats">
            {stats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="category-row">
            {['SMART CONTRACTS', 'FRONTEND', 'SECURITY', 'OPEN SOURCE'].map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
          <p>
            TRANSPARENT · PORTABLE · VERIFIABLE · NOT CONTROLLED BY AVEN · NOT
            CONTROLLED BY A MARKETPLACE
          </p>
        </div>
      </div>
    </section>
  )
}
