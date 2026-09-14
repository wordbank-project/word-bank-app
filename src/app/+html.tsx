import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Custom root HTML shell for web (this file only ever runs in Node at build
// time / dev-server request time to emit the shell below; it has no DOM
// access itself). The inline <script> it renders, though, is plain text
// shipped in the HTML and DOES run in the real browser, synchronously,
// before the app's own JS bundle parses/hydrates.
//
// Why this exists: without it, the app's very first paint on web used the
// wrong theme. Two distinct gaps, both closed here:
//
// 1. `useSystemColorScheme()` can't synchronously reflect the true OS
//    preference at the moment theme-context.tsx first runs (no `window` at
//    all during the static export's build-time render) — this script
//    determines the correct theme the same way theme-context.tsx eventually
//    would, but before React ever mounts, and stamps it onto
//    `<html data-theme>` (the same attribute theme-context.tsx sets later,
//    kept in sync there for subsequent toggles).
// 2. Even with `data-theme` set correctly, global.css's `[data-theme]` rules
//    live in a separately-fetched stylesheet — on a real network (unlike
//    localhost) there's a real gap between this script running and that
//    stylesheet finishing download, during which NO rule exists yet to
//    interpret the attribute at all, so the browser paints its blank
//    default regardless. Setting the background as a direct inline style
//    (not a class or attribute) sidesteps that network dependency entirely —
//    it applies the instant this script runs, no separate request needed.
//    The two hex values are duplicated from global.css's --color-background
//    on purpose (this file can't import that CSS — see the module doc
//    below); update both places together if that color ever changes.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = window.localStorage.getItem('app_theme');
    var theme = (saved === 'light' || saved === 'dark')
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#151718' : '#ffffff';
  } catch (e) {
    // localStorage/matchMedia unavailable (e.g. privacy mode) — leave
    // data-theme unset, so the plain @media (prefers-color-scheme) CSS rule
    // in global.css still applies correctly on its own (just not the inline
    // style above, which needs this same script to have run).
  }
})();
`;

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                {/* Restores what Expo's default root HTML provides — lost by defining a
                    custom +html.tsx at all. Without this, ScrollView-based full-screen
                    layouts collapse (e.g. the tab bar rendering pinned to the top over a
                    blank area instead of filling the screen with the bar at the bottom). */}
                <ScrollViewStyleReset />
                {/* Must run before the app bundle — see THEME_INIT_SCRIPT's comment above. */}
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
