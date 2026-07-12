"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from "@/lib/gsap";

export type InfinitePagePanel = {
  id: string;
  content: ReactNode;
  dense?: boolean;
};

type InfinitePageLoopProps = {
  enabled: boolean;
  panels: InfinitePagePanel[];
};

export default function InfinitePageLoop({ enabled, panels }: InfinitePageLoopProps) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !enabled) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const panelElements = gsap.utils.toArray<HTMLElement>("[data-loop-panel]", root);
        if (panelElements.length < 2) return;

        const pinTriggers = panelElements.map((panel, index) =>
          ScrollTrigger.create({
            id: `aven-page-panel-${index}`,
            trigger: panel,
            start: "top top",
            end: "bottom top",
            pin: true,
            pinSpacing: false,
            refreshPriority: index,
          })
        );

        let wrapping = false;
        let firstPanelStart = 0;
        let duplicateStart = 0;
        let forwardWrapPoint = 0;
        let resizeFrame = 0;
        let wrapFrame = 0;
        const smoother = ScrollSmoother.get();
        const duplicatePanel = panelElements[panelElements.length - 1];

        const getScroll = () => smoother?.scrollTop() ?? window.scrollY;
        const setScroll = (value: number) => {
          if (smoother) smoother.scrollTop(value);
          else window.scrollTo(0, value);
          ScrollTrigger.update();
        };

        const calculateBounds = () => {
          firstPanelStart = pinTriggers[0].start;
          const duplicateTrigger = pinTriggers[pinTriggers.length - 1];
          duplicateStart = duplicateTrigger.start;
          forwardWrapPoint = duplicateStart + duplicatePanel.offsetHeight * 0.85;
        };

        const wrapTo = (destination: number) => {
          if (wrapping) return;
          wrapping = true;
          setScroll(destination);
          cancelAnimationFrame(wrapFrame);
          wrapFrame = requestAnimationFrame(() => {
            wrapping = false;
          });
        };

        const onScroll = () => {
          if (wrapping || forwardWrapPoint <= duplicateStart) return;
          const boundaryScroll = Math.max(getScroll(), window.scrollY);
          if (boundaryScroll >= forwardWrapPoint) wrapTo(firstPanelStart + 2);
        };

        const onWheel = (event: WheelEvent) => {
          if (wrapping || duplicateStart <= 2) return;
          const scroll = getScroll();

          if (event.deltaY < 0 && scroll <= firstPanelStart + 1) {
            wrapTo(duplicateStart - 2);
          }
        };

        const onResize = () => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            calculateBounds();
          });
        };

        calculateBounds();
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("wheel", onWheel, { passive: true });

        const refreshFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          calculateBounds();
        });

        return () => {
          cancelAnimationFrame(refreshFrame);
          cancelAnimationFrame(resizeFrame);
          cancelAnimationFrame(wrapFrame);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("wheel", onWheel);
          pinTriggers.forEach((trigger) => trigger.kill());
        };
      });

      return () => media.revert();
    },
    { scope: rootRef, dependencies: [enabled], revertOnUpdate: true }
  );

  return (
    <main ref={rootRef} className="infinite-page-loop">
      {panels.map((panel, index) => (
        <section
          className={`loop-panel loop-panel--${panel.id}${panel.dense ? " loop-panel--dense" : ""}${index === panels.length - 1 ? " loop-panel--final" : ""}`}
          data-loop-panel
          data-panel-id={panel.id}
          data-theme={index % 2 === 0 ? "light" : "dark"}
          data-final-panel={index === panels.length - 1 ? "true" : undefined}
          key={panel.id}
        >
          {panel.content}
        </section>
      ))}

      <section
        className="loop-panel loop-panel--hero loop-panel--duplicate"
        data-loop-panel
        data-duplicate="true"
        data-theme="light"
        aria-hidden="true"
      >
        <div className="loop-hero-duplicate">
          <span>STREAMING VALUE · PROVING WORK</span>
          <strong>AVEN</strong>
          <p>THE ECONOMIC LAYER FOR VERIFIED WORK.</p>
        </div>
      </section>
      <div className="loop-wrap-runway" aria-hidden="true" />
    </main>
  );
}
