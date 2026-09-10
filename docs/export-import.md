# How Export / Import works (a study guide)

This doc walks through **every piece of code** behind More → "Your data" →
**Export Data** / **Import Data**, in plain language, so you can read it once
and understand the whole feature end to end. It's written for *studying* the
code, not as a terse reference — expect full sentences and "why", not just
"what".

If you want the one-paragraph version first: exporting turns everything you've
saved (books, their words, your sentence-analysis history, and the Memory
tab's per-word practice stats) into one JSON file and hands it to the OS share
sheet (or downloads it, on web). Importing does the reverse — reads a JSON
file, checks it's actually a Word Bank backup, cleans up anything it doesn't
recognize, and then either **merges** it on top of what you already have or
**replaces** everything with it.

## The four files, and who does what

The feature is deliberately split into four files, each with **one job**. This
is the single most important thing to understand before reading any of the
code — once you know *why* it's split this way, every function's location
makes sense:

```
src/storage/export-format.ts        "the rulebook" — what a backup file looks like,
                                     and how to turn untrusted JSON into safe data.
                                     No AsyncStorage, no React Native. Pure functions only.

src/storage/export-import.ts        "the bridge to storage" — reads your books/words/
                                     analyses/memory stats out of AsyncStorage into a
                                     backup object, and writes a parsed backup back into
                                     AsyncStorage.

src/utils/export-import-flow.ts     "the user-facing plumbing" — picking a file, writing
                                     a file, the native share sheet vs. a web download,
                                     and the result/error alerts. No AsyncStorage reads/
                                     writes of its own — it calls into export-import.ts.

src/app/(tabs)/more.tsx             "the entry point" — the two rows you actually tap,
                                     each showing a one-time "here's what this does"
                                     notice before calling into export-import-flow.ts.
```

There's a fifth, smaller file worth knowing about too:
[`models/export-import.ts`](../src/models/export-import.ts) holds every type
this feature passes around (`WordBankExport`, `ExportedBook`, `SanitizedImport`,
the three merge-result types, `ImportMode`, `ImportResult`) — it's not one of
the four "layers" above, just the shared vocabulary all of them import.

Why split it like this? Two reasons, both called out in the files' own header
comments:

1. **`export-format.ts` is kept 100% free of AsyncStorage/React Native
   imports on purpose**, so it's easy to unit-test — you can feed it a plain
   JS string and check what comes back, no app, no device, no mocking needed.
2. Everything platform-specific (file pickers, share sheets, `window.confirm`
   vs. a native alert) is quarantined in `export-import-flow.ts`, so the
   storage logic never has to know or care whether it's running on iOS,
   Android, or web.

Keep this mental model handy — "rulebook → storage bridge → user-facing
plumbing → entry point" — as you read the rest of this doc.

---

## Part 1 — The rulebook: [`export-format.ts`](../src/storage/export-format.ts)

This file answers two questions: *"what does a valid backup file look like?"*
and *"if I hand you an untrusted file someone edited by hand (or a corrupted
one), what do I do with the parts that don't make sense?"*

### The shape of a backup file

```ts
export type WordBankExport = {
    formatName: "word-bank-backup";  // always this literal string
    formatVersion: number;           // currently 1 — see "format versioning" below
    exportedAt: number;              // when the file was written (ms since epoch)
    appVersion: string;              // the app's package.json version — just for support requests
    books: ExportedBook[];           // every book, each with its own words
    analyses: AnalysisHistoryEntry[]; // your sentence-analysis history
    memoryStats: WordStat[];         // the Memory tab's per-word practice counters
};
```

(This type, and every other shared type mentioned in this doc, actually lives
in [`models/export-import.ts`](../src/models/export-import.ts) — shown inline
here for readability.)

`ExportedBook` is just `{ book: ReadListBook; words: WordEntry[] }` — one
saved book, with the array of words you've added to it sitting right next to
it. This mirrors how the app actually stores things (see "the storage bridge"
below): a book's words live in a *separate* AsyncStorage entry from the book
itself, but a backup file bundles them together so the file is
self-contained.

