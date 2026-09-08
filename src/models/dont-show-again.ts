// The "don't show again" checkbox options for one utils/alert-dialog.ts call —
// `id` is the stable key persisted via storage/dismissed-alerts-storage.ts.
export type DontShowAgainOptions = {
    id: string;
    checkboxLabel: string;
};
