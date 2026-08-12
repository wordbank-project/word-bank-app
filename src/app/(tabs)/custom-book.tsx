import React, { useEffect, useMemo, useState } from 'react';

import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

import ClearableTextInput from '@/components/ClearableTextInput';
import CoverImage from '@/components/CoverImage';
import CoverPlaceholder from '@/components/CoverPlaceholder';
import ReadStatusSelector from '@/components/ReadStatusSelector';

import { useColorScheme } from '@/context/theme-context';

import { useSavedLanguage } from '@/hooks/use-saved-language';
import { useTypewriterPlaceholder } from '@/hooks/use-typewriter-placeholder';

import type { ReadStatus } from '@/models/read-list-book';

import { upsertReadListBook } from '@/storage/read-list-storage';

import { Colors } from '@/styles/global';

import { openBook } from '@/utils/open-book';
import { pickCoverImage } from '@/utils/pick-cover-image';
import { fetchSuggestions, type SuggestedBook } from '@/utils/suggestions-api';

import { useIsFocused } from '@react-navigation/native';

const RANDOM_BOOKS_WITH_AUTHORS_AND_YEARS: SuggestedBook[] = [
    { title: "My Reading Notes", author: "John Doe", year: "2020" },
    { title: "Reflections on Life", author: "Jane Smith", year: "2018" },
    { title: "The Art of Learning", author: "Albert Johnson", year: "2019" },
    { title: "Journeys and Discoveries", author: "Emily Davis", year: "2021" },
    { title: "Thoughts and Musings", author: "Michael Brown", year: "2017" },
    { title: "The World Through My Eyes", author: "Sarah Wilson", year: "2022" },
    { title: "Lessons from the Past", author: "David Lee", year: "2016" },
    { title: "Adventures in Knowledge", author: "Laura Martinez", year: "2023" },
    { title: "The Mind's Eye", author: "Christopher Garcia", year: "2015" },
    { title: "Exploring the Unknown", author: "Patricia Anderson", year: "2024" },
];

