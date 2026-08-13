import { router } from "expo-router";

import { showActionSheet, type ActionSheetButton } from "@/utils/show-action-sheet";

/** 
 * Opens the "Add a book" menu screen (e.g. no "Search for a book" while already on the Search tab). 
 * If only one option makes sense from here, it's triggered directly instead of showing
 * a single-item menu.
 *
 * @param {string} pathname The current route pathname (extracted from expo-router's usePathname()).
 * @returns {void} Returns nothing — navigates or shows an action sheet.
 *
*/
export function openAddBookMenu(pathname: string): void {
    const onSearch = pathname === '/';                  // Search tab (index)
    const onCustom = pathname.endsWith('/custom-book'); // custom-book screen

    // Only offer the actions that make sense from the current screen.
    const actions: ActionSheetButton[] = [];
    if (!onSearch) {
        actions.push({ text: 'Search for a book', onPress: () => router.navigate('/') });
    }
    if (!onCustom) {
        actions.push({ text: 'Add a custom book', onPress: () => router.push('/(tabs)/custom-book' as any) });
    }

    // On the Search / custom-book screens only one action remains.
    // Just navigate to the page rather than showing a single-item menu.
    if (actions.length === 1) {
        actions[0].onPress?.();
        return;
    }

    showActionSheet('What would you like to do?', undefined, [...actions, { text: 'Cancel', style: 'cancel' }]);
}
