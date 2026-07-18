const attestationRows = [
  ['STATUS', 'CLIENT CONFIRMED'],
  ['WORK', 'SMART CONTRACT DEVELOPMENT'],
  ['WORK SESSION', 'SESSION 03'],
  ['AMOUNT PAID', '2,450 USDC'],
  ['SENDER', 'GBX7...81F'],
  ['RECIPIENT', 'GDQ4...92A'],
  ['PERIOD', '18 DAYS'],
  ['NETWORK', 'STELLAR TESTNET'],
]

export default function WorkAttestations() {
  return (
    <section className="aven-section attestation-section">
      <div className="section-kicker">03 / ATTESTATIONS</div>
      <div className="section-layout">
        <div>
          <h2>A RECEIPT FOR REAL WORK.</h2>
          <p className="section-copy">
            Each released npm work session creates a record both sides can verify—without
            asking a platform to vouch for them.
          </p>
          <p className="loud-copy">
            WHO DID THE WORK.
            <br />
            WHO PAID FOR IT.
            <br />
            WHAT THEY CONFIRMED.
            <br />
            RECORDED ON STELLAR.
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
