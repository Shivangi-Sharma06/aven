import { useRef } from 'react'
import './index.css'
import './App.css'
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from './lib/gsap'
import AvenNavigation from './components/navigation/AvenNavigation'
import AvenHero from './components/hero/AvenHero'
import HowItWorks from './components/sections/HowItWorks'
import LiveStreamDemo from './components/sections/LiveStreamDemo'
import WorkAttestations from './components/sections/WorkAttestations'
import Reputation from './components/sections/Reputation'
import Protocol from './components/sections/Protocol'
import Developers from './components/sections/Developers'
import AIAgents from './components/sections/AIAgents'
import FinalCTA from './components/sections/FinalCTA'
import AvenFooter from './components/sections/AvenFooter'

function App() {
  const appRef = useRef(null)
  const smootherRef = useRef(null)
  useGSAP(
    () => {
      ScrollSmoother.get()?.kill()

      const smoother = ScrollSmoother.create({
        smooth: 1,
        effects: false,
      })

      smootherRef.current = smoother

      gsap.utils.toArray('.aven-section').forEach((section) => {
        const sectionHeader = section.querySelector('.section-kicker')
        const sectionVisual = section.querySelector('.section-visual')

        gsap.fromTo(
          [sectionHeader, sectionVisual].filter(Boolean),
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.12,
            scrollTrigger: {
              trigger: section,
              start: 'top 72%',
              once: true,
            },
          }
        )
      })

      gsap.utils.toArray('.aven-section [data-strengthen-path]').forEach((path) => {
        gsap.fromTo(
          path,
          { strokeDasharray: '0 18', opacity: 0.16 },
          {
            strokeDasharray: '9 10',
            opacity: 0.48,
            duration: 1.2,
            ease: 'power2.inOut',
            scrollTrigger: {
              trigger: path.closest('.aven-section'),
              start: 'top 58%',
              once: true,
            },
          }
        )
      })

      ScrollTrigger.refresh()

      return () => {
        smoother.kill()
        if (smootherRef.current === smoother) {
          smootherRef.current = null
        }
      }
    },
    { scope: appRef }
  )


  return (
    <div ref={appRef} className="app">
      <AvenNavigation />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <AvenHero />
            <HowItWorks />
            <LiveStreamDemo />
            <WorkAttestations />
            <Reputation />
            <Protocol />
            <Developers />
            <AIAgents />
            <FinalCTA />
          </main>
          <AvenFooter />
        </div>
      </div>
    </div>
  )
}

export default App
