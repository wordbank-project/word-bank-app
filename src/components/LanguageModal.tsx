import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, KeyboardProvider } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/context/theme-context";

import type { Language } from "@/models/language";
import { LANGUAGES } from "@/models/language";

import { ACCENT, Colors } from "@/styles/global";

type LanguageModalProps = {
    selected: Language;
    onSelect: (language: Language) => void;
};

export default function LanguageModal({ selected, onSelect }: LanguageModalProps) {
    const scheme = useColorScheme();
    const insets = useSafeAreaInsets();

    const styles = scheme === 'dark' ? darkStyles : lightStyles;
    const placeholderColor = scheme === 'dark'
        ? Colors.dark.textPlaceholder
        : Colors.light.textPlaceholder;

    const [visible, setVisible] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const listRef = useRef<FlatList<Language>>(null);

    function handleSelect(language: Language): void {
        onSelect(language);
        setVisible(false);
    }

    // Filter the languages based on the search query, matching against both label and code.
    // useMemo caches the result so it only re-filters when `search` changes, not on every re-render.
    const filteredLanguages = useMemo(() => {
        const searchQuery = search.trim().toLowerCase();
        return LANGUAGES.filter(language =>
            language.label.toLowerCase().includes(searchQuery) || language.code.toLowerCase().includes(searchQuery)
        );
    }, [search]);

    // Clear the search whenever the modal closes so it reopens fresh.
    useEffect(() => {
        if (!visible) {
            setSearch('');
        }
    }, [visible]);

    // Scroll the selected language into view when opening with no active search.
    useEffect(() => {
        if (!visible || search) {
            return;
        }
        const index = LANGUAGES.findIndex(language => language.code === selected.code);
        if (index > 0) {
            setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.4 });
            }, 150);
        }
    }, [visible]);

    return (
        <React.Fragment>
            <Pressable style={styles.langButton} onPress={() => setVisible(true)}>
                <Text style={styles.langButtonLabel}>Dictionary language</Text>
                <View style={styles.langButtonRight}>
                    <Text style={styles.langButtonValue}>{selected.label}</Text>
                    <Text style={styles.langChevron}>›</Text>
                </View>
            </Pressable>

            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => setVisible(false)}
            >
                <KeyboardProvider>
                    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
                        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
                            <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                                <FlatList
                                    ref={listRef}
                                    data={filteredLanguages}
                                    keyExtractor={(item) => item.code}
                                    keyboardShouldPersistTaps="handled"
                                    onScrollToIndexFailed={() => { }}
                                    renderItem={({ item }) => {
                                        const active = item.code === selected.code;
                                        return (
                                            <Pressable
                                                style={[styles.langOption, active && styles.langOptionActive]}
                                                onPress={() => handleSelect(item)}
                                            >
                                                <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>
                                                    {item.label}
                                                </Text>
                                                <Text style={styles.langOptionCode}>{item.code}</Text>
                                                {active && <Text style={styles.langCheck}>✓</Text>}
                                            </Pressable>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <Text style={styles.langEmpty}>No languages match "{search}"</Text>
                                    }
                                />
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Dictionary language</Text>
                                    <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                                        <Text style={styles.modalClose}>✕</Text>
                                    </Pressable>
                                </View>

                                <TextInput
                                    style={styles.modalSearch}
                                    placeholder="Search languages..."
                                    placeholderTextColor={placeholderColor}
                                    value={search}
                                    onChangeText={setSearch}
                                    autoFocus
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />
                            </Pressable>
                        </Pressable>
                    </KeyboardAvoidingView>
                </KeyboardProvider>
            </Modal>
        </React.Fragment>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        langButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: C.border,
        },
        langButtonLabel: {
            fontSize: 13,
            color: C.textMuted,
        },
        langButtonRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        langButtonValue: {
            fontSize: 13,
            fontWeight: '600',
            color: ACCENT,
        },
        langChevron: {
            fontSize: 18,
            color: ACCENT,
        },
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.4)',
        },
        modalSheet: {
            backgroundColor: C.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70%',
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
        },
        modalTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: C.text,
        },
        modalClose: {
            fontSize: 16,
            color: C.textMuted,
        },
        modalSearch: {
            marginHorizontal: 16,
            height: 40,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.borderInput,
            backgroundColor: C.backgroundInput,
            paddingHorizontal: 12,
            paddingVertical: 0,
            fontSize: 15,
            color: C.text,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        langOption: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: C.border,
            gap: 8,
        },
        langOptionActive: {
            backgroundColor: C.backgroundCard,
        },
        langOptionText: {
            flex: 1,
            fontSize: 15,
            color: C.text,
        },
        langOptionTextActive: {
            color: ACCENT,
            fontWeight: '600',
        },
        langOptionCode: {
            fontSize: 12,
            color: C.textMuted,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        langCheck: {
            fontSize: 14,
            color: ACCENT,
            fontWeight: '700',
        },
        langEmpty: {
            textAlign: 'center',
            padding: 24,
            fontSize: 14,
            color: C.textMuted,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
