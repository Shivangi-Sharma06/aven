"use client";

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './landing.css';
import { gsap, useGSAP } from '../lib/gsap';

import AvenNavigation from '../components/navigation/AvenNavigation';
import SmoothScroll from '../components/SmoothScroll';
import AvenHero from '../components/hero/AvenHero';
import HowItWorks from '../components/sections/HowItWorks';
import LiveStreamDemo from '../components/sections/LiveStreamDemo';
import WorkAttestations from '../components/sections/WorkAttestations';
import Reputation from '../components/sections/Reputation';
import Protocol from '../components/sections/Protocol';
import Developers from '../components/sections/Developers';
import AIAgents from '../components/sections/AIAgents';
import FinalCTA from '../components/sections/FinalCTA';
import AvenFooter from '../components/sections/AvenFooter';
import InfinitePageLoop from '../components/sections/InfinitePageLoop';

export default function LandingPage() {
  const appRef = useRef<HTMLDivElement>(null);
  const [smoothScrollReady, setSmoothScrollReady] = useState(false);
  const handleSmoothScrollReady = useCallback(() => setSmoothScrollReady(true), []);

  useGSAP(
    () => {
      if (!smoothScrollReady) return;

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
    { scope: appRef, dependencies: [smoothScrollReady], revertOnUpdate: true }
  );

  return (
    <div ref={appRef} className="app">
      <AvenNavigation />
      <SmoothScroll onReady={handleSmoothScrollReady}>
        <InfinitePageLoop
          enabled={smoothScrollReady}
          panels={[
            { id: 'hero', content: <AvenHero /> },
            { id: 'how', content: <HowItWorks />, dense: true },
            { id: 'stream', content: <LiveStreamDemo /> },
            { id: 'attestations', content: <WorkAttestations />, dense: true },
            { id: 'reputation', content: <Reputation />, dense: true },
            { id: 'protocol', content: <Protocol />, dense: true },
            { id: 'developers', content: <Developers />, dense: true },
            { id: 'agents', content: <AIAgents /> },
            {
              id: 'cta',
              content: (
                <>
                  <FinalCTA />
                  <AvenFooter />
                </>
              ),
            },
          ]}
        />
      </SmoothScroll>
    </div>
  );
}
