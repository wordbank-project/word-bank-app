import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Custom root HTML shell for web (this file only ever runs in Node at build
// time / dev-server request time to emit the shell below; it has no DOM
// access itself). The inline <script> it renders, though, is plain text
// shipped in the HTML and DOES run in the real browser, synchronously,
// before the app's own JS bundle parses/hydrates.
//
// Why this exists: without it, the app's very first paint on web used the
// wrong theme for the header/tab-bar chrome (see theme-context.tsx) —
// `useSystemColorScheme()` can't synchronously reflect the true OS
// preference at that exact moment (build time has no window at all for the
// static export; even in dev mode there's a brief real gap before it
// settles), so the header would render wrong for a beat — visible as a
// flash before this fix, and as a permanent stuck state before the
// (tabs)/_layout.tsx key={colorScheme} fix landed. This script determines
// the correct theme the same way theme-context.tsx eventually would, but
// does it before React ever mounts, and stamps it onto <html data-theme> —
// the same attribute theme-context.tsx sets later (kept in sync there for
// subsequent toggles), which global.css's [data-theme] rules already apply
// immediately.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = window.localStorage.getItem('app_theme');
    var theme = (saved === 'light' || saved === 'dark')
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    // localStorage/matchMedia unavailable (e.g. privacy mode) — leave
    // data-theme unset, so the plain @media (prefers-color-scheme) CSS rule
    // in global.css still applies correctly on its own.
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
