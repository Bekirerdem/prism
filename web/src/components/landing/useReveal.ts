import { useEffect } from "react";

/** Motion for the landing page, carried over from the animmaster references.
 *
 *  An earlier version of this file claimed to adapt those components but shipped three
 *  variations of a fade instead. What follows tracks the actual reference source
 *  (`animmaster-lib/<category>/<n>/code.zip`) mechanic by mechanic:
 *
 *   - hero     → `hero-1`: the box opens, letters ride up staggered on expo.inOut, the two
 *                halves of the heading pull apart by ∓0.05em, the rule draws open, and the
 *                supporting blocks lift on expo.out. Letters, not words — the reference
 *                staggers `.willem__letter` at 0.025 and word-level staggering reads as a
 *                different animation.
 *   - headings → `text-15`: a coloured panel wipes across each line (scaleX 0→1 from the left),
 *                the line is revealed behind it, then the panel wipes off to the right.
 *
 *  `scroll-29`, `scroll-61` and `sliders-13` are the next wave; until they land, the cards and
 *  the remaining blocks keep a quiet entrance rather than pretending to be those components.
 *
 *  GSAP and Lenis are imported dynamically so they never reach the dashboard bundle.
 *  `.lp--pending` is what hides elements; anything that decides not to animate must remove it
 *  or the page stays blank. */
export function useReveal(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.querySelector<HTMLElement>(".lp");
    /** Release the pre-paint hiding. `motion-done` also unclips the rise boxes. */
    const reveal = () => root?.classList.remove("lp--pending");
    const settle = () => root?.classList.add("lp--motion-done");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      settle();
      return;
    }

    let disposed = false;
    let dispose = () => {};

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { SplitText }, lenisMod] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("gsap/SplitText"),
          import("lenis"),
        ]);
        // Under StrictMode the first effect is torn down before its imports land. Reveal so the
        // page is never left hidden, but do not `settle()` — that would unclip the rise boxes
        // while the second run still has its blocks parked at yPercent 110, and they would
        // spill out of their masks.
        if (disposed) {
          reveal();
          return;
        }

        gsap.registerPlugin(ScrollTrigger, SplitText);

        // Lenis drives the scroll; ScrollTrigger has to read from it rather than the native
        // scroll position, otherwise triggers fire at the wrong place under smoothing.
        const Lenis = lenisMod.default;
        const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        const onScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onScroll);

        let frame = 0;
        const raf = (time: number) => {
          lenis.raf(time);
          frame = requestAnimationFrame(raf);
        };
        frame = requestAnimationFrame(raf);

        // Line wrappers built for `text-15` have to be unwound by hand on teardown —
        // `ctx.revert()` only knows about tweens, not about DOM this effect inserted.
        const splits: { revert: () => void }[] = [];

        const ctx = gsap.context(() => {
          // ---- hero (hero-1) -------------------------------------------------
          const chars = gsap.utils.toArray<HTMLElement>(".lp__hero h1 .lp__char");
          const markChars = gsap.utils.toArray<HTMLElement>(".lp__hero h1 .lp__mark .lp__char");
          const leadChars = chars.filter((c) => !markChars.includes(c));
          const rises = gsap.utils.toArray<HTMLElement>(".lp__hero .lp__rise");

          const tl = gsap.timeline({
            defaults: { ease: "expo.inOut" },
            onComplete: settle,
          });

          // The box opens first (reference: `width: 0em → 1em`).
          tl.fromTo(".lp__hero .lp__rule", { width: 0 }, { width: 64, duration: 1.25 }, 0);

          // Letters ride up out of their word boxes.
          if (chars.length) {
            tl.from(chars, { yPercent: 110, stagger: 0.025, duration: 1.25 }, 0);
          }

          // …and the two halves of the heading separate as they land.
          if (leadChars.length) {
            tl.fromTo(leadChars, { x: "0em" }, { x: "-0.05em", duration: 1.25 }, 0);
          }
          if (markChars.length) {
            tl.fromTo(markChars, { x: "0em" }, { x: "0.05em", duration: 1.25 }, 0);
          }

          // The highlight wipes in while the phrase is already standing.
          tl.from(
            ".lp__hero .lp__mark-fill",
            { scaleX: 0, duration: 0.9, ease: "power3.inOut" },
            0.6,
          );

          // The rule widens out (reference: the box grows to `110vw`).
          tl.from(".lp__hero .lp__counter-rule", { scaleX: 0, duration: 1.1 }, 0.75);

          // Supporting blocks lift last, on expo.out like the reference's header letters.
          if (rises.length) {
            tl.from(
              rises,
              { yPercent: 110, duration: 1.25, ease: "expo.out", stagger: 0.1 },
              0.9,
            );
          }

          // ---- section headings (text-15 block revealer) ----------------------
          gsap.utils.toArray<HTMLElement>(".lp__reveal--head").forEach((el) => {
            const split = SplitText.create(el, {
              type: "lines",
              linesClass: "lp__line",
              lineThreshold: 0.1,
            });
            splits.push(split);

            const blocks: HTMLElement[] = [];
            split.lines.forEach((line) => {
              const wrap = document.createElement("span");
              wrap.className = "lp__line-wrap";
              line.parentNode?.insertBefore(wrap, line);
              wrap.appendChild(line);

              const block = document.createElement("i");
              block.className = "lp__revealer";
              wrap.appendChild(block);
              blocks.push(block);
            });

            gsap.set(split.lines, { opacity: 0 });
            gsap.set(blocks, { scaleX: 0, transformOrigin: "left center" });

            blocks.forEach((block, i) => {
              const lineTl = gsap.timeline({ paused: true, delay: i * 0.15 });
              lineTl.to(block, { scaleX: 1, duration: 0.75, ease: "power4.inOut" });
              lineTl.set(split.lines[i], { opacity: 1 });
              lineTl.set(block, { transformOrigin: "right center" });
              lineTl.to(block, { scaleX: 0, duration: 0.75, ease: "power4.inOut" });

              ScrollTrigger.create({
                trigger: el,
                start: "top 90%",
                once: true,
                onEnter: () => lineTl.play(),
              });
            });
          });

          // ---- cards and the rest (placeholder until wave 2) -------------------
          // Deliberately plain. `scroll-29` and `sliders-13` need the real pin/scrub and
          // clip-path work; calling this an adaptation of them is what went wrong before.
          gsap.utils.toArray<HTMLElement>(".lp__cards").forEach((row) => {
            gsap.from(row.querySelectorAll(".lp__card"), {
              opacity: 0,
              y: 26,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.12,
              scrollTrigger: { trigger: row, start: "top 86%", once: true },
            });
          });

          gsap.utils.toArray<HTMLElement>(".lp__reveal").forEach((el) => {
            gsap.from(el, {
              opacity: 0,
              y: 18,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            });
          });
        }, root ?? undefined);

        // GSAP has captured the hero's start state by now, so dropping the class cannot flash.
        reveal();

        dispose = () => {
          cancelAnimationFrame(frame);
          ctx.revert();
          splits.forEach((s) => s.revert());
          // SplitText.revert() restores the original text but leaves our wrappers behind.
          root?.querySelectorAll(".lp__line-wrap").forEach((wrap) => {
            if (wrap.parentNode && wrap.firstChild) {
              wrap.parentNode.insertBefore(wrap.firstChild, wrap);
            }
            wrap.remove();
          });
          lenis.off("scroll", onScroll);
          lenis.destroy();
        };
      } catch {
        // Motion is an enhancement; without it the page must still be readable.
        reveal();
        settle();
      }
    })();

    return () => {
      disposed = true;
      dispose();
    };
  }, []);
}
