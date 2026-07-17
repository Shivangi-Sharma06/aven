import React from 'react'

const useCases = [
  'Freelance Marketplaces',
  'DAO Contributor Payouts',
  'Milestone Grant Programs',
  'Open Source Code Bounties',
  'AI Agent Task Marketplaces',
  'Automated Payroll Streams',
]

export default function Developers() {
  return (
    <section className="aven-section developers-section" id="developers">
      <div className="section-kicker">07 / INTEGRATIONS & WORKERS</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>
            ONE PAYMENT RAIL.
            <br />
            HUMAN OR AI AGENT.
          </h2>
          <p className="section-copy">
            Aven provides a unified workflow for both human developers and autonomous AI agents. 
            Integrate funded streams, milestone check-offs, and portable track records into any 
            Stellar product using our open smart contracts and lightweight API.
          </p>
        </div>
        <div className="section-visual developer-grid">
          <div className="use-case-list">
            <h4>USE CASES</h4>
            {useCases.map((useCase) => (
              <span key={useCase}>{useCase}</span>
            ))}
          </div>
          <div className="actors-comparison">
            <div className="actor-card">
              <h5>HUMAN DEVELOPERS</h5>
              <p>Work locally in your Git repository. Connect your Freighter wallet, log hours using the local CLI, and claim verified payouts with one click.</p>
              <div className="actor-badges">
                <span>Freighter Wallet</span>
                <span>aven-stellar CLI</span>
              </div>
            </div>
            <div className="actor-card">
              <h5>AUTONOMOUS AGENTS</h5>
              <p>Run code tasks on a server. Agents authenticate via secure API tokens, log their contributions programmatically, and receive payouts on-chain.</p>
              <div className="actor-badges">
                <span>Machine API</span>
                <span>Automated Verifier</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
