import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { clearAllBookData } from "@/storage/read-list-storage";
import { alertDialog } from "@/utils/alert-dialog";
import { showActionSheet } from "@/utils/show-action-sheet";
import { Link, router, type Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

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
    const inner = (
        <View className={`flex-row items-center justify-between p-3.5 ${!first ? "border-t border-border" : ""}`}>
            <Text className={`text-[15px] ${danger ? "text-error" : "text-fg"}`}>{label}</Text>
            <View className="flex-row items-center gap-1.5">
                {value ? <Text className="text-[15px] text-muted">{value}</Text> : null}
                {chevron ? <Text className="text-lg text-faded">›</Text> : null}
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
    return (
        <View className="gap-2">
            <Text className="ml-1 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">{title}</Text>
            <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
        </View>
    );
}

// A tappable source row: shows the area, the provider in use, and a plain-language
// description. Tapping opens the provider chooser.
function SourceRow({ source, first, onPress }: { source: BookSource; first?: boolean; onPress: () => void }) {
    return (
        <Pressable className={`flex-row items-center gap-2 px-3.5 py-3 ${!first ? "border-t border-border" : ""}`} onPress={onPress}>
            <View className="flex-1 gap-0.5">
                <Text className="text-xs font-semibold uppercase tracking-[0.5px] text-muted">{source.category}</Text>
                <Text className="text-[15px] font-medium text-fg">{source.active}</Text>
                <Text className="text-[13px] leading-[18px] text-muted">{source.description}</Text>
            </View>
            <Text className="text-lg text-faded">›</Text>
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
    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    return (
        <ScrollView
            ref={scrollRef}
            className="flex-1 bg-background"
            contentContainerClassName="p-4 pb-8 gap-6"
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
                <Row label="Source code" href="https://github.com/wordbank-project/word-bank" chevron />
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
