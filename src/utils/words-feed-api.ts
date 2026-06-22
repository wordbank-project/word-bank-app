import { Platform } from 'react-native';

/**
 * Base URL of the external "floating words" feed server that collects words
 * users add, to power a public live feed. Only the bare word is ever sent
 * (no book, language, sentence, notes, or any other context) — see postWordToFeed.
 *
 * Opt-in via EXPO_PUBLIC_WORDS_FEED_API_URL (set per environment: `.env.local`
 * for a physical device, `eas.json` `env` for preview/production builds). When
 * unset we fall back to a local dev server (mirroring words-api.ts) — note that
 * "localhost" resolves differently per platform:
 *   - iOS simulator & web:  http://localhost:4000   (shares the host network)
 *   - Android emulator:     http://10.0.2.2:4000    (emulator alias for the host machine)
 *   - Physical device:      http://<your-LAN-IP>:4000  — must be provided via the env var
 *
 * Because the default is always set, the feature is effectively always on in
 * dev pointing at localhost:4000; that's fine — the request just fails silently
 * if no server is running (errors are intentionally swallowed).
 */
const DEFAULT_LOCAL_URL = Platform.select({
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_WORDS_FEED_API_URL ?? DEFAULT_LOCAL_URL;

// Abort the request after ~5s so a slow/unreachable server can't leak a request.
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Fire-and-forget POST that contributes a single word to the external words feed.
 *
 * Privacy: ONLY the bare word is sent (trimmed + lowercased) — no book, language,
 * sentence, notes, or user identity.
 *
 * This is fire-and-forget: it kicks off the request and returns `void`
 * synchronously without awaiting. It can NEVER throw and any failure (network
 * error, timeout, bad response) is intentionally swallowed so contributing to
 * the feed can never affect the caller's flow (e.g. adding a word).
 */
export function postWordToFeed(word: string): void {
    try {
        if (!word?.trim()) {
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        fetch(`${API_BASE_URL}/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: word.trim().toLowerCase() }),
            signal: controller.signal,
        })
            .catch(() => { })
            .finally(() => clearTimeout(timeout));
    } catch {
        // Swallow everything (e.g. a synchronous fetch/JSON failure) — must never throw.
    }
}
