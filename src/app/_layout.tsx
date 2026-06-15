import { AppThemeProvider, useTheme } from '@/context/theme-context';
import { useNotificationObserver } from '@/hooks/use-notification-observer';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function ThemedStack() {
    const { colorScheme } = useTheme();
    useNotificationObserver();

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
            <KeyboardProvider>
                <AppThemeProvider>
                    <ThemedStack />
                </AppThemeProvider>
            </KeyboardProvider>
        </SafeAreaProvider>
    );
}
