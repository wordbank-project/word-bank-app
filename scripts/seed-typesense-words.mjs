// Create + fill a Typesense word collection for as-you-type suggestions —
// the index behind fetchTypesenseWordSuggestions (src/utils/api/typesense-api.ts).
// See docs/typesense.md for the whole picture; this is the seeding half.
//
//   node scripts/seed-typesense-words.mjs --lang en --file words-en.txt \
//     --host http://localhost:8108 --key <ADMIN_KEY>
//
// --file is any newline-delimited word list (blank lines and duplicates are
// dropped). Where to get one is a separate, deliberately manual step — a
// kaikki.org Wiktionary dump, the wiktionary.db a self-hosted wiktapi.dev
// already builds (see docs/dictionary-api.md), or any word-frequency list. A
// short hand-written list is enough to smoke-test the whole path end to end.
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
 * Reads the word list, dropping blanks and duplicates.
 *
 * @param {string} path Path to the newline-delimited word list.
 * @returns {string[]} The unique, lowercased, trimmed words, in file order.
 *
 */
function readWords(path) {
    const seen = new Set();
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const word = line.trim().toLowerCase();
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
            // `word` is the only field the app queries (query_by=word).
            fields: [{ name: 'word', type: 'string' }],
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
 * @returns {Promise<number>} How many documents the server reported as successful.
 *
 */
async function importBatch(batch) {
    // id = the word itself, so a re-run updates rather than duplicates.
    const jsonl = batch.map((word) => JSON.stringify({ id: word, word })).join('\n');
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
    imported += await importBatch(words.slice(i, i + BATCH_SIZE));
    console.log(`  ${Math.min(i + BATCH_SIZE, words.length)}/${words.length}`);
}

console.log(`Done — ${imported} document(s) in ${collection}.`);
