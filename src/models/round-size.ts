// How many words a Memory round can be — any positive count, or "all" for every word in the pool. 
export type RoundSize = number | "all";
export const ROUND_SIZE_OPTIONS: { value: RoundSize; label: string }[] = [
    { value: 5, label: "5" },
    { value: 10, label: "10" },
    { value: 20, label: "20" },
    { value: "all", label: "All" },
];