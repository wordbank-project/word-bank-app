import { useColorScheme } from "@/context/theme-context";
import { ACCENT, Colors, ERROR } from '@/styles/global';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const SENTENCE_MAX = 300;

type WordInputProps = {
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    loading: boolean;
    error: string;
    sentence: string;
    onSentenceChange: (text: string) => void;
    notes: string;
    onNotesChange: (text: string) => void;
};

export default function WordInput({
    value,
    onChange,
    onSubmit,
    loading,
    error,
    sentence,
    onSentenceChange,
    notes,
    onNotesChange,
}: WordInputProps) {
    const scheme = useColorScheme();
    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const [showContext, setShowContext] = useState(false);
    const sentenceRef = useRef<TextInput>(null);
    const notesRef = useRef<TextInput>(null);

    function handleSubmit(): void {
        Keyboard.dismiss();
        onSubmit();
    }

    return (
        <>
            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    placeholder="Add a word..."
                    placeholderTextColor={placeholderColor}
                    value={value}
                    onChangeText={onChange}
                    onSubmitEditing={showContext
                        ? () => sentenceRef.current?.focus()
                        : handleSubmit
                    }
                    returnKeyType={showContext ? 'next' : 'done'}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Pressable
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.buttonText}>Add</Text>
                    )}
                </Pressable>
            </View>

            <Pressable
                style={styles.contextToggle}
                onPress={() => setShowContext((v) => !v)}
            >
                <Text style={styles.contextToggleText}>
                    {showContext ? 'Hide context −' : 'Add context +'}
                </Text>
            </Pressable>

            {showContext ? (
                <View style={styles.contextSection}>
                    <View style={styles.labelRow}>
                        <Text style={styles.contextLabel}>Sentence</Text>
                        <Text style={styles.charCount}>{sentence.length} / {SENTENCE_MAX}</Text>
                    </View>
                    <TextInput
                        ref={sentenceRef}
                        style={styles.contextInput}
                        placeholder={value ? `e.g. 'I encountered "${value}" while reading...'` : "e.g. 'Write the sentence from the book...'"}
                        placeholderTextColor={placeholderColor}
                        value={sentence}
                        onChangeText={onSentenceChange}
                        multiline
                        autoCorrect
                        maxLength={SENTENCE_MAX}
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => notesRef.current?.focus()}
                    />
                    <Text style={styles.contextLabel}>Notes</Text>
                    <TextInput
                        ref={notesRef}
                        style={styles.contextInput}
                        placeholder="e.g. Similar to 'optimistic', used in formal writing"
                        placeholderTextColor={placeholderColor}
                        value={notes}
                        onChangeText={onNotesChange}
                        multiline
                        autoCorrect
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                    />
                </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        row: {
            flexDirection: 'row',
            gap: 8,
            padding: 12,
            paddingBottom: 4,
        },
        input: {
            flex: 1,
            height: 44,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.borderInput,
            paddingHorizontal: 12,
            paddingVertical: 0,
            fontSize: 16,
            color: C.text,
            backgroundColor: C.backgroundInput,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        button: {
            backgroundColor: ACCENT,
            borderRadius: 8,
            paddingHorizontal: 16,
            justifyContent: 'center',
            minWidth: 56,
            alignItems: 'center',
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 16,
        },
        contextToggle: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignSelf: 'flex-start',
        },
        contextToggleText: {
            fontSize: 13,
            color: ACCENT,
            fontWeight: '500',
        },
        contextSection: {
            paddingHorizontal: 12,
            paddingBottom: 8,
            gap: 6,
        },
        labelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        contextLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        charCount: {
            fontSize: 11,
            color: C.textFaded,
        },
        contextInput: {
            borderWidth: 1,
            borderColor: C.borderInput,
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            color: C.text,
            backgroundColor: C.backgroundInput,
            minHeight: 64,
            textAlignVertical: 'top',
        },
        error: {
            color: ERROR,
            fontSize: 13,
            paddingHorizontal: 12,
            paddingBottom: 4,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
