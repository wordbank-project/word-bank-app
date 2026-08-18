import AsyncStorage from "@react-native-async-storage/async-storage";

import { MAX_ANALYSES_ENTRIES } from "@/models/sentence-analysis";
import type { AnalysisHistoryEntry } from "@/models/sentence-analysis";
import { READ_STATUS_ORDER } from "@/models/read-list-book";
import type { ReadListBook } from "@/models/read-list-book";
import type { WordEntry } from "@/models/word-entry";

import { clearAllBookData, setReadList } from "@/storage/read-list-storage";
import { setAnalysisHistory } from "@/storage/analysis-storage";
import { setMemoryStats, type WordStat } from "@/storage/memory-stats-storage";
import { pick, randomInt, shuffle } from "@/utils/random";

// Dev-only: generates large amounts of realistic-shaped test data (books,
// words, sentence analyses, Memory-tab practice stats) for stress-testing
// lists/filters/sort/Memory/export-import with real volume. Only ever
// reachable from More → Developer's __DEV__-gated "Seed test data" row —
// never runs in a production build. Always wipes existing book data first
// (via clearAllBookData, which also clears memory stats) so repeated runs
// are reproducible instead of accumulating.

export type SeedSize = "small" | "medium" | "large";

export type SeedResult = {
    books: number;
    words: number;
    analyses: number;
    wordsWithStats: number;
};

const SEED_SIZES: Record<SeedSize, { books: number; minWords: number; maxWords: number }> = {
    small: { books: 10, minWords: 3, maxWords: 10 },
    medium: { books: 50, minWords: 5, maxWords: 20 },
    large: { books: 200, minWords: 10, maxWords: 30 },
};

