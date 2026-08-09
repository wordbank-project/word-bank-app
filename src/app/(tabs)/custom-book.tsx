import ClearableTextInput from '@/components/ClearableTextInput';
import CoverImage from '@/components/CoverImage';
import CoverPlaceholder from '@/components/CoverPlaceholder';
import ReadStatusSelector from '@/components/ReadStatusSelector';
import { useColorScheme } from '@/context/theme-context';
import { useSavedLanguage } from '@/hooks/use-saved-language';
import type { ReadStatus } from '@/models/read-list-book';
import { upsertReadListBook } from '@/storage/read-list-storage';
import { Colors } from '@/styles/global';
import { openBook } from '@/utils/open-book';
import { pickCoverImage } from '@/utils/pick-cover-image';
import { useTypewriterPlaceholder } from '@/hooks/use-typewriter-placeholder';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

// Extend with AI suggestions later
const RANDOM_TITLES = [
    "My Reading Notes",
    "Reflections on Life",
    "The Art of Learning",
    "Journeys and Discoveries",
    "Thoughts and Musings",
    "The World Through My Eyes",
    "Lessons from the Past",
    "Adventures in Knowledge",
    "The Mind's Eye",
    "Exploring the Unknown",
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

    // Live AI-generated title suggestions replace the static list once available.
    const [suggestionTitles, setSuggestionTitles] = useState<string[]>(RANDOM_TITLES);
    useEffect(() => {
        if (!languageReady) {
            return;
        }
        fetchSuggestions(language.code).then(({ titles }) => {
            if (titles.length > 0) {
                setSuggestionTitles(titles);
            }
        });
    }, [languageReady, language.code]);

    // Types out one example title while the field is empty and the tab is focused.
    // `word` is the full suggestion, accepted on Enter when the field is empty.
    const isFocused = useIsFocused();
    const { text: typedPlaceholder, word } = useTypewriterPlaceholder(RANDOM_TITLES, isFocused && !title);

    async function handlePickImage(): Promise<void> {
        const uri = await pickCoverImage(coverUri !== null);
        if (uri) {
            setCoverUri(uri);
        }
    }

    async function handleCreate(): Promise<void> {
        // if placeholder is shown use that as the title instead of showing an error for empty title
        const bookTitle = title.trim() || word;
        if (!bookTitle) {
            setTitleError('Please enter a book title.');
            return;
        }
        const key = `custom_${Date.now()}`;
        const bookAuthor = author.trim();
        const bookYear = year.trim();

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
                            radius={8}
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
                            className={`rounded-lg border bg-input px-3.5 py-3 text-base text-fg ${titleError ? "border-error" : "border-border-input"}`}
                            placeholder={typedPlaceholder || "Enter book title"}
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
                            className="rounded-lg border border-border-input bg-input px-3.5 py-3 text-base text-fg"
                            placeholder="Jane Austen"
                            placeholderTextColor={placeholderColor}
                            value={author}
                            onChangeText={setAuthor}
                            returnKeyType="next"
                        />
                    </View>

                    <View className="gap-1.5">
                        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">Year <Text className="text-xs font-normal normal-case text-muted">(optional)</Text></Text>
                        <ClearableTextInput
                            className="rounded-lg border border-border-input bg-input px-3.5 py-3 text-base text-fg"
                            placeholder="1813"
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
