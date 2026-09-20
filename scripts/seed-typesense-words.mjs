// Create + fill a Typesense word collection for as-you-type suggestions —
// the index behind fetchTypesenseWordSuggestions (src/utils/api/typesense-api.ts).
// See docs/typesense.md for the whole picture; this is the seeding half.
//
//   node scripts/seed-typesense-words.mjs --lang en --file en_50k.txt \
//     --host http://localhost:8108 --key <ADMIN_KEY>
//
// --file is a newline-delimited word list, in either shape:
//   word            (plain, one per line)
//   word 12345      (word + frequency count, e.g. hermitdave/FrequencyWords)
// Only the first whitespace-separated token is read, so both just work.
//
// ORDER MATTERS: each word's line number becomes its `rank`, and the app sorts
// by `_text_match:desc, rank:asc` — so a FREQUENCY-ORDERED list gives good
// suggestions and an alphabetical one gives poor ones. Measured on a 235k-word
// alphabetical dump, "ephem" didn't return "ephemeral" in the top 6 at all
// (buried under ephemeromorphic/ephemeridae) and "recieve" ranked "reliever"
// above "receive". With a frequency-ordered list both land first.
// docs/typesense.md has the source recommendation and the full numbers.
//
// --key must be an ADMIN key (creating a collection and writing documents are
// both privileged). It stays here, run locally — the app itself only ever gets
// a search-only key. Never put an admin key in .env.local or eas.json.
//
// Re-running is safe: an existing collection is kept and documents are
// upserted, so this doubles as the "refresh the word list" path.
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, arg, i, all) => {
        if (arg.startsWith('--')) {
            pairs.push([arg.slice(2), all[i + 1]]);
        }
        return pairs;
    }, []),
);

const { lang, file, host, key } = args;
if (!lang || !file || !host || !key) {
    console.error('Usage: node scripts/seed-typesense-words.mjs --lang <code> --file <wordlist> --host <url> --key <admin-key>');
    process.exit(1);
}

// Must match typesense-api.ts's collectionName().
const collection = `words_${lang}`;
const headers = { 'X-TYPESENSE-API-KEY': key };

// Typesense caps a single import body's size, so send the list in chunks
// rather than one request for a few hundred thousand words.
const BATCH_SIZE = 5000;

/**
 * Reads the word list, dropping blanks and duplicates. Takes only the first
 * whitespace-separated token per line, so a plain list and a "word count"
 * frequency list both parse. File order is preserved — it becomes the rank.
 *
 * @param {string} path Path to the newline-delimited word list.
 * @returns {string[]} The unique, lowercased words, in file order.
 *
 */
function readWords(path) {
    const seen = new Set();
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const word = line.trim().split(/\s+/)[0]?.toLowerCase();
        if (word) {
            seen.add(word);
        }
    }
    return [...seen];
}

/**
 * Creates the collection, treating "already exists" as success so re-runs just
 * refresh the documents.
 *
 * @returns {Promise<void>} Resolves once the collection exists.
 *
 */
async function ensureCollection() {
    const res = await fetch(`${host}/collections`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: collection,
            // `word` is what the app queries (query_by=word); `rank` is what it
            // sorts by after text-match score, so common words win ties.
            fields: [
                { name: 'word', type: 'string' },
                { name: 'rank', type: 'int32' },
            ],
        }),
    });
    if (res.ok) {
        console.log(`Created collection ${collection}`);
        return;
    }
    // 409 = already there, which is the normal path on every re-run.
    if (res.status === 409) {
        console.log(`Collection ${collection} already exists — upserting into it`);
        return;
    }
    throw new Error(`Could not create ${collection}: ${res.status} ${await res.text()}`);
}

/**
 * Upserts one batch of words as JSONL (Typesense's bulk import format).
 *
 * @param {string[]} batch The words to send.
 * @param {number} startRank The rank of the batch's first word (its line number in the source list).
 * @returns {Promise<number>} How many documents the server reported as successful.
 *
 */
async function importBatch(batch, startRank) {
    // id = the word itself, so a re-run updates rather than duplicates.
    const jsonl = batch
        .map((word, i) => JSON.stringify({ id: word, word, rank: startRank + i }))
        .join('\n');
    const res = await fetch(`${host}/collections/${collection}/documents/import?action=upsert`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: jsonl,
    });
    if (!res.ok) {
        throw new Error(`Import failed: ${res.status} ${await res.text()}`);
    }
    // The response is one JSON result per line; anything not {"success":true}
    // is a rejected document worth surfacing rather than silently losing.
    const results = (await res.text()).split('\n').filter(Boolean);
    const failures = results.filter((line) => !line.includes('"success":true'));
    if (failures.length > 0) {
        console.warn(`  ${failures.length} document(s) rejected, first: ${failures[0]}`);
    }
    return results.length - failures.length;
}

const words = readWords(file);
console.log(`Seeding ${words.length} words into ${collection} at ${host}`);

await ensureCollection();

let imported = 0;
for (let i = 0; i < words.length; i += BATCH_SIZE) {
    imported += await importBatch(words.slice(i, i + BATCH_SIZE), i);
    console.log(`  ${Math.min(i + BATCH_SIZE, words.length)}/${words.length}`);
}

console.log(`Done — ${imported} document(s) in ${collection}.`);
