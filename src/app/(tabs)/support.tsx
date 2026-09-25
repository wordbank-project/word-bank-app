import { useBackTo } from "@/hooks/use-back-to";
import { useScrollViewScroll } from "@/hooks/use-scroll-registration";
import { Fonts } from "@/styles/global";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, Share, Text, View } from "react-native";

// Google Play policy forbids donation links inside Play-distributed apps — if a
// Play release ever ships, hide this screen and its More-tab row in that flavor
// (gate via app.config.js `extra`, same seam as the FDROID flag).
// TODO: confirm the Liberapay / Ko-fi / Buy Me a Coffee handles after registering.
const DONATE_LINKS: { name: string; description: string; href: string }[] = [
    // Hidden until the account is set up.
    // {
    //     name: "GitHub Sponsors",
    //     description: "Recurring or one-time support through your GitHub account — no fees.",
    //     href: "https://github.com/sponsors/jensrot",
    // },
    {
        name: "Liberapay",
        description: "Recurring donations on an open-source platform — no fees.",
        href: "https://liberapay.com/jensrot",
    },
    {
        name: "Ko-fi",
        description: "A quick one-off tip — no account needed.",
        href: "https://ko-fi.com/jensrot",
    },
    // Hidden until the account is set up.
    // {
    //     name: "Buy Me a Coffee",
    //     description: "Buy a coffee's worth of support in a couple of taps.",
    //     href: "https://buymeacoffee.com/jensrot",
    // },
];

const REPO_URL = "https://github.com/wordbank-project/word-bank";
const SITE_URL = "https://wordbankapp.com";
const SHARE_MESSAGE =
    "Word Bank — turn the books you read into vocabulary you keep. Free, open source, offline.";

type LinkRowProps = {
    label: string;
    description: string;
    href?: string;
    onPress?: () => void;
    first?: boolean;
    external?: boolean; // opens href in a new tab on web; native already opens external URLs in the system browser regardless
};

// A settings-style row with a title + one-line blurb, leading somewhere (an
// external URL via expo-router, or an onPress action like the share sheet).
// `external` opts the row into opening in a new tab on web.
function LinkRow({ label, description, href, onPress, first, external }: LinkRowProps) {
    const inner = (
        <View className={`flex-row items-center gap-2 px-3.5 py-3 ${!first ? "border-t border-border" : ""}`}>
            <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-medium text-fg">{label}</Text>
                <Text className="text-[13px] leading-4.5 text-muted">{description}</Text>
            </View>
            <Text className="text-lg text-faded">›</Text>
        </View>
    );

    if (href) {
        // `target` on <Link asChild> never reaches the DOM: react-native-web's View only
        // reads a nested `hrefAttrs` object, but Link's asChild path spreads `target` as a
        // bare prop instead — so it's passed directly to the Pressable child here instead.
        // react-native-web reads hrefAttrs off props at runtime but doesn't declare it on
        // PressableProps, so it needs a cast here.
        const webLinkProps = external ? ({ hrefAttrs: { target: "_blank" } } as object) : {};
        return (
            <Link href={href as Href} asChild>
                <Pressable {...webLinkProps}>{inner}</Pressable>
            </Link>
        );
    }
    return <Pressable onPress={onPress}>{inner}</Pressable>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="gap-2">
            <Text className="ml-1 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted">{title}</Text>
            <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
        </View>
    );
}

export default function SupportScreen() {
    const { ref: scrollRef, onScroll, scrollEventThrottle } = useScrollViewScroll();

    // Opened from the More tab — back should go there, not to the first tab.
    useBackTo("/more");

    // The native share sheet covers every social/messaging app on the device.
    const handleShare = async () => {
        try {
            await Share.share({ message: `${SHARE_MESSAGE} ${SITE_URL}` });
        } catch (error) {
            // Dismissed or unavailable — not a real failure, logged for visibility only.
            console.error(error);
        }
    };

    return (
        <ScrollView
            ref={scrollRef}
            className="flex-1 bg-background"
            contentContainerClassName="p-4 pb-8 gap-6"
            scrollEventThrottle={scrollEventThrottle}
            onScroll={onScroll}
        >
            <View className="items-center gap-1 pt-2">
                <Text className="text-2xl font-bold text-fg" style={{ fontFamily: Fonts.serif }}>
                    Support Word Bank ❤️
                </Text>
            </View>

            <View className="bg-card rounded-[10px] p-4">
                <Text className="text-[15px] leading-6 text-body">
                    Word Bank is free, open source, and ad-free — and it&apos;s staying that way.
                    There&apos;s no company behind it, just one developer and a few servers. Every
                    donation goes to infrastructure: the server running the dictionary and
                    word-feed APIs, and the domain behind them — currently about $6 a month and
                    $10 a year. The AI features run on free tiers for now; that&apos;s the part
                    most likely to grow.
                </Text>
            </View>

            <Section title="Donate">
                {DONATE_LINKS.map((link, i) => (
                    <LinkRow
                        key={link.href}
                        label={link.name}
                        description={link.description}
                        href={link.href}
                        first={i === 0}
                    />
                ))}
            </Section>

            <Section title="Other ways to help">
                <LinkRow
                    label="Star the project on GitHub"
                    description="A star makes Word Bank easier to discover and tells us it matters to you."
                    href={REPO_URL}
                    first
                />
                <LinkRow
                    label="Report bugs & share ideas"
                    description="Found something broken or missing? An issue on GitHub is a real contribution."
                    href={`${REPO_URL}/issues`}
                />
                <LinkRow
                    label="Tell a fellow reader"
                    description="Word Bank grows by word of mouth — share it with someone who reads."
                    onPress={handleShare}
                />
                <LinkRow
                    label="Website"
                    description="wordbankapp.com — the place to send anyone who wants to know more."
                    href={SITE_URL}
                    external
                />
            </Section>

            <Text className="px-1 text-[13px] leading-4.5 text-muted">
                Every contribution — money, code, or a kind word — keeps Word Bank free for
                everyone. Thank you. ❤️
            </Text>
        </ScrollView>
    );
}
