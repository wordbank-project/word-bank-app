import { Alert, Platform } from 'react-native';

// Shows a basic alert on web, and a native alert on iOS/Android.
export function alertDialog(title: string, message?: string): void {
    if (Platform.OS === 'web') {
        window.alert(message ? `${title}\n\n${message}` : title);
        return;
    }
    Alert.alert(title, message);
}
