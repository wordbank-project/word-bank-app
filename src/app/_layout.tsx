import ActionSheetBridge from '@/components/ActionSheetBridge';
import { AppThemeProvider, useTheme } from '@/context/theme-context';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function ThemedStack() {
    const { colorScheme } = useTheme();
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
            <ActionSheetProvider>
                <KeyboardProvider>
                    <AppThemeProvider>
                        <ActionSheetBridge />
                        <ThemedStack />
                    </AppThemeProvider>
                </KeyboardProvider>
            </ActionSheetProvider>
        </SafeAreaProvider>
    );
}
