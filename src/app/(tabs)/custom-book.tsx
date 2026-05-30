import CoverImage from '@/components/CoverImage';
import { useColorScheme } from '@/context/theme-context';
import { upsertBook } from '@/storage/books-storage';
import { ACCENT, Colors, ERROR } from '@/styles/global';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

export default function CustomBookScreen() {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [year, setYear] = useState('');
    const [coverUri, setCoverUri] = useState<string | null>(null);
    const [titleError, setTitleError] = useState('');

    async function handlePickImage() {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [2, 3],
            quality: 0.8,
        });
        if (!result.canceled) {
            setCoverUri(result.assets[0].uri);
        }
    }

    async function handleCreate() {
        const trimmed = title.trim();
        if (!trimmed) {
            setTitleError('Please enter a book title.');
            return;
        }
        const key = `custom_${Date.now()}`;
        const trimmedAuthor = author.trim();
        const trimmedYear = year.trim();
        await upsertBook({
            key,
            title: trimmed,
            author: trimmedAuthor,
            year: trimmedYear,
            cover_i: coverUri ?? '',
            wordCount: 0,
        });
        router.navigate('/(tabs)/saved-books');
        router.push({
            pathname: '/book' as any,
            params: { key, title: trimmed, author: trimmedAuthor, year: trimmedYear, cover_i: coverUri ?? '' },
        });
        setTitle('');
        setAuthor('');
        setYear('');
        setCoverUri(null);
        setTitleError('');
    }

    return (
        <React.Fragment>
            <KeyboardAwareScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                bottomOffset={80}
            >
                <View style={styles.coverRow}>
                    <CoverImage uri={coverUri} style={styles.cover} />
                    <Pressable style={styles.pickButton} onPress={handlePickImage}>
                        <Text style={styles.pickButtonText}>
                            {coverUri ? 'Change image' : 'Pick cover image'}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Title</Text>
                    <TextInput
                        style={[styles.input, titleError ? styles.inputError : null]}
                        placeholder="e.g. My reading notes"
                        placeholderTextColor={placeholderColor}
                        value={title}
                        onChangeText={(t) => { setTitle(t); setTitleError(''); }}
                        returnKeyType="next"
                    />
                    {titleError ? <Text style={styles.error}>{titleError}</Text> : null}
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Author <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Jane Austen"
                        placeholderTextColor={placeholderColor}
                        value={author}
                        onChangeText={setAuthor}
                        returnKeyType="next"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Year <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 1813"
                        placeholderTextColor={placeholderColor}
                        value={year}
                        onChangeText={setYear}
                        keyboardType="number-pad"
                        maxLength={4}
                        returnKeyType="done"
                        onSubmitEditing={handleCreate}
                    />
                </View>

                <Pressable style={styles.createButton} onPress={handleCreate}>
                    <Text style={styles.createButtonText}>Create Book</Text>
                </Pressable>
            </KeyboardAwareScrollView>
            <KeyboardToolbar />
        </React.Fragment>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
        scrollContent: {
            padding: 20,
            gap: 24,
            paddingBottom: 400,
        },
        coverRow: {
            alignItems: 'center',
            gap: 14,
        },
        cover: {
            width: 120,
            height: 160,
            borderRadius: 8,
        },
        pickButton: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: ACCENT,
        },
        pickButtonText: {
            color: ACCENT,
            fontSize: 14,
            fontWeight: '500',
        },
        field: {
            gap: 6,
        },
        optional: {
            fontSize: 12,
            fontWeight: '400',
            color: C.textMuted,
            textTransform: 'none',
        },
        label: {
            fontSize: 13,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        input: {
            height: 48,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.borderInput,
            paddingHorizontal: 14,
            fontSize: 16,
            color: C.text,
            backgroundColor: C.backgroundInput,
        },
        inputError: {
            borderColor: ERROR,
        },
        error: {
            fontSize: 13,
            color: ERROR,
        },
        createButton: {
            backgroundColor: ACCENT,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
        },
        createButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
