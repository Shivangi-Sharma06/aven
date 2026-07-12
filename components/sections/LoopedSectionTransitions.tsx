"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

export type LoopedSection = {
  id: string;
  content: ReactNode;
  dense?: boolean;
};

export default function LoopedSectionTransitions({ sections }: { sections: LoopedSection[] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const elements = gsap.utils.toArray<HTMLElement>("[data-loop-section]", root);
        if (!elements.length) return;

        let currentSection = elements[0];

        const setAccessibility = (activeSection: HTMLElement) => {
          elements.forEach((section) => {
            const isActive = section === activeSection;
            section.classList.toggle("is-active", isActive);
            section.setAttribute("aria-hidden", String(!isActive));
            section.toggleAttribute("inert", !isActive);
          });
        };

        gsap.set(elements, { autoAlpha: 0, scale: 0.96, zIndex: 1 });
        gsap.set(currentSection, { autoAlpha: 1, scale: 1, zIndex: 2 });
        setAccessibility(currentSection);

        const setSection = (newSection: HTMLElement) => {
          if (newSection === currentSection) return;

          gsap.to(currentSection, {
            autoAlpha: 0,
            scale: 0.96,
            zIndex: 1,
            duration: 0.35,
            overwrite: "auto",
          });
          gsap.to(newSection, {
            autoAlpha: 1,
            scale: 1,
            zIndex: 2,
            duration: 0.35,
            overwrite: "auto",
          });

          currentSection = newSection;
          setAccessibility(currentSection);
        };

        const triggers = elements.map((section, index) =>
          ScrollTrigger.create({
            id: `aven-looped-section-${index}`,
            start: () => (index - 0.5) * window.innerHeight,
            end: () => (index + 0.5) * window.innerHeight,
            onToggle: (self) => {
              if (self.isActive) setSection(section);
            },
          })
        );

        const loopTrigger = ScrollTrigger.create({
          id: "aven-looped-section-wrap",
          start: 1,
          end: () => ScrollTrigger.maxScroll(window) - 1,
          onLeaveBack: (self) => self.scroll(ScrollTrigger.maxScroll(window) - 2),
          onLeave: (self) => self.scroll(2),
        });

        ScrollTrigger.refresh();
        loopTrigger.scroll(2);

        return () => {
          gsap.killTweensOf(elements);
          loopTrigger.kill();
          triggers.forEach((trigger) => trigger.kill());
          elements.forEach((section) => {
            section.classList.remove("is-active");
            section.removeAttribute("aria-hidden");
            section.removeAttribute("inert");
          });
        };
      });

      return () => media.revert();
    },
    { scope: rootRef }
  );

  return (
    <main ref={rootRef} className="looped-sections" aria-label="Aven looped sections">
      <div className="looped-sections__fixed">
        {sections.map((section, index) => (
          <article
            className={`looped-section looped-section--${section.id}${section.dense ? " looped-section--dense" : ""}${index === sections.length - 1 ? " looped-section--final" : ""}`}
            data-loop-section
            data-section-id={section.id}
            data-theme={index % 2 === 0 ? "light" : "dark"}
            key={section.id}
          >
            {section.content}
          </article>
        ))}
      </div>
      <div
        className="looped-sections__spacer"
        style={{ height: `${sections.length * 100}vh` }}
        aria-hidden="true"
      />
    </main>
  );
}
