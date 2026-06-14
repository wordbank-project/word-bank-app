import { useEffect, useState } from "react";

type TypewriterOptions = {
    typeMs?: number;   // delay between each character
    pauseMs?: number;  // how long to hold a fully-typed word before the next one
};

// Animates a placeholder that "types out" words one character at a time, pausing on
// each full word before clearing and typing the next (random) one. A gentle hint of
// example searches/words. Pass active=false (e.g. once the field has a value) to stop.
export function useTypewriterPlaceholder(
    words: string[],
    active: boolean = true,
    { typeMs = 130, pauseMs = 1600 }: TypewriterOptions = {},
): string {
    const [display, setDisplay] = useState("");

    useEffect(() => {
        if (!active || words.length === 0) {
            setDisplay("");
            return;
        }

        let timer: ReturnType<typeof setTimeout>;
        let word = pickRandom(words);
        let i = 1; // start at 1 so the first character shows immediately (no blank frame)

        function tick() {
            setDisplay(word.slice(0, i));
            if (i < word.length) {
                i += 1;
                timer = setTimeout(tick, typeMs);
            } else {
                // fully typed — hold, then type a fresh word from the start
                timer = setTimeout(() => {
                    word = pickRandom(words, word);
                    i = 1;
                    tick();
                }, pauseMs);
            }
        }

        tick();
        return () => clearTimeout(timer);
    }, [active, words, typeMs, pauseMs]);

    return display;
}

// Picks a random word, avoiding `exclude` so the same one doesn't repeat back-to-back.
function pickRandom(words: string[], exclude?: string): string {
    const pool = exclude && words.length > 1 ? words.filter((w) => w !== exclude) : words;
    return pool[Math.floor(Math.random() * pool.length)];
}
