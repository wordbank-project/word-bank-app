# Typesense — search upgrade path

[Typesense](https://github.com/typesense/typesense) is an open-source, typo-tolerant search engine
(self-hosted or Typesense Cloud) built for sub-50ms search-as-you-type — positioned as an easier-to-run
alternative to Algolia/Elasticsearch.

**Status: (1) word suggestion autocomplete is integrated and opt-in — see below. (2)–(4) are still
future work.** Three of Typesense's own hosted demos map almost one-to-one onto shapes this app has,
which is what made it worth pursuing:

- **[spellcheck.typesense.org](https://spellcheck.typesense.org/)** — types out corrected spellings
  from a ~333k-word dictionary as you type, purely via Typesense's built-in typo-tolerance (no custom
  spellcheck logic). Runs on a single 512MB-RAM node.
- **[books-search.typesense.org](https://books-search.typesense.org/)** — search-as-you-type over
  **28 million OpenLibrary books**, with facets by subject/author. Source is public; the dataset is
  the same OpenLibrary catalog this app already searches.
- **[federated-search.typesense.org](http://federated-search.typesense.org/)** — one query, fanned out
  to two independent collections at once (via `POST /multi_search`, "federated" mode), shown
  side-by-side.

## Where it would actually help here

### 1. Word suggestion autocomplete — **integrated (opt-in)**

`useWordSuggestions` → `fetchWordSuggestions` ([src/utils/api/words-api.ts](../src/utils/api/words-api.ts))
backs the add-word suggestion chips on `book.tsx`. It previously had two sources, both weak: Datamuse
for English (word-frequency based — the code's own comment flagged it as "occasionally containing
misspellings"), and wiktapi.dev's `/search` for every other language, which [doesn't work on the public
instance](dictionary-api.md#known-limitations-of-the-public-instance), leaving non-English suggestions
effectively dead. This is exactly the spellcheck demo's shape, so Typesense now serves real dictionary
words with typo tolerance instead of frequency guesses or a broken endpoint.

**How it's wired**

- [src/utils/api/typesense-api.ts](../src/utils/api/typesense-api.ts) — `fetchTypesenseWordSuggestions()`,
  a plain `fetch` call against Typesense's REST search endpoint. Deliberately **not** the official
  `typesense` npm client: that ships axios as its transport, while every API client in this app uses raw
  `fetch` and the app carries no HTTP library at all. One `GET` with one header isn't worth the
  dependency, its bundle weight, or an axios adapter misbehaving on Hermes.
- `fetchWordSuggestions` tries Typesense first, then falls back to the Datamuse/wiktapi path whenever
  Typesense is unconfigured, errors, or has no match. Its signature and `[]`-on-any-failure contract are
  unchanged, so `useWordSuggestions` and `book.tsx` needed no changes at all.
- **Opt-in:** with `EXPO_PUBLIC_TYPESENSE_HOST` / `EXPO_PUBLIC_TYPESENSE_SEARCH_KEY` unset, behaviour is
  byte-for-byte what it was before. There's no default host — unlike wiktapi.dev there's no public shared
  instance, so "unset" can only mean "off".

**Collection schema** — one collection per language, `words_<code>` (e.g. `words_en`, `words_nl`), with a
single indexed `word` string field and the word itself as the document `id` (so re-seeding upserts rather
than duplicates). `LANGUAGES` has 58 entries; seed the ones you actually use, not all 58. One language is
roughly tens of thousands to a few hundred thousand words — the same order as the spellcheck demo, which
runs on a single 512MB node.

**Seeding** — [scripts/seed-typesense-words.mjs](../scripts/seed-typesense-words.mjs) creates the
collection and bulk-imports a newline-delimited word list as JSONL, in batches, idempotently:

```bash
# A local node to develop against (--enable-cors is only needed for Expo web):
docker run -p 8108:8108 -v "$(pwd)"/typesense-data:/data \
  typesense/typesense:30.2 --data-dir /data --api-key=devkey --enable-cors

node scripts/seed-typesense-words.mjs --lang en --file words-en.txt \
  --host http://localhost:8108 --key devkey
```

Where the word list itself comes from stays a manual step — a kaikki.org Wiktionary dump, the
`wiktionary.db` a self-hosted wiktapi.dev already builds (see [dictionary-api.md](dictionary-api.md)), or
any word-frequency list. A short hand-written list is enough to smoke-test the whole path.

**Keys** — `--key` on the seed script must be an **admin** key (creating collections and writing documents
are privileged) and stays on your machine. The app only ever gets a **search-only** key, which is safe to
embed in the bundle by design — the same model InstantSearch/Algolia use, and no different in trust terms
from this app already calling OpenLibrary/Datamuse directly.

**Verifying** — a typo'd query is the whole point, so test with one:

```bash
curl -H "X-TYPESENSE-API-KEY: devkey" \
  "http://localhost:8108/collections/words_en/documents/search?q=ambigous&query_by=word&prefix=true&num_typos=2"
# -> ambiguous
```

### 2. Book search — highest visible impact, highest infra cost

`useBookSearch` ([src/hooks/use-book-search.ts](../src/hooks/use-book-search.ts)) calls OpenLibrary's
`search.json` directly — no typo tolerance beyond what OpenLibrary itself does, and no facets (subject,
author, year range) surfaced in `index.tsx`/`BooksList` today. The books-search demo is, literally, this
same OpenLibrary catalog already put in front of Typesense with facets and sub-50ms typeahead — its
source is public, so the indexing pipeline wouldn't have to be designed from scratch. Swapping
`useBookSearch`'s `fetch` calls for a `typesense-js` client call (scoped, search-only API key — safe to
ship in the app bundle, same trust model as calling OpenLibrary's public API directly today) would add
typo correction ("harry poter" → *Harry Potter*) and cheap subject/author faceting. The cost is real,
though: standing up and keeping a 28M-book index fresh (an initial bulk import from OpenLibrary's data
dumps, then a recurring re-sync) is a materially bigger commitment than anything else here — closer to
the wiktapi.dev self-hosting story in `dictionary-api.md` than a quick add.

### 3. The community word wall — small, and already ours to index

`word-bank-server`'s word feed (`src/word/`) collects every word contributed via `postWordToFeed`
(see `docs/community-server.md`), and `word-bank-site`'s `WordWall.astro` displays it as a glossary
modal — currently a plain client-filtered list, not a real search. Since `word-bank-server` already
owns the write path for this data, it's the natural place to also push each new word into a Typesense
collection as it's saved, then have the word wall query that collection instead of filtering a fetched
JSON array in the browser. Small dataset, so this is cheap to run — arguably a good "first real
integration" to learn the pattern on before attempting book search's much bigger index.

### 4. Federated search — a new possibility, not a current pain point

None of the above currently share one search box, so this is more of an idea than a fix: a single
query box (on the marketing site, say) that federates across the word wall *and* AI-suggested book
titles (`GET /v1/suggestions`'s `books` list, see `suggestions-api.ts`) in one `multi_search` call,
shown side-by-side like the federated-search demo does for its users/companies collections. Worth
revisiting only once 1–3 are real and a genuine cross-collection UI need shows up — not worth building
speculatively.

### Not a good fit: the Words List's local filter

`words-list.tsx`'s live search is a client-side filter over a small per-device AsyncStorage list
(typically dozens to a few hundred words) — already instant, nothing networked. Typesense's value
proposition (server-side fuzzy search at real scale) doesn't buy anything here.

## Architectural note

This repo has no backend of its own (see AGENTS.md's opening paragraph) — every existing network call
either hits a public third-party API directly (OpenLibrary, wiktapi.dev, Datamuse, Google Translate) or
goes through the sibling `word-bank-server`. Any Typesense use would follow the same split:

- **Word suggestions & book search (read-only)** — query a Typesense Cloud/self-hosted instance
  **directly from the app**, using a scoped search-only API key embedded in the client. Typesense is
  explicitly designed for this (the same key model InstantSearch/Algolia use) — no different in trust
  terms from calling OpenLibrary directly today. *(This is what word suggestions now do, via
  `typesense-api.ts`.)*
- **Word wall & federated search (owns a write path)** — route through `word-bank-server`, which
  already owns ingesting the word feed and fronting the AI endpoints so no key ships in the app bundle.

Hosting-wise, the cheapest path mirrors what `dictionary-api.md` already recommends for wiktapi.dev:
Typesense Cloud's free tier for a quick trial, or a small self-hosted node (e.g. the same Oracle Cloud
Always Free ARM VM) once/if a real integration is worth running continuously.

## Recommended priority

1. ~~**Word suggestion autocomplete**~~ — **done** (opt-in, see above). Smallest dataset, fixed an
   already-documented pain point (misspelling-prone Datamuse results, dead non-English `/search`),
   lowest infra commitment.
2. **Community word wall search** — small, self-owned dataset; good second integration, and the
   client-side pattern from #1 is now established to build on.
3. **Book search facets/typo-tolerance** — the biggest visible upgrade, but only worth it once the
   OpenLibrary bulk-import + refresh commitment is something someone's ready to own long-term.
4. **Federated search** — revisit later, only if a real cross-collection UI need appears.
