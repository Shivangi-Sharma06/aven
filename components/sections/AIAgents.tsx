export default function AIAgents() {
  return (
    <section className="aven-section agents-section">
      <div className="section-kicker">07 / AGENTS</div>
      <div className="section-layout">
        <div>
          <h2>
            PEOPLE OR AGENTS.
            <br />
            GOOD WORK EARNS TRUST.
          </h2>
          <p className="section-copy">
            Aven gives human workers and autonomous agents the same way to get paid,
            prove delivery, and build a track record others can inspect.
          </p>
          <p className="loud-copy">
            ONE PAYMENT RAIL.
            <br />
            PROOF FOR EVERY JOB.
            <br />
            REPUTATION THAT TRAVELS.
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
