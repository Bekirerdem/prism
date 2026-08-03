import type { ReactNode } from "react";

/** Splits a line into masked words, and each word into individual letters.
 *
 *  This is the real mechanic from the animmaster hero (`hero-1`): the reference animates
 *  `.willem__letter` — letters, not words — with `stagger: 0.025` out of an `overflow:hidden`
 *  box. Word-level staggering reads as a completely different animation, which is why this
 *  splits all the way down to characters.
 *
 *  The reference also pulls the two halves of the heading apart (`x: -0.05em` / `+0.05em`).
 *  No wrapper is needed for that: the marked phrase is already addressable via `.lp__mark`,
 *  so `useReveal` can shift the two letter groups by the same amount and the halves separate.
 *
 *  Splitting happens in markup rather than at runtime so the text stays selectable. Each word
 *  carries an `aria-label` and its letters are `aria-hidden`, so screen readers read words
 *  rather than spelling them out. */
export default function Words({
  text,
  mark,
  className = "",
}: {
  /** The line to animate. Split on spaces, then on characters. */
  text: string;
  /** A word or phrase inside `text` that gets the green highlight wipe. */
  mark?: string;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  const marked = mark ? text.split(mark) : [text];

  /** One word: an overflow box, the word itself, then a span per letter. */
  const letters = (word: string, keyBase: string) =>
    [...word].map((ch, i) => (
      <span className="lp__char" aria-hidden="true" key={`${keyBase}-c${i}`}>
        {ch}
      </span>
    ));

  const pushWords = (chunk: string, keyBase: string) => {
    chunk
      .split(" ")
      .filter(Boolean)
      .forEach((w, i) => {
        parts.push(
          <span className="lp__mask" key={`${keyBase}-${i}`}>
            <span className="lp__word" aria-label={w}>
              {letters(w, `${keyBase}-${i}`)}
            </span>
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
        <span className="lp__word" aria-label={mark + (punct ? punct[1] : "")}>
          <span className="lp__mark">
            <i className="lp__mark-fill" aria-hidden="true" />
            {letters(mark, "mark")}
          </span>
          {punct ? letters(punct[1], "punct") : null}
        </span>
      </span>,
    );

    if (!punct) pushWords(rest, "b");
  } else {
    pushWords(text, "w");
  }

  return <span className={className}>{parts}</span>;
}