`WordStat` (from [`models/word-stat.ts`](../src/models/word-stat.ts)) is
`{ word: string; stillLearning: number; knewIt: number; lastReviewedAt: number }`
— one word's practice counters, self-contained the same way. This is also
exactly the shape the app stores on-device (`memory_word_stats` in
[`memory-stats-storage.ts`](../src/storage/memory-stats-storage.ts)) — unlike
books, there's no reshaping needed at the export/import boundary for memory
stats, since both sides already agree on one plain array.

### Stripping local cover images — `stripLocalCoverUri`

```ts
export function stripLocalCoverUri(coverI: string): string {
    if (!coverI) {
        return coverI;
    }
    const isPortable = !coverI.includes("://") || coverI.startsWith("http://") || coverI.startsWith("https://");
    if (isPortable) {
        return coverI;
    }
    return "";
}
```

A book's `cover_i` field is usually just a plain OpenLibrary numeric id (e.g.
`"12345"`) or a full `http(s)://` URL — both are "portable": they mean the
same thing on any device. But a *custom* book's cover photo (picked via
`pick-cover-image.ts`) is stored as a device-local URI — `file://…`,
`content://…`, or `ph://…` — that literally cannot be opened on a different
phone, or even the same phone after a reinstall. This function's whole job is
to detect that case (anything containing `"://"` that *isn't* `http(s)://`)
and blank it out before it goes into the export, rather than writing a broken
link into the backup. Simple, deliberately narrow logic — it doesn't try to
validate the URL, it just checks "does this look like something only *this*
device can use?"

### Turning untrusted JSON into safe data — the `sanitize*` functions

This is the part worth reading slowly, because the same pattern repeats
across `sanitizeWordDefinition`, `sanitizeWordEntry`, `sanitizeReadListBook`,
`sanitizeAnalysisEntry`, and `sanitizeMemoryStat` — once you see it once
you've basically read all five:

```ts
function sanitizeWordEntry(raw: unknown): WordEntry | null {
    if (!isRecord(raw) || typeof raw.word !== "string" || raw.word.trim() === "") {
        return null;                          // ← reject: no usable "word" text at all
    }
    // ...
    return {
        word: raw.word,
        phonetic: optionalString(raw.phonetic),          // ← keep if present & a string, else undefined
        partOfSpeech: optionalString(raw.partOfSpeech) ?? "",
        // ...
    };
}
```

The idea: `raw` is `unknown` — it came from `JSON.parse`-ing a file someone
could have hand-edited, so **nothing about its shape can be trusted**. Each
`sanitize*` function:

1. Checks for the *one or two fields that genuinely can't be defaulted*
   (e.g. a word needs actual word text; a book needs a `key` and a `title`).
   If those are missing, the whole entry is thrown away — it returns `null`.
2. For every *other* field, it's "best effort": `optionalString`/
   `optionalNumber` (two tiny helper functions right above) either use the
   value if it's the right type, or fall back to `undefined`/a sane default.
   Nothing throws, nothing crashes the whole import over one bad field.

This is a really common, really useful shape for "validate input I don't
control" code, and it's worth recognizing: **reject only what truly can't be
salvaged, default everything else.**

`sanitizeMemoryStat` follows the identical shape, with `word` as its one
essential field (exactly like `sanitizeWordEntry`) and every counter defaulted
to `0`:

```ts
function sanitizeMemoryStat(raw: unknown): WordStat | null {
    if (!isRecord(raw) || typeof raw.word !== "string" || raw.word.trim() === "") {
        return null;
    }
    return {
        word: raw.word.trim().toLowerCase(),
        stillLearning: Math.max(0, optionalNumber(raw.stillLearning) ?? 0),
        knewIt: Math.max(0, optionalNumber(raw.knewIt) ?? 0),
        lastReviewedAt: Math.max(0, optionalNumber(raw.lastReviewedAt) ?? 0),
    };
}
```

`isRecord` (the small helper at the top) is just `typeof value === "object" &&
value !== null && !Array.isArray(value)` — TypeScript's way of narrowing
`unknown` down to "a plain object I can safely read `.someField` off of".

### Reading the whole file — `parseImportFile`

This is the function that actually gets called with the raw file text. Read
it as three stages:

```ts
export function parseImportFile(raw: string): SanitizedImport {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new ImportFormatError("This file isn't a Word Bank backup — it doesn't look like valid JSON.");
    }

    if (!isRecord(parsed) || parsed.formatName !== EXPORT_FORMAT_NAME) {
        throw new ImportFormatError("This file doesn't look like a Word Bank backup.");
    }
    // ... formatVersion checks ...
```

**Stage 1 — is this even a Word Bank file?** Not valid JSON → reject. Doesn't
have `formatName: "word-bank-backup"` → reject. `formatVersion` missing or
from a *future* app version this build doesn't understand → reject. These are
the *only* cases that throw `ImportFormatError` and refuse the whole file —
see "format versioning" below for why the version check matters.

**Stage 2 — walk every book/word/analysis/memory stat and sanitize each one
individually** using the functions from the previous section, counting (not
crashing on) the ones that don't survive:

```ts
for (const rawEntry of rawBooks) {
    const book = isRecord(rawEntry) ? sanitizeReadListBook(rawEntry.book) : null;
    if (!book) {
        skippedBooks++;
        continue;                 // ← one bad book doesn't stop the loop
    }
    // ... sanitize that book's words the same way ...
}
```

Books and words are nested (a `for` loop inside a `for` loop, since each
book carries its own word list); analyses and memory stats are both flat
arrays, so each gets one simple loop of its own, structurally identical to
each other:

```ts
const rawMemoryStats = Array.isArray(parsed.memoryStats) ? parsed.memoryStats : [];
let skippedMemoryStats = 0;
const memoryStats: WordStat[] = [];
for (const rawStat of rawMemoryStats) {
    const stat = sanitizeMemoryStat(rawStat);
    if (stat) {
        memoryStats.push(stat);
    } else {
        skippedMemoryStats++;
    }
}
```

**Stage 3 — return everything, good and bad, together:**

```ts
export type SanitizedImport = {
    data: WordBankExport;      // the cleaned-up data, ready to write to storage
    skippedBooks: number;      // how many were dropped, so the UI can tell the user
    skippedWords: number;
    skippedAnalyses: number;
    skippedMemoryStats: number;
};
```

This `skipped*` counting is what lets `export-import-flow.ts` later show you
something like *"3 books, 40 words. 2 unreadable entries skipped."* instead of
either silently losing data or refusing an otherwise-fine file over one typo.

### Format versioning — why `CURRENT_FORMAT_VERSION` exists

```ts
export const CURRENT_FORMAT_VERSION = 1;
```

The file's header comment spells out the contract: *"bump
`CURRENT_FORMAT_VERSION` on breaking changes, and keep `parseImportFile` able
to read every version up to the current one."* In plain words: if a future
version of the app changes what a backup file contains in some way that
*old* parsing code couldn't handle (e.g. a required field gets renamed), the
version number goes up, and `parseImportFile`'s `formatVersion > CURRENT_FORMAT_VERSION`
check is what stops an *older* app build from misreading a *newer* file it
doesn't understand yet — instead of silently corrupting your data, it shows
"this backup was made by a newer version of Word Bank."

Nothing in the codebase currently branches on the version number itself
(there's only ever been version 1) — when `memoryStats` changed shape from a
keyed object to a plain array, the decision was made *not* to bump the
version or add a migration for it: an old backup's `memoryStats` field just
comes back empty on import (`Array.isArray` fails on the old object shape,
falls back to `[]`), while everything else in that same old file — books,
words, analyses — still imports completely normally. That's a fine trade-off
for a field this new and low-stakes; a more significant future change would
be a better candidate for an actual version bump.

### The merge helpers — `mergeWords`, `mergeAnalyses`, and `mergeMemoryStats`

These only run for a **merge** import (never for **replace**, which wipes
first — see Part 2). All three share the exact same idea, so once you
understand one you understand all of them:

```ts
export function mergeWords(existing: WordEntry[], incoming: WordEntry[]): WordMergeResult {
    const seen = new Set(existing.map((w) => w.word.trim().toLowerCase()));
    const additions = incoming.filter((w) => !seen.has(w.word.trim().toLowerCase()));
    return { merged: [...existing, ...additions], added: additions.length };
}
```

1. Build a `Set` of every word you already have, normalized (trimmed,
   lowercased) so `"Cat"` and `" cat "` count as the same word.
2. Keep only the *incoming* words that aren't already in that set.
3. The result is `existing` first, untouched, with only the genuinely new
   ones appended after. **A word already on your device always wins** — if
   the import file has a different definition saved for a word you already
   have, that difference is silently dropped. This is a deliberate, simple
   rule: your on-device data is never overwritten by a merge, only added to.

`mergeAnalyses` does the identical thing but keys on `lang:text` (language +
the lowercased sentence) instead of just the word text, and additionally
re-sorts everything newest-first and caps it at `MAX_ANALYSES_ENTRIES` (20)
afterward — same cap the app already enforces on every normal analysis save
(see `addAnalysis` in [analysis-storage.ts](../src/storage/analysis-storage.ts)).

`mergeMemoryStats` is now a near-exact copy of `mergeWords` — one word's
practice stats already on the device always win over an incoming copy for
that same word:

```ts
export function mergeMemoryStats(existing: WordStat[], incoming: WordStat[]): MemoryStatsMergeResult {
    const seen = new Set(existing.map((stat) => stat.word));
    const additions = incoming.filter((stat) => !seen.has(stat.word));
    return { merged: [...existing, ...additions], added: additions.length };
}
```

No `.trim().toLowerCase()` needed here the way `mergeWords` does it — every
`word` reaching this function is already normalized, either by
`recordRating`'s key (on-device) or by `sanitizeMemoryStat` above (imported).
Note this specifically means practice counts are never *summed* across a
merge — if you practiced the same word on two devices before merging their
backups, only one device's count survives. That was a deliberate choice for
consistency with `mergeWords`/`mergeAnalyses` (and to keep merge idempotent —
importing the same backup twice changes nothing the second time), not an
oversight.

---

## Part 2 — The storage bridge: [`export-import.ts`](../src/storage/export-import.ts)

This is the *only* file in the whole feature that actually reads or writes
AsyncStorage for import/export — its header comment says so explicitly. It has
three exported functions: `buildExport`/`applyImport` (one for each
direction), plus a small helper, `hasExistingData`, that `export-import-flow.ts`
uses to decide whether importing even needs to ask a question at all — see
Part 3.

### Building an export — `buildExport`

```ts
export async function buildExport(): Promise<WordBankExport> {
    const books = await getReadList();
    const exportedBooks: ExportedBook[] = await Promise.all(
        books.map(async (book) => ({
            book: { ...book, cover_i: stripLocalCoverUri(book.cover_i) },
            words: await getWords(book.key),
        })),
    );
    const analyses = await getAnalysisHistory();
    const memoryStats = await getMemoryStats();

    return { formatName: EXPORT_FORMAT_NAME, formatVersion: CURRENT_FORMAT_VERSION, exportedAt: Date.now(), appVersion, books: exportedBooks, analyses, memoryStats };
}
```

Read this as: *"get the read list ([`getReadList`](../src/storage/read-list-storage.ts)),
then for every book, fetch its words separately ([`getWords`](../src/storage/words-storage.ts),
since — remember — each book's words live under their own `words_<key>`
AsyncStorage entry, not inside the book object itself), stitch book + words
back together into one `ExportedBook`, strip any local-only cover URI along
the way, then grab the analysis history and the memory stats too, and wrap it
all up with a timestamp/format marker."* The `Promise.all` just means all
those books' word lookups happen in parallel rather than one at a time — a
minor speed detail, not a correctness one. `getMemoryStats()` needs no
reshaping at all before being assigned — see Part 1's note on `WordStat`
already being the same shape on both sides of the boundary.

### Applying an import — `applyImport`

This function is the mirror image, and its two branches (`mode === "replace"`
vs. the merge path) are worth reading side by side.

**Replace** is the simple branch — wipe, then restore exactly what the file
says:

```ts
if (mode === "replace") {
    await clearAllBookData();
    await Promise.all(data.books.map((entry) => setWords(entry.book.key, entry.words)));
    await setReadList(data.books.map((entry) => entry.book));
    await setAnalysisHistory(data.analyses);
    await setMemoryStats(data.memoryStats);
    // ... return a summary of what was written ...
}
```

`clearAllBookData()` (in [read-list-storage.ts](../src/storage/read-list-storage.ts#L128))
is the same function More → "Delete all data" uses — it empties the read
list, removes every book's word collection, and clears both the analysis
history *and* the Memory-tab practice stats. The comment right above this
code block explains why that's still correct here even though it looks
aggressive: *all four* — books, words, analyses, memory stats — get written
back immediately after from the file's own contents, so nothing is
permanently lost, it's genuinely a clean "replace everything with exactly
what's in this file."

**Merge** is the more careful branch — it goes book by book:

```ts
for (const entry of data.books) {
    if (!existingKeys.has(entry.book.key)) {
        // New book: add it (and its words) as-is from the file.
        nextBooks.push(entry.book);
        await setWords(entry.book.key, entry.words);
        booksAdded++;
        wordsAdded += entry.words.length;
        continue;
    }
    // Already on-device: only its words are merged; review/notes/rating/status
    // are left untouched, and an existing word always wins over an incoming copy.
    const existingWords = await getWords(entry.book.key);
    const { merged, added } = mergeWords(existingWords, entry.words);
    if (added > 0) {
        await setWords(entry.book.key, merged);
    }
    booksMerged++;
    wordsAdded += added;
}
```

Two cases per book from the file:

- **You don't have this book yet** (its `key` isn't in your read list) → add
  the whole thing, book and words, exactly as the file has it.
- **You already have this book** → the *book itself* (its status, star
  rating, review, notes) is left completely alone — only its **words** get
  merged in via `mergeWords` from Part 1. This is a deliberate choice: a
  merge import shouldn't silently overwrite a review you wrote, just because
  an old backup happens to also have that book in it.

After the books loop, the analysis history is merged the same way via
`mergeAnalyses`, and then the memory stats too via `mergeMemoryStats` — each
following the identical "read existing, merge, write back only if something
was actually added" shape:

```ts
const existingMemoryStats = await getMemoryStats();
const { merged: mergedMemoryStats, added: memoryStatsAdded } = mergeMemoryStats(existingMemoryStats, data.memoryStats);
if (memoryStatsAdded > 0) {
    await setMemoryStats(mergedMemoryStats);
}
```

The whole thing returns an `ImportResult` —
`booksAdded`/`booksMerged`/`wordsAdded`/`analysesAdded`/`memoryStatsAdded` —
which is exactly the data `export-import-flow.ts`'s summary alert reads from.

### The third function — `hasExistingData`

```ts
export async function hasExistingData(): Promise<boolean> {
    const [books, analyses, memoryStats] = await Promise.all([getReadList(), getAnalysisHistory(), getMemoryStats()]);
    return books.length > 0 || analyses.length > 0 || memoryStats.length > 0;
}
```

This one isn't part of either export or import's actual data flow — it exists
purely to answer one yes/no question for `export-import-flow.ts`: *"is there
anything on this device already?"* The reason that question matters: on a
fresh install (or right after "Delete all data"), **merge** and **replace**
behave identically — with nothing existing to merge into or replace, every
book/analysis/memory-stat in the file just counts as new either way. Asking
the user to pick between two options that do the exact same thing is a
pointless question, so `importData()` (Part 3) uses this to skip it.

---

## Part 3 — The user-facing plumbing: [`export-import-flow.ts`](../src/utils/export-import-flow.ts)

This file is where "the abstract data operation" turns into "an actual button
that does something you can see." Its header comment calls out its scope
precisely: *file I/O and user prompts only* — it never touches AsyncStorage
directly, it just calls `buildExport`/`parseImportFile`/`applyImport` from
the two files above.

### Exporting — `exportData()`

```ts
export async function exportData(): Promise<void> {
    try {
        const data = await buildExport();
        if (data.books.length === 0 && data.analyses.length === 0 && data.memoryStats.length === 0) {
            alertDialog("Nothing to export yet", "...");
            return;
        }
        const json = JSON.stringify(data, null, 2);
        if (Platform.OS === "web") {
            downloadOnWeb(json);
            return;
        }
        await shareOnNative(json);
    } catch {
        alertDialog("Export failed", "...");
    }
}
```

Straightforward once you've read Part 2: build the export object, bail out
with a friendly message if there's genuinely nothing to back up (checking all
three collections — a device with zero books/words/analyses but leftover
practice stats, e.g. after deleting a book without ever clearing its stats on
the Stats screen, still has something worth backing up), otherwise serialize
it to indented JSON (`JSON.stringify(data, null, 2)` — the `2` just makes the
file human-readable if you ever open it yourself) and hand it off to one of
two platform-specific helpers:

- **`downloadOnWeb`** — there's no share sheet in a browser, so this creates
  an in-memory `Blob`, makes a temporary `<a download>` link pointing at it,
  and clicks it programmatically to trigger a normal browser file download,
  then cleans up the temporary URL (`URL.revokeObjectURL`).
- **`shareOnNative`** — writes the JSON to a real file in the app's cache
  directory (`expo-file-system`'s `File`), then hands that file's path to
  `expo-sharing`'s `Sharing.shareAsync(...)`, which pops the native "Share via
  Mail / Drive / Files / …" sheet you're used to from other apps. If sharing
  genuinely isn't available on that device, it falls back to just telling you
  where the file was saved instead of failing silently.

### Importing — `importData()`, `readPickedFile`, and `runImport`

Import has one more moving part than export because it involves a *choice*
(merge vs. replace) partway through — except when there's nothing to choose
between. Read it top to bottom as one flow:

```ts
export async function importData(): Promise<void> {
    try {
        const picked = await DocumentPicker.getDocumentAsync({ type: [...], copyToCacheDirectory: true, multiple: false });
        if (picked.canceled || !picked.assets?.[0]) {
            return;                                    // user backed out of the file picker — silently do nothing
        }
        const raw = await readPickedFile(picked.assets[0]);
        const parsed = parseImportFile(raw);           // ← throws ImportFormatError for a bad file (Part 1)
        const memoryStatsCount = parsed.data.memoryStats.length;
        if (parsed.data.books.length === 0 && parsed.data.analyses.length === 0 && memoryStatsCount === 0) {
            alertDialog("Nothing to import", "...");
            return;
        }

        if (!(await hasExistingData())) {
            // Nothing on-device yet — merge vs. replace would behave identically,
            // so just load the file directly instead of asking a meaningless question.
            void runImport(parsed, "replace");
            return;
        }

        // ... build a summary string, then:
        showActionSheet("Import data", `Found ${...}. How do you want to import them?`, [
            { text: "Merge with existing", onPress: () => void runImport(parsed, "merge") },
            { text: "Replace everything", style: "destructive", onPress: () => void runImport(parsed, "replace") },
            { text: "Cancel", style: "cancel" },
        ]);
    } catch (error) {
        alertDialog("Import failed", error instanceof ImportFormatError ? error.message : "...");
    }
}
```

Step by step: open the native document picker (accepting a few different
MIME types since, per the code comment, some Android file managers
mis-report a plain `.json` file as `application/octet-stream` or
`text/plain`) → read its text via `readPickedFile` → hand that text to
`parseImportFile` (all of Part 1 happens right here, inside this `try`) →
show a one-time "nothing in this file" notice if it's empty → check
`hasExistingData()` (Part 2) and, on an empty device, skip straight to
`runImport` with no prompt at all → otherwise show an action sheet with a
plain-language summary ("Found 3 books, 40 words, 2 sentence analyses, and 5
practice stats...") and let the user pick **Merge** or **Replace**.

`readPickedFile` exists because *reading the actual bytes of a picked file*
works differently per platform — the comment above it and the branching
inside both spell this out: on web, either the picker handed back a real
browser `File` object (call `.text()` on it) or just a `blob:` URL (`fetch`
it and read the text back); on native, `expo-file-system`'s `File(...).text()`
handles it directly.

Whichever button the user taps, it flows into `runImport`:

```ts
async function runImport(parsed: SanitizedImport, mode: ImportMode): Promise<void> {
    try {
        const result = await applyImport(parsed.data, mode);   // ← Part 2 happens here
        // ... build "3 new books, 12 new words, 1 new analysis, 2 new practice stats." style summary ...
        alertDialog("Import complete", `${parts.join(", ")}.${skippedNote}`);
    } catch {
        alertDialog("Import failed", "...");
    }
}
```

This is where `applyImport` from Part 2 actually gets called, and where the
`skippedBooks`/`skippedWords`/`skippedAnalyses`/`skippedMemoryStats` counts
from Part 1 finally get surfaced to the user, as a trailing sentence like *"2
unreadable entries skipped."* — so a slightly-corrupted file doesn't fail the
whole import, but you're still told something didn't make it in.

---

## Part 4 — The entry point: `more.tsx`'s `handleExportData` / `handleImportData`

Everything above happens *after* one more step you'd actually see first: a
one-time explainer alert, using the shared `alertDialog` helper's
`dontShowAgain` option (see [alert-dialog.ts](../src/utils/alert-dialog.ts)):

```ts
function handleExportData(): void {
    alertDialog(
        "Export data",
        "This saves your books, words, and analyses to a JSON file on your device, which you can then share or save anywhere you like.",
        {
            dontShowAgain: { id: "export-data", checkboxLabel: "Don't show this again" },
            onAcknowledge: () => void exportData(),
        },
    );
}
```

`handleImportData` is the same shape with its own `id: "import-data"` and its
own explainer text. Two things worth noticing here:

1. **The confirmation dialog and the actual work are deliberately kept in
   different files.** `more.tsx` only knows "show this heads-up, then call
   `exportData()`/`importData()` once the user says OK" — it has no idea
   *how* export or import actually works. That's the same split the file
   header comments describe elsewhere in this feature: each layer only knows
   about the layer directly below it.
2. **`dontShowAgain` is a real persisted preference**, not just in-memory
   state — `alertDialog` checks `dismissed-alerts-storage.ts` up front
   ([alert-dialog.ts:70](../src/utils/alert-dialog.ts#L70)) and skips
   straight to `onAcknowledge()` if you've previously ticked the checkbox for
   that exact `id`. So after the first time, tapping "Export Data" or "Import
   Data" goes straight to the real action with no dialog at all.

---

## Following one tap, start to finish

Putting all four parts together — here's literally everything that happens
when you tap **Export Data**:

1. `more.tsx`'s `handleExportData()` fires.
2. `alertDialog(...)` checks `dismissed-alerts-storage.ts` — if you've
   dismissed this notice before, it skips straight to step 4; otherwise it
   shows the explainer and waits for OK.
3. You tap OK → `onAcknowledge` runs → `exportData()` (in
   `export-import-flow.ts`) is called.
4. `exportData()` calls `buildExport()` (in `export-import.ts`), which reads
   your read list, every book's words, your analysis history, and your
   Memory-tab practice stats straight out of AsyncStorage and assembles one
   `WordBankExport` object, stripping any device-local cover photo URIs along
   the way (`stripLocalCoverUri`, from `export-format.ts`).
5. If there's genuinely nothing saved anywhere (books, analyses, *and*
   memory stats all empty), you get a friendly "nothing to export yet"
   message and the flow stops here.
6. Otherwise the object is turned into indented JSON text, and either
   downloaded (web) or written to a cache file and handed to the native share
   sheet (`shareOnNative`).

And **Import Data**:

1. `more.tsx`'s `handleImportData()` fires, same dismissible-notice dance as
   export.
2. `importData()` (in `export-import-flow.ts`) opens the native file picker.
3. The picked file's text is read (`readPickedFile`) and handed to
   `parseImportFile` (in `export-format.ts`), which rejects the whole file
   only for a file-level problem (bad JSON / wrong format marker / too-new
   version), and otherwise sanitizes every book/word/analysis/memory-stat
   entry individually, dropping and counting anything unusable.
4. If the sanitized result is empty, you get a "nothing to import" message.
5. `hasExistingData()` (in `export-import.ts`) checks whether you have
   anything on-device at all. If not — a fresh install, or right after
   "Delete all data" — there's no real choice to make (merge and replace
   would do the exact same thing), so the file is applied immediately, no
   prompt shown.
6. Otherwise you're shown a summary + a choice: **Merge with existing** or
   **Replace everything**.
7. Whichever you pick, `runImport` calls `applyImport` (in
   `export-import.ts`), which either wipes and restores everything exactly
   (`clearAllBookData` + write the file's data back), or walks book-by-book
   adding new ones as-is and merging words/analyses/memory stats into what
   you already have (`mergeWords`/`mergeAnalyses`/`mergeMemoryStats`, from
   `export-format.ts`, existing data always wins).
7. You see a final "Import complete" summary, including how many entries were
   skipped as unreadable, if any.

---

## A few concepts worth remembering

- **Untrusted input gets sanitized field-by-field, not accepted or rejected
  as a whole.** Only a handful of "can't be defaulted" fields (a word's text,
  a book's key/title, the file's format marker) cause something to be
  thrown away; everything else degrades gracefully to a sensible default.
- **"Merge" never overwrites what you already have** — new books/words/
  analyses/memory stats are *added*, but anything already on your device (a
  review, a word's saved definition, an existing analysis, a word's practice
  counts) always wins over an incoming copy with the same identity. This also
  keeps merge idempotent — importing the same backup twice changes nothing
  the second time.
- **"Replace" is safe specifically because everything gets restored right
  back from the same file** — it's not "delete some things", it's "delete
  everything, then rebuild it from this file", which nets out to just
  "make my data exactly match this backup."
- **Local-only file paths (a custom cover photo) never leave the device** —
  they're blanked out before the export is even built, so a restored backup
  on a different device just falls back to the placeholder cover instead of
  a broken image link.
- **Every collection this app persists is a plain array of self-contained
  records — the backup file just mirrors that.** `books`, `analyses`, and
  `memoryStats` are all arrays in the file for the same reason `read_list`,
  `sentence_analyses`, and `memory_word_stats` are all arrays on-device: one
  consistent shape, no keyed-object outlier to special-case at the storage
  boundary.
- **Each file only knows about the layer directly beneath it** —
  `more.tsx` → `export-import-flow.ts` → `export-import.ts` → `export-format.ts`.
  If you ever need to change *what a backup file contains*, you're almost
  certainly editing `export-format.ts` (and `models/export-import.ts` for the
  type) alone; if you need to change *how the file gets shared or picked*,
  that's `export-import-flow.ts` alone.

## Related files, for more context

- [`read-list-storage.ts`](../src/storage/read-list-storage.ts) — owns
  `getReadList`/`setReadList` and `clearAllBookData`, the functions
  `export-import.ts` builds on. Also documents the read-list migrations
  (renamed/legacy fields) that run every time it's loaded — worth knowing
  about since a very old backup file could contain pre-migration field names
  too.
- [`words-storage.ts`](../src/storage/words-storage.ts) — the simple
  `getWords`/`setWords` pair, one AsyncStorage entry per book (`words_<key>`).
- [`analysis-storage.ts`](../src/storage/analysis-storage.ts) — see
  `setAnalysisHistory`, added specifically for import's "bulk overwrite"
  need, alongside the normal `addAnalysis`/`removeAnalysis` used elsewhere.
- [`memory-stats-storage.ts`](../src/storage/memory-stats-storage.ts) — see
  `getMemoryStats`/`setMemoryStats`, this feature's other "bulk read/bulk
  overwrite" pair, alongside the normal one-word-at-a-time
  `recordRating`/`removeMemoryStat` used by the Memory tab and Stats screen.
- [`alert-dialog.ts`](../src/utils/alert-dialog.ts) and
  [`show-action-sheet.ts`](../src/utils/show-action-sheet.ts) — the shared,
  platform-safe dialog/action-sheet helpers this feature (and most of the
  rest of the app) is built on.
- [`export-format.ts`](../src/storage/export-format.ts)'s own file-header
  comment, [`models/export-import.ts`](../src/models/export-import.ts)'s own
  header comment, and [AGENTS.md](../AGENTS.md)'s "Data layer" table are the
  places this contract is summarized even more tersely, if you want the
  quick-reference version after finishing this doc.
