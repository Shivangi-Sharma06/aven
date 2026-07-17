"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

export type InfinitePagePanel = {
  id: string;
  content: ReactNode;
  dense?: boolean;
};

type InfinitePageLoopProps = { panels: InfinitePagePanel[] };

export default function InfinitePageLoop({ panels }: InfinitePageLoopProps) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const panelElements = gsap.utils.toArray<HTMLElement>(
          "[data-aven-layered-panel]",
          root
        );
        if (panelElements.length < 2) return;

        const triggers: ScrollTrigger[] = [];

        // Pin each panel so they stack on top of each other while scrolling
        // Skip the final panel — it flows naturally into the footer
        panelElements.forEach((panel, i) => {
          const isFinal = i === panelElements.length - 1;

          if (!isFinal) {
            triggers.push(
              ScrollTrigger.create({
                trigger: panel,
                start: "top top",
                pin: true,
                pinSpacing: false,
                anticipatePin: 1,
              })
            );
          }

          // Slide panels in from below with a scale + fade effect (except first)
          if (i > 0) {
            gsap.fromTo(
              panel,
              { opacity: 0, y: 60, scale: 0.97 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: panel,
                  start: "top 95%",
                  end: "top 30%",
                  scrub: 0.6,
                },
              }
            );
          }

          // Animate content cards/elements inside each panel with a stagger
          const cards = gsap.utils.toArray<HTMLElement>(
            ".step-panel, .attestation-card, .reputation-document-card, .protocol-stack article, .agent-rails > div, .developer-grid",
            panel
          );
          if (cards.length > 0) {
            gsap.fromTo(
              cards,
              { opacity: 0, y: 32 },
              {
                opacity: 1,
                y: 0,
                duration: 0.65,
                stagger: 0.1,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: panel,
                  start: "top 70%",
                  once: true,
                },
              }
            );
          }
        });

        const onResize = () => {
          ScrollTrigger.refresh();
        };

        window.addEventListener("resize", onResize);
        const frame = requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => {
          cancelAnimationFrame(frame);
          window.removeEventListener("resize", onResize);
          triggers.forEach((t) => t.kill());
        };
      });

      return () => media.revert();
    },
    { scope: rootRef }
  );

  return (
    <main ref={rootRef} className="aven-layered-loop">
      {panels.map((panel, index) => (
        <section
          className={[
            "aven-layered-panel",
            `aven-layered-panel--${panel.id}`,
            panel.dense ? "aven-layered-panel--dense" : "",
            index === panels.length - 1 ? "aven-layered-panel--final" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-aven-layered-panel
          data-panel-id={panel.id}
          data-theme={index % 2 === 0 ? "light" : "dark"}
          data-final-panel={index === panels.length - 1 ? "true" : undefined}
          key={panel.id}
        >
          {panel.content}
        </section>
      ))}
    </main>
  );
}
