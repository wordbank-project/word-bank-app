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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function ThemedStack() {
    const { colorScheme } = useTheme();
    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {/* Web only (no-op on native) — sets the browser tab title, which the
                static export otherwise leaves empty (React Navigation's own
                document-title sync isn't wired up for this tab navigator). */}
            <Head>
                <title>Word Bank Web - Your personal words vault</title>
            </Head>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
            </Stack>
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
