export type ReadStatus = 'want' | 'currently_reading' | 'read';

export type ReadListFilter = 'all' | 'want' | 'currently_reading' | 'read';

// A record that maps each ReadStatus to a human-readable label
export const READ_STATUS_LABELS: Record<ReadStatus, string> = {
    want: 'Want to read',
    currently_reading: 'Currently reading',
    read: 'Have Read',
};

// A record that maps each ReadListFilter to a human-readable label
export const READ_STATUS_FILTER_LABELS: Record<ReadListFilter, string> = {
    all: 'All',
    want: 'Want to read',
    currently_reading: 'Currently reading',
    read: 'Have Read',
};

export const READ_STATUS_ORDER: ReadStatus[] = ['want', 'currently_reading', 'read'];

// Every valid ReadListFilter value, "all" plus each real status — used to
// validate a saved filter read back from storage (see read-list-storage.ts).
export const READ_LIST_FILTERS: ReadListFilter[] = ['all', ...READ_STATUS_ORDER];

export type ReadListBook = {
    key: string;
    title: string;
    author: string;
    year: string;
    cover_i: string;
    status: ReadStatus;
    addedAt: number;
    review?: string;     // user's overall review of the book (optional)
    bookNotes?: string;  // general notes about the book (optional)
    rating?: number;     // 0–5 star rating of the book (optional)
};
