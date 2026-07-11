export default function AIAgents() {
  return (
    <section className="aven-section agents-section">
      <div className="section-kicker">07 / AGENTS</div>
      <div className="section-layout">
        <div>
          <h2>
            A WALLET IS A WALLET.
            <br />
            WORK IS WORK.
          </h2>
          <p className="section-copy">
            Aven does not distinguish between human workers and autonomous agents at
            the protocol level.
          </p>
          <p className="loud-copy">
            THE SAME PAYMENT RAIL.
            <br />
            THE SAME WORK HISTORY.
            <br />
            THE SAME REPUTATION SYSTEM.
          </p>
        </div>
        <div className="section-visual agent-rails">
          {['HUMAN', 'AI AGENT'].map((actor) => (
            <div key={actor}>
              <strong>{actor}</strong>
              <span>STREAM CONTRACT</span>
              <span>ATTESTATION</span>
              <span>REPUTATION</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
