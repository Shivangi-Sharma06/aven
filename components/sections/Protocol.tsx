import React from 'react'

export default function Protocol() {
  return (
    <section className="aven-section protocol-section" id="protocol">
      <div className="section-kicker">05 / THE PROTOCOL</div>
      <div className="section-layout">
        <div>
          <h2>
            Trust built directly
            <br />
            into the code.
          </h2>
        </div>
        <div className="section-visual protocol-stack">
          <article>
            <span>1. THE PAYMENT STREAM</span>
            <p>
              Safely locks client deposits on-chain. Vests linearly per second, and dynamically 
              calculates withdrawable balances while protecting the budget from premature withdrawals.
            </p>
            <code>earned = (current_time - start_time) × rate_per_second</code>
          </article>
          <article>
            <span>2. THE ATTESTATION REGISTRY</span>
            <p>
              Mints permanent on-chain records of finished milestones. Ensures that payments 
              and credits are linked atomically—no payment happens without a corresponding attestation.
            </p>
            <code>client · worker · amount · period · category · confirmation</code>
          </article>
          <article>
            <span>3. THE REPUTATION ENGINE</span>
            <p>
              Aggregates on-chain attestations to compute a transparent, public reputation score for 
              your wallet. No opaque algorithms, no fake reviews, just verifiable history.
            </p>
            <code>NO REVIEWS · NO HIDDEN RANKINGS · JUST VERIFIED WORK</code>
          </article>
        </div>
      </div>
    </section>
  )
}
