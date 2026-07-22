import LiveStreamCounter from '../hero/LiveStreamCounter'

export default function LiveStreamDemo() {
  return (
    <section className="aven-section stream-section" id="stream">
      <div className="section-kicker">02 / STREAM</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>PAYMENT FOR TIME ACTUALLY WORKED.</h2>
          <p className="section-copy">
            The Aven npm package measures active work time. The contract releases only
            that measured time at the agreed rate—never idle ledger time.
          </p>
        </div>
        <div className="section-visual stream-receipt">
          <div className="stream-receipt__header">
            <span>AVEN / LIVE PAYMENT RECEIPT</span>
            <strong>● VERIFIED</strong>
          </div>
          <div className="stream-receipt__project">
            <div>
              <span>FUNDED WORK</span>
              <strong>FRONTEND DEVELOPMENT</strong>
            </div>
            <div>
              <span>ROUTE</span>
              <strong>GBX...84A → GDK...21F</strong>
            </div>
          </div>
          <div className="stream-receipt__earnings">
            <LiveStreamCounter compact />
          </div>
          <div className="stream-receipt__metrics">
            <div>
              <span>ACTIVE TIME</span>
              <strong>04H 22M</strong>
            </div>
            <div>
              <span>RATE</span>
              <strong>$0.002314/S</strong>
            </div>
            <div>
              <span>APPROVED</span>
              <strong>$1,248.38</strong>
            </div>
          </div>
          <p className="stream-receipt__note">
            IDLE TIME EXCLUDED · ACTIVE WORK VERIFIED · RELEASE READY
          </p>
        </div>
      </div>
    </section>
  )
}
