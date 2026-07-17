import React from 'react'

const attestationRows = [
  ['STATUS', 'Verified & Minted'],
  ['WORK SUMMARY', 'Soroban Smart Contract Integration'],
  ['DELIVERABLE', 'Project Completed (CLI --ended)'],
  ['AMOUNT RELEASED', '2,500.00 USDC'],
  ['SENDER (CLIENT)', 'GBX7...81F'],
  ['RECIPIENT (WORKER)', 'GDQ4...92A'],
  ['VERIFIER KEY', 'SHA-256 Verified'],
  ['NETWORK', 'Stellar Testnet'],
]

export default function WorkAttestations() {
  return (
    <section className="aven-section attestation-section">
      <div className="section-kicker">03 / ATTESTATIONS</div>
      <div className="section-layout">
        <div>
          <h2>A permanent receipt for real work.</h2>
          <p className="section-copy">
            When a client approves your work session or milestone, Aven releases the payment 
            and mints an on-chain attestation at the exact same moment. It’s a permanent, 
            tamper-proof record of your contribution that no platform can delete or take away.
          </p>
          <p className="loud-copy">
            WHO DID THE WORK.
            <br />
            WHO PAID FOR IT.
            <br />
            WHAT WAS COMPLETED.
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
