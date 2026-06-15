export type ReadStatus = 'want' | 'reading' | 'read';

// A record that maps each ReadStatus to a human-readable label
export const READ_STATUS_LABELS: Record<ReadStatus, string> = {
    want: 'Want to read',
    reading: 'Reading',
    read: 'Have Read',
};

export const READ_STATUS_ORDER: ReadStatus[] = ['want', 'reading', 'read'];

export type ReadListBook = {
    key: string;
    title: string;
    author: string;
    year: string;
    cover_i: string;
    status: ReadStatus;
    addedAt: number;
    review?: string;   // user's overall review of the book (optional)
    notes?: string;    // general notes about the book (optional)
};
