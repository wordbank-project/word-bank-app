import { Platform } from 'react-native';

/**
 * Base URL (including the `/v1` API version) of the external Word Bank server
 * (`word-bank-server`): the words feed, AI placeholder suggestions, and
 * sentence analysis all live behind this one host. Defined once here because
 * every client under utils/ needs the same value and the same platform
 * caveats — each call site just appends its own path (e.g. `${FEED_API_BASE_URL}/words`),
 * never repeating `/v1` itself.
 *
 * Opt-in via EXPO_PUBLIC_WORDS_FEED_API_URL (set per environment: `.env.local`
 * for a physical device, `eas.json` `env` for preview/production builds — set
 * it to the server's `/v1` URL, e.g. `https://words.yourdomain.com/v1`). When
 * unset we fall back to a local dev server (mirroring words-api.ts) — note that
 * "localhost" resolves differently per platform:
 *   - iOS simulator & web:  http://localhost:4000/v1   (shares the host network)
 *   - Android emulator:     http://10.0.2.2:4000/v1    (emulator alias for the host machine)
 *   - Physical device:      http://<your-LAN-IP>:4000/v1  — must be provided via the env var
 *
 * Because the default is always set, these features are effectively always on in
 * dev pointing at localhost:4000; that's fine — requests just fail silently if
 * no server is running, and every caller degrades gracefully.
 */
const DEFAULT_LOCAL_URL = Platform.select({
    android: 'http://10.0.2.2:4000/v1',
    default: 'http://localhost:4000/v1',
});

export const FEED_API_BASE_URL = process.env.EXPO_PUBLIC_WORDS_FEED_API_URL ?? DEFAULT_LOCAL_URL;

/** Abort window for the small JSON endpoints (feed). */
export const FEED_REQUEST_TIMEOUT_MS = 5000;
