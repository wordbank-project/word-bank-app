import { alertDialog } from '@/utils/alert-dialog';
import { showActionSheet } from '@/utils/show-action-sheet';
import type { ActionSheetButton } from '@/models/action-sheet-button';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [2, 3],
    quality: 0.8,
};

async function takePhoto(): Promise<string | null> {
    try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            alertDialog(
                'Camera permission needed',
                'Enable camera access in Settings to take a photo.',
            );
            return null;
        }
        const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
        return result.canceled ? null : result.assets[0].uri;
    } catch (error) {
        console.error(error);
        alertDialog('Something went wrong', 'Could not take a photo. Please try again.');
        return null;
    }
}

async function pickFromLibrary(): Promise<string | null> {
    try {
        const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
        return result.canceled ? null : result.assets[0].uri;
    } catch (error) {
        console.error(error);
        alertDialog('Something went wrong', 'Could not open your photo library. Please try again.');
        return null;
    }
}

/**
 * Prompts the user to take a photo or choose an existing one, then resolves with
 * the selected image URI (or null if they cancelled or denied camera access).
 * Uses a native action sheet on iOS and an alert dialog on Android.
 */
export function pickCoverImage(hasExisting = false): Promise<string | null> {
    const title = hasExisting ? 'Change cover image' : 'Add cover image';

    return new Promise((resolve) => {
        const buttons: ActionSheetButton[] = [];
        // Camera capture isn't reliable on web — only offer it on native.
        if (Platform.OS !== 'web') {
            buttons.push({ text: 'Take Photo', onPress: () => resolve(takePhoto()) });
        }
        buttons.push(
            { text: 'Choose from Library', onPress: () => resolve(pickFromLibrary()) },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        );
        showActionSheet(title, undefined, buttons);
    });
}
