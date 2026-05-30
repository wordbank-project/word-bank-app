import { createContext, useContext, useState } from "react";

type ScrollContextType = {
    scrollY: number;
    setScrollY: (y: number) => void;
    scrollToTop: (() => void) | null;
    setScrollToTop: (fn: (() => void) | null) => void;
};

const ScrollContext = createContext<ScrollContextType>({
    scrollY: 0,
    setScrollY: () => {},
    scrollToTop: null,
    setScrollToTop: () => {},
});

export function ScrollProvider({ children }: { children: React.ReactNode }) {
    const [scrollY, setScrollY] = useState(0);
    const [scrollToTop, setScrollToTopFn] = useState<(() => void) | null>(null);

    function setScrollToTop(fn: (() => void) | null): void {
        setScrollToTopFn(() => fn);
    }

    return (
        <ScrollContext.Provider value={{ scrollY, setScrollY, scrollToTop, setScrollToTop }}>
            {children}
        </ScrollContext.Provider>
    );
}

export function useScrollContext() {
    return useContext(ScrollContext);
}
