import { useRouter } from 'next/navigation'
import { ScrollSmoother } from '../../lib/gsap'

const navItems = [
  ['HOW IT WORKS', 'how-it-works'],
  ['PROTOCOL', 'protocol'],
  ['DEVELOPERS', 'developers'],
]



function scrollToTarget(id: string) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}

export default function AvenNavigation() {
  const router = useRouter()

  return (
    <nav className="aven-nav" aria-label="Primary navigation">
      <button className="aven-nav__brand" onClick={() => scrollToTarget('hero')}>
        AVEN
      </button>
      <div className="aven-nav__links">
        {navItems.map(([label, id]) => (
          <button key={id} onClick={() => scrollToTarget(id)}>
            {label}
          </button>
        ))}
        <a
          className="aven-nav__docs"
          href="https://heyaven09.mintlify.site/"
          target="_blank"
          rel="noopener noreferrer"
        >
          DOCS ↗
        </a>
      </div>
      <button className="aven-nav__launch" onClick={() => router.push('/dashboard')}>
        LAUNCH APP ↗
      </button>
    </nav>
  )
}