export default function CustomBookScreen() {
    // placeholderTextColor needs a color value (not a class), so keep it themed here.
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    const [title, setTitle] = useState<string>('');
    const [author, setAuthor] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const [coverUri, setCoverUri] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string>('');
    const [readStatus, setReadStatus] = useState<ReadStatus>('want');

    // Restores the saved dictionary language from AsyncStorage on mount.
    const { language, languageReady } = useSavedLanguage();

    // Live AI-generated book (title/author/year) suggestions replace the static list once available.
    const [suggestions, setSuggestions] = useState<SuggestedBook[]>(RANDOM_BOOKS_WITH_AUTHORS_AND_YEARS);
    useEffect(() => {
        if (!languageReady) {
            return;
        }
        fetchSuggestions(language.code).then(({ books }) => {
            if (books.length > 0) {
                setSuggestions(books);
            }
        });
    }, [languageReady, language.code]);

    // Gives back an array of the titles from the suggested books object
    // useMemo, because we only want to redo it when the suggestions array changes
    const suggestionTitles = useMemo(() => suggestions.map((suggestion) => suggestion.title), [suggestions]);

    // Types out one example title while the field is empty and the tab is focused.
    // `word` is the placeholder title, accepted on Enter when the field is empty.
    const isFocused = useIsFocused();
    const { text: typedPlaceholder, word: placeHolderTitle } = useTypewriterPlaceholder(suggestionTitles, isFocused && !title);

    // We find the author and year that is linked to the suggested title
    const matchedSuggestion = suggestions.find((suggestion) => suggestion.title === placeHolderTitle);

    async function handlePickImage(): Promise<void> {
        const uri = await pickCoverImage(coverUri !== null);
        if (uri) {
            setCoverUri(uri);
        }
    }

    async function handleCreate(): Promise<void> {
        // if placeholder title is shown use that as the title instead of showing an error for empty title
        const bookTitle = title.trim() || placeHolderTitle;
        if (!bookTitle) {
            setTitleError('Please enter a book title.');
            return;
        }
        const key = `custom_${Date.now()}`;
        // if placeholder author or year is shown use that
        const bookAuthor = author.trim() || matchedSuggestion?.author || '';
        const bookYear = year.trim() || matchedSuggestion?.year || '';

        await upsertReadListBook({
            key,
            title: bookTitle,
            author: bookAuthor,
            year: bookYear,
            cover_i: coverUri ?? '',
            status: readStatus,
        });

        router.navigate('/(tabs)/read-list');
        openBook({ key, title: bookTitle, author: bookAuthor, year: bookYear, cover_i: coverUri ?? '' });
        setTitle('');
        setAuthor('');
        setYear('');
        setCoverUri(null);
        setTitleError('');
        setReadStatus('want');
    }

    return (
        <React.Fragment>
            {/* KeyboardAwareScrollView is third-party (no className) — wrap it for the bg. */}
            <View className="flex-1 bg-background">
                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, gap: 16 }}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={80}
                >
                    <View className="flex-row items-center gap-4">
                        <CoverImage
                            uri={coverUri}
                            className="h-32 w-24 rounded-lg"
                            placeholder={<CoverPlaceholder size={32} />}
                        />
                        <Pressable className="rounded-lg border border-accent px-4 py-2" onPress={handlePickImage}>
                            <Text className="text-sm font-medium text-accent">
                                {coverUri ? 'Change image' : 'Pick cover image'}
                            </Text>
                        </Pressable>
                    </View>

                    <View className="gap-1.5">
                        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Title</Text>
                        <ClearableTextInput
                            className={`rounded-lg border bg-input pt-3 pr-3.5 pb-3 pl-3.5 text-[14px] android:leading-[21px] text-fg ${titleError ? "border-error" : "border-border-input"}`}
                            placeholder={typedPlaceholder || "Pride and Prejudice"}
                            placeholderTextColor={placeholderColor}
                            value={title}
                            onChangeText={(t) => { setTitle(t); setTitleError(''); }}
                            returnKeyType="next"
                        />
                        {titleError ? <Text className="text-[13px] text-error">{titleError}</Text> : null}
                    </View>

                    <View className="gap-1.5">
                        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Author <Text className="text-xs font-normal normal-case text-muted">(optional)</Text></Text>
                        <ClearableTextInput
                            className="rounded-lg border border-border-input bg-input pt-3 pr-3.5 pb-3 pl-3.5 text-[14px] android:leading-[21px] text-fg"
                            placeholder={matchedSuggestion?.author || "Jane Austen"}
                            placeholderTextColor={placeholderColor}
                            value={author}
                            onChangeText={setAuthor}
                            returnKeyType="next"
                        />
                    </View>

                    <View className="gap-1.5">
                        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Year <Text className="text-xs font-normal normal-case text-muted">(optional)</Text></Text>
                        <ClearableTextInput
                            className="rounded-lg border border-border-input bg-input pt-3 pr-3.5 pb-3 pl-3.5 text-[14px] android:leading-[21px] text-fg"
                            placeholder={matchedSuggestion?.year || "1813"}
                            placeholderTextColor={placeholderColor}
                            value={year}
                            onChangeText={setYear}
                            keyboardType="number-pad"
                            maxLength={4}
                            returnKeyType="done"
                            onSubmitEditing={handleCreate}
                        />
                    </View>

                    <View className="gap-1.5">
                        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Reading status</Text>
                        <ReadStatusSelector value={readStatus} onChange={setReadStatus} />
                    </View>

                    <Pressable className="items-center rounded-[10px] bg-accent py-3.5" onPress={handleCreate}>
                        <Text className="text-base font-bold text-white">Create Book</Text>
                    </Pressable>
                </KeyboardAwareScrollView>
            </View>
            <KeyboardToolbar />
        </React.Fragment>
    );
}
