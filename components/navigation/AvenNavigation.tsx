'use client'

import { ArrowDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ScrollSmoother } from '../../lib/gsap'

const navItems = [
  ['HOW IT WORKS', 'how-it-works'],
  ['PROOF', 'proof'],
  ['PROTOCOL', 'protocol'],
  ['DEVELOPERS', 'developers'],
] as const

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
        <img src="/icon.png" alt="Aven logo" className="aven-nav__logo" />
        <span>AVEN</span>
      </button>

      <div className="aven-nav__links">
        {navItems.map(([label, id], index) => (
          <button className={index === 0 ? 'is-active' : undefined} key={id} onClick={() => scrollToTarget(id)}>
            {label}
          </button>
        ))}
      </div>

      <a href="https://aven-docs.mintlify.site/" target="_blank" rel="noopener noreferrer" className="aven-nav__launch">
        DOCS ↗
      </a>

      <button className="aven-nav__menu" aria-label="Go to start" onClick={() => scrollToTarget('start')}>
        <ArrowDown aria-hidden="true" size={18} strokeWidth={1.7} />
      </button>
    </nav>
  )
}
