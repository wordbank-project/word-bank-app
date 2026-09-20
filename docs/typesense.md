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

**Collection schema** — one collection per language, `words_<code>` (e.g. `words_en`, `words_nl`), with the
word itself as the document `id` (so re-seeding upserts rather than duplicates) and two fields:

| field  | type     | why |
|--------|----------|-----|
| `word` | `string` | what's queried (`query_by=word`) |
| `rank` | `int32`  | the word's position in the source list — the tiebreak after text-match score |

`LANGUAGES` has 58 entries; seed the ones you actually use, not all 58.

**The word list is the whole ballgame.** The search quality *is* the list quality, and this is worth
getting right — measured on a real 235k-word index, a bad list is genuinely worse than the Datamuse it
replaces:

| query | alphabetical dump (`/usr/share/dict/words`) | frequency-ordered + dictionary-filtered |
|---|---|---|
| `ephem` | `ephemerous, ephemeromorphic, ephemeromorph, …` — **no `ephemeral` in the top 6** | **`ephemeral`** |
| `serend` | `serendite, serendipity, serendibite, …` | **`serendipity`** |
| `recieve` | `reliever, relieved, relieve, receiver, …` | **`received, receive`, …** |
| `seperate` | `sperate, separates, separate, …` | **`separate`, …** |
| `mel` | `melosa, melomane, melitriose, melitose` | `mel, melissa, melody, melinda, melon` |

Two things cause that gap, and the recipe below fixes both:

1. **Order = rank.** Line number becomes `rank`, and the app sorts `_text_match:desc, rank:asc`, so
   common words win ties. An alphabetical list makes `rank` meaningless noise.
2. **Junk words match exactly.** An exact match always wins `_text_match`, so if the misspelling
   `seperate` is *in* your index, a search for it returns itself instead of correcting. Filtering the
   list against a real dictionary is what removes it.

