export default function Protocol() {
  const protocolFlows = [
    {
      eyebrow: '01 / AVEN-STELLAR NPM PACKAGE',
      description:
        'Tracks active and idle duration, Git branch and commits, relative changed paths, and diff statistics. It never records file contents, keystrokes, screenshots, or wallet secrets.',
      footer: 'npx aven-stellar start  →  npx aven-stellar stop',
    },
    {
      eyebrow: '02 / SESSION PAYMENT',
      description:
        'The CLI submits a structured work report to the dashboard. Only tracked active seconds count toward the reserved payment.',
      footer: 'payment = min(active_seconds × rate, unreserved_escrow)',
    },
    {
      eyebrow: '03 / REVIEW + ONCHAIN RECORD',
      description:
        'The sender reviews the session before release. Approval pays the worker and creates the work attestation; project completion updates reputation once.',
      footer: 'REPORT  →  REVIEW  →  RELEASE  →  PROOF',
    },
  ]

  return (
    <section className="aven-section protocol-section" id="protocol">
      <div className="section-kicker">05 / PROTOCOL</div>
      <div className="section-layout">
        <div>
          <h2>
            FROM LOCAL WORK
            <br />
            TO VERIFIED PAYMENT.
          </h2>
          <p className="section-copy">
            The aven-stellar npm package connects work inside a Git repository to an
            existing Aven stream—without executing the project or uploading its source.
          </p>
        </div>
        <div className="section-visual protocol-stack">
          {protocolFlows.map(({ eyebrow, description, footer }) => (
            <article key={eyebrow}>
              <span>{eyebrow}</span>
              <p>{description}</p>
              <code>{footer}</code>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
