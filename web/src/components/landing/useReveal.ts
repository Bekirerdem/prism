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
        //
        // Lenis MUST be driven from GSAP's ticker, not from its own requestAnimationFrame.
        // With two independent rAF loops, Lenis writes a new scroll position in one callback
        // and GSAP renders the scrubbed tweens in another — the pinned section and the scrubbed
        // clip-paths end up a frame apart from the scroll position, which is felt as shudder
        // even though no frame is actually dropped. `lagSmoothing(0)` stops GSAP from silently
        // skipping time after a stall, which would desync the two again.
        const Lenis = lenisMod.default;
        const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        const onScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onScroll);

        const drive = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(drive);
        gsap.ticker.lagSmoothing(0);

        // Line wrappers built for `text-15` have to be unwound by hand on teardown —
        // `ctx.revert()` only knows about tweens, not about DOM this effect inserted.
        const splits: { revert: () => void }[] = [];
        // Same for the slideshow's click handlers.
        let slideCleanup = () => {};

        const ctx = gsap.context(() => {
          // ---- hero (hero-1) -------------------------------------------------
          // The reference plays a loading scene first: the brand name assembles letter by
          // letter, a box grows out of its middle, the artwork inside that box expands until
          // it fills the viewport, and only then do the header letters and nav rise.
          const loadChars = gsap.utils.toArray<HTMLElement>(".lp__hero .lp__load-char");
          const chars = gsap.utils.toArray<HTMLElement>(".lp__hero h1 .lp__char");
          const markChars = gsap.utils.toArray<HTMLElement>(".lp__hero h1 .lp__mark .lp__char");
          const leadChars = chars.filter((c) => !markChars.includes(c));
          const navLinks = gsap.utils.toArray<HTMLElement>(
            ".lp__hero .lp__nav-link, .lp__hero .lp__nav-chip",
          );
          const rises = gsap.utils.toArray<HTMLElement>(".lp__hero .lp__rise");

          // Put the seam where the name actually splits. "Eu" and "nomia" are not the same
          // width, so a 50/50 curtain would hang the word off to one side.
          const curtain = document.querySelector<HTMLElement>(".lp__curtain");
          const half1 = document.querySelector<HTMLElement>(".lp__brand-start");
          const half2 = document.querySelector<HTMLElement>(".lp__brand-end");
          if (curtain && half1 && half2) {
            const w1 = half1.getBoundingClientRect().width;
            const w2 = half2.getBoundingClientRect().width;
            curtain.style.setProperty(
              "--seam",
              `${(window.innerWidth - (w1 + w2)) / 2 + w1}px`,
            );
          }

          const tl = gsap.timeline({
            defaults: { ease: "expo.inOut" },
            onComplete: settle,
          });

          // 1 — the name assembles at the seam.
          if (loadChars.length) {
            tl.from(loadChars, { yPercent: 100, stagger: 0.025, duration: 1.25 }, 0);
          }

          // 2 — a sliver opens between the two halves (reference: the box at `1em`), enough to
          //     show that there is something behind the curtain.
          tl.fromTo(
            ".lp__curtain",
            { "--gap": "0px" },
            { "--gap": "120px", duration: 1.25 },
            ">",
          );

          // 3 — then it opens all the way past the viewport, carrying both halves of the name
          //     off screen with it (reference: the box growing to 110vw). By the end the green
          //     owns the screen.
          tl.to(
            ".lp__curtain",
            { "--gap": `${Math.ceil(window.innerWidth * 1.1)}px`, duration: 2 },
            "<1.25",
          );

          // 3b — and then the green lifts away to hand the screen to the hero. This is the
          //      only part that is not in the reference: there the grown panel is a photograph
          //      and it stays. Ours has nothing to say once it has filled the frame.
          tl.to(
            ".lp__curtain-fill",
            { yPercent: -100, duration: 1.15, ease: "expo.inOut" },
            "<1.35",
          );

          // 4 — the headline is NOT animated in. The curtain is what reveals it: the words are
          //     already standing behind the panels, so parting them uncovers a finished hero
          //     rather than an empty stage that then fills itself. Animating both reads as the
          //     page being built twice.

          // 5 — the nav follows the curtain, on a slower stagger like the reference's links.
          if (navLinks.length) {
            tl.from(
              navLinks,
              { yPercent: 110, duration: 1.25, ease: "expo.out", stagger: 0.1 },
              "<",
            );
          }

          // The heading's two halves separate as they land, mirroring step 3.
          if (leadChars.length) {
            tl.fromTo(leadChars, { x: "0em" }, { x: "-0.05em", duration: 1.25 }, "<");
          }
          if (markChars.length) {
            tl.fromTo(markChars, { x: "0em" }, { x: "0.05em", duration: 1.25 }, "<");
          }

          // The highlight wipes in while the phrase is already standing.
          tl.from(
            ".lp__hero .lp__mark-fill",
            { scaleX: 0, duration: 0.9, ease: "power3.inOut" },
            "<0.55",
          );

          tl.from(".lp__hero .lp__rule", { width: 0, duration: 0.9 }, "<0.1");
          tl.from(".lp__hero .lp__counter-rule", { scaleX: 0, duration: 1.1 }, "<0.15");

          // Supporting blocks lift last, on expo.out like the reference's credits line.
          if (rises.length) {
            tl.from(
              rises,
              { yPercent: 110, duration: 1.25, ease: "expo.out", stagger: 0.1 },
              "<0.1",
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

          // ---- the proof reveal (scroll-29) -----------------------------------
          // The reference pins a column and wipes each image away with
          // `clipPath: inset(0) → inset(0 0 100%)` on scrub, tinting the page as it goes.
          // Here the cards are pinned and wiped *open* the same way, and the refusal lands
          // last — the beat the section exists for.
          const proof = document.querySelector<HTMLElement>(".lp__proof");
          if (proof) {
            const cards = gsap.utils.toArray<HTMLElement>(".lp__proof .lp__card");
            const ordered = [...cards].sort(
              (a, b) =>
                Number(a.classList.contains("lp__card--blocked")) -
                Number(b.classList.contains("lp__card--blocked")),
            );

            gsap.set(cards, { clipPath: "inset(0 0 100% 0)" });
            const jail = proof.querySelector<HTMLElement>(".lp__jail");
            if (jail) gsap.set(jail, { clipPath: "inset(0 0 100% 0)", opacity: 0 });

            // The pin is a desktop affordance and does not survive the trip to a phone. Pinned,
            // this section holds still for three screen-heights while the cards clip open one
            // at a time — and a card that has not opened yet still occupies its slot, so what
            // you scroll past is a column of empty rectangles. Choreography on a large screen,
            // dead space on a small one.
            //
            // Narrow screens keep the same mechanic (each card wipes open) but drop the scrub:
            // a card opens when it arrives, on its own trigger, and is finished by the time you
            // have read it. Nothing waits on the scroll position of the section as a whole.
            //
            // Read once rather than through gsap.matchMedia: the timeline is rebuilt on remount
            // and a phone does not change width mid-visit.
            const canPin = window.matchMedia("(min-width: 1024px)").matches;

            if (canPin) {
              const proofTl = gsap.timeline({
                scrollTrigger: {
                  trigger: proof,
                  start: "top top",
                  // Longer now that the jailbreak block reveals inside the same pin.
                  end: `+=${Math.round(window.innerHeight * 2)}`,
                  pin: true,
                  scrub: true,
                  invalidateOnRefresh: true,
                },
              });

              proofTl.to(".lp__proof .lp__sheet", { opacity: 1, ease: "none", duration: 3 }, 0);
              ordered.forEach((card, i) => {
                const blocked = card.classList.contains("lp__card--blocked");
                proofTl.to(
                  card,
                  { clipPath: "inset(0 0 0% 0)", ease: "none", duration: 1 },
                  i * 0.85 + (blocked ? 0.45 : 0),
                );
              });

              // The jailbreak account is the payoff of this section, so it cannot already be
              // sitting there while the cards are still arriving. It joins the same scrub, last.
              if (jail) {
                proofTl.to(
                  jail,
                  { clipPath: "inset(0 0 0% 0)", opacity: 1, ease: "none", duration: 1.2 },
                  2.9,
                );
              }
            } else {
              gsap.set(".lp__proof .lp__sheet", { opacity: 1 });
              const openOnArrival = (el: HTMLElement, delay = 0) =>
                gsap.to(el, {
                  clipPath: "inset(0 0 0% 0)",
                  opacity: 1,
                  duration: 0.5,
                  delay,
                  ease: "power3.out",
                  scrollTrigger: { trigger: el, start: "top 88%", once: true },
                });

              ordered.forEach((card, i) => openOnArrival(card, i * 0.06));
              if (jail) openOnArrival(jail);
            }
          }

          // ---- privacy cards: the same reveal, without a pin ------------------
          // Same mechanic as the proof grid so the two sections read as one language. No pin
          // here — two pinned sections back to back would stretch the page out of proportion.
          const privacy = document.querySelector<HTMLElement>(".lp__privacy");
          if (privacy) {
            const cards = gsap.utils.toArray<HTMLElement>(".lp__privacy .lp__card");
            gsap.set(cards, { clipPath: "inset(0 0 100% 0)" });

            const privacyTl = gsap.timeline({
              scrollTrigger: {
                trigger: privacy,
                start: "top 78%",
                end: "bottom 78%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            });
            cards.forEach((card, i) => {
              privacyTl.to(
                card,
                { clipPath: "inset(0 0 0% 0)", ease: "none", duration: 1 },
                i * 0.75,
              );
            });
          }

          // ---- how it works (scroll-61) ---------------------------------------
          // Two mechanics from the reference: copy that fills in on scrub behind a clip, and
          // rows that travel in from alternating sides as the block is scrolled into.
          gsap.utils.toArray<HTMLElement>(".lp__fill-text").forEach((el) => {
            el.setAttribute("data-text", (el.textContent ?? "").trim());
            ScrollTrigger.create({
              trigger: el,
              start: "top 78%",
              end: "bottom 55%",
              scrub: 1,
              onUpdate: (self) => {
                el.style.setProperty(
                  "--clip-value",
                  `${Math.max(0, 100 - self.progress * 100)}%`,
                );
              },
            });
          });

          // The pinned scene, straight from the reference: the lines travel in from alternating
          // sides on the approach, then the pin holds while they split vertically and scale
          // down together.
          const scene = document.querySelector<HTMLElement>(".lp__scene");
          const lines = gsap.utils.toArray<HTMLElement>(".lp__scene-line");
          if (scene && lines.length === 3) {
            ScrollTrigger.create({
              trigger: scene,
              start: "top bottom",
              end: "top top",
              scrub: 1,
              onUpdate: (self) => {
                gsap.set(lines[0], { x: `${100 - self.progress * 100}%` });
                gsap.set(lines[1], { x: `${-100 + self.progress * 100}%` });
                gsap.set(lines[2], { x: `${100 - self.progress * 100}%` });
              },
            });

            // Two viewports of travel is a large-screen luxury. On a phone the second half of
            // that — where the lines have already merged and only shrink — is a long stretch of
            // scrolling with nothing new happening, and the scene has already made its point.
            const sceneTravel = window.innerWidth <= 720 ? 1.15 : 2;

            ScrollTrigger.create({
              trigger: scene,
              start: "top top",
              end: `+=${Math.round(window.innerHeight * sceneTravel)}`,
              pin: true,
              scrub: 1,
              pinSpacing: false,
              invalidateOnRefresh: true,
              // `pinSpacing: false` releases the element back into the flow when the pin ends,
              // and the lines — still transformed — end up sitting on top of the copy block
              // that follows. The scene has said what it has to say by then, so it leaves.
              onLeave: () => gsap.to(scene, { autoAlpha: 0, duration: 0.25, overwrite: true }),
              onEnterBack: () => gsap.to(scene, { autoAlpha: 1, duration: 0.25, overwrite: true }),
              onUpdate: (self) => {
                if (self.progress <= 0.5) {
                  const y = self.progress / 0.5;
                  gsap.set(lines[0], { y: `${y * 100}%` });
                  gsap.set(lines[2], { y: `${y * -100}%` });
                  gsap.set(lines, { scale: 1 });
                } else {
                  gsap.set(lines[0], { y: "100%" });
                  gsap.set(lines[2], { y: "-100%" });
                  const t = (self.progress - 0.5) / 0.5;
                  // The reference bottoms out at 0.1 because its lines are display type that is
                  // *meant* to dissolve into texture. These are the product's three steps and
                  // have to stay readable when the scene settles, so the floor is much higher.
                  const minScale = window.innerWidth <= 1000 ? 0.78 : 0.7;
                  gsap.set(lines, { scale: 1 - t * (1 - minScale) });
                }
              },
            });
          }

          // ---- the guarantees slideshow (sliders-13) — RETIRED ----------------
          // The carousel showed one guarantee at a time, but the section's argument is that the
          // four caps are cumulative. Showing them one by one contradicted the point being
          // made, so the four are laid out together and this mechanic was dropped on purpose.
          // Kept behind a selector that no longer exists rather than deleted outright, so the
          // reason survives in the file rather than only in the commit message.
          const slidesRoot = document.querySelector<HTMLElement>("[data-slides]");
          if (slidesRoot) {
            // Switches the stacked list into a carousel. Until this lands the section is a
            // plain list, so every guarantee stays reachable without JS.
            root?.classList.add("lp--slides-live");
            const slides = gsap.utils.toArray<HTMLElement>(".lp__slide", slidesRoot);
            const shapeOf = (s: HTMLElement) => s.querySelector(".lp__slide-shape");
            const bodyOf = (s: HTMLElement) =>
              s.querySelectorAll(".lp__slide-n, .lp__slide-t, .lp__slide-d");

            // The reference's clip shapes, kept as a config object like the original.
            // Centred rather than the reference's `at 70%`: this panel is wide and short, so an
            // off-centre circle gets sliced flat on one side only and reads as a mistake.
            const CLIP = {
              initial: "circle(62% at 50% 50%)",
              final: "circle(9% at 50% 50%)",
            };

            let current = 0;
            let animating = false;

            gsap.set(slides, { opacity: 0 });
            gsap.set(slides[0], { opacity: 1 });
            gsap.set(shapeOf(slides[0]), { clipPath: CLIP.initial });

            const count = slidesRoot.parentElement?.querySelector("[data-slide-count]");
            const paint = () => {
              if (count) count.textContent = `0${current + 1} / 0${slides.length}`;
              slides.forEach((s, i) => {
                s.classList.toggle("lp__slide--current", i === current);
                if (i === current) s.removeAttribute("aria-hidden");
                else s.setAttribute("aria-hidden", "true");
              });
            };

            const navigate = (dir: "next" | "prev") => {
              if (animating) return;
              animating = true;

              const from = slides[current];
              current =
                dir === "next"
                  ? (current + 1) % slides.length
                  : (current - 1 + slides.length) % slides.length;
              const to = slides[current];
              const out = dir === "next" ? "-100%" : "100%";
              const inFrom = dir === "next" ? "100%" : "-100%";

              gsap
                .timeline({
                  onStart: paint,
                  onComplete: () => {
                    animating = false;
                  },
                })
                .addLabel("start", 0)
                .set(shapeOf(to), { y: inFrom, clipPath: CLIP.final }, "start")
                .set(to, { opacity: 1 }, "start")
                .set(bodyOf(to), { y: inFrom }, "start")
                // the outgoing shape contracts, then leaves
                .to(shapeOf(from), { duration: 1, ease: "power3", clipPath: CLIP.final }, "start")
                .to(bodyOf(from), { duration: 1, ease: "power3", y: out }, "start")
                .to(
                  shapeOf(from),
                  { duration: 1, ease: "power2.inOut", y: out },
                  "start+=0.6",
                )
                .set(from, { opacity: 0 }, "start+=1.55")
                // the incoming one arrives and opens back up
                .to(shapeOf(to), { duration: 1, ease: "power2.inOut", y: "0%" }, "start+=0.6")
                .to(
                  shapeOf(to),
                  { duration: 1.5, ease: "expo.inOut", clipPath: CLIP.initial },
                  "start+=1.2",
                )
                .to(
                  bodyOf(to),
                  { duration: 1.5, ease: "expo.inOut", y: "0%", stagger: 0.1 },
                  "start+=1.1",
                );
            };

            const onNext = () => navigate("next");
            const onPrev = () => navigate("prev");
            const nextBtn = document.querySelector("[data-slide-next]");
            const prevBtn = document.querySelector("[data-slide-prev]");
            nextBtn?.addEventListener("click", onNext);
            prevBtn?.addEventListener("click", onPrev);
            paint();

            slideCleanup = () => {
              nextBtn?.removeEventListener("click", onNext);
              prevBtn?.removeEventListener("click", onPrev);
              root?.classList.remove("lp--slides-live");
            };
          }

          // ---- guarantees: the page's own language, not a new one -------------
          // These four were static while every section around them moved, so the page felt
          // like it stopped here. Rather than importing a sixth mechanic, the reveal already
          // used by the proof and privacy cards is extended to them — same `inset` wipe, same
          // scrub — and the closing statement lands last, the way the jailbreak block does.
          const guards = gsap.utils.toArray<HTMLElement>(".lp__guard");
          const guardKey = document.querySelector<HTMLElement>(".lp__guard-key");
          if (guards.length) {
            gsap.set(guards, { clipPath: "inset(0 0 100% 0)" });
            if (guardKey) gsap.set(guardKey, { clipPath: "inset(0 0 100% 0)" });

            const guardTl = gsap.timeline({
              scrollTrigger: {
                trigger: guards[0].parentElement ?? guards[0],
                start: "top 82%",
                end: "bottom 62%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            });
            guards.forEach((g, i) => {
              guardTl.to(g, { clipPath: "inset(0 0 0% 0)", ease: "none", duration: 1 }, i * 0.6);
            });
            if (guardKey) {
              guardTl.to(
                guardKey,
                { clipPath: "inset(0 0 0% 0)", ease: "none", duration: 1.1 },
                guards.length * 0.6 + 0.2,
              );
            }
          }

          // ---- how it works: the two parts of each row arrive apart ------------
          // The number leads and the sentence follows a beat behind, so a row reads as one
          // gesture rather than a block appearing. Same expo.out the hero closes on.
          gsap.utils.toArray<HTMLElement>(".lp__step").forEach((step) => {
            const rule = step.querySelector(".lp__step-rule");
            const num = step.querySelector(".lp__step-n");
            const body = step.querySelector(".lp__step-b");
            if (!num || !body) return;

            const stepTl = gsap.timeline({
              scrollTrigger: { trigger: step, start: "top 88%", once: true },
            });
            // The rule draws first — same move as the hero's counter rule.
            if (rule) {
              stepTl.from(rule, { scaleX: 0, duration: 0.9, ease: "expo.inOut" });
            }
            // Then the number rides up out of its box, like the hero's letters.
            stepTl.from(
              num,
              { yPercent: 110, duration: 1.05, ease: "expo.out" },
              rule ? "<0.15" : 0,
            );
            // The sentence follows a beat later.
            stepTl.from(
              body,
              { yPercent: 20, opacity: 0, duration: 0.95, ease: "expo.out" },
              "<0.16",
            );
          });

          // Remaining card rows keep a quiet entrance; proof and privacy drive their own.
          gsap.utils.toArray<HTMLElement>(".lp__cards").forEach((row) => {
            if (row.closest(".lp__proof") || row.closest(".lp__privacy")) return;
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

        // Trigger positions were measured against a layout that has since moved: two pinned
        // sections and a `155svh` clearance push everything below them down, and the webfonts
        // resize the headings again when they land. Without a recalculation the triggers below
        // the pins fire against stale coordinates — the step rows were counting themselves as
        // already passed and skipping their entrance entirely.
        ScrollTrigger.refresh();
        void document.fonts?.ready.then(() => {
          if (!disposed) ScrollTrigger.refresh();
        });

        dispose = () => {
          gsap.ticker.remove(drive);
          gsap.ticker.lagSmoothing(500, 33);
          slideCleanup();
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
