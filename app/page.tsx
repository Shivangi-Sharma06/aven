"use client";

import { useRef } from 'react';
import './landing.css';
import { gsap, useGSAP } from '../lib/gsap';

import AvenNavigation from '../components/navigation/AvenNavigation';
import AvenHero from '../components/hero/AvenHero';
import HowItWorks from '../components/sections/HowItWorks';
import LiveStreamDemo from '../components/sections/LiveStreamDemo';
import Reputation from '../components/sections/Reputation';
import FinalCTA from '../components/sections/FinalCTA';
import AvenFooter from '../components/sections/AvenFooter';
import InfinitePageLoop from '../components/sections/InfinitePageLoop';

export default function LandingPage() {
  const appRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>('.aven-section').forEach((section) => {
        const sectionHeader = section.querySelector('.section-kicker');
        const sectionVisual = section.querySelector('.section-visual');

        gsap.fromTo(
          [sectionHeader, sectionVisual].filter(Boolean) as Element[],
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
        );
      });

      gsap.utils.toArray<HTMLElement>('.aven-section [data-strengthen-path]').forEach((path) => {
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
        );
      });

    },
    { scope: appRef }
  );

  return (
    <div ref={appRef} className="app">
      <AvenNavigation />
        <InfinitePageLoop
          panels={[
            {
              // Panel 1 — Hero
              id: 'hero',
              content: <AvenHero />,
            },
            {
              // Panel 2 — How It Works + Live Payment Demo
              id: 'how',
              content: (
                <>
                  <HowItWorks />
                  <LiveStreamDemo />
                </>
              ),
              dense: true,
            },
            {
              // Panel 3 — Reputation, CTA, and Footer
              id: 'reputation',
              content: (
                <>
                  <Reputation />
                  <FinalCTA />
                  <AvenFooter />
                </>
              ),
              dense: true,
            },
          ]}
        />
    </div>
  );
}
