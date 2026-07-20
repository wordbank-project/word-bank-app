# Word Bank — app

**Turn the books you read into vocabulary you keep.**

The Word Bank mobile app: track what you read and save every new word with its definition, your own sentence, and your notes — all on your device, offline, no account.

_Part of the [Word Bank](https://github.com/wordbank-project/word-bank) project._

[![Download for Android (beta)](https://img.shields.io/badge/Download-Android%20(beta)-208AEF?logo=android&logoColor=white)](https://word-bank-vault.netlify.app)

_iOS — coming soon · Web — coming soon · F-Droid — planned_

## What it is

- **Track every book you read** — search millions of titles via Open Library (or add a custom book with a cover photo) and sort them into _Want to read_, _Currently reading_, or _Have read_.
- **A word bank per book** — each book keeps its own vocabulary, with a running word count.
- **Instant, precise definitions** — every meaning at once, with part of speech and IPA; search and pick the one that fits, colour-coded by part of speech.
- **Make words stick** — save each word with the sentence you found it in and your own notes; rate each book with stars and add a review and notes per book.
- **Typo-proof lookups** — as-you-type suggestions while adding a word, and "Did you mean …?" corrections when a lookup fails.
- **Translate on demand** — tap-to-reveal translation of a word into your own language; never called automatically.
- **All your words in one place** — the Words List gathers every word from every book; search, filter by part of speech, and sort A–Z, by book, or by recently added.
- **Read in your language** — definitions across 100+ languages (Wiktionary data); English and Dutch live today.
- **Private & offline** · **Dark mode** included.

## Tech

Expo SDK 55 · React Native · TypeScript · Expo Router · NativeWind (Tailwind v4) · AsyncStorage. Definitions come from the self-hosted [wiktapi.dev](https://github.com/jensrot/wiktapi.dev) (and [dictionaryapi.dev](https://dictionaryapi.dev) for English); book search from [Open Library](https://openlibrary.org); word suggestions from [Datamuse](https://www.datamuse.com/api/) (English) and wiktapi search (other languages).

## Run it

> The app uses native modules (e.g. `react-native-keyboard-controller`), so it needs a **custom dev client** — it does **not** run in Expo Go.

```bash
npm install
npm run dev            # start Metro + open the dev client (both platforms)
# after adding a native package or changing app.config.js:
npm run android        # or: npm run ios   (rebuild + install the dev client)
```

Optional `.env.local` (gitignored) for pointing at your own backends:

```bash
EXPO_PUBLIC_DICT_API_URL=http://192.168.x.x:3000        # dictionary API (wiktapi.dev)
EXPO_PUBLIC_WORDS_FEED_API_URL=http://192.168.x.x:4000  # community word feed (opt-in)
```

The full build matrix — dev client vs standalone APK, local Gradle builds, EAS cloud builds, OTA updates, and the per-profile app variants — lives in [`AGENTS.md`](./AGENTS.md).

## Project layout

```
src/
  app/            # expo-router routes (file = route); book.tsx is the book detail
    (tabs)/       # Search · Read List · Words List · More  (+ custom-book, about)
  components/     # presentational + small stateful UI
  hooks/          # reusable hooks (search, scroll, placeholder typewriter…)
  context/        # theme + scroll providers
  storage/        # AsyncStorage data layer (read list, words, language, theme)
  models/         # TypeScript types + constant data
  utils/          # API clients + pure helpers
```

See [`AGENTS.md`](./AGENTS.md) for the full architecture, data model, and dev/build flow.

## Privacy

No account, no cloud, no tracking — your reading list, words, sentences, and notes are stored on your device and work offline.

The app talks to the network only for the features you use, and sends only what the feature needs:

| Feature | Service | What is sent |
|---|---|---|
| Book search & covers | openlibrary.org · covers.openlibrary.org | your search text |
| Definitions | self-hosted wiktapi.dev · dictionaryapi.dev (English) | the word you look up |
| As-you-type suggestions | api.datamuse.com (English) · wiktapi search | the typed prefix |
| Translate (tap-to-reveal) | translate.googleapis.com (unofficial, keyless) | the word + two language codes — only when you tap |
| Community word feed (**opt-in**) | your [word-bank-server](https://github.com/wordbank-project/word-bank-server) instance | the saved word + its public dictionary data — never your sentences, notes, books, or identity |

The community feed is disabled unless `EXPO_PUBLIC_WORDS_FEED_API_URL` is set at build time. There are no analytics, crash reporters, or ad SDKs in the app.

## Contributing

Issues and pull requests are welcome. Run `npm run lint` before submitting, and use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:` …) for commit messages — see [`AGENTS.md`](./AGENTS.md) for the architecture and dev/build flow.

## License

[MIT](./LICENSE)
