# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Codebase Architecture

Word Bank is an Expo (SDK 55) / React Native app using **expo-router** (file-based routing, typed routes), TypeScript, and AsyncStorage for all persistence. There is no backend in this repo. Network calls are: book search (OpenLibrary), word definitions (the public [wiktapi.dev](docs/dictionary-api.md) instance for every language, including English — self-hostable via `EXPO_PUBLIC_DICT_API_URL`; no phonetic transcription is currently fetched for any language, a known gap, see the doc), as-you-type word suggestions on the book screen (wiktapi `/search` for non-English, which only actually works against a self-hosted instance — the public instance's `/search` is currently non-functional; the free **api.datamuse.com** suggest API for English — prefixes only), an optional per-word "Translate to" lookup on the book screen (`translate.googleapis.com` — the unofficial, keyless Google Translate endpoint; sends only the word text and the two language codes, tap-to-reveal so it's never called automatically), and — opt-in — the [community word feed](docs/community-server.md): the app contributes each saved word plus its public dictionary values to the `word-bank-server` feed and reads back AI-generated word/book-title suggestions for placeholders. The one call that sends text the user wrote is the **Analyze a sentence** screen (`POST /analyze`), which is user-initiated per sentence and disclosed on screen — everything else sends only public dictionary data.

## Mental model

A **book** the user is tracking lives on the **read list** (`ReadListBook`, keyed by `key`) and carries a reading status (Want to read / Currently reading / Have Read). Each book has a separate **word collection** stored under `words_<key>`. The two are linked by the book `key`: adding words to a book automatically ensures the book is on the read list, and the read list shows each book's word count. The **Words List** tab flattens every book's words into one searchable view.

## Source layout (`src/`)

