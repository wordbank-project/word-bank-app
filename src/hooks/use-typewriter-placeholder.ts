import { useEffect, useState } from "react";

type TypewriterOptions = {
    typeMs?: number; // delay between each character
};

export type TypewriterPlaceholder = {
    text: string; // the progressively-typed string, for use as a placeholder
    word: string; // the full target word (known up front), for "accept on empty submit"
};

// Types out a single random word one character at a time, then stops (no looping).
// `text` animates; `word` is the full word and is available immediately so a caller
// can accept it on Enter. A new word is picked whenever `active` flips back to true
// (e.g. after the field is emptied). Pass active=false to stop and clear.
export function useTypewriterPlaceholder(
    words: string[],
    active: boolean = true,
    { typeMs = 50 }: TypewriterOptions = {},
): TypewriterPlaceholder {
    const [text, setText] = useState<string>("");
    const [word, setWord] = useState<string>("");

    useEffect(() => {
        if (!active || words.length === 0) {
            setText("");
            setWord("");
            return;
        }

        const target = words[Math.floor(Math.random() * words.length)];
        setWord(target);

        let timer: ReturnType<typeof setTimeout>;
        let i = 1; // start at 1 so the first character shows immediately (no blank frame)

        function tick(): void {
            setText(target.slice(0, i));
            if (i < target.length) {
                i += 1;
                timer = setTimeout(tick, typeMs);
            }
            // once fully typed we simply stop — the word stays shown
        }

        tick();
        return () => clearTimeout(timer);
    }, [active, words, typeMs]);

    return { text, word };
}