// Public-domain-style title/author pairs — enough variety to not feel
// mechanical; repeats (with a unique key suffix) once a preset needs more
// books than this list has entries.
const SEED_BOOKS: { title: string; author: string; year: string }[] = [
    { title: "Pride and Prejudice", author: "Jane Austen", year: "1813" },
    { title: "Moby-Dick", author: "Herman Melville", year: "1851" },
    { title: "Frankenstein", author: "Mary Shelley", year: "1818" },
    { title: "Dracula", author: "Bram Stoker", year: "1897" },
    { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", year: "1892" },
    { title: "Great Expectations", author: "Charles Dickens", year: "1861" },
    { title: "Jane Eyre", author: "Charlotte Brontë", year: "1847" },
    { title: "Wuthering Heights", author: "Emily Brontë", year: "1847" },
    { title: "The Picture of Dorian Gray", author: "Oscar Wilde", year: "1890" },
    { title: "Crime and Punishment", author: "Fyodor Dostoevsky", year: "1866" },
    { title: "War and Peace", author: "Leo Tolstoy", year: "1869" },
    { title: "Anna Karenina", author: "Leo Tolstoy", year: "1877" },
    { title: "The Odyssey", author: "Homer", year: "-800" },
    { title: "Don Quixote", author: "Miguel de Cervantes", year: "1605" },
    { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", year: "1865" },
    { title: "The Time Machine", author: "H. G. Wells", year: "1895" },
    { title: "The War of the Worlds", author: "H. G. Wells", year: "1898" },
    { title: "A Tale of Two Cities", author: "Charles Dickens", year: "1859" },
    { title: "Oliver Twist", author: "Charles Dickens", year: "1837" },
    { title: "The Count of Monte Cristo", author: "Alexandre Dumas", year: "1844" },
    { title: "The Three Musketeers", author: "Alexandre Dumas", year: "1844" },
    { title: "Little Women", author: "Louisa May Alcott", year: "1868" },
    { title: "The Scarlet Letter", author: "Nathaniel Hawthorne", year: "1850" },
    { title: "Heart of Darkness", author: "Joseph Conrad", year: "1899" },
    { title: "Treasure Island", author: "Robert Louis Stevenson", year: "1883" },
    { title: "The Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson", year: "1886" },
    { title: "Gulliver's Travels", author: "Jonathan Swift", year: "1726" },
    { title: "The Wonderful Wizard of Oz", author: "L. Frank Baum", year: "1900" },
    { title: "Peter Pan", author: "J. M. Barrie", year: "1911" },
    { title: "The Legend of Sleepy Hollow", author: "Washington Irving", year: "1820" },
];

// Curated word pool — enough spread across the four main parts of speech
// (see utils/part-of-speech.ts's POS_ORDER) that the Words List's POS filter
// has real variety. Phonetic/exampleSentence are only on some entries, same
// as real dictionary data.
const SEED_WORDS: { word: string; partOfSpeech: string; definition: string; phonetic?: string; exampleSentence?: string }[] = [
    { word: "serendipity", partOfSpeech: "noun", definition: "The occurrence of finding something good without looking for it.", phonetic: "/ˌserənˈdɪpɪti/", exampleSentence: "Finding this old photograph was pure serendipity." },
    { word: "ephemeral", partOfSpeech: "adjective", definition: "Lasting for a very short time.", phonetic: "/ɪˈfɛmərəl/", exampleSentence: "The beauty of cherry blossoms is ephemeral." },
    { word: "melancholy", partOfSpeech: "noun", definition: "A deep, pensive, long-lasting sadness.", exampleSentence: "A quiet melancholy settled over the empty house." },
    { word: "resilience", partOfSpeech: "noun", definition: "The capacity to recover quickly from difficulties." },
    { word: "eloquent", partOfSpeech: "adjective", definition: "Fluent and persuasive in speaking or writing.", phonetic: "/ˈɛləkwənt/", exampleSentence: "His eloquent speech moved the entire audience." },
    { word: "ambiguous", partOfSpeech: "adjective", definition: "Open to more than one interpretation.", phonetic: "/æmˈbɪɡjuəs/", exampleSentence: "The instructions were so ambiguous that no one knew what to do." },
    { word: "tenacious", partOfSpeech: "adjective", definition: "Persisting firmly, not readily giving up.", phonetic: "/təˈneɪʃəs/", exampleSentence: "The tenacious reporter refused to give up on the story." },
    { word: "vivid", partOfSpeech: "adjective", definition: "Producing powerful feelings or clear images in the mind.", phonetic: "/ˈvɪvɪd/", exampleSentence: "She had a vivid memory of her first day at school." },
    { word: "profound", partOfSpeech: "adjective", definition: "Very great or intense; having deep insight.", phonetic: "/prəˈfaʊnd/" },
    { word: "meticulous", partOfSpeech: "adjective", definition: "Showing great attention to detail; very careful.", phonetic: "/məˈtɪkjələs/", exampleSentence: "He kept meticulous records of every transaction." },
    { word: "candid", partOfSpeech: "adjective", definition: "Truthful and straightforward; frank.", phonetic: "/ˈkændɪd/", exampleSentence: "She gave a candid answer, even though it wasn't flattering." },
    { word: "perseverance", partOfSpeech: "noun", definition: "Persistence in doing something despite difficulty.", phonetic: "/ˌpɜrsəˈvɪrəns/", exampleSentence: "Only through perseverance did she finally pass the exam." },
    { word: "whimsical", partOfSpeech: "adjective", definition: "Playfully quaint or fanciful.", exampleSentence: "The garden was full of whimsical sculptures shaped like animals." },
    { word: "diligent", partOfSpeech: "adjective", definition: "Showing care and conscientiousness in one's work." },
    { word: "wander", partOfSpeech: "verb", definition: "To walk slowly without a fixed direction or purpose.", phonetic: "/ˈwɑndər/", exampleSentence: "She loved to wander the old city streets." },
    { word: "linger", partOfSpeech: "verb", definition: "To stay in a place longer than necessary.", phonetic: "/ˈlɪŋɡər/", exampleSentence: "The smell of fresh bread lingered in the kitchen all morning." },
    { word: "ponder", partOfSpeech: "verb", definition: "To think about something carefully." },
    { word: "flourish", partOfSpeech: "verb", definition: "To grow or develop in a healthy or vigorous way.", exampleSentence: "The small business began to flourish after the renovation." },
    { word: "conceal", partOfSpeech: "verb", definition: "To keep something from being seen or known.", phonetic: "/kənˈsil/", exampleSentence: "She tried to conceal her disappointment with a smile." },
    { word: "beckon", partOfSpeech: "verb", definition: "To signal someone to approach or follow.", phonetic: "/ˈbɛkən/", exampleSentence: "The warm lights of home beckoned him from across the field." },
    { word: "murmur", partOfSpeech: "verb", definition: "To say something in a low, indistinct voice." },
    { word: "glisten", partOfSpeech: "verb", definition: "To shine with a sparkling light.", phonetic: "/ˈɡlɪsən/", exampleSentence: "Dew glistened on the grass in the early morning sun." },
    { word: "unravel", partOfSpeech: "verb", definition: "To undo twisted threads, or to investigate and solve.", phonetic: "/ʌnˈrævəl/", exampleSentence: "It took months for detectives to unravel the mystery." },
    { word: "kindle", partOfSpeech: "verb", definition: "To start a fire, or to arouse a feeling." },
    { word: "quaint", partOfSpeech: "adjective", definition: "Attractively unusual or old-fashioned.", phonetic: "/kweɪnt/", exampleSentence: "They stayed in a quaint little cottage by the sea." },
    { word: "solitude", partOfSpeech: "noun", definition: "The state of being alone.", phonetic: "/ˈsɑlɪˌtud/", exampleSentence: "He treasured the solitude of his early morning walks." },
    { word: "wistful", partOfSpeech: "adjective", definition: "Having a feeling of vague or regretful longing.", exampleSentence: "She gave a wistful smile at the mention of her childhood home." },
    { word: "gregarious", partOfSpeech: "adjective", definition: "Fond of company; sociable.", phonetic: "/ɡrɪˈɡɛriəs/", exampleSentence: "He was gregarious by nature, always the first to strike up a conversation." },
    { word: "obscure", partOfSpeech: "adjective", definition: "Not clearly expressed or easily understood; little known." },
    { word: "luminous", partOfSpeech: "adjective", definition: "Full of or shedding light; glowing.", phonetic: "/ˈlumɪnəs/", exampleSentence: "The luminous moon lit up the entire valley." },
    { word: "fervent", partOfSpeech: "adjective", definition: "Having or displaying passionate intensity." },
    { word: "austere", partOfSpeech: "adjective", definition: "Severe or strict in manner or appearance; simple, without luxury.", phonetic: "/ɔˈstɪr/", exampleSentence: "The monastery's austere rooms had nothing but a bed and a chair." },
    { word: "benevolent", partOfSpeech: "adjective", definition: "Well-meaning and kindly.", phonetic: "/bəˈnɛvələnt/", exampleSentence: "The benevolent old man donated most of his fortune to charity." },
    { word: "candor", partOfSpeech: "noun", definition: "The quality of being open and honest.", phonetic: "/ˈkændər/", exampleSentence: "I appreciate your candor, even when the truth is hard to hear." },
    { word: "clarity", partOfSpeech: "noun", definition: "The quality of being clear, coherent, and easy to understand.", phonetic: "/ˈklærɪti/", exampleSentence: "Her explanation brought sudden clarity to a confusing topic." },
    { word: "curiosity", partOfSpeech: "noun", definition: "A strong desire to know or learn something.", phonetic: "/ˌkjʊriˈɑsɪti/", exampleSentence: "Curiosity led her to open every drawer in the old desk." },
    { word: "despair", partOfSpeech: "noun", definition: "The complete loss or absence of hope.", phonetic: "/dɪˈspɛr/", exampleSentence: "He felt a wave of despair as the deadline passed." },
    { word: "elation", partOfSpeech: "noun", definition: "Great happiness and excitement.", phonetic: "/ɪˈleɪʃən/", exampleSentence: "There was pure elation on her face when she opened the letter." },
    { word: "fortitude", partOfSpeech: "noun", definition: "Courage in pain or adversity.", phonetic: "/ˈfɔrtɪˌtud/", exampleSentence: "It took great fortitude to keep going after the injury." },
    { word: "harmony", partOfSpeech: "noun", definition: "A pleasing combination or arrangement of elements." },
    { word: "integrity", partOfSpeech: "noun", definition: "The quality of being honest and having strong moral principles.", phonetic: "/ɪnˈtɛɡrɪti/", exampleSentence: "Everyone respected him for his integrity." },
    { word: "jubilant", partOfSpeech: "adjective", definition: "Feeling or expressing great happiness and triumph.", phonetic: "/ˈdʒubɪlənt/", exampleSentence: "The team was jubilant after their unexpected victory." },
    { word: "keen", partOfSpeech: "adjective", definition: "Having or showing eagerness or enthusiasm." },
    { word: "languid", partOfSpeech: "adjective", definition: "Displaying or having a disinclination for physical exertion.", phonetic: "/ˈlæŋɡwɪd/", exampleSentence: "They spent a languid afternoon by the pool, doing nothing at all." },
    { word: "meander", partOfSpeech: "verb", definition: "To follow a winding course, or to wander aimlessly.", phonetic: "/miˈændər/", exampleSentence: "The trail meanders along the riverbank for several miles." },
    { word: "nostalgia", partOfSpeech: "noun", definition: "A sentimental longing for the past.", phonetic: "/nəˈstældʒə/", exampleSentence: "The old song filled her with nostalgia for summers long past." },
    { word: "opulent", partOfSpeech: "adjective", definition: "Ostentatiously rich and luxurious.", phonetic: "/ˈɑpjələnt/", exampleSentence: "The hotel lobby was almost absurdly opulent." },
    { word: "placid", partOfSpeech: "adjective", definition: "Not easily upset or excited; calm and peaceful.", phonetic: "/ˈplæsɪd/", exampleSentence: "The lake was placid at dawn, without a single ripple." },
    { word: "quiver", partOfSpeech: "verb", definition: "To shake with a slight rapid motion.", phonetic: "/ˈkwɪvər/", exampleSentence: "Her voice began to quiver as she read the letter aloud." },
    { word: "resolute", partOfSpeech: "adjective", definition: "Admirably purposeful and determined.", phonetic: "/ˈrɛzəˌlut/", exampleSentence: "He remained resolute despite everyone telling him to quit." },
    { word: "solace", partOfSpeech: "noun", definition: "Comfort in a time of distress or sadness.", phonetic: "/ˈsɑlɪs/", exampleSentence: "She found solace in long walks through the woods." },
    { word: "tranquil", partOfSpeech: "adjective", definition: "Free from disturbance; calm.", phonetic: "/ˈtræŋkwɪl/", exampleSentence: "The garden was a tranquil escape from the noisy city." },
    { word: "undulate", partOfSpeech: "verb", definition: "To move with a smooth wave-like motion.", phonetic: "/ˈʌndʒəˌleɪt/", exampleSentence: "The wheat fields undulated gently in the breeze." },
    { word: "vex", partOfSpeech: "verb", definition: "To make someone feel annoyed or worried.", phonetic: "/vɛks/", exampleSentence: "The constant delays began to vex even the most patient passengers." },
    { word: "wane", partOfSpeech: "verb", definition: "To decrease in size, extent, or degree." },
    { word: "yearn", partOfSpeech: "verb", definition: "To have an intense feeling of longing for something.", phonetic: "/jɜrn/", exampleSentence: "He yearned to return to the mountains where he grew up." },
    { word: "zealous", partOfSpeech: "adjective", definition: "Having or showing great energy or enthusiasm for a cause.", phonetic: "/ˈzɛləs/", exampleSentence: "The new volunteer was almost too zealous, showing up before anyone else." },
    { word: "boldly", partOfSpeech: "adverb", definition: "In a confident and courageous way.", phonetic: "/ˈboʊldli/", exampleSentence: "She boldly stepped onto the stage without a script." },
    { word: "gracefully", partOfSpeech: "adverb", definition: "In a way that shows elegance and smoothness of movement." },
    { word: "reluctantly", partOfSpeech: "adverb", definition: "In an unwilling or hesitant manner.", phonetic: "/rɪˈlʌktəntli/", exampleSentence: "He reluctantly agreed to give the speech." },
    { word: "utterly", partOfSpeech: "adverb", definition: "Completely and absolutely.", phonetic: "/ˈʌtərli/", exampleSentence: "The plan was utterly ruined by the sudden storm." },
    { word: "swiftly", partOfSpeech: "adverb", definition: "Quickly, rapidly.", phonetic: "/ˈswɪftli/", exampleSentence: "The news spread swiftly through the small town." },
    { word: "cautiously", partOfSpeech: "adverb", definition: "In a careful, prudent manner.", exampleSentence: "She cautiously opened the old, creaking door." },
    { word: "earnestly", partOfSpeech: "adverb", definition: "In a sincere and heartfelt way.", phonetic: "/ˈɜrnəstli/", exampleSentence: "He earnestly apologized for the misunderstanding." },
    { word: "wearily", partOfSpeech: "adverb", definition: "In a tired manner.", phonetic: "/ˈwɪrəli/", exampleSentence: "She wearily climbed the last flight of stairs." },
];

const SEED_LANGUAGES = ["en", "en", "en", "en", "nl", "es", "fr"]; // mostly English, a few others in the mix

// Curated sentence + plain-language meaning pairs for the Analyze history.
const SEED_ANALYSES: { text: string; meaning: string }[] = [
    { text: "It was the best of times, it was the worst of times.", meaning: "Life held both great joy and great hardship at once." },
    { text: "He was drowning in time, and the shore kept moving.", meaning: "He felt overwhelmed and unable to catch up, no matter how hard he tried." },
    { text: "She had a habit of speaking in half-finished thoughts.", meaning: "She often trailed off before completing what she meant to say." },
    { text: "The city wore its history like a threadbare coat.", meaning: "The city's age and past were visible everywhere, worn and faded." },
    { text: "Hope is the thing with feathers.", meaning: "Hope is delicate and light, like a bird, but it keeps us going." },
    { text: "The silence between them said more than words could.", meaning: "What went unspoken carried more meaning than anything said aloud." },
    { text: "He wore his failures like medals.", meaning: "He was strangely proud of his past mistakes instead of ashamed of them." },
    { text: "Time is a thief that steals without hurry.", meaning: "Time takes things from us slowly and quietly, but inevitably." },
    { text: "Her laughter was a room filling with light.", meaning: "Her laughter made everything around her feel brighter and warmer." },
    { text: "The old house exhaled dust with every opened door.", meaning: "The house was long unused, and opening it revealed clear signs of neglect." },
    { text: "He spoke softly, but his words carried like thunder.", meaning: "Even though he wasn't loud, what he said had a powerful impact." },
    { text: "Grief is love with nowhere left to go.", meaning: "Grief comes from love that can no longer be given to the person who died." },
    { text: "The road ahead blurred into promise and doubt.", meaning: "The future felt both hopeful and uncertain." },
    { text: "She carried her homeland in the folds of her accent.", meaning: "Her way of speaking still revealed where she originally came from." },
    { text: "Every ending is a door standing slightly ajar.", meaning: "Endings often leave room for something new to begin." },
    { text: "The garden remembered every hand that had tended it.", meaning: "The garden's condition reflected the care it had received over time." },
    { text: "His silence was louder than any argument.", meaning: "The fact that he said nothing spoke volumes on its own." },
    { text: "She measured her days in cups of coffee and unread mail.", meaning: "Her daily routine was quiet and repetitive, marked by small habits." },
    { text: "The mountains kept their secrets in the mist.", meaning: "Some things about the mountains remained mysterious and hidden." },
    { text: "He learned to read the weather in his mother's eyes.", meaning: "He became skilled at sensing his mother's mood before she said anything." },
];

/**
 * Builds one fake ReadListBook for the given seed index. Cycles through
 * SEED_BOOKS for title/author/year, and READ_STATUS_ORDER for status, so a
 * large seed still gets an even, predictable spread of both.
 *
 * @param {number} index The book's position in the seeded set (0-based).
 * @returns {ReadListBook} The generated book.
 *
 */
function buildSeedBook(index: number): ReadListBook {
    const source = SEED_BOOKS[index % SEED_BOOKS.length];
    const status = READ_STATUS_ORDER[index % READ_STATUS_ORDER.length];
    // Spread addedAt across the past ~6 months so "Recently added" sorting has
    // something real to show, instead of every book sharing one timestamp.
    const addedAt = Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000;

    const book: ReadListBook = {
        key: `seed-${index}`,
        title: source.title,
        author: source.author,
        year: source.year,
        cover_i: "",
        status,
        addedAt,
    };

    if (status === "read") {
        book.rating = randomInt(0, 5);
        // Only some read books get a review/notes — most real books don't.
        if (Math.random() < 0.5) {
            book.review = "A memorable read — worth revisiting.";
        }
        if (Math.random() < 0.3) {
            book.bookNotes = "Recommended by a friend; check the ending again.";
        }
    }

    return book;
}

/**
 * Builds up to `count` fake WordEntry values, sampled *without* repetition
 * from SEED_WORDS — a book's own word list must never contain the same word
 * twice (book.tsx keys each word card by `item.word`, and the real add-word
 * flow already guards against duplicates the same way).
 *
 * @param {number} count How many words to generate (capped at SEED_WORDS.length).
 * @returns {WordEntry[]} The generated words, each word appearing at most once.
 *
 */
function buildSeedWords(count: number): WordEntry[] {
    const sources = shuffle(SEED_WORDS).slice(0, Math.min(count, SEED_WORDS.length));
    const words: WordEntry[] = [];
    for (const source of sources) {
        const entry: WordEntry = {
            word: source.word,
            phonetic: source.phonetic,
            partOfSpeech: source.partOfSpeech,
            definition: source.definition,
            exampleSentence: source.exampleSentence,
            addedAt: Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000,
            sourceLanguage: pick(SEED_LANGUAGES),
        };
        // Only some words get a saved sentence/notes — most real words don't.
        if (Math.random() < 0.4) {
            entry.sentence = source.exampleSentence ?? `I came across "${source.word}" while reading.`;
        }
        if (Math.random() < 0.15) {
            entry.notes = "Looked this up more than once — still learning it.";
        }
        words.push(entry);
    }
    return words;
}

/**
 * Builds seeded Memory-tab practice stats for a random subset of the given
 * words — mirrors buildSeedWords's "only some words get a saved sentence"
 * pattern, so the Stats screen shows a realistic mix of practiced and
 * never-practiced words rather than every single word having history.
 *
 * @param {Set<string>} words Every seeded word's lowercased, trimmed text, across all books.
 * @returns {Record<string, WordStat>} Stats for roughly half of `words`, keyed the same way memory-stats-storage.ts does.
 *
 */
function buildSeedMemoryStats(words: Set<string>): Record<string, WordStat> {
    const stats: Record<string, WordStat> = {};
    for (const word of words) {
        // Only some words have been practiced at all — most real words haven't yet.
        if (Math.random() >= 0.5) {
            continue;
        }
        const total = randomInt(1, 8);
        const knewIt = randomInt(0, total);
        stats[word] = {
            knewIt,
            stillLearning: total - knewIt,
            // More recent than addedAt's 180-day spread — practice happens after adding.
            lastReviewedAt: Date.now() - randomInt(0, 14) * 24 * 60 * 60 * 1000,
        };
    }
    return stats;
}

/**
 * Builds the seeded sentence-analysis history, capped at MAX_ANALYSES_ENTRIES
 * (matching the real app's own cap — see analysis-storage.ts).
 *
 * @returns {AnalysisHistoryEntry[]} The generated analysis history, newest first.
 *
 */
function buildSeedAnalyses(): AnalysisHistoryEntry[] {
    return SEED_ANALYSES.slice(0, MAX_ANALYSES_ENTRIES).map((entry, i) => ({
        text: entry.text,
        lang: "en",
        analysis: { meaning: entry.meaning },
        createdAt: Date.now() - i * 60 * 60 * 1000, // spaced an hour apart, newest first
    }));
}

/**
 * Replaces all book data (read list, every book's words, analysis history,
 * Memory-tab practice stats) with generated test data of the given size.
 * Always wipes existing data first (via clearAllBookData, which also clears
 * memory stats) so repeated runs are reproducible rather than accumulating.
 * Dev-only — see the file header.
 *
 * @param {SeedSize} size Which preset to generate ("small" | "medium" | "large").
 * @returns {Promise<SeedResult>} How many books/words/analyses/stat-carrying words were written.
 *
 */
export async function seedTestData(size: SeedSize): Promise<SeedResult> {
    await clearAllBookData();

    const config = SEED_SIZES[size];
    const books: ReadListBook[] = [];
    const wordEntries: [string, string][] = [];
    const allWordTexts = new Set<string>();
    let totalWords = 0;

    for (let i = 0; i < config.books; i++) {
        const book = buildSeedBook(i);
        books.push(book);

        const words = buildSeedWords(randomInt(config.minWords, config.maxWords));
        totalWords += words.length;
        words.forEach((word) => allWordTexts.add(word.word.trim().toLowerCase()));
        wordEntries.push([`words_${book.key}`, JSON.stringify(words)]);
    }

    await setReadList(books);
    // One bulk write for every book's words, not setWords() in a loop — the
    // "large" preset would otherwise be 200 sequential AsyncStorage round-trips.
    // Mirrors words-storage.ts's own multiGet/multiRemove bulk-write precedent.
    await AsyncStorage.multiSet(wordEntries);

    const analyses = buildSeedAnalyses();
    await setAnalysisHistory(analyses);

    const memoryStats = buildSeedMemoryStats(allWordTexts);
    await setMemoryStats(memoryStats);

    return {
        books: books.length,
        words: totalWords,
        analyses: analyses.length,
        wordsWithStats: Object.keys(memoryStats).length,
    };
}
