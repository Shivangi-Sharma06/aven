export default function LiveStreamCounter({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'live-counter live-counter--compact' : 'live-counter'}>
      <span>SESSION VERIFIED</span>
      <strong>$ 36.784260</strong>
      <small>15,896 ACTIVE SECONDS × $0.002314</small>
    </div>
  )
}
