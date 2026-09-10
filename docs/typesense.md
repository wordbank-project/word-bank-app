# Typesense — a future search upgrade path

Not integrated anywhere yet. [Typesense](https://github.com/typesense/typesense) is an open-source,
typo-tolerant search engine (self-hosted or Typesense Cloud) built for sub-50ms search-as-you-type —
positioned as an easier-to-run alternative to Algolia/Elasticsearch. Three of its own hosted demos map
almost one-to-one onto shapes this app already has, which is what makes it worth a written-down look:

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

### 1. Word suggestion autocomplete — closest fit, cheapest to try

`useWordSuggestions` → `fetchWordSuggestions` ([src/utils/words-api.ts](../src/utils/words-api.ts))
backs the add-word suggestion chips on `book.tsx`. Today: Datamuse for English (word-frequency based —
the code's own comment already flags it as "occasionally containing misspellings"), and wiktapi.dev's
`/search` for every other language — which [doesn't currently work on the public
instance](dictionary-api.md#known-limitations-of-the-public-instance), so non-English suggestions are
effectively dead. This is exactly the spellcheck demo's shape: index each language's word list (already
obtainable per Wiktionary edition, or any word-frequency list) into one small Typesense collection and
let its typo-tolerance serve real dictionary words instead of frequency guesses or a broken endpoint.
Same order of magnitude as the demo (one language ≈ tens of thousands to a few hundred thousand words),
so it fits on the same class of tiny single-node deployment. Would also let `fetchWordSuggestions` drop
its dependency on wiktapi.dev's `/search` entirely.

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
  terms from calling OpenLibrary directly today.
- **Word wall & federated search (owns a write path)** — route through `word-bank-server`, which
  already owns ingesting the word feed and fronting the AI endpoints so no key ships in the app bundle.

Hosting-wise, the cheapest path mirrors what `dictionary-api.md` already recommends for wiktapi.dev:
Typesense Cloud's free tier for a quick trial, or a small self-hosted node (e.g. the same Oracle Cloud
Always Free ARM VM) once/if a real integration is worth running continuously.

## Recommended priority

1. **Word suggestion autocomplete** — smallest dataset, fixes an already-documented pain point
   (misspelling-prone Datamuse results, dead non-English `/search`), lowest infra commitment.
2. **Community word wall search** — small, self-owned dataset; good second integration to learn the
   pattern on.
3. **Book search facets/typo-tolerance** — the biggest visible upgrade, but only worth it once the
   OpenLibrary bulk-import + refresh commitment is something someone's ready to own long-term.
4. **Federated search** — revisit later, only if a real cross-collection UI need appears.
