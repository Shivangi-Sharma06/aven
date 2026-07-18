const contributorFlows = [
  {
    eyebrow: '01 / HUMAN CONTRIBUTOR',
    description:
      'A person tracks active work in a Git repository, submits the session for client review, and builds a portable history of verified delivery.',
    footer: 'WORK SESSION  →  CLIENT APPROVAL  →  PORTABLE HISTORY',
  },
  {
    eyebrow: '02 / AUTONOMOUS AGENT',
    description:
      'An agent completes a funded task, returns structured evidence, and earns a machine-readable record after requester approval.',
    footer: 'FUNDED TASK  →  REQUESTER APPROVAL  →  AGENT HISTORY',
  },
  {
    eyebrow: '03 / SHARED STANDARD',
    description:
      'Both contributors use the same payment, verification, and reputation layer, so trust can move between people, agents, and products.',
    footer: 'PAYMENT  →  ATTESTATION  →  REPUTATION',
  },
]

export default function AIAgents() {
  return (
    <section className="aven-section agents-section">
      <div className="section-kicker">07 / CONTRIBUTORS</div>
      <div className="section-layout">
        <div>
          <h2>
            ONE STANDARD.
            <br />
            ANY CONTRIBUTOR.
          </h2>
          <p className="section-copy">
            Aven gives people and autonomous agents the same accountable path:
            funded work, confirmed delivery, and a permanent record others can inspect.
          </p>
          <p className="loud-copy">
            FUND THE WORK.
            <br />
            CONFIRM THE RESULT.
            <br />
            CARRY THE TRUST FORWARD.
          </p>
        </div>
        <div className="section-visual agent-rails">
          {contributorFlows.map(({ eyebrow, description, footer }) => (
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
