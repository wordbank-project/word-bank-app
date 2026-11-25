import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The tab bar's size, shared by the tab layout and the FAB that floats above it.
// Content height + the device's bottom safe area (home indicator / gesture bar),
// so it's compact on web and 3-button Android and still clears the inset elsewhere.

const TAB_BAR_CONTENT_HEIGHT = 56;
// Keeps the labels off the screen edge when there's no inset (web, 3-button Android).
const MIN_BOTTOM_PADDING = 8;

/**
 * Computes the tab bar's total height and bottom padding from the device's
 * bottom safe-area inset.
 *
 * @returns {{ height: number; paddingBottom: number }} The bar's total height and its bottom padding.
 *
 */
export function useTabBarHeight(): { height: number; paddingBottom: number } {
    const { bottom } = useSafeAreaInsets();
    const paddingBottom = Math.max(bottom, MIN_BOTTOM_PADDING);
    return { height: TAB_BAR_CONTENT_HEIGHT + paddingBottom, paddingBottom };
}
