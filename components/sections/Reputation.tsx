import React from 'react'

const reputationRows = [
  ['IDENTITY', 'kartik.aven'],
  ['STREAMS COMPLETED', '14 Active Streams'],
  ['TOTAL VOLUME', '12,450 USDC'],
  ['VERIFIED TIME', '342 Active Hours'],
  ['EXPERTISE FOCUS', 'Rust Smart Contracts / React Web Apps / Security Auditing'],
]

export default function Reputation() {
  return (
    <section className="aven-section reputation-section">
      <div className="section-kicker">04 / REPUTATION</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>
            A career history you
            <br />
            truly own.
          </h2>
          <p className="section-copy">
            Traditional platforms lock your work history inside their database. Aven builds your 
            reputation directly onto your Stellar wallet address. By aggregating every verified 
            payout and attestation you earn, it creates a living, portable CV that follows you 
            wherever you go.
          </p>
        </div>
        <div className="section-visual reputation-document-card">
          <div className="reputation-document-title">REPUTATION RECORD</div>
          <div className="reputation-document-row reputation-score-row">
            <span>SCORE</span>
            <strong className="reputation-score">842</strong>
          </div>
          {reputationRows.map(([label, value]) => (
            <div className="reputation-document-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <p className="reputation-document-footnote">
            EARNED THROUGH WORK · PORTABLE ACROSS PRODUCTS · VERIFIABLE BY ANYONE ·
            OWNED BY YOUR WALLET
          </p>
        </div>
      </div>
    </section>
  )
}
