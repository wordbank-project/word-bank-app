import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/** Sends the Android hardware/gesture back press to a specific route while this
 * screen is focused.
 * No-op on iOS/web — there is no hardware back button and tabs have no back
 *  gesture, so the listener simply never fires.
 * @param {Href} href the route to navigate to when the back button is pressed
 * @returns {void} nothing
 * 
 */
export function useBackTo(href: Href): void {
    useFocusEffect(
        useCallback(() => {
            const sub = BackHandler.addEventListener('hardwareBackPress', () => {
                router.navigate(href);
                return true; // handled — don't let the navigator/system also act
            });
            return () => sub.remove();
        }, [href])
    );
}
