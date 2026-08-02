import type { ReactNode } from "react";

/** Splits a line into masked words so they can rise from below, one after another.
 *
 *  This is the mechanic from the animmaster hero (`hero-1`): every word sits in an
 *  `overflow:hidden` box and starts at yPercent 110, then a staggered timeline lifts them into
 *  place. Splitting happens in markup rather than at runtime so the text stays selectable and
 *  readable to screen readers even if the animation never runs. */
export default function Words({
  text,
  mark,
  className = "",
}: {
  /** The line to animate. Split on spaces. */
  text: string;
  /** A word or phrase inside `text` that gets the green highlight wipe. */
  mark?: string;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  const marked = mark ? text.split(mark) : [text];

  const pushWords = (chunk: string, keyBase: string) => {
    chunk
      .split(" ")
      .filter(Boolean)
      .forEach((w, i) => {
        parts.push(
          <span className="lp__mask" key={`${keyBase}-${i}`}>
            <span className="lp__word">{w}</span>
          </span>,
          // A real space, not CSS padding: the masks would otherwise concatenate into
          // "Youdon'thave…" when copied or read aloud.
          " ",
        );
      });
  };

  if (mark && marked.length > 1) {
    pushWords(marked[0], "a");

    // Trailing punctuation rides inside the marked span. As its own "word" it would sit after
    // the mask's word-gap and float away from the phrase.
    const rest = marked.slice(1).join(mark);
    const punct = /^([.,!?;:]+)(\s*)$/.exec(rest);

    parts.push(
      <span className="lp__mask" key="mark">
        <span className="lp__word">
          <span className="lp__mark">
            <i className="lp__mark-fill" aria-hidden="true" />
            {mark}
          </span>
          {punct ? punct[1] : null}
        </span>
      </span>,
    );

    if (!punct) pushWords(rest, "b");
  } else {
    pushWords(text, "w");
  }

  return <span className={className}>{parts}</span>;
}
