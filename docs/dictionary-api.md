# Dictionary API (wiktapi.dev)

Word definitions and phonetic transcriptions, for every language including English, come from **[wiktapi.dev](https://github.com/TheAlexLichter/wiktapi.dev)** — a multilingual REST API built on kaikki.org's pre-processed Wiktionary data. By default the app talks to the **public, upstream-hosted instance** at `https://api.wiktapi.dev` — no setup required, works out of the box. Self-hosting your own instance (below) is optional: useful for full 100+ language coverage beyond the public instance's current editions, for your own reliability control, or because `fetchWordSuggestions` still requires a self-hosted override for non-English as-you-type suggestions — see [Known limitations of the public instance](#known-limitations-of-the-public-instance). The app no longer calls dictionaryapi.dev or **Wikimedia's REST API** at all, for any language or any purpose.

**Why wiktapi.dev at all, rather than Wikimedia's REST API:** Wikimedia's API enforces a [User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy) and rejects Android's default `okhttp` UA with a 403 — so Dutch lookups failed only on Android. wiktapi.dev removes the runtime dependency on Wikimedia entirely, gives structured JSON (definitions + part of speech + IPA) instead of fragile text scraping, and supports 100+ languages from one endpoint (of which the public instance currently hosts a subset — see [Endpoint shape](#endpoint-shape)).

## Self-hosting your own instance (optional)

The sections below (repo location, running locally, production hosting) are only relevant if you want your own instance instead of — or as an override on top of — the public default. Skip straight to [App integration](#app-integration) if you're just consuming the public instance as-is.

### Repo location

The API lives in a sibling repo (not part of this app):
```
~/programming/word-bank/word-bank-ecosystem/wiktapi.dev
```
Toolchain: Node ≥ 24.13.1, pnpm 10.30.0 (via corepack). The README uses a `vp` (vite-plus) CLI; the `pnpm --filter` commands below are the equivalents and need no extra install.

### Run the API locally

```bash
cd ~/programming/word-bank/word-bank-ecosystem/wiktapi.dev

# 1. Install deps (compiles the native better-sqlite3 module)
pnpm install

# 2. Download a Wiktionary edition's data from kaikki.org.
#    Start with nl (small). English is ~2.3 GB compressed — add it if/when
#    you need it (e.g. to self-host English for reliability — see "Should
#    English move onto wiktapi.dev too?" below).
pnpm --filter @wiktapi/api run download -- --editions nl

# 3. Import into SQLite → packages/api/data/wiktionary.db
pnpm --filter @wiktapi/api run import -- --edition nl --fresh

# 4. Start the dev server (http://localhost:3000)
pnpm --filter @wiktapi/api run dev
```

Add more languages by repeating steps 2–3 with `--editions <code>` / `--edition <code>` (e.g. `en`).

**Verify + inspect the schema:**
```bash
curl "http://localhost:3000/v1/nl/word/hond?lang=nl"
```
Interactive explorer at `/_scalar`, raw OpenAPI at `/_openapi.json`.

## Endpoint shape

```
GET /v1/{edition}/word/{word}/definitions?lang={code}
```

| Axis | Meaning |
|---|---|
| `{edition}` | Which Wiktionary the data comes from → **the language definitions are written in** |
| `?lang=` | Filters to entries for a specific language |

The app uses matching edition + lang (e.g. `/v1/nl/word/hond/definitions?lang=nl`) so Dutch words get **Dutch-language** definitions. Using the `en` edition instead would return English glosses of the Dutch word.

**Editions on the public instance today:** `cs`, `de`, `el`, `en`, `es`, `fr`, `id`, `it`, `ja`, `ko`, `ku`, `ms`, `nl`, `pl`, `pt`, `ru`, `simple`, `th`, `tr`, `vi`, `zh` (check `GET /v1/editions` for the current list — it can grow over time without a doc update here). Every other language in the app's `LANGUAGES` list (see [src/models/language.ts](../src/models/language.ts)) 404s gracefully against the public instance today; self-host your own instance and import that edition if you need one of them.

## App integration

All lookups go through a single entry point — see [src/utils/words-api.ts](../src/utils/words-api.ts):

```ts
fetchDefinition(word, lang)  // → WordEntry — word, phonetic?, partOfSpeech, definition,
                              //   plus every definition flattened into definitions[] (deduped, capped
                              //   at 50) with selectedDefinition pointing at the first one
```

Every language, including English, routes through `fetchFromWiktapi` — the edition passed in the URL is just the language code itself (no remapping table — every edition on the public instance is named by plain ISO code identical to the app's language codes; an unsupported code 404s gracefully). The base URL is `process.env.EXPO_PUBLIC_DICT_API_URL`, defaulting to the public instance (`https://api.wiktapi.dev`) when unset.

`fetchFromWiktapi`'s own `/definitions` call never returns phonetic data, so `fetchDefinition` also fires a concurrent, best-effort call to wiktapi.dev's dedicated `/v1/{edition}/word/{word}/pronunciations` route (`fetchPhonetic`) via `Promise.allSettled` — it adds no latency, and its failure (timeout, non-200, no IPA in the response) never fails the word lookup itself, it just means no phonetic gets attached. This is the same pattern used everywhere else in this file for optional supplements, and works for every language, not just English.

## Known limitations of the public instance

### Resolved: a ~1-day outage affecting every route (2026-08-27 → 2026-08-28)

On 2026-08-27, direct testing found `/v1/{edition}/word/{word}/definitions` hanging indefinitely
for any *uncached* word (confirmed via `curl -v`: TLS handshake completes, request sent, zero
bytes ever come back, even after 20s) — reproduced across two separate testing sessions, six
different English words, and independently **on a real device** (the app surfacing "Dictionary
request timed out. Try again." looking up the plain word "test"). `/v1/{edition}/search`
(suggestions) and `/v1/{edition}/word/{word}/pronunciations` (phonetics) hung identically the
whole time. Tellingly, `api.dictionaryapi.dev` — a completely unrelated, normally reliable
service — also hung in the same testing sessions, while non-Cloudflare services (Datamuse,
OpenLibrary) stayed fast throughout; both wiktapi.dev and dictionaryapi.dev are Cloudflare-fronted.
That pattern pointed at a shared Cloudflare-side incident rather than a wiktapi.dev-specific bug.

**As of 2026-08-28, every route — `/definitions`, `/pronunciations`, `/search`, and the bare
`/word/{word}` route — is responding fast and correctly again**, across every word that
previously hung. This looks like it really was a transient outage, now resolved on its own,
rather than a permanent defect. Treat this as **volatile, not proven-stable**: it broke once for
about a day across every route simultaneously, so a repeat isn't out of the question. To
spot-check current health yourself:
```bash
curl -s -w "\n%{http_code} %{time_total}s\n" "https://api.wiktapi.dev/v1/en/word/dog/definitions?lang=en"
curl -s -w "\n%{http_code} %{time_total}s\n" "https://api.wiktapi.dev/v1/en/word/dog/pronunciations?lang=en"
```
A fast 200 on both means it's healthy from your vantage point right now. If lookups start failing
often enough to be a real problem, `EXPO_PUBLIC_DICT_API_URL` can be pointed at a self-hosted
instance instead (see [Self-hosting your own instance](#self-hosting-your-own-instance-optional)
above) — a failed lookup already degrades to the on-screen timeout message rather than broken app
state either way.

### A find worth knowing about: the bare `/v1/{edition}/word/{word}` route

Discovered while investigating the outage above: `/v1/{edition}/word/{word}` (no `/definitions`
or `/pronunciations` suffix) returns the full raw kaikki.org entry per part-of-speech, including
`sounds[].ipa` — i.e. it has phonetic data too, in the same call. It's **not** currently used by
this app: `fetchFromWiktapi` deliberately uses `/definitions` instead, because the bare route's
response has no `pos` (part-of-speech) field at all (confirmed by reading the route source,
`packages/api/routes/v1/[edition]/word/[word].get.ts` — its `.map()` only carries over `senses`,
`sounds`, `translations`, `forms`), and `pos` is required for the app's part-of-speech
filter/colour-coding (`utils/part-of-speech.ts`). Fetching both `/definitions` and `/pronunciations`
concurrently (the current design, see [App integration](#app-integration) above) costs one extra
request but keeps both fields; switching to the bare route instead would trade that extra request
for permanently losing part-of-speech data, which isn't a good trade for this app.

## Pointing the app at the server

By default, with no env var set at all, the app talks to the public instance — this covers iOS simulator, Android emulator, physical device, web, and preview/production builds alike, with zero configuration. Set `EXPO_PUBLIC_DICT_API_URL` only if you want to override that (self-hosting, testing your own instance, or working around one of the [known limitations](#known-limitations-of-the-public-instance) above):

| App runs on | URL | Setup needed |
|---|---|---|
| Any platform, no override | `https://api.wiktapi.dev` (public) | none (default) |
| iOS simulator / web, own local server | `http://localhost:3000` | set env var (below) |
| Android emulator, own local server | `http://10.0.2.2:3000` | set env var (below) |
| **Physical phone, own local server** | `http://<your-Mac-LAN-IP>:3000` | set env var (below) |
| Preview / production, own deployed server | deployed HTTPS URL | set in `eas.json` per profile |

Note the shift from before: running your *own* server locally now always requires the env var explicitly, even on simulator/emulator — there's no more automatic `localhost`/`10.0.2.2` fallback, since an unset env var now means "use the public instance" instead.

**Physical device, own local server:** create `.env.local` (gitignored) in this app's root:
```
EXPO_PUBLIC_DICT_API_URL=http://192.168.0.205:3000
```
`EXPO_PUBLIC_*` vars are inlined at bundle time, so **restart Metro with `--clear`** after changing it (`npm run dev-client:physical` already includes `--clear`). The IP is DHCP-assigned — update it whenever your Mac's LAN address changes. Note this only affects the **dev client** (JS comes from Metro at runtime); a Metro restart is enough, no APK rebuild needed.

⚠️ **Gotcha:** the Nitro dev server binds to `localhost` by default, so a physical device can't reach it. Start it bound to all interfaces, and keep both devices on the same Wi-Fi:
```bash
HOST=0.0.0.0 pnpm --filter @wiktapi/api run dev
```
Cleartext HTTP is fine for dev-client (debug) builds; production must use HTTPS (iOS ATS / Android block cleartext in release).

## Production hosting

Optional — the public instance already works for production builds with zero configuration. Deploy your own instance only if you want your own reliability control, broader language coverage, or working non-English suggestions (see [Known limitations](#known-limitations-of-the-public-instance) above). If you do, the API must be deployed to a public **HTTPS** URL and set via `EXPO_PUBLIC_DICT_API_URL` in `eas.json` (`env` per profile). The repo ships a `Dockerfile` + `docker-compose.yml` (`restart: unless-stopped`), and the runtime image expects the DB mounted at `/data/wiktionary.db`. Build the `wiktionary.db` on a fast machine and copy it to the host rather than downloading/importing on constrained hardware (e.g. a Raspberry Pi). For a home host behind NAT, Cloudflare Tunnel gives free HTTPS without port-forwarding.

**eas.json status:** the `preview` profile carries `EXPO_PUBLIC_DICT_API_URL` pointed at a self-hosted instance (useful for testing your own server); `production` still carries an unfilled placeholder (`https://your-api.example.com`) left over from before the public instance existed. ⚠️ **This placeholder must be removed (or replaced with a real URL) before a production build is useful** — an env var set to a bad URL does *not* fall through to the code-level public-instance default the way an absent/unset var would; it's actively worse than having no override at all, since the app will try (and fail) to reach `your-api.example.com` for every non-English word. **Cloud (EAS) builds ignore `.env.local`** (it's gitignored and never uploaded); they read the URL only from `eas.json` `env` (or EAS dashboard environment variables). `.env.local` applies only to `npm run dev` and the local `build:apk:local:*` scripts.

**Free hosting option (recommended): Oracle Cloud Always Free.** The Ampere A1 (Arm) Always-Free shape (up to 4 OCPU / 24 GB RAM, 200 GB storage, public IPv4) is arm64 — the same arch the Docker image already targets — so it runs unchanged. Deploy mirrors the Raspberry Pi steps below minus the home-network pain; put HTTPS in front with Caddy (auto Let's Encrypt) or a Cloudflare Tunnel. Watch the two gotchas: open the port in **both** the OCI security list **and** the instance's iptables, and A1 capacity can be scarce in popular regions. The same image also drops onto a $4–6/mo VPS with zero code changes.

## Hosting on a Raspberry Pi (Still TODO)

The Dockerfile targets `node:22` (arm64 is published) and compiles `better-sqlite3`, so it builds natively on a Pi. **Golden rule:** build `wiktionary.db` on your Mac and copy the file over — never run the multi-GB download/import on the Pi.

**0. Prerequisites** — 64-bit Raspberry Pi OS, Pi 4/5, DB ideally on a **USB SSD** (not the SD card). Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # then log out/in
```

**1. Copy the database from the Mac** (run on the Mac):
```bash
ssh pi@raspberrypi.local 'mkdir -p ~/wiktapi-data'
scp ~/programming/word-bank/word-bank-ecosystem/wiktapi.dev/packages/api/data/wiktionary.db \
    pi@raspberrypi.local:~/wiktapi-data/
```

**2. Build the image on the Pi:**
```bash
git clone <your-wiktapi-repo> ~/wiktapi.dev && cd ~/wiktapi.dev
docker build --target runtime -t wiktapi-api .
```
If the Pi is RAM-constrained, build on the Mac for arm64 and transfer instead:
```bash
docker buildx build --platform linux/arm64 --target runtime -t wiktapi-api . --load
docker save wiktapi-api | ssh pi@raspberrypi.local docker load
```

**3. Run it, mounting the DB** (image expects it at `/data/wiktionary.db`):
```bash
docker run -d --name wiktapi --restart unless-stopped \
  -p 3000:3000 -v ~/wiktapi-data:/data wiktapi-api

curl "http://localhost:3000/v1/nl/word/hond?lang=nl"   # verify
```
Now reachable on the LAN at `http://<pi-ip>:3000`.

**4. Expose over HTTPS (Cloudflare Tunnel)** — no port-forwarding, hides the home IP, and the app requires HTTPS in production:
```bash
# install cloudflared (arm64), then:
cloudflared tunnel login
cloudflared tunnel create wiktapi
cloudflared tunnel route dns wiktapi dict.yourdomain.com
# point ingress at http://localhost:3000 in ~/.cloudflared/config.yml
cloudflared service install      # run as a service, survives reboot
```
Then set `EXPO_PUBLIC_DICT_API_URL=https://dict.yourdomain.com` in `eas.json` for the preview/production profiles.

**Keeping it fresh:** monthly (or quarterly — definitions change rarely), rebuild `wiktionary.db` on the Mac, `scp` it over, then `docker restart wiktapi`.

**Caveat:** fine for yourself + preview testers; home power/internet is the uptime weak link for a real launch. The same image moves to a $4–6/mo VPS with zero code changes — just keep the env URL pointed at wherever it lives.

## Should English move onto wiktapi.dev too?

**Definitions: yes — as of 2026-08-27, English definitions come from wiktapi.dev too**, via
`fetchFromWiktapi('en', word)`, the same path every other language already uses (see [App
integration](#app-integration) above). `dictionaryapi.dev` is no longer called by the app at all
right now.

**Phonetics: not currently — reverted shortly after shipping the above.** wiktapi.dev's
`/definitions` never returns phonetic data (no `sounds` column in the response), and its
dedicated phonetics route, `/pronunciations`, is [confirmed
non-functional](#known-limitations-of-the-public-instance) on the public instance. A hybrid fix
was briefly wired up — a concurrent, best-effort `fetchEnglishPhonetic` call to dictionaryapi.dev
just for the phonetic field, via `Promise.allSettled` so it never blocked or failed the main
lookup — but was pulled back out shortly after. **English word entries currently have no
phonetic transcription on a fresh lookup, a known, accepted gap, not a bug.**
`src/utils/words-api.ts`'s `fetchEnglishPhonetic` is still there, explicitly marked `NOT WIRED UP
YET`, ready to re-enable in `fetchDefinition` whenever there's a decision to bring it back (or
`/pronunciations` starts working upstream, removing the dictionaryapi.dev dependency entirely).

**Why it took this long to unify definitions, for the record:** the old cost/reliability argument
for keeping English off a self-hosted box (importing the ~2.3 GB English edition would strain
your own Oracle VM/Pi/VPS, and a self-hosted-box outage would take down the language most people
use) stopped applying once wiktapi.dev moved from something *you* self-host to a public
third-party instance — you're not paying that hosting cost either way.

**The cache-miss `/definitions` reliability question was an accepted, unresolved risk before
shipping this — and has since been confirmed real**, not just a sandbox artifact (see [Known
limitations](#known-limitations-of-the-public-instance) above for the full detail, including a
real-device repro on a plain uncached English word). English was unified onto wiktapi.dev anyway,
on the reasoning that a failed lookup already degrades gracefully to an on-screen timeout message
rather than broken app state — that reasoning held up: the confirmed failure mode is exactly that
degraded-but-safe behavior, not a crash. If English lookups are failing often enough to be a real
problem for real users, set `EXPO_PUBLIC_DICT_API_URL` to a self-hosted instance as a workaround.

**Recommended mitigation: self-host the `en` edition too, rather than relying on any public
fallback.** The obvious safety net — retry via dictionaryapi.dev when wiktapi.dev's cache-miss
path fails — isn't actually reliable right now either: dictionaryapi.dev was confirmed
non-responsive in the same testing that surfaced this whole issue (see [Known
limitations](#known-limitations-of-the-public-instance) above), so it can't be trusted as a
fallback target at the moment. Self-hosting sidesteps both public services' problems at once —
follow [Run the API locally](#run-the-api-locally) above, adding `en` alongside whatever editions
you already have (`pnpm --filter @wiktapi/api run download -- --editions en`, then `import --
--edition en --fresh`, then re-index/VACUUM per the Production hosting section's guidance), and
point `EXPO_PUBLIC_DICT_API_URL` at that instance. The tradeoff this reintroduces — the ~2.3 GB
English edition's size and the heavier refresh cycle it implies, previously the whole reason
English was kept off self-hosting — is a known, accepted cost of this path, not an oversight.

One still-unclaimed quality win: wiktapi.dev's own `/search` would give English autocomplete real
dictionary words instead of Datamuse's word-frequency-based suggestions (which
`fetchWordSuggestions`'s own comment already flags as occasionally containing misspellings) — not
available yet, since `/search` still hangs on the public instance regardless of the English
definitions question above.

## Alternative dictionary APIs considered

Kept for reference if we ever move off wiktapi.dev. The key distinction is **dictionary** (definition + part of speech + IPA, matching our `WordEntry` model) vs **translation** (word → word only, no POS/phonetic — would require reshaping the model).

### Free
| Option | Type | Languages | Notes |
|---|---|---|---|
| **wiktapi.dev** — current | Dictionary | 21 on the public instance, 100+ if self-hosted | Public instance free to use, no infra to pay for; self-hosting still available for full coverage. Structured JSON: definitions + POS + IPA (phonetics/search currently non-functional on the public instance — see [Known limitations](#known-limitations-of-the-public-instance)). |
| **Wiktionary REST API** | Dictionary | 100+ | `en.wiktionary.org/api/rest_v1`. Closest zero-infra equivalent, but Wikimedia-hosted (needs `User-Agent` header, rate limits, glosses in English). |
| **dictionaryapi.dev** | Dictionary | ~13 only | Free, no key, but **no Dutch** (en, es, fr, de, it, ru, ja, ko, ar, tr, hi, pt-BR). Was the original English source; now only called for English's phonetic transcription (see [App integration](#app-integration)). |
| **MyMemory** | Translation | All pairs | Free ~50k chars/day (more with email). No POS/IPA. |
| **LibreTranslate** | Translation | ~30 | Open-source, self-hostable or public instances. |
| **Merriam-Webster API** | Dictionary | en + es | Free with key, limited daily calls. Not multilingual. |

### Paid (most have a free tier)
| Option | Type | Languages | Notes |
|---|---|---|---|
| **Lexicala API** (K Dictionaries) | Dictionary | 25+ incl. Dutch | Product-grade multilingual dictionary (definitions, POS, IPA, examples). Free trial, cleanest commercial licensing. |
| **Oxford Dictionaries API** | Dictionary | ~10 incl. Dutch | Monolingual definitions + phonetics. Had a free prototype tier; since restructured/limited. |
| **DeepL API** | Translation | ~30 incl. Dutch | Free 500k chars/mo then paid. Highest-quality translations, needs key. |
| **Google Cloud Translation** | Translation | 100+ | Paid ($300 free credit). Broadest coverage, translations only. |

The dictionary options (wiktapi.dev / Wiktionary REST / Lexicala) drop in without reshaping `WordEntry`; the translation options would mean dropping or repurposing `definition` / `partOfSpeech` / `phonetic`.

