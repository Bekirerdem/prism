import { useEffect } from "react";

/** Motion for the landing page, adapted from the animmaster components.
 *
 *  Three distinct behaviours, not one generic fade:
 *   - hero      → `hero-1`: masked words ride up staggered on expo.inOut, then the highlight
 *                 wipes left-to-right, then the supporting elements follow.
 *   - headings  → `text-15`: the line opens from below behind a clip, word by word.
 *   - cards     → `scroll-29`: staggered entrance on scroll, the blocked card landing last.
 *
 *  GSAP and Lenis are imported dynamically so they never reach the dashboard bundle.
 *  `.lp--pending` is what hides elements; anything that decides not to animate must remove it
 *  or the page stays blank. */
export function useReveal(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.querySelector<HTMLElement>(".lp");
    const reveal = () => root?.classList.remove("lp--pending");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    let disposed = false;
    let dispose = () => {};

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, lenisMod] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
        if (disposed) {
          reveal();
          return;
        }

        gsap.registerPlugin(ScrollTrigger);

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

        const ctx = gsap.context(() => {
          // ---- hero (hero-1) -------------------------------------------------
          const heroWords = gsap.utils.toArray<HTMLElement>(".lp__hero .lp__word");
          const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });

          if (heroWords.length) {
            tl.from(heroWords, { yPercent: 110, stagger: 0.045, duration: 1.15 });
          }
          // The highlight wipes in while the word is already standing.
          tl.from(
            ".lp__hero .lp__mark-fill",
            { scaleX: 0, duration: 0.9, ease: "power3.inOut" },
            "<0.55",
          );
          tl.from(
            [".lp__hero .lp__lede", ".lp__hero .lp__actions", ".lp__hero .lp__counter"],
            { opacity: 0, y: 16, duration: 0.75, stagger: 0.09, ease: "power2.out" },
            "<0.2",
          );

          // ---- section headings (text-15) ------------------------------------
          gsap.utils.toArray<HTMLElement>(".lp__reveal--head").forEach((el) => {
            gsap.from(el, {
              yPercent: 24,
              opacity: 0,
              duration: 0.95,
              ease: "expo.out",
              clipPath: "inset(100% 0% 0% 0%)",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            });
          });

          // ---- cards and the rest (scroll-29) --------------------------------
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

          // Everything else: a quieter version of the same entrance. `from` so the elements
          // stay visible in CSS and a missing library costs nothing.
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
          lenis.off("scroll", onScroll);
          lenis.destroy();
        };
      } catch {
        // Motion is an enhancement; without it the page must still be readable.
        reveal();
      }
    })();

    return () => {
      disposed = true;
      dispose();
    };
  }, []);
}
