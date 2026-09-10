# Community word feed + AI endpoints (word-bank-server)

The app's **outbound** data. A small Express + SQLite service (`word-bank-server`, a sibling
repo) collects words people save, so the marketing site can show a live "word wall". It also
fronts the AI features — sentence analysis and word/book-title placeholder suggestions
(`GET /v1/suggestions`, integrated) — so the LLM API key stays server-side instead of shipping
in the app bundle. Unlike `/analyze`, `/v1/suggestions` is **not** rate-limited or cached
server-side — every call is a live, parallel pair of LLM completions — which is why the app
caches successful results in memory per `lang` (see `suggestions-api.ts` in [AGENTS.md](../AGENTS.md)'s Utils section).

- **Touch points:** [`words-feed-api.ts`](../src/utils/words-feed-api.ts) `postWordToFeed()`
  contributes a word on add; [`analyze-api.ts`](../src/utils/analyze-api.ts) `analyzeSentence()`
  powers the Analyze screen; [`suggestions-api.ts`](../src/utils/suggestions-api.ts)
  `fetchSuggestions()` powers the AI-generated word/book/sentence placeholder on `book.tsx`
  (words), `SearchBar.tsx`/`custom-book.tsx` (book titles, author/year), and `analyze.tsx`
  (example sentences). All resolve the host through [`feed-api-base.ts`](../src/utils/feed-api-base.ts).
- **Privacy — the feed:** only the bare word and its **public** dictionary values (definition,
  part of speech, phonetic) are ever sent — never your sentence, notes, book, language, or any
  identity.
- **Privacy — `POST /analyze` is the deliberate exception.** A sentence you type *is* your own
  text, and analyzing it means sending it to the server and on to an LLM (Groq). It only ever
  happens when you submit a sentence on the Analyze screen, which says so on screen. The server
  is deliberately simple: no cache, no TTL — every request calls the model live and the
  response is just `{ meaning: string | null }`, nothing else (no tone, no figurative-device
  detection, no word list — those were considered and dropped; see `SentenceAnalysis` in
  `src/models/sentence-analysis.ts`). The server never logs or stores the sentence itself.
  Nothing identifying is sent either way. See the privacy stance in `word-bank-server/AGENTS.md`.
  The local history of your analyses stays on the device (`sentence_analyses`) and is wiped by
  More → "Delete all data".
- **Opt-in + offline-safe:** enabled by `EXPO_PUBLIC_WORDS_FEED_API_URL` (platform-aware local
  fallback in dev). Every call is fire-and-forget / `[]`-or-`null`-on-failure, so a missing or
  unreachable server never affects the UI — the Analyze screen shows a "couldn't analyze" state.
  The AI endpoints additionally need `GROQ_API_KEY` **on the server**; without it `/analyze`
  returns `null` and `/v1/suggestions` returns `{ words: [], books: [] }` (200, not an error), and
  the app degrades to its static fallback lists either way.
- **Deploy:** the server ships its own `Dockerfile`/`docker-compose.yml` and can share the
  Oracle VM that runs the dictionary API — see `word-bank-server/README.md` and the step-by-step
  in [api.md](../api.md).

