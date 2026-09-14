import '../../global.css';

import ActionSheetBridge from '@/components/ActionSheetBridge';
import AlertDialogBridge from '@/components/AlertDialogBridge';
import NotificationResponseBridge from '@/components/NotificationResponseBridge';
import { AppLanguageProvider } from '@/context/language-context';
import { AppThemeProvider, useTheme } from '@/context/theme-context';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// react-native-screens defaults `screensEnabled()` to false on web (only
// ios/android/windows count as "native platform supported"), and nothing in
// expo-router/React Navigation's own init ever calls this — so on web,
// @react-navigation/bottom-tabs' MaybeScreen falls back to a plain View with
// NO visibility-hiding logic at all for inactive tabs. Every visited tab's
// Screen (and its own separate Header) stays permanently mounted, told apart
// only by zIndex, never display:none — confirmed via direct DOM inspection:
// switching tabs left both the old and new header's title text simultaneously
// present and visible. Enabling screens routes inactive tabs through
// Screen.web.tsx's NativeScreen, which correctly applies display:none.
// Module-level (not inside a component) so it runs once, before anything
// renders — safe to call unconditionally, no-ops don't apply here since this
// flag isn't platform-gated internally, only its (skipped) native-module
// validation is.
enableScreens(true);

// React Navigation's own theme.colors.background (DefaultTheme/DarkTheme's
// stock screen-container backdrop) has the same build-time-baked-wrong
// problem as (tabs)/_layout.tsx's headerStyle/tabBarStyle did — on a web
// static export, colorScheme defaults to light at build time (no window
// there), baking that wrong color as a literal inline style into the
// pre-rendered Stack's screen container for every visitor. Making it
// transparent and relying on bg-background (CSS, already correct from the
// first frame) on the wrapping View below fixes it the same way.
const TRANSPARENT_LIGHT_NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };
const TRANSPARENT_DARK_NAV_THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } };

function ThemedStack() {
    const { colorScheme } = useTheme();
    return (
        <ThemeProvider value={colorScheme === 'dark' ? TRANSPARENT_DARK_NAV_THEME : TRANSPARENT_LIGHT_NAV_THEME}>
            {/* Web only (no-op on native) — sets the browser tab title, which the
                static export otherwise leaves empty (React Navigation's own
                document-title sync isn't wired up for this tab navigator). */}
            <Head>
                <title>Word Bank Web - Your personal words vault</title>
            </Head>
            <View style={{ flex: 1 }} className="bg-background">
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                </Stack>
            </View>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ActionSheetProvider>
                <KeyboardProvider>
                    <AppThemeProvider>
                        <AppLanguageProvider>
                            <ActionSheetBridge />
                            <AlertDialogBridge />
                            <ThemedStack />
                            <NotificationResponseBridge />
                        </AppLanguageProvider>
                    </AppThemeProvider>
                </KeyboardProvider>
            </ActionSheetProvider>
        </SafeAreaProvider>
    );
}