```
app/                         # expo-router routes (file = route)
  _layout.tsx                # Root: SafeAreaProvider > ActionSheetProvider > KeyboardProvider > AppThemeProvider > (ActionSheetBridge + AlertDialogBridge + ThemedStack + NotificationResponseBridge)
  book.tsx                   # /book — book detail (add/edit words, status, cover, meta). NOT a tab
  (tabs)/
    _layout.tsx              # Tab bar (ScrollProvider + FloatingActionButton); hides custom-book, about, support, analyze & stats
    index.tsx                # "Search" tab — search OpenLibrary, browse results
    read-list.tsx            # "Read" tab — saved books, filter by status
    words-list.tsx           # "Words" tab — all words across books, searchable
    memory-words.tsx         # "Memory" tab — flip-to-reveal flashcard practice
    more.tsx                 # "More" tab — settings/about menu (card rows)
    about.tsx                # /about — reached from More (href: null, not a visible tab)
    custom-book.tsx          # /custom-book — create a manual book (href: null; opened via the FAB)
    support.tsx               # /support — donate/share screen, reached from More → About (href: null)
    analyze.tsx               # /analyze — sentence analysis, reached from More → Tools (href: null)
    stats.tsx                  # /stats — Memory-tab practice history, reached from Memory tab + More → Tools (href: null)
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

- `app/_layout.tsx` wraps everything in `SafeAreaProvider > ActionSheetProvider > KeyboardProvider > AppThemeProvider`, then renders `ActionSheetBridge`, `AlertDialogBridge`, a `ThemedStack` (the root `Stack` — headers hidden, wrapped in `@react-navigation/native`'s light/dark `ThemeProvider` + `StatusBar` — rendering the `(tabs)` group), and `NotificationResponseBridge` (after the `Stack`, so its effect fires once the navigator has mounted).
- `app/(tabs)/_layout.tsx` defines five visible tabs — Search (`index`) / Words (`words-list`) / Read (`read-list`) / Memory (`memory-words`) / More (`more`) — plus the per-tab header (with `ThemeToggle`). `custom-book`, `about`, `support`, `analyze`, and `stats` are registered with `href: null` so they're routable but not shown as tabs. The whole tab area is wrapped in `ScrollProvider` and overlaid with one shared `FloatingActionButton`.
- `book.tsx` is a stack route opened via `openBook(...)` ([utils/open-book.ts](src/utils/open-book.ts)), passing `key/title/author/year/cover_i` plus an optional `focusWord` (scroll-to/highlight a specific word) as params. A module-level 800ms cooldown swallows rapid duplicate taps so it can't stack the screen twice.

## Screens (`app/`)

| Screen | What it does | Key collaborators |
|---|---|---|
| `index.tsx` | Search books; renders results with infinite scroll | `useBookSearch`, `SearchBar`, `BooksList` |
| `book.tsx` | Add words (dictionary lookup + choose among multiple definitions), edit per-word sentence/notes, set reading status, pick cover, edit title/author/year, write a Book Notes + Review (both tap-to-edit) with a 0–5 star rating, jump-to-notes link. Keeps a growing multiline notes/review input above the keyboard (`keepInputAboveKeyboard`, native-only); placeholder suggestions come from AI-generated word suggestions; a successful add contributes the word to the community feed; a `LanguageModal` row picks the dictionary language (shared preference via `useSavedLanguage`) | `ReadStatusSelector`, `LanguageModal`, `DefinitionModal`, `StarRating`, `BookDetailSkeletons`, `CoverImage`, `words-storage`, `read-list-storage`, `words-api`, `words-feed-api`, `suggestions-api`, `pending-read-filter`, `useSavedLanguage` |
| `read-list.tsx` | List saved books (ordered by word count), filter by status, change status / remove / open. The status filter auto-selects after a status change — in-place, or via the `filter` route param `book.tsx` sends on "Update read list" | `ReadListItem`, `read-list-storage`, `getWordCounts`, `open-add-book-menu` |
| `words-list.tsx` | Flatten all words across books, live word-text search (typewriter placeholder cycles your own saved words, accepted on empty submit via `SearchButton`), a **dynamic, colour-coded, multi-select part-of-speech filter** — one chip per POS actually present in the saved words (with counts; colours/labels shared with `DefinitionModal` via `utils/part-of-speech.ts`; hidden when ≤1 POS present), sort control (A–Z / Z–A / By book / Recently added, persisted via `words-list-storage`), tap to open the book. Each row also shows the word's saved sentence | `WordListItem`, `getAllWords`, `utils/part-of-speech.ts`, `words-list-storage`, `SearchButton`, `ClearableTextInput`, `useTypewriterPlaceholder` |
| `custom-book.tsx` | Create a manual book (title/author/year/cover/status) then open it. Title field types out an AI-generated example title (in the saved dictionary language) as a placeholder — accepting it (empty submit) also pre-fills the matching author/year from the same suggestion | `CoverImage`, `ReadStatusSelector`, `upsertReadListBook`, `useSavedLanguage`, `useTypewriterPlaceholder`, `suggestions-api` |
| `memory-words.tsx` | "Memory" tab — flip-to-reveal flashcard practice, capped at an in-session **round size** (5 / 10 / 20 / All chip row, default 10 — `buildDeck`/`SizeChipRow`) over the saved-word pool (word/phonetic front, phonetic/definition/part of speech/example sentence back — the user's own saved sentence when there is one, else the dictionary's), self-rated "Still learning" / "Knew it". Ratings affect the current round's tally (shown on an end-of-round summary with a "Practice again"/"‹ Exit" mid-round control), a session-only rotation that favors not-yet-known words each round, and — separately — a persisted per-word "Still learning"/"Knew it" counter (see `memory-stats-storage.ts`) that feeds `stats.tsx`; still no spaced repetition/scheduling in v1. A "View your stats" link (start/summary phases) opens `stats.tsx`. The word pool is re-read on every focus except mid-round (`phase === "playing"`), so changes made elsewhere (seeding, deleting, adding words) show up without a reload. Empty-pool state links to the Read List. A toggle on this screen (not `more.tsx`, hidden on web and mid-round) turns on/off a single recurring daily local notification with a user-configurable time (native time picker) and word-count target, re-scheduled with that round's result text every time a round finishes | `FlashCard`, `DailyReminderCard`, `SizeChipRow`, `getAllWords`, `notifications-storage`, `memory-stats-storage`, `build-deck`, `daily-reminder` |
| `stats.tsx` | **/stats** — the Memory tab's practice-history screen: four stat tiles ("Words tracked" — tap navigates to Words List — "Knew-it rate" %, total "Knew it", total "Still learning") and a "Still struggling with" list (words with `stillLearning > 0`, sorted worst-first), each row tapping through to its source book. Empty states for no practice history yet and for zero currently-struggling words. Reads `getAllWords()` + `getMemoryStats()` on every focus and resolves each stat back to a saved word, so a stat for a word no longer saved anywhere just drops off the list (the counter itself isn't deleted). `href: null`, reached from the Memory tab's "View your stats" link and from More → Tools' "Practice history" row, both passing a `from` param (`"memory"`/`"more"`) that `useBackTo` reads to decide where back goes | `WordStatRow`, `getAllWords`, `memory-stats-storage`, `open-book`, `useScrollViewScroll`, `useBackTo` |
| `more.tsx` / `about.tsx` / `support.tsx` | Settings-style card menu: "Tools" (→ Analyze a sentence, → Practice history), "Your data" (export/import via `export-import-flow`/**Delete all data**), "Sources" (book & dictionary providers in plain language; switching providers is a Pro-locked placeholder), "About" (About, **Support Word Bank**, source link, version/license), "Developer" (links to the actual APIs, plus a `__DEV__`-gated "Seed test data" row generating small/medium/large fake datasets via `seed-test-data.ts`). `support.tsx` is its own donate/share screen (GitHub Sponsors/Liberapay/Ko-fi/Buy Me a Coffee links, "star on GitHub", native share sheet) — `href: null`, reached from More → About | `useScrollViewScroll`, `useBackTo`, `showActionSheet`, `clearAllBookData`, `exportData`/`importData`, `seedTestData`, `alertDialog` |
| `analyze.tsx` | **/analyze** — paste a sentence (capped at `MAX_SENTENCE_LENGTH` = 300 chars, live counter), AI explains what it means in plain language. A `LanguageModal` row picks the language both the AI response and the "Try one" example sentences use (shared dictionary-language preference via `useSavedLanguage`, which this screen also writes to via the modal); the Sentence field types out one AI-generated example sentence as a placeholder, and pressing "Analyze" on an empty field accepts it (same click-to-accept pattern as `SearchBar`/Words List, via `SearchButton`'s `suggestion`/`loadingLabel` props). A `429` shows a live countdown in the error message until retry is allowed. Reopening a "Recent" entry (or landing on a fresh result) scrolls to top and briefly flashes an accent outline around the result card. Keeps the last 20 analyses locally; long-press to remove. `href: null`, reached from More → Tools | `AnalysisResult`, `LanguageModal`, `SearchButton`, `analyze-api`, `analysis-storage`, `suggestions-api`, `useSavedLanguage`, `useTypewriterPlaceholder`, `useScrollViewScroll`, `useBackTo`, `showActionSheet` |

## Components (`src/components/`)

| Component | Purpose |
|---|---|
| `BooksList` | `FlatList` of search results: pulsing skeletons while loading, infinite scroll, empty/retry states |
| `BookItem` | One search-result row (cover + title/author/year); opens the book |
| `CoverImage` | Cover with a pulsing skeleton, loading spinner, and graceful fallback on error |
| `ReadListItem` | `React.memo` card for a saved book: cover, status badge, word count, `StarRating` (read-only, when a "read" book has a rating), remove |
| `ReadStatusSelector` | Three-pill selector for Want / Currently reading / Have Read |
| `WordListItem` | `React.memo` card on the Words List: word + phonetic + part of speech + definition + the saved sentence (when present) + source-book label |
| `ClearableTextInput` | `TextInput` wrapper with a ✕ button that appears while there's text and clears the field; reused by all search/add inputs |
| `SearchButton` | The accent action button shared by Search, Words List, and Analyze. `label`/`loadingLabel` customize the idle/loading text (defaults `"Search"`/`"Searching"`); `suggestion` (the live typewriter word/title/sentence) echoes what an empty-field press will actually submit, e.g. `Analyze "…"` |
| `SearchBar` | Book search field; types out an AI-generated example title (in the saved dictionary language, via `useSavedLanguage`) as a placeholder, accepted on empty submit |
| `LanguageModal` | Bottom-sheet dictionary-language picker with search; a self-contained trigger row (label + current selection) + the picker itself. Reused on `book.tsx` (dictionary language + "Translate to") and `analyze.tsx` |
| `DefinitionModal` | Bottom-sheet picker to search and switch among a word's definitions, grouped under part-of-speech headers color-coded via the shared `utils/part-of-speech.ts` palette (same colours as the Words List filter) |
| `FloatingActionButton` | Scrolls to top when scrolled; otherwise opens the shared "Add a book" menu via `open-add-book-menu.ts` |
| `CoverPlaceholder` | Book-glyph placeholder shown for a book with no cover image |
| `StarRating` | 0–5 star rating row (`IconSymbol` `star`/`star.fill`); interactive (tap to set, tapping the current value clears it) when given `onChange`, otherwise a read-only display. Used for the book screen's review rating and its Read List display |
| `BookDetailSkeletons` | Pulsing (`usePulse`) placeholder set for `book.tsx` while its data loads: `WordCardSkeletons`, `ReadStatusSkeleton`, `SaveButtonSkeleton`, `WordCountSkeleton`, `NoteCardSkeleton`, `LanguageModalSkeleton` — each mirrors the real content's layout so nothing flashes a default value before loading |
| `AnalysisResult` | Purely presentational result card for `analyze.tsx`: the quoted sentence + the AI's plain-language "Meaning" |
| `FlashCard` | Tap-to-flip word card (word/phonetic front, phonetic/definition/part-of-speech/example sentence back — the user's own saved sentence when there is one, else the dictionary's, reanimated `rotateY`); shows "Still learning" / "Knew it" once flipped. Always shows a "From: {book} ›" tap-through (opens the book, focused on the word) and a "Your round stays paused — come back anytime" hint below the card, regardless of flip state. Used by `memory-words.tsx` |
| `WordStatRow` | `React.memo` card on `stats.tsx`'s "Still struggling with" list: word + its "Still learning"/"Knew it" counts + source-book label; tap opens the book |
| `DailyReminderCard` | `memory-words.tsx`'s "Daily practice reminder" card: on/off toggle, and — once enabled — the fire-time row (opens the native time picker) and a word-count target (`SizeChipRow`). Purely presentational/fully-controlled — the screen keeps the actual state itself, since it also needs the enabled/hour/minute values to reschedule the reminder when a round finishes |
| `SizeChipRow` | A row of "5 / 10 / 20 / All / Custom" chips — shared by `memory-words.tsx`'s in-session round-size picker and `DailyReminderCard`'s word-count target. "Custom" reveals an inline number field (capped at the caller-supplied `maxAllowedInputValue`) rather than being a value itself; composes `Chip` |
| `Chip` | One selectable pill (label/selected/press handler) — the shared visual for every chip in `SizeChipRow` |
| `ActionSheetBridge` | Root-mounted (in `_layout.tsx`) bridge that backs the imperative `showActionSheet` helper, themed for dark mode |
| `AlertDialogBridge` | Root-mounted (in `_layout.tsx`) bridge rendering every native `alertDialog()` call as its own centered `Modal` (Cancel + OK, dismissable by tapping the backdrop or the Android back button, plus an optional "don't show again" checkbox) — `Alert.alert` can't offer either consistently on both platforms (no backdrop to tap on iOS) or host custom UI at all |
| `NotificationResponseBridge` | Root-mounted (in `_layout.tsx`, after the `Stack`) bridge with no UI: routes to the screen a tapped local notification's `data.type` points at (Memory tab for the daily reminder), covering both a live tap while the app's running/backgrounded and a cold start launched by the tap |
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
| `useBackTo(href)` | Routes the Android hardware/gesture back press to `href` while the screen is focused, instead of the default back behavior. No-op on iOS/web (no hardware back button). Used by screens reached from a fixed place (e.g. `analyze.tsx`/`support.tsx` → back to `/more`) so back doesn't depend on navigation history |

## Context (`src/context/`)

- `theme-context.tsx` — `AppThemeProvider`, `useTheme()`, `useColorScheme()`. Restores the saved theme via `theme-storage` on launch (defaulting to the system scheme) and persists every toggle.
- `language-context.tsx` — `AppLanguageProvider`, `useSavedLanguage()`. Restores the saved dictionary language via `language-storage` once, app-wide, on launch (`language` defaults to `LANGUAGES[0]` until `languageReady` flips true) and persists every change via `setLanguage`. Shared by `book.tsx`, `analyze.tsx`, `custom-book.tsx`, and `SearchBar.tsx` — `book.tsx`/`analyze.tsx` also call the setter (each via its own `LanguageModal`), `custom-book.tsx`/`SearchBar.tsx` are read-only. Context-backed (not a per-mount `useState`, like `theme-context.tsx`) specifically so a change made on one screen shows up immediately on every other screen that reads it, with no reload/remount needed.
- `scroll-context.tsx` — `ScrollProvider`, `useScrollContext()`. Holds `scrollY` + a `scrollToTop` callback that screens register and the FAB consumes.

## Data layer (`src/storage/`, all AsyncStorage)

| Module | Keys | Exports |
|---|---|---|
| `storage.ts` | — | `getJSON(key, fallback)` / `setJSON(key, value)` — shared parse/stringify helpers |
| `read-list-storage.ts` | `read_list`, `read_list_filter` | `getReadList` (runs one-time migrations, see below), `setReadList`, `upsertReadListBook`, `removeReadListBook`, `setReadBookStatus`, `clearAllBookData`, `getReadListFilter`/`setReadListFilter` (the Read List's persisted status filter), `getAllWords` (every saved word across every book, each tagged with its source book — the shared pool used by `words-list.tsx` and `memory-words.tsx`) |
| `words-storage.ts` | `words_<bookKey>` | `getWords`, `setWords`, `removeWords`, `getWordCounts` (batched `multiGet`) |
| `language-storage.ts` | `dictionary_language`, `translation_language` | `getLanguageCode`/`setLanguageCode` (the dictionary language — see `useSavedLanguage`), `getTranslationLanguageCode`/`setTranslationLanguageCode` (the book screen's independent "Translate to" preference) |
| `analysis-storage.ts` | `sentence_analyses` | `getAnalysisHistory`, `addAnalysis`, `removeAnalysis`, `setAnalysisHistory` (bulk overwrite — used by `export-import.ts`/`seed-test-data.ts`), `clearAnalysisHistory` — the last `MAX_ANALYSES_ENTRIES` (20) sentence analyses, newest first; the mutators return the updated list |
| `words-list-storage.ts` | `words_list_sort` | `getSortMode`/`setSortMode` — the Words List's persisted sort choice (`SortMode`: `'az' \| 'za' \| 'book' \| 'recent'`, `SORT_MODES` lists them) |
| `theme-storage.ts` | `app_theme` | `getTheme`, `setTheme` (light/dark choice) |
| `notifications-storage.ts` | `daily_reminder_enabled`, `daily_reminder_time`, `daily_reminder_word_count` | `getNotificationsEnabled`/`setNotificationsEnabled` (toggle state), `getReminderTime`/`setReminderTime` (hour/minute), `getReminderWordCount`/`setReminderWordCount` (the reminder's word-count target — also owns the shared `RoundSize` type + `ROUND_SIZE_OPTIONS`, "5 / 10 / 20 / All", mirrored by the Memory tab's in-session round size) |
| `memory-stats-storage.ts` | `memory_word_stats` | `getMemoryStats`, `recordRating(word, knew)` (increments that word's `stillLearning`/`knewIt` counter, stamps `lastReviewedAt`), `setMemoryStats` (bulk overwrite — used by `seed-test-data.ts`), `clearMemoryStats` — per-word Memory-tab practice counters, stored as a `WordStat[]` (each entry: `word`/`stillLearning`/`knewIt`/`lastReviewedAt`, `word` already lowercased/trimmed), app-wide not book-scoped (matching `memory-words.tsx`'s `knownThisSession`/`export-format.ts`'s `mergeWords`). Lightweight counters only, no spaced-repetition scheduling. Feeds `stats.tsx`; wiped by `clearAllBookData`; also round-trips through the backup export/import feature (`export-format.ts`/`export-import.ts`) |
| `dismissed-alerts-storage.ts` | `dismissed_alert_ids` | `isAlertDismissed(id)`/`dismissAlert(id)` — which `alertDialog` "don't show again" checkboxes (see `utils/alert-dialog.ts`) the user has permanently dismissed, keyed by a caller-supplied stable id (e.g. `"export-data"`). A UI preference, not book data — left intact by `clearAllBookData` |
| `export-format.ts` | — (pure, no AsyncStorage) | `EXPORT_FORMAT`, `CURRENT_FORMAT_VERSION`, `ExportedBook`/`WordBankExport` types, `ImportFormatError`, `SanitizedImport`, `stripLocalCoverUri`, `parseImportFile` (validates + sanitizes a raw import file), `mergeWords`/`WordMergeResult` (dedupes by lowercased/trimmed word text, existing-wins), `mergeAnalyses`/`AnalysesMergeResult` (dedupes by `lang:text`) — the backup file's shape + merge logic, deliberately storage-free so it's easy to unit-test |
| `export-import.ts` | — (drives the modules above) | `ImportMode` (`'merge' \| 'replace'`), `ImportResult`, `buildExport()` (snapshots books+words+analyses into a `WordBankExport`), `applyImport(data, mode)` (`'replace'` wipes via `clearAllBookData` then restores everything; `'merge'` adds new books as-is and merges existing books' words/analyses) — the AsyncStorage-side counterpart to `export-format.ts`, driven by `utils/export-import-flow.ts`'s file-picker/share UI |

`upsertReadListBook` takes `Omit<ReadListBook, 'addedAt'>` — `addedAt` is owned by storage (stamped on insert, preserved on update).

`clearAllBookData` (used by More → "Delete all data") removes every book's `words_<key>` entry, empties `read_list`, and clears analysis history + Memory-tab practice stats — leaving settings (theme, dictionary language, notification preferences) intact.

### Data migrations

`getReadList` rewrites data left over from older app versions, on load. Current migrations:
- reading status value `reading` → `currently_reading`
- book-level field `notes` → `bookNotes`

The pass is **idempotent and self-erasing**: it only writes back when something actually changed, so after the first launch on a migrated build it's a cheap no-op.

**Why it's needed:** installing a new APK with the **same package id** is an *update* — AsyncStorage is preserved — so books saved before a rename survive on the device and must be migrated. Without the migration those books aren't deleted, but a pre-rename `reading` book shows a blank/broken status badge and falls out of the "Currently reading" filter (until its status is re-picked), and notes saved under the old key stop displaying.

**When it can be removed:** once every install has opened a migrated build at least once (or after a fresh package id / clean reinstall, which start with empty storage). It's then safe to delete in a later release; until you're sure, leaving it in costs almost nothing. For retiring future migrations cleanly, consider a stored `schema_version` so old steps can be dropped once the minimum version has moved past them.

## Models (`src/models/`)

- `book.ts` — `Book` (OpenLibrary search result shape).
- `read-list-book.ts` — `ReadListBook` (incl. optional book-level `review?`, `bookNotes?` — the latter renamed from `notes` — and `rating?` — a 0–5 star rating, see `StarRating`), `ReadStatus` (`'want' | 'currently_reading' | 'read'`), plus `READ_STATUS_LABELS` / `READ_STATUS_ORDER`, and the Read List's own `ReadListFilter` (`ReadStatus | 'all'`) / `READ_STATUS_FILTER_LABELS` / `READ_LIST_FILTERS`.
- `word-entry.ts` — `WordEntry` (word, phonetic, the selected partOfSpeech/definition/exampleSentence, the full `definitions` list + `selectedDefinition` index, the user's sentence/notes, optional `addedAt` timestamp for "Recently added" sorting, and optional `sourceLanguage` — the dictionary language active when the word was added, used as the "Translate to" source language even after the book's dictionary language changes), `WordDefinition` (one candidate meaning), and `EditDraft`.
- `language.ts` — `Language` + the full `LANGUAGES` list used by the dictionary picker.
- `sentence-analysis.ts` — `SentenceAnalysis` (currently just `{ meaning: string }` — the server only ever returns a plain-language meaning, see `analyze-api.ts`), `AnalysisHistoryEntry` (`text`/`lang`/`analysis`/`createdAt`, as kept by `analysis-storage.ts`), and `MAX_ANALYSES_ENTRIES` (20).

## Utils (`src/utils/`)

- `words-api.ts` — `fetchDefinition(word, lang)`: every language, including English, routes to wiktapi.dev (`fetchFromWiktapi`; the public instance by default, self-hostable via `EXPO_PUBLIC_DICT_API_URL`; see [docs/dictionary-api.md](docs/dictionary-api.md)). No phonetic data is fetched today (wiktapi.dev's `/definitions` doesn't return it); a `fetchEnglishPhonetic` dictionaryapi.dev supplement exists but is explicitly `NOT WIRED UP YET`, pending a decision — see the doc. Returns a `WordEntry` with **all** definitions flattened into `definitions[]` (deduped, capped at 50), the first selected by default. Also `fetchWordSuggestions(prefix, lang, limit?, signal?)` — as-you-type prefix suggestions (Datamuse for English, wiktapi `/search` otherwise — non-English suggestions only work with a self-hosted override, the public instance's `/search` doesn't currently respond; `[]`-on-failure, abortable).
- `translate-api.ts` — `translateWord(word, from, to, signal?)`: tap-to-reveal word translation via the unofficial `translate.googleapis.com` endpoint (free, no key). Returns `null` on any failure, including the endpoint's quirk of echoing back untranslatable input as its own "translation" — treated the same as "not found."
- `part-of-speech.ts` — part-of-speech helpers shared by the Words List filter and `DefinitionModal` so colours/labels stay consistent: `POS_COLORS`, `normalizePos` (folds source variants — `adj`→`adjective`, `adv`→`adverb`, …), `posColor`, `posLabel`, `POS_ORDER`.
- `dict-utils.ts` — `timedFetch` (8s timeout with friendly errors).
- `cover-uri.ts` — `coverUri(coverI, size)`: local image as-is, otherwise an OpenLibrary cover URL.
- `open-book.ts` — `openBook(params)`: the single place that navigates to `/book`, with an 800ms re-tap cooldown to avoid stacking the screen. `params` includes an optional `focusWord` for scroll-to/highlight.
- `random.ts` — `randomInt(min, max)`, `pick(items)`, `shuffle(items)` (Fisher-Yates, non-mutating): small randomization helpers used by `memory-words.tsx` (deck shuffling) and `seed-test-data.ts`.
- `date.ts` — `dateFromTime(hour, minute)` (today's date stamped at that hour/minute, seconds/ms zeroed — for handing a time-of-day to a native time picker), `formatTime(hour, minute)` (short local string, e.g. "9:00 AM"). Used by `memory-words.tsx`'s reminder time picker.
- `build-deck.ts` — `buildDeck(words, size, knownThisSession)`: builds the Memory tab's practice-round deck, capped at `size` (or the whole pool for `"all"`), shuffling not-yet-known words in first.
- `seed-test-data.ts` — `seedTestData(size)`: dev-only, reachable only via More → Developer's `__DEV__`-gated "Seed test data" row. Wipes existing book data (`clearAllBookData`) then generates a small/medium/large (`SeedSize`) set of realistic books, words, sentence analyses, and Memory-tab practice stats in one go, returning a `SeedResult` summary. Never runs in a production build.
- `export-import-flow.ts` — `exportData()`/`importData()`: the imperative More → "Your data" flows (file picker/share sheet via `expo-document-picker`/`expo-file-system`/`expo-sharing`, plus the merge-vs-replace action sheet), driving `storage/export-import.ts`. The pre-action "here's what this does" heads-up (with a "don't show again" checkbox) lives in `more.tsx`'s `handleExportData`/`handleImportData` instead — same split as `handleDeleteAll`/`handleSeedTestData`, which keep their confirmation `showActionSheet` in the screen while the underlying util just does the work.
- `pick-cover-image.ts` — `pickCoverImage()`: camera-or-library prompt (uses `expo-image-picker`).
- `show-action-sheet.ts` — `showActionSheet()`: backed by `@expo/react-native-action-sheet` via a root `ActionSheetBridge` (themed for dark mode), so it supports any number of options on both platforms (Android is no longer capped at 3 buttons like `Alert`). Keeps a plain imperative API so it's callable from non-component code; falls back to native iOS sheet / `Alert` if the bridge isn't mounted.
- `alert-dialog.ts` — `alertDialog(title, message?, options?)`: platform-safe Cancel + OK dialog — `window.confirm` on web, a native alert on iOS/Android rendered through the root `AlertDialogBridge` Modal (dismissable by tapping the backdrop or the Android back button, same as Cancel) rather than `Alert.alert`, which can't offer either reliably on both platforms or host custom UI. `options.onAcknowledge` fires when OK is tapped (including when the alert was skipped for being already-dismissed, see below); `options.onCancel` fires when Cancel (or, native-only, the backdrop/back button) closes it instead. `options.dontShowAgain` (`{ id, checkboxLabel }`, native only — no room for a checkbox in `window.confirm`) adds a "don't show again" checkbox whose choice persists via `storage/dismissed-alerts-storage.ts`, checked at the top of every call. Used this way by `more.tsx`'s `handleExportData`/`handleImportData` to show a one-time heads-up (with the checkbox, and relying on the plain Cancel-declines-the-action behavior) before calling `export-import-flow.ts`'s `exportData`/`importData`.
- `pending-read-filter.ts` — `setPendingReadFilter` / `consumePendingReadFilter`: module-level handoff of a reading status chosen on the book screen to the Read List, which auto-selects that filter next time it's focused (covers back-button returns, not just the "Update read list" button).
- `open-add-book-menu.ts` — `openAddBookMenu(pathname)`: the "Add a book" action sheet (Search for a book / Add a custom book) shared by `FloatingActionButton` and the Read List empty state, so both trigger the exact same contextual menu (omitting whichever option matches the current screen, via `show-action-sheet.ts`).
- `daily-reminder.ts` — `requestReminderPermission`, `defaultReminderBody(count)` (the pre-first-round body text for a word-count target, "all" or a number), `scheduleDailyReminder(body, hour, minute)`, `rescheduleDailyReminder(enabled, knewCount, total, hour, minute)`, `cancelDailyReminder`: wraps `expo-notifications` for the Memory tab's single recurring daily local reminder — time is a caller-supplied parameter (persisted in `notifications-storage.ts`, this file has no default of its own), including Android notification-channel setup. A denied permission shows a plain `alertDialog`, never throws/crashes. See [docs/notifications.md](docs/notifications.md) for the full behavior.
- `words-feed-api.ts` — `postWordToFeed(word, meta?)`: fire-and-forget contribution of a saved word + its **public** dictionary values (definition / part of speech / phonetic) to the feed. Never throws (failures swallowed); sends **no** sentence, notes, book, or identity; opt-in via `EXPO_PUBLIC_WORDS_FEED_API_URL`.
- `feed-api-base.ts` — `FEED_API_BASE_URL` + `FEED_REQUEST_TIMEOUT_MS`: the one place the `word-bank-server` host is resolved (env var, else a platform-aware localhost — `10.0.2.2` on the Android emulator). Every client of that server imports it instead of re-deriving it. Note `words-api.ts` keeps its own base URL — that's the *dictionary* API, a different service on a different env var (and, unlike this one, defaults to a public hosted instance rather than localhost).
- `analyze-api.ts` — `analyzeSentence(text, lang, signal?)`: sentence analysis via the server's `POST /analyze` (see [docs/community-server.md](docs/community-server.md)). `null` on any failure, `'rate-limited'` on a `429` (distinguished so the screen can show a more accurate message), never throws; a **25s** timeout rather than the usual 5s since the server has no cache — every call waits on a full live LLM round trip. Re-validates the payload client-side (rebuilds `{ meaning }` from known fields rather than trusting the raw response). Also exports `MAX_SENTENCE_LENGTH` (300), the cap `analyze.tsx` enforces client-side. This is the only call in the app that sends text the user wrote — see the privacy note in [docs/community-server.md](docs/community-server.md).
- `suggestions-api.ts` — `fetchSuggestions(lang?)`: AI-generated word + book + example-sentence suggestions via the server's `GET /v1/suggestions` (see [docs/community-server.md](docs/community-server.md)). Returns `Suggestions = { words: string[]; books: SuggestedBook[]; sentences: string[] }` where `SuggestedBook = { title, author, year }` — callers map `books` to titles themselves when that's all they need. Resolves to `{ words: [], books: [], sentences: [] }` on any failure (including a `429`, logged via `console.warn` and left uncached), never throws; a **20s** timeout since the server fires parallel, uncached LLM completions per request — a cold call costs one round trip, but each list is verbose (up to 80 words / 40 books / 3 sentences). Successful non-empty results are cached in memory per `lang` for the app session (never the empty/failure case), so reopening a screen (e.g. `book.tsx`, opened per book; `analyze.tsx`) doesn't re-trigger a live, unrate-limited LLM call every time. Consumed by `book.tsx` (words), `SearchBar.tsx`/`custom-book.tsx` (book titles, author/year), and `analyze.tsx` (sentences).

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
- **A fire-and-forget promise gets `.catch((error) => (console.error(error)))` whenever
  the callee can actually reject** (this app specifically — a UI/React Native
  convention, not necessarily shared with the sibling repos). Simply put: if you call an
  async function without `await`-ing it, chain `.catch(console.error)` onto it unless
  that function is documented to never fail on its own — otherwise a real failure there
  just vanishes with nobody, not even the logs, ever seeing it. For a call to an async
  storage/utility function that a UI event handler doesn't need to block on, that's the
  default — never a bare `someAsyncCall();` and never `void someAsyncCall();` for it,
  since a bare or `void`-marked call behaves identically to a `.catch()`'d one at
  runtime (none of the three ever block or surface anything to the user) — the only
  difference `.catch()` adds is that a failure actually gets logged instead of silently
  vanishing with no trace, and a bare call in particular is also ambiguous to a future
  reader (forgotten `await`, or deliberate?). See `persistRoundSize`/`recordRating` in
  [memory-words.tsx](src/app/(tabs)/memory-words.tsx) for the canonical (logged) shape.
  The one case to skip it: a callee documented as "never throws" (it already swallows
  its own errors and resolves instead of rejecting — `translate-api.ts`,
  `words-api.ts`, `suggestions-api.ts`, `analyze-api.ts`, `words-feed-api.ts`, and every
  `get*` storage function built on [storage.ts](src/storage/storage.ts)'s `getJSON`).
  **`set*`/write storage functions are not on that list** — none of them wrap their
  `AsyncStorage` call in a try/catch (`setJSON` itself doesn't either), so every one of
  them can genuinely reject and needs a `.catch()` at its fire-and-forget call sites.
  Nothing can ever reach a `.catch()` on a true never-throws callee, so adding one there
  is dead code, not caution — check the callee's own contract, not how important a
  hypothetical failure would feel, to decide.
- **No bare `catch {}` either — always `catch (error)`, and always log it**, same
  reasoning as the rule above, just for the `await`-inside-`try/catch` shape instead of
  the fire-and-forget one. This matters most for the "never throws" utility functions
  (`translate-api.ts`, `words-api.ts`, `suggestions-api.ts`, `analyze-api.ts`,
  `words-feed-api.ts`, and every `get*` storage function built on
  [storage.ts](src/storage/storage.ts)'s `getJSON`) — their `catch` block is
  the *only* place a real failure could ever be observed, since they're deliberately
  built to swallow it and resolve to a safe fallback instead of rejecting. A bare
  `catch {}` there doesn't just skip logging, it makes that failure permanently
  invisible — no caller, no matter how carefully it's written, could ever see it
  either. See `getJSON` in [storage.ts](src/storage/storage.ts) for the canonical shape.
  (`set*`/write storage functions don't get this treatment at all — they have no
  `catch` block of their own, per the rule above.)
- **Logging a caught error is not the same decision as showing the user one — don't
  reach for both by default.** Always `console.error` (the rule above). Only *also* show
  a user-facing error (`alertDialog`, an inline error message, etc.) when **both**: (1)
  the failure is the direct result of something the user just did and is actively
  waiting on, and (2) there isn't already a graceful, silent fallback covering for it.
  `pick-cover-image.ts`'s `takePhoto`/`pickFromLibrary` clear both bars — the user just
  tapped a button expecting something to happen now, so their `catch` does
  `console.error` *and* `alertDialog`. Most storage reads (`getTheme`, `getSortMode`,
  `getReadListFilter`, `areNotificationsEnabled`, ...) clear only the first — they run
  automatically (app launch, a screen mounting), nobody consciously triggered them, and
  each already degrades to a sensible default (system theme, alphabetical sort, no
  filter) — so an alert there would be an intrusive dialog about something the user
  never asked for, over a failure that's already invisible on its own. `export-format.ts`'s
  `parseImportFile` does both too, just structured differently: it logs and throws, and
  `importData()` — the layer that actually knows an import is in progress — is what
  shows the user the message, via the thrown error's own text.

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

# Further documentation

The sections below are intentionally short — each links to a separate doc with the full detail, kept out of this file so routine feature work doesn't have to load them. Read the linked doc when a task actually touches that area.

## Build & deploy

Two tracks: **local** (`npm run dev` day-to-day, `npm run android`/`ios` after a native change) for fast personal iteration, and **EAS cloud** (`npm run build:apk`, OTA via `npm run update:preview`) for anything distributed to testers or the store. Three build variants — `development`/`preview`/`production` — each get a distinct app name/package id via `app.config.js`'s `APP_VARIANT`. → **[docs/build-and-deploy.md](docs/build-and-deploy.md)** for the full decision matrix, every npm script, local APK builds, and build-variant gotchas.

## Keyboard handling

Uses `react-native-keyboard-controller` (`KeyboardAwareScrollView` + `KeyboardToolbar`) to keep inputs visible above the keyboard — requires the dev client, doesn't work in Expo Go. → **[docs/keyboard-handling.md](docs/keyboard-handling.md)** for the exact patterns (regular inputs, excluding inputs from toolbar navigation, autoFocus).

## Cover images

Custom books can take a photo or pick from the library via `pickCoverImage()` + `showActionSheet()`. Camera permission is a native config change — needs a rebuild, not OTA. → **[docs/cover-images.md](docs/cover-images.md)**.

## Notifications (daily practice reminder)

The Memory tab has one optional feature: a single recurring daily local notification, user-configurable time/word-count target, its body text reflecting your last practice round. Tapping it routes to the Memory tab via `NotificationResponseBridge`. → **[docs/notifications.md](docs/notifications.md)** for the full behavior (permission handling, scheduling, session-scoped rotation, persisted per-word stats).

## Community word feed + AI endpoints (word-bank-server)

A sibling Express + SQLite service the app talks to: contributes saved words (public dictionary values only) to a public "word wall," and fronts the AI features — sentence analysis (`POST /analyze`, the only call that sends text you wrote) and word/book/sentence placeholder suggestions (`GET /v1/suggestions`). Opt-in, offline-safe — every call degrades gracefully on failure. → **[docs/community-server.md](docs/community-server.md)** for privacy details and deploy notes.

## Dictionary API (wiktapi.dev)

Word definitions for every language, including English, come from the public **wiktapi.dev** instance by default (21 languages, self-hostable for full 100+ language coverage); **dictionaryapi.dev** isn't called at all currently — no language gets a phonetic transcription on a fresh lookup, a known, accepted gap. → **[docs/dictionary-api.md](docs/dictionary-api.md)** for the endpoint shape, self-hosting your own instance, pointing the app at a server override per environment, and known limitations of the public instance (including an unresolved reliability question accepted as a known risk when English was unified onto it).

## Search: a future Typesense upgrade

Not integrated — a written-down look at where [Typesense](https://github.com/typesense/typesense)'s typo-tolerant search could plug into book search, word suggestions, and the community word wall, if ever pursued. → **[docs/typesense.md](docs/typesense.md)**.

## Git tips

Repo-specific workflow notes not tied to any one feature — e.g. partially staging a brand-new file (VS Code/`git gui`/git-cola all need an `git add -N` intent-to-add baseline first, and none of them let you discard/revert the file safely until you're done), and quoting paths under `(tabs)/` in zsh. → **[docs/git-tips.md](docs/git-tips.md)**.

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
