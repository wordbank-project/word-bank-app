import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { clearAllBookData } from "@/storage/read-list-storage";
import { Colors, ERROR } from "@/styles/global";
import { showActionSheet } from "@/utils/show-action-sheet";
import { alertDialog } from "@/utils/alert-dialog";
import { Link, router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { version, license } from "../../../package.json";

// The services that power the app. `pro` providers are placeholders for a future
// paid version — selecting one shows an upsell rather than actually switching.
type SourceProvider = { name: string; pro?: boolean };
type BookSource = {
    category: string;
    description: string;
    active: string;              // currently-used provider (free)
    providers: SourceProvider[]; // options shown in the chooser
};

const SOURCES: BookSource[] = [
    {
        category: 'Books',
        description: 'Where Word Bank finds books and their covers.',
        active: 'Open Library',
        providers: [{ name: 'Open Library' }, { name: 'Google Books', pro: true }],
    },
    {
        category: 'Definitions',
        description: 'Where word meanings and example sentences come from.',
        active: 'Wiktionary & Free Dictionary',
        providers: [{ name: 'Wiktionary & Free Dictionary' }, { name: 'Urban Dictionary', pro: true }],
    },
];

// Developer-facing links to the actual APIs behind the sources above.
const API_LINKS: { label: string; href: string }[] = [
    { label: 'Open Library API', href: 'https://openlibrary.org/developers/api' },
    { label: 'Free Dictionary API', href: 'https://dictionaryapi.dev' },
    { label: 'Wiktionary API (wiktapi.dev)', href: 'https://github.com/TheAlexLichter/wiktapi.dev' },
];

type RowProps = {
    label: string;
    value?: string;
    href?: Href;
    onPress?: () => void;
    chevron?: boolean;
    first?: boolean;
    danger?: boolean;
};

// A single settings-style row. Renders a chevron when it leads somewhere, or a
// right-aligned value for read-only info (version, license). `danger` styles a
// destructive action's label in red.
function Row({ label, value, href, onPress, chevron, first, danger }: RowProps) {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const inner = (
        <View style={[styles.row, !first && styles.rowBorder]}>
            <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
            <View style={styles.rowRight}>
                {value ? <Text style={styles.rowValue}>{value}</Text> : null}
                {chevron ? <Text style={styles.chevron}>›</Text> : null}
            </View>
        </View>
    );

    if (href) {
        return (
            <Link href={href} asChild>
                <Pressable>{inner}</Pressable>
            </Link>
        );
    }
    if (onPress) {
        return <Pressable onPress={onPress}>{inner}</Pressable>;
    }
    return inner;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const styles = useThemedStyles(lightStyles, darkStyles);
    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>{title}</Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
}

// A tappable source row: shows the area, the provider in use, and a plain-language
// description. Tapping opens the provider chooser.
function SourceRow({ source, first, onPress }: { source: BookSource; first?: boolean; onPress: () => void }) {
    const styles = useThemedStyles(lightStyles, darkStyles);
    return (
        <Pressable style={[styles.sourceRow, !first && styles.rowBorder]} onPress={onPress}>
            <View style={styles.sourceMain}>
                <Text style={styles.sourceCategory}>{source.category}</Text>
                <Text style={styles.sourceProvider}>{source.active}</Text>
                <Text style={styles.sourceDescription}>{source.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </Pressable>
    );
}

// Lets you pick a provider. The active (free) one is the only working choice for now;
// Pro options show an upsell instead of switching (placeholder for a future version).
function handleChooseSource(source: BookSource): void {
    showActionSheet(source.category, 'Choose where this comes from', [
        ...source.providers.map((p) => ({
            text: `${p.name === source.active ? '✓ ' : ''}${p.name}${p.pro ? '  (Pro)' : ''}`,
            onPress: () => {
                if (p.pro) {
                    alertDialog('Word Bank Pro', `${p.name} will be available in a future Pro version.`);
                }
            },
        })),
        { text: 'Cancel', style: 'cancel' as const },
    ]);
}

function handleDeleteAll(): void {
    showActionSheet(
        "Delete all data",
        "This permanently deletes every book and all of its words. This cannot be undone!",
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete everything",
                style: "destructive",
                onPress: async () => {
                    // Clear all book data, then navigate to the read list screen (which will be empty).
                    await clearAllBookData();
                    router.navigate('/(tabs)/read-list');
                },
            },
        ],
    );
}

export default function MoreScreen() {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={styles.content}
            scrollEventThrottle={scrollEventThrottle}
            onScroll={onScroll}
        >
            <Section title="Your data">
                <Row label="Export Books" chevron first />
                <Row label="Import Books" chevron />
                <Row label="Delete all data" danger onPress={handleDeleteAll} />
            </Section>

            <Section title="Sources">
                {SOURCES.map((source, i) => (
                    <SourceRow
                        key={source.category}
                        source={source}
                        first={i === 0}
                        onPress={() => handleChooseSource(source)}
                    />
                ))}
            </Section>

            <Section title="About">
                <Row label="About" href="/about" chevron first />
                <Row label="Source code" href="https://github.com/word-bank/word-bank" chevron />
                <Row label="Version" value={version} />
                <Row label="License" value={license} />
            </Section>

            <Section title="Developer">
                {API_LINKS.map((link, i) => (
                    <Row key={link.href} label={link.label} href={link.href as Href} chevron first={i === 0} />
                ))}
            </Section>
        </ScrollView>
    );
}

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: C.background,
        },
        content: {
            padding: 16,
            paddingBottom: 32,
            gap: 24,
        },
        section: {
            gap: 8,
        },
        sectionLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginLeft: 4,
        },
        card: {
            backgroundColor: C.backgroundCard,
            borderRadius: 10,
            overflow: 'hidden',
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 14,
        },
        rowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: C.border,
        },
        rowLabel: {
            fontSize: 15,
            color: C.text,
        },
        rowLabelDanger: {
            color: ERROR,
        },
        sourceRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 8,
        },
        sourceMain: {
            flex: 1,
            gap: 2,
        },
        sourceCategory: {
            fontSize: 12,
            fontWeight: '600',
            color: C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        sourceProvider: {
            fontSize: 15,
            fontWeight: '500',
            color: C.text,
        },
        sourceDescription: {
            fontSize: 13,
            color: C.textMuted,
            lineHeight: 18,
        },
        rowRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        rowValue: {
            fontSize: 15,
            color: C.textMuted,
        },
        chevron: {
            fontSize: 18,
            color: C.textFaded,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
