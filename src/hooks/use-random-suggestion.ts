import { useRef } from "react";

export function useRandomSuggestion(items: string[]) {
    // flag to track if the current query is a random (to avoid triggering randomization on every search press)
    const isRandom = useRef(false);

    function pickNextWord(current: string): string {
        const others = items.filter((t) => t !== current);
        return others[Math.floor(Math.random() * others.length)];
    }

    function onManualChange() {
        isRandom.current = false;
    }

    return { isRandom, pickNextWord, onManualChange };
}
