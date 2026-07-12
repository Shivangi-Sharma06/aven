"use client";

import './landing.css';

import AvenNavigation from '../components/navigation/AvenNavigation';
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
import LoopedSectionTransitions from '../components/sections/LoopedSectionTransitions';

export default function LandingPage() {
  return (
    <div className="app">
      <AvenNavigation />
      <LoopedSectionTransitions
          sections={[
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
    </div>
  );
}
