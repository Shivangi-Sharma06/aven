const attestationRows = [
  ['STATUS', 'VERIFIED'],
  ['CATEGORY', 'SMART CONTRACT DEVELOPMENT'],
  ['DURATION', '18 DAYS'],
  ['TOTAL PAID', '2,450 USDC'],
  ['SENDER', 'GBX7...81F'],
  ['RECIPIENT', 'GDQ4...92A'],
  ['TRANSACTION', '7fa3...192d'],
  ['NETWORK', 'STELLAR'],
]

export default function WorkAttestations() {
  return (
    <section className="aven-section attestation-section">
      <div className="section-kicker">03 / ATTESTATIONS</div>
      <div className="section-layout">
        <div>
          <h2>PAYMENT BECOMES PROOF.</h2>
          <p className="section-copy">
            Every completed stream leaves behind a permanent, portable record of real
            economic activity.
          </p>
          <p className="loud-copy">
            NO SELF-REPORTED CLAIMS.
            <br />
            NO PLATFORM BADGES.
            <br />
            THE PAYMENT ITSELF CREATES THE PROOF.
          </p>
        </div>
        <div className="section-visual attestation-card">
          <span>WORK ATTESTATION</span>
          <dl className="data-list data-list--large">
            {attestationRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <svg className="attestation-path" viewBox="0 0 420 72" aria-hidden="true">
            <path d="M14 36 C118 8 232 8 406 36" data-strengthen-path />
          </svg>
        </div>
      </div>
    </section>
  )
}