**Recommended source** — [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(OpenSubtitles-derived, frequency-ordered, `word count` per line — the script reads the first token, so
it works as-is). It covers **51 of this app's 58 languages** (all but `az be cy ga la sw zh`), which
matters because non-English suggestions are otherwise dead entirely.

Its one catch: being subtitle-derived, ~51% of the English 50k list isn't real dictionary words — names,
slang, and typos. Intersecting it against a dictionary (keeping frequency order) cuts 50k → ~24k and is
what produces the right-hand column above. Note `/usr/share/dict/words` is a 1934 dictionary, so it drops
modern words (`internet`, `email`, `online`); a current wordlist avoids that.

```bash
# A local node to develop against (--enable-cors is only needed for Expo web):
docker run -p 8108:8108 -v "$(pwd)"/typesense-data:/data \
  typesense/typesense:30.2 --data-dir /data --api-key=devkey --enable-cors

# Frequency list for one language:
curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt

# Optional but recommended — drop non-dictionary words, keep frequency order:
python3 -c "
d={w.strip().lower() for w in open('/usr/share/dict/words')}
print('\n'.join(w for w in (l.split()[0].lower() for l in open('en_50k.txt') if l.strip()) if w in d))
" > en-clean.txt

node scripts/seed-typesense-words.mjs --lang en --file en-clean.txt \
  --host http://localhost:8108 --key devkey
```

Seeding is fast and idempotent — 234k words imported in ~3s locally, and re-running upserts rather than
duplicating, so it doubles as the refresh path.

**Keys** — `--key` on the seed script must be an **admin** key (creating collections and writing documents
are privileged) and stays on your machine. The app only ever gets a **search-only** key, which is safe to
embed in the bundle by design — the same model InstantSearch/Algolia use, and no different in trust terms
from this app already calling OpenLibrary/Datamuse directly.

**Verifying** — a typo'd query is the whole point, so test with one:

```bash
curl -H "X-TYPESENSE-API-KEY: devkey" \
  "http://localhost:8108/collections/words_en/documents/search?q=ambigous&query_by=word&prefix=true&num_typos=2&sort_by=_text_match:desc,rank:asc"
# -> ambiguous
```

Check a plain prefix too (`ephem`, `serend`) — that's what catches a badly-ordered list, since typo
correction can look fine while everyday typing returns obscure words.

### Testing the whole feature locally — a worked run

**Run 2026-09-20 on macOS against `typesense/typesense:30.2`.** Every number and every result
below is measured, not estimated. This is the full path from "nothing seeded" to "proven working
in the app," and it's also the regression check to re-run after touching
`typesense-api.ts`, `words-api.ts`'s fallback order, or the seed script.

#### 1. A node to develop against

```bash
docker run -d --name wb-typesense -p 8108:8108 -v "$PWD"/typesense-data:/data \
  typesense/typesense:30.2 --data-dir /data --api-key=devkey --enable-cors
curl -s http://localhost:8108/health      # {"ok":true}
```

`--enable-cors` matters only for Expo web; native builds don't need it. If a Typesense container
is already running for another project, seeding `words_*` alongside its collections is additive
and safe — just use that container's own admin key (`docker inspect <name> --format '{{json .Config.Env}}'`).

#### 2. Build the word list

The filter step is not optional-in-practice: it is the difference between beating Datamuse and
losing to it, for the reasons in the table above.

```bash
# one-time: git clone https://github.com/hermitdave/FrequencyWords
python3 -c "
d={w.strip().lower() for w in open('/usr/share/dict/words')}
print('\n'.join(w for w in (l.split()[0].lower() for l in open('FrequencyWords/content/2018/en/en_50k.txt') if l.strip()) if w in d))
" > en-clean.txt
```

**Measured:** 50,000 lines in → **24,297** out. The dropped ~51% is names, slang and misspellings —
exactly the entries that would otherwise match themselves exactly and outrank the real correction.

There's no `/usr/share/dict/words` equivalent for other languages, so a non-English list goes in
unfiltered (take the first token per line only). Results are still good — see the Dutch row below —
just slightly noisier.

#### 3. Seed

```bash
node scripts/seed-typesense-words.mjs --lang en --file en-clean.txt \
  --host http://localhost:8108 --key <ADMIN_KEY>
```

**Measured:** 24,297 docs in **0.7s**; 50,000 unfiltered Dutch docs in roughly the same. Fast enough
that re-seeding is a normal part of the loop, not a chore — and it upserts, so re-running is the
refresh path too.

#### 4. Verify at the API, before touching the app

```bash
curl -s -H "X-TYPESENSE-API-KEY: <ADMIN_KEY>" \
  "http://localhost:8108/collections/words_en/documents/search?q=ambigous&query_by=word&prefix=true&num_typos=2&per_page=6&sort_by=_text_match:desc,rank:asc"
```

**Measured results** — the top-6, in order, from the filtered 24k English index and the unfiltered
50k Dutch one:

| query | returns | what it proves |
|---|---|---|
| `ambigous` | `ambiguous` | typo correction; Datamuse (prefix-only) returns nothing here |
| `definately` | `definitely` | same, on the most common English misspelling |
| `recieve` | `received, receive, relieved, relieve, receiver` | correction **and** rank ordering — `reliever` no longer outranks `receive` |
| `seperate` | `separate, separates, separately` | the misspelling is absent from the index, so it can't match itself |
| `ephem` | `ephemeral` | plain prefix on a frequency-ordered list |
| `serend` | `serendipity` | same |
| `mel` | `mel, melissa, melody, melinda, melon, melancholy` | short prefixes stay useful rather than returning obscurities |
| `huis` (nl) | `huis, huiswerk, huiszoekingsbevel, huiszoeking, huiskamer, huisgenoten` | non-English works at all — impossible on the old path |
| `gezelig` (nl) | `gezellig, gezellige, gezelligheid, gezelliger` | typo tolerance is language-agnostic, no per-language config |
| `woordenboek` (nl) | `woordenboek` | long exact words don't drift |

**Latency:** `search_time_ms` of **0–2ms** across all of the above. The client's 3s
`SEARCH_TIMEOUT_MS` is there for the network, not for Typesense.

Always include a plain-prefix query (`ephem`, `serend`) alongside a typo'd one — typo correction can
look perfect while everyday typing returns junk, and only the prefix queries catch a badly-ordered
list.

#### 5. Make a search-only key

The admin key must never reach `.env.local` — it ends up in the bundle. Create a scoped one:

```bash
curl -s -H "X-TYPESENSE-API-KEY: <ADMIN_KEY>" -X POST http://localhost:8108/keys \
  -H 'Content-Type: application/json' \
  -d '{"description":"word-bank search-only","actions":["documents:search"],"collections":["words_.*"]}'
```

The response contains the full key **once** — copy it immediately; it's unrecoverable afterwards.

> ⚠️ **`collections` is a regex, not a glob.** `"words_*"` looks right and is accepted without
> error, but as a regex it means "`words` followed by zero or more underscores" — which does not
> match `words_en`. The resulting key fails **every** request with
> `Forbidden - a valid 'x-typesense-api-key' header must be sent`, which reads like a bad key
> rather than a bad scope, and sends you debugging the wrong thing. It must be **`"words_.*"`**.
> Verified: with `words_.*` the key searches `words_en` fine, and still gets `401` on a write and
> `401` on an unrelated collection.

#### 6. Point the app at it

Append to `.env.local`:

```
EXPO_PUBLIC_TYPESENSE_HOST=http://<your-mac-lan-ip>:8108
EXPO_PUBLIC_TYPESENSE_SEARCH_KEY=<the search-only key>
```

Use the LAN IP, not `localhost`, if a physical device is involved — same constraint as the other
two API URLs in that file. Then **restart Metro with `--clear`**: `EXPO_PUBLIC_*` values are inlined
at bundle time, so without it you test the previous bundle and conclude the feature is broken.

#### 7. Test in the app

Open any book → the add-word field. `useWordSuggestions` debounces 250ms, needs **2+ characters**,
and renders at most **6** chips.

| Do this | Expect |
|---|---|
| Type `ambigous` | chip `ambiguous` — the definitive "Typesense is live" tell, since the Datamuse fallback is prefix-only and returns nothing |
| Type `recieve` | `received` / `receive` lead, not `reliever` |
| Type `ephem` | `ephemeral` first |
| Switch the dictionary language to Dutch, type `huis` | real Dutch suggestions — dead on the old path |
| **Remove both env vars, `--clear`, retype `ambigous`** | no chips; English prefixes still work via Datamuse |

That last row is the one that's easy to skip and the one that matters for shipping: the entire
design promise is that unset env vars mean byte-for-byte the previous behaviour.

#### What this does *not* cover

A local node only proves the client and the index. A preview/production build still has the feature
off until the instance is publicly reachable and `eas.json` carries the two vars — see the Typesense
appendix in [`../../hosting.md`](../../hosting.md) for exposing it through the Cloudflare Tunnel, and
note the edge rate-limit it calls for: the search key ships in the bundle by design, so that
hostname is public the moment it resolves.


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
