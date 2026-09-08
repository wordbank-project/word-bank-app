// One button in an action sheet shown via utils/show-action-sheet.ts.
export type ActionSheetButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};
