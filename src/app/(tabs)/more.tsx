import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { Colors } from "@/styles/global";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { version, license } from "../../../package.json";

type RowProps = {
    label: string;
    value?: string;
    href?: Href;
    onPress?: () => void;
    chevron?: boolean;
    first?: boolean;
};

// A single settings-style row. Renders a chevron when it leads somewhere, or a
// right-aligned value for read-only info (version, license).
function Row({ label, value, href, onPress, chevron, first }: RowProps) {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const inner = (
        <View style={[styles.row, !first && styles.rowBorder]}>
            <Text style={styles.rowLabel}>{label}</Text>
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
            <Section title="Settings">
                <Row label="Notifications" href="/notifications-settings" chevron first />
            </Section>

            <Section title="Your data">
                <Row label="Export Books" chevron first />
                <Row label="Import Books" chevron />
            </Section>

            <Section title="About">
                <Row label="About" href="/about" chevron first />
                <Row label="Source code" href="https://github.com/word-bank/word-bank" chevron />
                <Row label="Version" value={version} />
                <Row label="License" value={license} />
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
