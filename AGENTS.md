# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Codebase Architecture

Word Bank is an Expo (SDK 55) / React Native app using **expo-router** (file-based routing, typed routes), TypeScript, and AsyncStorage for all persistence. There is no backend in this repo. Network calls are: book search (OpenLibrary), word definitions (the self-hosted [wiktapi.dev](#dictionary-api-wiktapidev) instance + dictionaryapi.dev for English), as-you-type word suggestions on the book screen (wiktapi `/search` for non-English; the free **api.datamuse.com** suggest API for English — prefixes only, comparable surface to the existing dictionaryapi.dev lookups), an optional per-word "Translate to" lookup on the book screen (`translate.googleapis.com` — the unofficial, keyless Google Translate endpoint; sends only the word text and the two language codes, tap-to-reveal so it's never called automatically), and — opt-in — the [community word feed](#community-word-feed-word-bank-server): the app contributes each saved word plus its public dictionary values to the `word-bank-server` feed and reads back AI-generated word/book-title suggestions for placeholders. The one call that sends text the user wrote is the **Analyze a sentence** screen (`POST /analyze`), which is user-initiated per sentence and disclosed on screen — everything else sends only public dictionary data.

## Mental model

A **book** the user is tracking lives on the **read list** (`ReadListBook`, keyed by `key`) and carries a reading status (Want to read / Currently reading / Have Read). Each book has a separate **word collection** stored under `words_<key>`. The two are linked by the book `key`: adding words to a book automatically ensures the book is on the read list, and the read list shows each book's word count. The **Words List** tab flattens every book's words into one searchable view.

## Source layout (`src/`)

```
app/                         # expo-router routes (file = route)
  _layout.tsx                # Root: SafeAreaProvider > AppThemeProvider > KeyboardProvider > Stack
  book.tsx                   # /book — book detail (add/edit words, status, cover, meta). NOT a tab
  (tabs)/
    _layout.tsx              # Tab bar (ScrollProvider + FloatingActionButton); hides custom-book & about
    index.tsx                # "Search" tab — search OpenLibrary, browse results
    read-list.tsx            # "Read List" tab — saved books, filter by status
    words-list.tsx           # "Words List" tab — all words across books, searchable
    more.tsx                 # "More" tab — settings/about menu (card rows)
    about.tsx                # /about — reached from More (href: null, not a visible tab)
    custom-book.tsx          # /custom-book — create a manual book (href: null; opened via the FAB)
components/                  # presentational + small stateful UI
hooks/                       # reusable hooks
context/                     # React context providers
storage/                    # AsyncStorage wrappers (the data layer)
models/                     # TypeScript types + constant data
utils/                       # pure helpers + API clients
global.css                   # NativeWind semantic theme tokens (light @theme + dark media-query overrides)
styles/global.ts             # Colors (light/dark) for raw color-value props, ACCENT, Fonts (serif/mono/etc.)
```

## Routing

- `app/_layout.tsx` wraps everything in theme, keyboard, and safe-area providers; the root Stack hides headers and renders the `(tabs)` group.
- `app/(tabs)/_layout.tsx` defines the four visible tabs (Search / Read List / Words List / More) plus the per-tab header (with `ThemeToggle`). `custom-book` and `about` are registered with `href: null` so they're routable but not shown as tabs. The whole tab area is wrapped in `ScrollProvider` and overlaid with one shared `FloatingActionButton`.
- `book.tsx` is a stack route opened via `openBook(...)` ([utils/open-book.ts](src/utils/open-book.ts)), passing `key/title/author/year/cover_i` as params.

## Screens (`app/`)

| Screen | What it does | Key collaborators |
|---|---|---|
| `index.tsx` | Search books; renders results with infinite scroll | `useBookSearch`, `SearchBar`, `BooksList` |
| `book.tsx` | Add words (dictionary lookup + choose among multiple definitions), edit per-word sentence/notes, set reading status, pick cover, edit title/author/year, write a Book Notes + Review (both tap-to-edit) with a 0–5 star rating, jump-to-notes link. Keeps a growing multiline notes/review input above the keyboard (`keepInputAboveKeyboard`, native-only); placeholder suggestions come from AI-generated word suggestions; a successful add contributes the word to the community feed; a `LanguageModal` row picks the dictionary language (shared preference via `useSavedLanguage`) | `ReadStatusSelector`, `LanguageModal`, `DefinitionModal`, `StarRating`, `BookDetailSkeletons`, `CoverImage`, `words-storage`, `read-list-storage`, `words-api`, `words-feed-api`, `suggestions-api`, `pending-read-filter`, `useSavedLanguage` |
| `read-list.tsx` | List saved books (ordered by word count), filter by status, change status / remove / open. The status filter auto-selects after a status change — in-place, or via the `filter` route param `book.tsx` sends on "Update read list" | `ReadListItem`, `read-list-storage`, `getWordCounts` |
| `words-list.tsx` | Flatten all words across books, live word-text search, a **dynamic, colour-coded, multi-select part-of-speech filter** — one chip per POS actually present in the saved words (with counts; colours/labels shared with `DefinitionModal` via `utils/pos.ts`; hidden when ≤1 POS present), sort control (A–Z / Z–A / By book / Recently added, persisted via `words-list-storage`), tap to open the book. Each row also shows the word's saved sentence | `WordListItem`, `getReadList` + `getWords`, `utils/pos.ts`, `words-list-storage` |
| `custom-book.tsx` | Create a manual book (title/author/year/cover/status) then open it. Title field types out an AI-generated example title (in the saved dictionary language) as a placeholder, accepted on empty submit | `CoverImage`, `ReadStatusSelector`, `upsertReadListBook`, `useSavedLanguage`, `useTypewriterPlaceholder`, `suggestions-api` |
| `more.tsx` / `about.tsx` / `support.tsx` | Settings-style card menu: "Tools" (→ Analyze a sentence), "Your data" (export/import/**Delete all data**), "Sources" (book & dictionary providers in plain language; switching providers is a Pro-locked placeholder), "About" (About, **Support Word Bank ❤️**, source link, version/license), "Developer" (links to the actual APIs). `support.tsx` is its own donate/share screen (GitHub Sponsors/Liberapay/Ko-fi/Buy Me a Coffee links, "star on GitHub", native share sheet) — `href: null`, reached from More → About | `useScrollViewScroll`, `useBackTo`, `showActionSheet`, `clearAllBookData` |
| `analyze.tsx` | **/analyze** — paste a sentence, AI explains what it means in plain language. A `LanguageModal` row picks the language both the AI response and the "Try one" example sentences use (shared dictionary-language preference via `useSavedLanguage`); the Sentence field types out one AI-generated example sentence as a placeholder, and pressing "Analyze" on an empty field accepts it (same click-to-accept pattern as `SearchBar`/Words List, via `SearchButton`'s `suggestion`/`loadingLabel` props). Reopening a "Recent" entry (or landing on a fresh result) scrolls to top and briefly flashes an accent outline around the result card. Keeps the last 20 analyses locally; long-press to remove. `href: null`, reached from More → Tools | `AnalysisResult`, `LanguageModal`, `SearchButton`, `analyze-api`, `analysis-storage`, `suggestions-api`, `useSavedLanguage`, `useTypewriterPlaceholder`, `useScrollViewScroll`, `useBackTo`, `showActionSheet` |

## Components (`src/components/`)

| Component | Purpose |
|---|---|
| `BooksList` | `FlatList` of search results: pulsing skeletons while loading, infinite scroll, empty/retry states |
| `BookItem` | One search-result row (cover + title/author/year); opens the book |
| `CoverImage` | Cover with a pulsing skeleton, loading spinner, and graceful fallback on error |
| `ReadListItem` | `React.memo` card for a saved book: cover, status badge, word count, remove |
| `ReadStatusSelector` | Three-pill selector for Want / Currently reading / Have Read |
| `WordListItem` | `React.memo` card on the Words List: word + phonetic + part of speech + definition + the saved sentence (when present) + source-book label |
| `ClearableTextInput` | `TextInput` wrapper with a ✕ button that appears while there's text and clears the field; reused by all search/add inputs |
| `SearchButton` | The accent action button shared by Search, Words List, and Analyze. `label`/`loadingLabel` customize the idle/loading text (defaults `"Search"`/`"Searching"`); `suggestion` (the live typewriter word/title/sentence) echoes what an empty-field press will actually submit, e.g. `Analyze "…"` |
| `SearchBar` | Book search field; types out an AI-generated example title (in the saved dictionary language, via `useSavedLanguage`) as a placeholder, accepted on empty submit |
| `LanguageModal` | Bottom-sheet dictionary-language picker with search; a self-contained trigger row (label + current selection) + the picker itself. Reused on `book.tsx` (dictionary language + "Translate to") and `analyze.tsx` |
| `DefinitionModal` | Bottom-sheet picker to search and switch among a word's definitions, grouped under part-of-speech headers color-coded via the shared `utils/pos.ts` palette (same colours as the Words List filter) |
| `FloatingActionButton` | Scrolls to top when scrolled; otherwise opens a context-aware "Add a book" action sheet (Search for a book / Add a custom book), omitting whichever option matches the current screen |
| `CoverPlaceholder` | Book-glyph placeholder shown for a book with no cover image |
| `StarRating` | 0–5 star rating row (`IconSymbol` `star`/`star.fill`); interactive (tap to set, tapping the current value clears it) when given `onChange`, otherwise a read-only display. Used for the book screen's review rating and its Read List display |
| `BookDetailSkeletons` | Pulsing (`usePulse`) placeholder set for `book.tsx` while its data loads: `WordCardSkeletons`, `ReadStatusSkeleton`, `SaveButtonSkeleton`, `WordCountSkeleton`, `NoteCardSkeleton` — each mirrors the real content's layout so nothing flashes a default value before loading |
| `AnalysisResult` | Purely presentational result card for `analyze.tsx`: the quoted sentence + the AI's plain-language "Meaning" |
| `ActionSheetBridge` | Root-mounted (in `_layout.tsx`) bridge that backs the imperative `showActionSheet` helper, themed for dark mode |
| `ThemeToggle` | Header light/dark switch |
| `ui/IconSymbol(.ios)` | SF Symbols on iOS, Material-icon fallback elsewhere |

> **Lists & performance:** the Read List and Words List render **local** data through `FlatList`, which already virtualizes (only visible rows render). They intentionally have **no infinite scroll** — that pattern exists only for the **remote, paginated** book search (`useBookSearch` → OpenLibrary `offset`/`limit`). If a local list ever feels slow, tune `FlatList` (`initialNumToRender`, `windowSize`, `removeClippedSubviews`, `getItemLayout`) rather than paginating.

## Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useBookSearch` | OpenLibrary search: paginated `loadMore`, abortable, `searched`/`loadingMore`/error flags |
| `useFlatListScroll` / `useScrollViewScroll` | Register a scroll-to-top callback + report scroll position to `ScrollProvider` (drives the FAB). Both share one internal `useScrollRegistration` |
| `usePulse` | Reanimated opacity-pulse style for loading skeletons |
| `useTypewriterPlaceholder(words, active)` | Types out one example word/title/sentence then stops; returns `{ text, word }` so a screen can show `text` as the placeholder and accept `word` on Enter/empty-submit. Pauses when `active` is false (field non-empty or screen blurred) |
| `useWordSuggestions(input, langCode, enabled)` | Debounced (250ms) as-you-type dictionary suggestions for the add-word input: min 2 chars, max 6, AbortController-per-request, `[]` on any failure. Backs the suggestion chip row on the book screen |
| `useSavedLanguage()` | Restores the saved dictionary language from AsyncStorage on mount; returns `{ language, languageReady, setLanguage }` — `language` defaults to `LANGUAGES[0]` until `languageReady` flips true, and `setLanguage` updates state **and** persists via `setLanguageCode`. One restore per mount, shared by `book.tsx`, `analyze.tsx`, `custom-book.tsx`, and `SearchBar.tsx` — only `book.tsx` also calls the setter (via its `LanguageModal`), the rest are read-only |
| `useBackTo(href)` | Routes the Android hardware/gesture back press to `href` while the screen is focused, instead of the default back behavior. No-op on iOS/web (no hardware back button). Used by screens reached from a fixed place (e.g. `analyze.tsx`/`support.tsx` → back to `/more`) so back doesn't depend on navigation history |

## Context (`src/context/`)

- `theme-context.tsx` — `AppThemeProvider`, `useTheme()`, `useColorScheme()`. Restores the saved theme via `theme-storage` on launch (defaulting to the system scheme) and persists every toggle.
- `scroll-context.tsx` — `ScrollProvider`, `useScrollContext()`. Holds `scrollY` + a `scrollToTop` callback that screens register and the FAB consumes.

## Data layer (`src/storage/`, all AsyncStorage)

| Module | Keys | Exports |
|---|---|---|
| `storage.ts` | — | `getJSON(key, fallback)` / `setJSON(key, value)` — shared parse/stringify helpers |
| `read-list-storage.ts` | `read_list` | `getReadList` (runs one-time migrations, see below), `setReadList`, `upsertReadListBook`, `removeReadListBook`, `setReadBookStatus`, `clearAllBookData` |
| `words-storage.ts` | `words_<bookKey>` | `getWords`, `setWords`, `removeWords`, `getWordCounts` (batched `multiGet`) |
| `language-storage.ts` | `dictionary_language`, `translation_language` | `getLanguageCode`/`setLanguageCode` (the dictionary language — see `useSavedLanguage`), `getTranslationLanguageCode`/`setTranslationLanguageCode` (the book screen's independent "Translate to" preference) |
| `analysis-storage.ts` | `sentence_analyses` | `getAnalysisHistory`, `addAnalysis`, `removeAnalysis`, `clearAnalysisHistory` — the last 20 sentence analyses, newest first |
| `words-list-storage.ts` | `words_list_sort` | `getSortMode`/`setSortMode` — the Words List's persisted sort choice (`SortMode`: `'az' \| 'za' \| 'book' \| 'recent'`, `SORT_MODES` lists them) |
| `theme-storage.ts` | `app_theme` | `getTheme`, `setTheme` (light/dark choice) |

`upsertReadListBook` takes `Omit<ReadListBook, 'addedAt'>` — `addedAt` is owned by storage (stamped on insert, preserved on update).

`clearAllBookData` (used by More → "Delete all data") removes every book's `words_<key>` entry and empties `read_list`, leaving settings (theme, dictionary language) intact.

### Data migrations

`getReadList` rewrites data left over from older app versions, on load. Current migrations:
- reading status value `reading` → `currently_reading`
- book-level field `notes` → `bookNotes`

The pass is **idempotent and self-erasing**: it only writes back when something actually changed, so after the first launch on a migrated build it's a cheap no-op.

**Why it's needed:** installing a new APK with the **same package id** is an *update* — AsyncStorage is preserved — so books saved before a rename survive on the device and must be migrated. Without the migration those books aren't deleted, but a pre-rename `reading` book shows a blank/broken status badge and falls out of the "Currently reading" filter (until its status is re-picked), and notes saved under the old key stop displaying.

**When it can be removed:** once every install has opened a migrated build at least once (or after a fresh package id / clean reinstall, which start with empty storage). It's then safe to delete in a later release; until you're sure, leaving it in costs almost nothing. For retiring future migrations cleanly, consider a stored `schema_version` so old steps can be dropped once the minimum version has moved past them.

## Models (`src/models/`)

- `book.ts` — `Book` (OpenLibrary search result shape).
- `read-list-book.ts` — `ReadListBook` (incl. optional book-level `review?`, `bookNotes?` — the latter renamed from `notes` — and `rating?` — a 0–5 star rating, see `StarRating`), `ReadStatus` (`'want' | 'currently_reading' | 'read'`), plus `READ_STATUS_LABELS` / `READ_STATUS_ORDER`.
- `word-entry.ts` — `WordEntry` (word, phonetic, the selected partOfSpeech/definition/exampleSentence, the full `definitions` list + `selectedDefinition` index, the user's sentence/notes, and optional `addedAt` timestamp for "Recently added" sorting), `WordDefinition` (one candidate meaning), and `EditDraft`.
- `language.ts` — `Language` + the full `LANGUAGES` list used by the dictionary picker.
- `sentence-analysis.ts` — `SentenceAnalysis` (currently just `{ meaning: string }` — the server only ever returns a plain-language meaning, see `analyze-api.ts`) and `AnalysisHistoryEntry` (`text`/`lang`/`analysis`/`createdAt`, as kept by `analysis-storage.ts`).

## Utils (`src/utils/`)

- `words-api.ts` — `fetchDefinition(word, lang)`: routes English to dictionaryapi.dev, everything else to the self-hosted wiktapi.dev instance (see [Dictionary API](#dictionary-api-wiktapidev)). Returns a `WordEntry` with **all** definitions flattened into `definitions[]` (deduped, capped at 50), the first selected by default. Also `fetchWordSuggestions(prefix, lang, limit?, signal?)` — as-you-type prefix suggestions (Datamuse for English, wiktapi `/search` otherwise; `[]`-on-failure, abortable) — and `suggestCorrections(failedWord, lang)` — "Did you mean?" candidates for a failed add: prefix-fetch ~50 words sharing the typo's first 3 chars, rank by Damerau-Levenshtein (`utils/edit-distance.ts`), keep distance ≤ 2, top 3. Known limits: typos in the first two chars find nothing; Datamuse's vocab contains some misspellings (a tapped one just fails validation into did-you-mean again).
- `edit-distance.ts` — `damerauLevenshtein(a, b)`: pure edit-distance with adjacent transpositions (so "recieve" → "receive" is 1), used to rank did-you-mean candidates.
- `translate-api.ts` — `translateWord(word, from, to, signal?)`: tap-to-reveal word translation via the unofficial `translate.googleapis.com` endpoint (free, no key). Returns `null` on any failure, including the endpoint's quirk of echoing back untranslatable input as its own "translation" — treated the same as "not found."
- `pos.ts` — part-of-speech helpers shared by the Words List filter and `DefinitionModal` so colours/labels stay consistent: `POS_COLORS`, `normalizePos` (folds source variants — `adj`→`adjective`, `adv`→`adverb`, …), `posColor`, `posLabel`, `POS_ORDER`.
- `dict-utils.ts` — `timedFetch` (8s timeout with friendly errors).
- `cover-uri.ts` — `coverUri(coverI, size)`: local image as-is, otherwise an OpenLibrary cover URL.
- `open-book.ts` — `openBook(params)`: the single place that navigates to `/book`.
- `pick-cover-image.ts` — `pickCoverImage()`: camera-or-library prompt (uses `expo-image-picker`).
- `show-action-sheet.ts` — `showActionSheet()`: backed by `@expo/react-native-action-sheet` via a root `ActionSheetBridge` (themed for dark mode), so it supports any number of options on both platforms (Android is no longer capped at 3 buttons like `Alert`). Keeps a plain imperative API so it's callable from non-component code; falls back to native iOS sheet / `Alert` if the bridge isn't mounted.
- `alert-dialog.ts` — `alertDialog(title, message?)`: platform-safe alert (`window.alert` on web, native `Alert` on iOS/Android).
- `pending-read-filter.ts` — `setPendingReadFilter` / `consumePendingReadFilter`: module-level handoff of a reading status chosen on the book screen to the Read List, which auto-selects that filter next time it's focused (covers back-button returns, not just the "Update read list" button).
- `words-feed-api.ts` — `postWordToFeed(word, meta?)`: fire-and-forget contribution of a saved word + its **public** dictionary values (definition / part of speech / phonetic) to the feed. Never throws (failures swallowed); sends **no** sentence, notes, book, or identity; opt-in via `EXPO_PUBLIC_WORDS_FEED_API_URL`.
- `feed-api-base.ts` — `FEED_API_BASE_URL` + `FEED_REQUEST_TIMEOUT_MS`: the one place the `word-bank-server` host is resolved (env var, else a platform-aware localhost — `10.0.2.2` on the Android emulator). Every client of that server imports it instead of re-deriving it. Note `words-api.ts` keeps its own base URL — that's the *dictionary* API on a different port/env var.
- `analyze-api.ts` — `analyzeSentence(text, lang, signal?)`: sentence analysis via the server's `POST /analyze` (see [community server](#community-word-feed-word-bank-server)). `null` on any failure, `'rate-limited'` on a `429` (distinguished so the screen can show a more accurate message), never throws; a **25s** timeout rather than the usual 5s since the server has no cache — every call waits on a full live LLM round trip. Re-validates the payload client-side (rebuilds `{ meaning }` from known fields rather than trusting the raw response). This is the only call in the app that sends text the user wrote — see the privacy note below.
- `suggestions-api.ts` — `fetchSuggestions(lang?)`: AI-generated word + book-title + example-sentence suggestions via the server's `GET /v1/suggestions` (see [community server](#community-word-feed-word-bank-server)). Resolves to `{ words: [], titles: [], sentences: [] }` on any failure, never throws; a **20s** timeout since the server fires parallel, uncached LLM completions per request — a cold call costs one round trip, but each list is verbose (up to 80 words / 40 titles / 3 sentences). Successful non-empty results are cached in memory per `lang` for the app session (never the empty/failure case), so reopening a screen (e.g. `book.tsx`, opened per book; `analyze.tsx`) doesn't re-trigger a live, unrate-limited LLM call every time. Consumed by `book.tsx` (words), `SearchBar.tsx`/`custom-book.tsx` (titles), and `analyze.tsx` (sentences).

## Styling / theming convention

Styling uses **NativeWind v5** (`className`, Tailwind v4). Dark mode is driven by **semantic CSS-variable tokens** defined in [global.css](global.css): a light `@theme` block plus a `@media (prefers-color-scheme: dark)` block that redefines the same `--color-*` vars. Use the semantic utilities everywhere — `bg-background`, `bg-card`, `bg-input`, `text-fg`, `text-secondary`, `text-muted`, `text-body`, `text-meta`, `text-faded`, `border-border`, `border-border-input`, `border-border-edit`, `bg-accent`/`text-accent`, `text-error`, etc. — so a single class flips automatically between light and dark. The persisted theme toggle is bridged to NativeWind in [theme-context.tsx](src/context/theme-context.tsx) via `Appearance.setColorScheme(...)`, so the manual choice (not just the OS) drives the flip.

**What stays as `style` (not `className`):** reanimated/`Animated` animated styles (e.g. `usePulse` in [CoverImage.tsx](src/components/CoverImage.tsx)/[BooksList.tsx](src/components/BooksList.tsx)/[FloatingActionButton.tsx](src/components/FloatingActionButton.tsx)), `StyleSheet.absoluteFill`, safe-area-inset paddings, RN-only props (`textAlignVertical`, `includeFontPadding`), color-value props (`placeholderTextColor`, `ActivityIndicator`/icon `color`), and inline `fontFamily: Fonts.*`. Third-party components without `className` support (e.g. `KeyboardAwareScrollView`) keep `style`/`contentContainerStyle` and are wrapped in a `bg-background` `View` for theming. Dynamic per-status styling (e.g. [ReadListItem.tsx](src/components/ReadListItem.tsx)) uses small `className` record maps.

### ⚠️ Never pad a `TextInput` with `px-*` / `py-*`

Use `p-*`, or the physical edges `pt-/pr-/pb-/pl-*`. **Not** `px-*`/`py-*`/`ps-*`/`pe-*` — those silently do nothing on Android.

Why: Tailwind v4 emits CSS *logical* properties for `px-`/`py-`, and NativeWind compiles them to RN's `paddingInline`/`paddingBlock` (verify any class with `compile()` from `react-native-css/compiler`). RN's Android `TextInput` decides whether to apply the **platform `EditText` theme padding** by checking only the legacy prop names — `padding`, `padding{Horizontal,Vertical}`, `padding{Left,Right,Top,Bottom,Start,End}` (see `AndroidTextInputComponentDescriptor.h` + `AndroidTextInputProps.cpp` in `node_modules/react-native`). `paddingInline`/`paddingBlock` aren't on that list, so Android concludes "no padding was set" and injects the theme's `EditText` padding on `Edge::Start/End/Top/Bottom`. Yoga resolves a specific edge ahead of `Edge::Horizontal`/`Vertical`, so the theme value **wins over the class** — the input renders with Android's default `EditText` padding (~4dp horizontally) while iOS honours the class. `p-*` maps to `padding` and the physical edges map 1:1, so both are seen and no theme padding is injected.

This is why the multiline notes/review inputs (`p-2.5`) were always consistent while the single-line search fields were not.

### ⚠️ A single-line `TextInput` must not carry a line-height **on iOS**

Size single-line inputs as `text-[14px] android:leading-[21px]` rather than `text-base` — an arbitrary size (which emits `fontSize` alone) plus the line-height re-added for Android only. The book-screen meta fields use the `text-sm` equivalent, `text-[12.25px] android:leading-[17.5px]`.

Why iOS only: Tailwind's named sizes bundle a `line-height` (`text-base` → `fontSize: 14` **and** `lineHeight: 21`). On iOS the typed value and the placeholder take different rendering paths — typed text becomes an attributed string where `lineHeight` is applied as `NSParagraphStyle.minimum/maximumLineHeight` (`RCTAttributedTextUtils.mm`), dropping the baseline to the bottom of the line box, while the placeholder is a plain `NSString` (`RCTTextInputComponentView.mm`) that UIKit centers — so the placeholder looks centred and typed text sits visibly lower. Android renders it centred either way, so it keeps the line-height and its previous appearance exactly.

The odd numbers are the previous values preserved: NativeWind resolves `1rem` to **14px** (RN's default font size), so `text-base` is 14px/21 and `text-sm` is 12.25px/17.5 — not 16/14. Verify any class with `compile()` from `react-native-css/compiler`; the `android:` variant compiles to a real platform condition (`m: [['=','platform','android']]`).

**Multiline** inputs (`p-2.5 text-sm` book notes / review / sentence) keep the plain paired line-height on both platforms — it sets line spacing, and top-aligned text has nothing to be centred against.

Raw color values still come from `Colors[scheme]` (indexed via `useColorScheme()`) for the cases above. `ACCENT`, `Colors`, and `Fonts` live in [styles/global.ts](src/styles/global.ts). `Fonts` maps semantic roles (`serif`, `mono`, `sans`, `rounded`) to platform font families — currently `Fonts.serif` for book titles and `Fonts.mono` for phonetics/IPA and the language code.

## Code style

Shared with the sibling `word-bank-server` and `word-bank-site` repos:

- **Guard clauses, not nested conditionals.** Validate/reject early and return, rather than
  nesting the "happy path" inside `if`/`else`. See `sanitizeWord` in `word-bank-server`'s
  [`src/word/words.ts`](../word-bank-server/src/word/words.ts) for the canonical shape: one
  `if (...) { return null; }` per rule, all at the same indentation level.
- **Every `if`/`for`/`while` body is braced**, even single-statement ones — no one-liners
  like `if (x) return null;`. Enforced by ESLint's `curly: ["error", "all"]` rule in
  [`eslint.config.js`](eslint.config.js); run `npm run lint` before committing.
- **JSDoc on every function** — see "Code comment style" below for the exact shape.

## Code comment style

This is the personal JSDoc style to use for new code throughout this project — the same style already used in the sibling `word-bank-server` and `word-bank-site` repos, so it's shared across all three (in `word-bank-site` it's scoped to `.ts` files and `.astro` frontmatter — see that repo's own AGENTS.md). See [src/storage/analysis-storage.ts](src/storage/analysis-storage.ts) as the canonical example here:

- **File header:** a `//` line comment (one or more lines, not `/**`) describing what the module does, placed after the imports, before the first constant/export.
- **Every function gets a `/** */` JSDoc block — exported or not, component or plain helper, top-level or nested.** `/**` alone on its own opening line, description starting on the next line (multi-line prose is fine).
- A blank `*` line separates the description from the tags, and another blank `*` line comes right before the closing `*/`.
- **`@param {Type} name Description.`** — one per parameter, restating the TypeScript type in braces (mirrors `word-bank-server`'s convention even though TS already has the type), description capitalized with a trailing period. Optional params use `[name]` (e.g. `@param {CompleteOptions} [options] ...`).
- **`@returns {Type} Description.`** — plural `@returns`, type in braces. For async functions the type is the literal `Promise<...>` (e.g. `{Promise<AnalysisHistoryEntry[]>}`), and the description covers the resolved value (including any fallback like `` `[]` if none or unreadable ``) — don't separately narrate rejection/failure modes, matching `word-bank-server`.
- Plain `//` line comments are still right for in-line "why" notes *inside* a function body — the JSDoc block above it is for what the function does/takes/returns, not a replacement for those.

Example:
```ts
/**
 * Reads back the past analyses, newest first.
 *
 * @returns {Promise<AnalysisHistoryEntry[]>} The list of entries (newest first, capped), or `[]` if none or unreadable.
 *
 */
export async function getAnalysisHistory(): Promise<AnalysisHistoryEntry[]> { ... }
```

Apply this style whenever adding new functions of any kind, including in files that don't yet use it.

# Development & Build Flow (start here)

Two tracks: **local** for fast personal iteration, **EAS cloud** for anything you distribute. The short version of the normal loop: `npm run dev` every day → `npm run android`/`ios` only when you touch native → `build:apk:local:preview` to sideload a real build → EAS (`build:apk`) only when handing it to someone else.

## 1. Daily development (99% of the time)
Dev client + Metro; JS/UI changes hot-reload, no rebuild.
```bash
npm run dev                 # both emulator + iOS simulator
npm run dev-client:android  # Android only
npm run dev-client:ios      # iOS only
npm run dev-client:physical # your phone (scan QR)
```
All pinned to `APP_VARIANT=development` → the `.dev` client. API comes from `.env.local` (your LAN IP) via Metro — edit it, relaunch (`--clear` is already included).

## 2. After adding/removing a native package or changing `app.config.js`
Native changes can't hot-reload — rebuild & install the dev client once, then go back to step 1:
```bash
npm run android   # builds + installs .dev client on emulator, starts dev server
npm run ios        # same for iOS simulator
# EAS equivalents: npm run build:dev / build:dev:ios
```
(Example: the camera permission needs this — "Take Photo" won't work until a rebuild.)

## 3. A standalone build to sideload to yourself → local (fast, free, no account)
```bash
npm run build:apk:local:preview   # → builds/preview/app-release.apk  (standalone, "just works")
npm run build:apk:local:dev       # → builds/dev/app-debug.apk         (dev client, needs Metro)
npm run build:apk:local:all       # both
```
Pass an HTTPS API URL: `EXPO_PUBLIC_DICT_API_URL=https://… npm run build:apk:local:preview`. These restore the dev variant when done, so `npm run dev` keeps working after.

## 4. Distribute to testers or the store → EAS cloud
```bash
npm run build:apk        # preview APK for internal testers (managed keystore, downloadable)
npm run build:all        # dev client, both platforms
eas build --profile production --platform android   # store build
```
Cloud builds **ignore `.env.local`** — the URL comes from `eas.json` `env` (replace the `https://your-api.example.com` placeholder). Required for **iOS** distribution (signing/TestFlight) and OTA channels.

## 5. Push a JS-only fix to existing tester builds → OTA
```bash
npm run update:preview   # eas update, no rebuild
```
Only for JS/UI changes on builds already made for that channel. Native changes (step 2) need a new build.

## Quick decision: local vs cloud
| Goal | Use |
|---|---|
| Daily coding | `npm run dev` (step 1) |
| After a native/config change | `npm run android` / `ios` (step 2) |
| Quick APK for *yourself* | **Local** `build:apk:local:preview` |
| APK for *other people* / Play Store | **EAS** `build:apk` / production |
| iOS build for a real device | **EAS** (signing) |
| Patch JS on existing testers | OTA `update:preview` |

## The API URL, per context
- **Dev** → `.env.local` LAN IP (run the server with `HOST=0.0.0.0`, same Wi-Fi).
- **Local preview APK** → pass HTTPS inline at build time.
- **EAS builds** → `eas.json` `env` (deployed HTTPS URL).
- Release/standalone builds **block cleartext HTTP** — anything non-dev must be HTTPS.

# NPM Scripts

## Development
| Script | Description |
|---|---|
| `npm start` | Start Metro bundler (web only, no device) |
| `npm run android` | Local build and run on Android emulator (no EAS) |
| `npm run ios` | Local build and run on iOS simulator via Xcode (no EAS, no Apple account needed) |
| `npm run web` | Start in browser |
| `npm run dev` | Start dev server and open on both Android emulator and iOS simulator |
| `npm run dev-client:physical` | Start dev server for the installed dev client app (Can be tested on physical device, own phone) |
| `npm run dev-client:android` | Start dev server and open on Android emulator |
| `npm run dev-client:ios` | Start dev server and open on iOS simulator |
| `npm run lint` | Run ESLint |

## Builds (EAS — takes 10–20 min)
| Script | Description |
|---|---|
| `npm run build:dev` | Build Android dev client (install once per native change) |
| `npm run build:dev:ios` | Build iOS dev client (install once per native change) |
| `npm run build:android` | Build Android dev client |
| `npm run build:ios` | Build iOS dev client |
| `npm run build:all` | Build dev client for both platforms |
| `npm run build:apk` | Build preview APK for internal tester distribution |

## Local APK builds (no EAS, no cloud, no device)

Build an installable Android APK entirely on your Mac via `expo prebuild` + Gradle — no Expo cloud, no EAS account, and **no connected device/emulator required**. Each script regenerates the native `android/` project with its own `APP_VARIANT`, runs Gradle, then copies the APK into a per-script folder under `builds/` (gitignored).

| Script | Output | Notes |
|---|---|---|
| `npm run build:apk:local:dev` | `builds/dev/app-debug.apk` | Debug **dev client** — does *not* bundle JS; needs Metro running on the same Wi-Fi to load the app. Package `com.jensrot.wordbank.dev`. |
| `npm run build:apk:local:preview` | `builds/preview/app-release.apk` | **Standalone** release APK — JS bundled in, runs offline. Copy to a phone and it just works. Package `com.jensrot.wordbank.preview`. |
| `npm run build:apk:local:all` | both of the above | Runs dev then preview back-to-back. They can't run in parallel — both wipe/regenerate the shared `android/` folder, so they must be sequential. |

> The `preview` script (and therefore `:all`) ends by running `APP_VARIANT=development expo prebuild --platform android --clean --no-install` to **restore the dev variant** of the native folder. Without this, the folder would be left stamped `.preview` and `npm run dev` would fail (see Build Variants → native-folder drift).

**Prerequisites:** JDK 17, Android SDK (`ANDROID_HOME` set), and the NDK the project pins (`27.1.12297006`). If a build fails with `[CXX1101] NDK ... did not have a source.properties file`, an NDK auto-download was still in progress — just re-run once it finishes.

**Install the result:**
```bash
adb install -r builds/preview/app-release.apk          # onto a running emulator/device
```
Or copy the `.apk` to a phone and tap it (enable "install from unknown sources").

**Signing:** the Expo/RN template signs release with the debug keystore by default, so `app-release.apk` installs on any device for personal/tester use. A real keystore is only needed for the Play Store.

⚠️ **API URL gotcha:** `EXPO_PUBLIC_DICT_API_URL` is inlined into the JS bundle at Gradle build time (read from `.env`/env). A **release** APK blocks cleartext HTTP, so a `localhost`/LAN URL won't work — pass an HTTPS URL for the preview build:
```bash
EXPO_PUBLIC_DICT_API_URL=https://your-api npm run build:apk:local:preview
```

**vs. EAS:** `npm run build:apk` (cloud, 10–20 min, managed keystore, downloadable artifact) is still the path for distributing to testers. The local scripts are for fast, offline, throwaway builds. `eas build --local --platform android --profile preview` is a middle ground — runs on your machine but honours `eas.json` profiles/env.

## OTA Updates
| Script | Description |
|---|---|
| `npm run update:preview` | Push JS/UI changes to preview testers without a full rebuild |

# Development Workflow (without Expo Go app)

## Why not Expo Go app?

This project uses **SDK 55**. Expo Go on the Play Store only supported SDK 54 at the time of development — it did not update in time for Android 16 devices. Additionally, `react-native-keyboard-controller` is a native library that requires a custom build and cannot run inside Expo Go regardless of SDK version.

For these reasons the project uses a **development client** — a custom APK built via EAS that includes the exact SDK and native libraries this project needs.

## First-time setup (only needed once, or when adding new native packages)

**1. Build the dev client APK:**
```bash
npm run build:dev
```
When the build finishes, install the APK on your Android device from the EAS build page at expo.dev.

**2. Start the dev server:**
```bash
npm run dev-client:physical
```

**3. Open the dev client app on your phone** — it looks similar to Expo Go but is your own custom build. On its home screen there is a QR scanner.

**4. Scan the QR code** shown in your terminal. Your app loads with full hot reload.

## Dev client: cloud vs local build give the same result

Once installed, scanning the QR behaves **identically no matter how the dev client was built** — the build source doesn't change runtime behavior. All of these produce the same `.dev` dev client that loads JS from Metro at scan time:

| Build method | Notes |
|---|---|
| EAS `npm run build:dev` | Cloud, EAS-managed keystore, downloadable artifact (easy to share with someone who can't build it) |
| `npm run android` / `ios` | Built locally + auto-installed on the connected device/simulator |
| `npm run build:apk:local:dev` | Local `.dev` APK file — install manually, then scan the QR |

Because a dev client pulls **all JS (and the API URL) from Metro** at runtime, the running app is the same; only the build *environment*, signing keystore, and convenience differ.

**Caveats — "same" only holds when:**
- **Native parity:** both built from the same Expo SDK, native packages, and `app.config.js`. Add a native package (e.g. the camera permission) and an older dev client is missing that native code → JS crashes when it reaches it. Rebuild after any native change (step 2 of the flow at the top).
- **Same variant:** the `npm run dev` QR is `.dev`; the installed client must also be `.dev` (all the above are). A `.preview`/production client won't connect.
- **API URL comes from Metro**, not the APK — read from `.env.local` at bundle time. (Opposite of a standalone/preview APK, where it's baked in.)
- **Physical-device basics:** phone + Mac on the same Wi-Fi, and the API server on `HOST=0.0.0.0` if you're hitting it.

**Rule of thumb:** for your *own* device, build locally (`npm run android` or `build:apk:local:dev`) — faster and free. Use EAS `build:dev` only to hand the dev client to someone who can't build it themselves.

## Daily development

Run `npm run dev-client:physical` (or `npm run dev` for both platforms at once), open the dev client app and scan the QR code. No rebuild needed unless you add a new native package.

## Troubleshooting

**"No development build installed" error:**
The dev client APK is not installed on the emulator/device. Install it, after wiping the data in Android Studio fron the emulator:
```bash
npx eas build:run --platform android --profile development
```

**Changes not appearing on device:**
Metro is serving a cached bundle. The `--clear` flag is already included in `npm run dev-client:physical` and `npm run dev-client:android` to prevent this.

**"Port 8081 is already in use":**
A previous Metro server is still running. Kill it:
```bash
kill $(lsof -t -i:8081)
```

**App not connecting after opening emulator:**
Manually open the dev client app on the emulator, then enter the URL shown in the terminal (e.g. `http://192.168.0.205:8081`). Or force open via ADB:
```bash
adb shell am start -a android.intent.action.VIEW -d "exp+word-bank://expo-development-client/?url=http%3A%2F%2F192.168.0.205%3A8081"
```

## Build times

EAS builds typically take **10–20 minutes** for Android. The first build is slower as EAS sets up the environment fresh — subsequent builds are faster due to caching.

# Development & Preview Flow

## Android

### Development
1. Build the dev client once (or after every native package change):
   ```bash
   npm run build:dev
   ```
2. Install the APK from expo.dev on your device or emulator.
3. Daily: `npm run dev-client:android` — no rebuild needed for JS/UI changes.

### Preview (sharing with testers)
1. Build a preview APK:
   ```bash
   npm run build:apk
   ```
2. Share the download link from expo.dev — testers install it directly, no Play Store needed.
3. For JS/UI-only updates push OTA instead of rebuilding:
   ```bash
   npm run update:preview
   ```

## iOS

### Development (no Apple account needed)
1. Build and run locally on the simulator via Xcode:
   ```bash
   npm run ios
   ```
   Re-run this after any native package change.
2. Daily: `npm run dev-client:ios` — no rebuild needed for JS/UI changes.

### Preview (requires paid Apple Developer account — $99/year)
- TestFlight distribution requires a paid account. Without one, iOS distribution to others is not possible.
- For your own device: free Apple account allows sideloading via Xcode, but the certificate expires every 7 days.

## Decision: when to rebuild vs. OTA (Over-the-air) update

| Change type | Action |
|---|---|
| JS/UI only | `npm run update:preview` (OTA, instant) |
| Added/removed a native package | Full rebuild required |
| Changed `app.config.js` native config | Full rebuild required |
| Bumped `version` in `package.json` | Full rebuild required |

# Build Variants

The project uses `app.config.js` (not `app.json`) to set a different app name and package ID per build profile. This allows the development and preview builds to coexist on the same device.

| Profile | App name | Android package |
|---|---|---|
| `development` | Word Bank (Dev) | `com.jensrot.wordbank.dev` |
| `preview` | Word Bank (Preview) | `com.jensrot.wordbank.preview` |
| `production` | Word Bank | `com.jensrot.wordbank` |

The variant is controlled by the `APP_VARIANT` environment variable. `app.config.js` only special-cases `development`/`preview`; any other value (including `production`) yields the base name/package.

- **EAS cloud builds** set it per profile via `eas.json` → `env` (`development` / `preview` / `production`).
- **Local dev scripts** (`dev`, `dev-client:*`, `android`, `ios`) pin `APP_VARIANT=development` inline in `package.json`, so they always target the `.dev` client regardless of your shell.
- **Local APK scripts** set it inline too (`build:apk:local:dev` → development, `build:apk:local:preview` → preview).

## EAS build profiles (`eas.json`)

[eas.json](eas.json) defines three cloud build profiles. Each sets its own `env` — `APP_VARIANT` (→ the name/package above) and `EXPO_PUBLIC_DICT_API_URL` (→ the dictionary backend, needed because **cloud builds ignore `.env.local`**).

| Profile | `distribution` | Android type | `channel` | Extra |
|---|---|---|---|---|
| `development` | internal | (default) | development | `developmentClient: true` — dev client that loads JS from Metro |
| `preview` | internal | `apk` | preview | Standalone APK for internal testers (`npm run build:apk`) |
| `production` | store (default) | app bundle (default) | production | `autoIncrement: true` bumps the build number each build |

What the keys do:
- **`env.APP_VARIANT`** — picks the app name/package (see variant table above).
- **`env.EXPO_PUBLIC_DICT_API_URL`** — the API URL baked into the JS bundle at build time. `preview`/`production` currently hold a **placeholder** (`https://your-api.example.com`); replace with the deployed HTTPS URL before a cloud build is useful.
- **`channel`** — ties the build to an EAS Update channel so `eas update` can OTA-patch it later.
- **`distribution: internal`** — installable via a direct link, no store; `production` omits it to target the store.
- **`autoIncrement` + `appVersionSource: "remote"`** (top-level `cli`) — EAS tracks and increments the production build number server-side.

> The `production` profile was added this round — your earlier Play Store builds used a "production" profile that wasn't in this file, so they relied on defaults. It's now explicit.

⚠️ Cloud builds read these from `eas.json` (or EAS dashboard env vars), **never `.env.local`** — that file applies only to `npm run dev` and the local `build:apk:local:*` scripts.

⚠️ **Shell-leak gotcha:** a leftover `export APP_VARIANT=preview` (e.g. from a manual build) hijacks any command that doesn't pin its own variant. Symptom: `npm run dev` fails with `No development build (com.jensrot.wordbank.preview) installed`. Fix: `unset APP_VARIANT` or open a new terminal. The pinned scripts above are immune — an inline value overrides the inherited one.

⚠️ **Native-folder drift gotcha:** the generated `ios/`/`android/` folders carry a *baked-in* package ID, and `expo start --dev-client` reads **that**, not the freshly-resolved `app.config.js`. The local APK scripts run `prebuild --clean`, so a `build:apk:local:preview`/`:all` would otherwise leave the native folder stamped `.preview` — after which `npm run dev`/`dev-client:android`/`dev-client:ios` would look for the `.preview` dev client and fail. **Fix at the source:** `build:apk:local:preview` (and thus `:all`) ends by restoring the dev variant (`APP_VARIANT=development expo prebuild --platform android --clean --no-install`), so the dev scripts stay fast and never see drift. Note incremental prebuild (`npm run android`/`ios`) does **not** restamp an existing folder — only `--clean` does, which is why the restore uses `--clean`.

## One-time: install the dev client after native drift

If the dev client isn't installed for the current variant (or the folders drifted to `.preview`), regenerate as `.dev` and install once. Do the clean prebuild **first** — `run:android`/`run:ios` use incremental prebuild and won't restamp a `.preview` folder on their own:

```bash
APP_VARIANT=development npx expo prebuild --clean   # regen native as .dev (full, with pods)
npm run android     # builds + installs .dev on the Android emulator
npm run ios         # builds + installs .dev on the iOS simulator
```

After the dev client is installed, daily `npm run dev` resets the variant and connects — no rebuild.

## Verify the config locally (no build needed)

```bash
APP_VARIANT=development npx expo config 2>/dev/null | head -5
APP_VARIANT=preview npx expo config 2>/dev/null | head -5
```

Check that `name` and `package` match the expected values above.

## After changing variants

Since the package name changed from the original `com.jensrot.wordbank`, **all existing APKs must be rebuilt** before the new names take effect:

```bash
npm run build:dev   # new dev client: Word Bank (Dev)
npm run build:apk   # new preview APK: Word Bank (Preview)
```

Uninstall the old APKs from your device first, then install the new ones.

# Keyboard Handling

This project uses `react-native-keyboard-controller` to keep inputs visible above the keyboard. This library requires the dev client — it does **not** work with Expo Go.

## Setup

Already installed. `KeyboardProvider` wraps the entire app in `src/app/_layout.tsx` — this is required for all keyboard controller APIs to work.

> **Web:** native-only keyboard APIs must be guarded. `book.tsx`'s `keepInputAboveKeyboard`
> checks `typeof Keyboard.metrics === "function"` and no-ops on web (`react-native-web` has no
> `Keyboard.metrics` and no floating keyboard to avoid) — otherwise editing Book Notes crashes
> on web. See `web.md` for the broader web-readiness story.

## Pattern: screens with regular inputs

Use `KeyboardAwareScrollView` — it automatically scrolls to the focused input:

```tsx
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

<>
    <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
        contentContainerStyle={{ paddingBottom: 24 }}
    >
        <TextInput ... />
        <TextInput ... />
    </KeyboardAwareScrollView>
    <KeyboardToolbar />
</>
```

Key notes:
- `bottomOffset` — extra space between the keyboard and the focused input (increase to show more context)
- `contentContainerStyle` bottom padding — keep it **modest** (e.g. `24`). `KeyboardAwareScrollView` adds a dynamic bottom inset (keyboard height) when an input focuses, so it already lifts bottom fields above the keyboard. A large static `paddingBottom` (e.g. 400) is **not** needed and causes dead over-scroll into empty space — avoid it.
- `KeyboardToolbar` — shows a Done/Prev/Next toolbar above the keyboard. Conditionally render it if you only want it for specific inputs (e.g. `{editingWord ? <KeyboardToolbar /> : null}`)

## Pattern: excluding inputs from KeyboardToolbar navigation

If a screen has inputs that should not be reachable via the toolbar arrows (e.g. an "Add word" field separate from edit fields), unmount them while other inputs are active:

```tsx
{!editingWord && (
    <View>
        <TextInput placeholder="Add a word..." />
    </View>
)}
```

## Pattern: autoFocus with KeyboardToolbar

Do not use `autoFocus` on the first input of an edit form — the toolbar won't show arrows because the second input hasn't registered yet. Instead, use a ref and focus after a short delay so all inputs are mounted first:

```tsx
const sentenceRef = useRef<TextInput>(null);

useEffect(() => {
    if (editingWord) {
        setTimeout(() => sentenceRef.current?.focus(), 50);
    }
}, [editingWord]);

<TextInput ref={sentenceRef} ... />
```

# Cover Images (camera + photo library)

Custom books can **take a photo** or **pick from the library** for their cover. Both screens route through one helper so behaviour stays consistent.

## Helpers (reusable)

- [src/utils/pick-cover-image.ts](src/utils/pick-cover-image.ts) — `pickCoverImage(hasExisting?) → Promise<string | null>`. Prompts take-photo vs. choose-from-library, requests camera permission, launches the camera or library, and resolves with the image URI (or `null` if cancelled/denied). Used by both [custom-book.tsx](src/app/(tabs)/custom-book.tsx) and [book.tsx](src/app/book.tsx).
- [src/utils/show-action-sheet.ts](src/utils/show-action-sheet.ts) — `showActionSheet(title, message, buttons)`. Platform-aware prompt: native `ActionSheetIOS` on iOS, `Alert.alert` on Android. Buttons use the same shape as `Alert`'s (`{ text, onPress?, style? }`) — mark dismiss with `style: 'cancel'` and dangerous actions with `style: 'destructive'`, and the helper wires `cancelButtonIndex`/`destructiveButtonIndex` automatically. On Android, tapping outside the dialog maps to the cancel button.

**Convention:** use `showActionSheet` for any new multi-choice or confirm dialog so iOS gets a native sheet (already used for the cover picker and the remove-word / remove-book confirmations). Keep pure single-message notifications (e.g. the camera-permission-denied notice) as `Alert.alert` — an action sheet is the wrong control for a plain message.

## Camera permission requires a rebuild

Camera access is declared in [app.config.js](app.config.js):
- iOS: `NSCameraUsageDescription` (infoPlist) + the `expo-image-picker` plugin's `cameraPermission`.
- Android: the `expo-image-picker` plugin adds the `CAMERA` permission.

This is a **native config change**, so it ships only via a new build — **not** OTA. Rebuild before "Take Photo" works:
```bash
npm run build:dev    # or build:apk:local:dev
npm run build:apk    # or build:apk:local:preview
```

# OTA Updates (EAS Update)

JS/UI changes can be pushed over-the-air without a full rebuild using EAS Update. Native changes (adding/removing packages) always require a new build.

## Push an update to preview testers
```bash
npm run update:preview
```

`--auto` uses the current git commit message as the update description.

## How testers receive updates
The app checks for updates on every launch (`checkAutomatically: "ON_LOAD"` in `app.config.js`). If an update is available it downloads in the background and applies on the next launch.

## When a full rebuild is needed
- Adding or removing a native package (e.g. `react-native-keyboard-controller`)
- Changing `app.config.js` native config (icons, permissions, scheme)
- Bumping `version` in `package.json` — this changes the `runtimeVersion` and requires a new build before updates can be pushed to that version

## Channels
| Profile | Channel | Use for |
|---|---|---|
| `development` | `development` | Dev client builds |
| `preview` | `preview` | Internal testers |

# Community word feed + AI endpoints (word-bank-server)

The app's **outbound** data. A small Express + SQLite service (`word-bank-server`, a sibling
repo) collects words people save, so the marketing site can show a live "word wall". It also
fronts the AI features — sentence analysis and word/book-title placeholder suggestions
(`GET /v1/suggestions`, integrated) — so the LLM API key stays server-side instead of shipping
in the app bundle. Unlike `/analyze`, `/v1/suggestions` is **not** rate-limited or cached
server-side — every call is a live, parallel pair of LLM completions — which is why the app
caches successful results in memory per `lang` (see `suggestions-api.ts` above).

- **Touch points:** [`words-feed-api.ts`](src/utils/words-feed-api.ts) `postWordToFeed()`
  contributes a word on add; [`analyze-api.ts`](src/utils/analyze-api.ts) `analyzeSentence()`
  powers the Analyze screen; [`suggestions-api.ts`](src/utils/suggestions-api.ts)
  `fetchSuggestions()` powers the AI-generated word/title/sentence placeholder on `book.tsx`
  (words), `SearchBar.tsx`/`custom-book.tsx` (titles), and `analyze.tsx` (example sentences).
  All resolve the host through [`feed-api-base.ts`](src/utils/feed-api-base.ts).
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
  returns `null` and `/v1/suggestions` returns `{ words: [], titles: [] }` (200, not an error), and
  the app degrades to its static fallback lists either way.
- **Deploy:** the server ships its own `Dockerfile`/`docker-compose.yml` and can share the
  Oracle VM that runs the dictionary API — see `word-bank-server/README.md` and the step-by-step
  in [api.md](api.md).

# Dictionary API (wiktapi.dev)

Word definitions come from a **self-hosted [wiktapi.dev](https://github.com/TheAlexLichter/wiktapi.dev) instance** — a multilingual REST API built on kaikki.org's pre-processed Wiktionary data, backed by a local SQLite database. The app no longer calls **Wikimedia's REST API** directly; English still uses the public **dictionaryapi.dev**, everything else the self-hosted instance (see [App integration](#app-integration) below).

**Why self-hosted:** Wikimedia's API enforces a [User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy) and rejects Android's default `okhttp` UA with a 403 — so Dutch lookups failed only on Android. Self-hosting removes the runtime dependency on Wikimedia entirely, gives structured JSON (definitions + part of speech + IPA) instead of fragile text scraping, and supports 100+ languages from one endpoint.

## Repo location

The API lives in a sibling repo (not part of this app):
```
~/programming/word-bank/word-bank-app/wiktapi.dev
```
Toolchain: Node ≥ 24.13.1, pnpm 10.30.0 (via corepack). The README uses a `vp` (vite-plus) CLI; the `pnpm --filter` commands below are the equivalents and need no extra install.

## Run the API locally

```bash
cd ~/programming/word-bank/word-bank-app/wiktapi.dev

# 1. Install deps (compiles the native better-sqlite3 module)
pnpm install

# 2. Download a Wiktionary edition's data from kaikki.org.
#    Start with nl (small). English is ~2.3 GB compressed — add it later.
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
GET /v1/{edition}/word/{word}?lang={code}
```

| Axis | Meaning |
|---|---|
| `{edition}` | Which Wiktionary the data comes from → **the language definitions are written in** |
| `?lang=` | Filters to entries for a specific language |

The app uses matching edition + lang (e.g. `/v1/nl/word/hond?lang=nl`) so Dutch words get **Dutch-language** definitions. Using the `en` edition instead would return English glosses of the Dutch word.

## App integration

All lookups go through a single entry point — see [src/utils/words-api.ts](src/utils/words-api.ts):

```ts
fetchDefinition(word, lang)  // → { word, phonetic?, partOfSpeech, definition }
```

It routes by language:
- **English** (`lang === 'en'`) → the free public **`api.dictionaryapi.dev`** (`fetchEnglish`). No key or User-Agent needed, and it means the self-hosted server never has to import the ~2.3 GB English edition.
- **Everything else** → the self-hosted wiktapi.dev instance (`fetchSelfHosted`).

For the self-hosted path:
- `EDITION_BY_LANG` maps a language code to its edition (currently `nl`; English is intentionally absent). Add an entry here when you import a new edition into the DB. Unmapped codes use the language code itself as the edition (and 404 gracefully if that edition isn't imported).
- The base URL is `process.env.EXPO_PUBLIC_DICT_API_URL`, with a platform-aware local fallback when unset.

## Pointing the app at the server

The URL the app must hit depends on where it runs (the fallbacks handle simulators/emulators automatically):

| App runs on | URL | Setup needed |
|---|---|---|
| iOS simulator / web | `http://localhost:3000` | none (default) |
| Android emulator | `http://10.0.2.2:3000` | none (default) |
| **Physical phone** | `http://<your-Mac-LAN-IP>:3000` | set env var (below) |
| Preview / production | deployed HTTPS URL | set in `eas.json` per profile |

**Physical device:** create `.env.local` (gitignored) in this app's root:
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

The published app can't reach a `localhost`/LAN URL, so the API must be deployed to a public **HTTPS** URL and set via `EXPO_PUBLIC_DICT_API_URL` in `eas.json` (`env` per profile). The repo ships a `Dockerfile` + `docker-compose.yml` (`restart: unless-stopped`), and the runtime image expects the DB mounted at `/data/wiktionary.db`. Build the `wiktionary.db` on a fast machine and copy it to the host rather than downloading/importing on constrained hardware (e.g. a Raspberry Pi). For a home host behind NAT, Cloudflare Tunnel gives free HTTPS without port-forwarding.

**eas.json status:** the `preview` and `production` profiles already carry `EXPO_PUBLIC_DICT_API_URL` set to a **placeholder** (`https://your-api.example.com`) — replace it with the real deployed URL before a cloud/preview build is useful. **Cloud (EAS) builds ignore `.env.local`** (it's gitignored and never uploaded); they read the URL only from `eas.json` `env` (or EAS dashboard environment variables). `.env.local` applies only to `npm run dev` and the local `build:apk:local:*` scripts.

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
scp ~/programming/word-bank/word-bank-app/wiktapi.dev/packages/api/data/wiktionary.db \
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

## Alternative dictionary APIs considered

Kept for reference if we ever move off the self-hosted wiktapi.dev. The key distinction is **dictionary** (definition + part of speech + IPA, matching our `WordEntry` model) vs **translation** (word → word only, no POS/phonetic — would require reshaping the model).

### Free
| Option | Type | Languages | Notes |
|---|---|---|---|
| **wiktapi.dev (self-host)** — current | Dictionary | 100+ | Free to use, you pay infra. Structured JSON: definitions + POS + IPA. |
| **Wiktionary REST API** | Dictionary | 100+ | `en.wiktionary.org/api/rest_v1`. Closest zero-infra equivalent, but Wikimedia-hosted (needs `User-Agent` header, rate limits, glosses in English). |
| **dictionaryapi.dev** | Dictionary | ~13 only | Free, no key, but **no Dutch** (en, es, fr, de, it, ru, ja, ko, ar, tr, hi, pt-BR). Was the original English source. |
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

# Git Commit Conventions

This project uses **Conventional Commits**. Always prefix commit messages with a type:

| Prefix | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, tooling, config (no production code change) |
| `refactor` | Code restructure without changing behavior |
| `style` | Formatting, whitespace, no logic change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `revert` | Reverting a previous commit |

**Format:**
```
feat: add custom book creation screen
fix: FAB crash when outside tab navigator
chore: update AGENTS.md with dev flow
feat(searchbar-cross): updated colors
```

Optionally scope to the affected area:
```
feat(book): add edit details button for custom books
fix(nav): back from book now returns to read-list
```
