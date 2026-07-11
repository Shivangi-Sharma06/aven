const useCases = [
  'FREELANCE PLATFORMS',
  'DAO CONTRIBUTOR PAYMENTS',
  'GRANT PROGRAMS',
  'OPEN SOURCE BOUNTIES',
  'CONTRACTOR PAYROLL',
  'AI AGENT MARKETPLACES',
]

export default function Developers() {
  return (
    <section className="aven-section developers-section" id="developers">
      <div className="section-kicker">06 / DEVELOPERS</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>BUILD ON THE WORK LAYER.</h2>
          <p className="section-copy">
            Aven is designed as infrastructure that any Stellar application can
            integrate.
          </p>
        </div>
        <div className="section-visual developer-grid">
          <div className="use-case-list">
            {useCases.map((useCase) => (
              <span key={useCase}>{useCase}</span>
            ))}
          </div>
          <div className="code-panels">
            <pre>{`// conceptual integration
createStream({
  sender,
  recipient,
  asset: "USDC",
  ratePerSecond,
  category
});`}</pre>
            <pre>{`// conceptual query
getAttestations(wallet);`}</pre>
          </div>
        </div>
      </div>
    </section>
  )
}
