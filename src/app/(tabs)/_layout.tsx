import type { ComponentProps } from 'react';

import FloatingActionButton from '@/components/FloatingActionButton';
import ThemeToggle from '@/components/ThemeToggle';

import { ScrollProvider } from '@/context/scroll-context';
import { useColorScheme } from '@/context/theme-context';

import { Colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';

import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';

/**
 * Renders a tab's icon, colored via CSS (`text-tab-active`/`text-tab-inactive`,
 * global.css) instead of the literal `color` React Navigation computes from
 * `tabBarActiveTintColor`/`tabBarInactiveTintColor` — same fix already
 * applied to `headerTitle`'s color below. On the web static export, that
 * literal color gets baked in at build time for whichever tab a given
 * route's page renders as active, and — since `focused` for that specific
 * tab never changes again on its own after hydration — is never re-diffed
 * and stays visibly wrong (e.g. the light theme's blue tint on a page
 * loaded in dark mode) until the tab is switched away from and back to.
 * `color="currentColor"` is a constant string regardless of focus/theme, so
 * there's nothing for hydration to get stuck on; the real color comes from
 * the wrapping View's className, which (like every other className) is
 * correct from paint 0. Native has no such build-time-render step, so it
 * keeps using the passed-in `color` directly.
 *
 * @param {ComponentProps<typeof Ionicons>['name']} name The Ionicons glyph name.
 * @returns {(props: { focused: boolean; color: string; size: number }) => React.ReactNode} A `tabBarIcon` render function for a `Tabs.Screen`.
 *
 */
function renderTabIcon(name: ComponentProps<typeof Ionicons>['name']) {
    function TabIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
        if (Platform.OS !== 'web') {
            return <Ionicons name={name} size={size} color={color} />;
        }
        return (
            <View className={focused ? 'text-tab-active' : 'text-tab-inactive'}>
                <Ionicons name={name} size={size} color="currentColor" />
            </View>
        );
    }
    return TabIcon;
}

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const C = Colors[colorScheme];

    return (
        <ScrollProvider>
            {/* bg-background (CSS, not JS) shows through the header/tab-bar below on
                web, which are made transparent there instead of colored via
                C.background — a web static export bakes the wrong color into their
                inline styles at build time (no visitor-specific window at build
                time), and no pre-hydration script can repaint an already-rendered
                node's own inline style. className is already correct from the very
                first frame, same as every other themed element. Native has no such
                build-time-render step, so it keeps using C.background directly below
                — making it transparent there too made the tab bar genuinely
                see-through, revealing whatever's behind it. */}
            <View style={{ flex: 1 }} className="bg-background">
                <Tabs
                    screenOptions={{
                        headerShown: true,
                        headerStyle: {
                            backgroundColor: Platform.OS === 'web' ? 'transparent' : C.background,
                        },
                        // Title color moved off headerTitleStyle (a literal RN style ->
                        // literal DOM style attribute) onto a NativeWind className instead —
                        // on the web static export, a plain JS color value here gets baked
                        // into the pre-rendered markup at build time and then permanently
                        // stuck: React DOM's hydration adopts the SSR-baked attribute
                        // without patching it, and since colorScheme is correct from the
                        // very first client render onward, no later render ever produces a
                        // prop diff to trigger a real DOM update. className is CSS-driven
                        // (global.css's [data-theme] rules) and needs no React reconciliation
                        // at all, so it's correct from paint 0 regardless of hydration —
                        // same fix already applied to headerStyle/tabBarStyle's background.
                        headerTitle: ({ children }: { children: string }) => (
                            <Text className="text-fg" style={{ fontWeight: 'bold', fontVariant: ['small-caps'], fontSize: 20 }}>
                                {children}
                            </Text>
                        ),
                        headerTitleAlign: 'center',
                        headerRight: () => <ThemeToggle />,
                        tabBarStyle: {
                            backgroundColor: Platform.OS === 'web' ? 'transparent' : C.background,
                            borderTopColor: C.border,
                            paddingBottom: 50,
                            height: 105,
                        },
                        tabBarActiveTintColor: C.tint,
                        tabBarInactiveTintColor: C.tabIconDefault,
                        // Same className-over-literal-color fix as the icons (renderTabIcon)
                        // and headerTitle above — React Navigation's own label styling uses
                        // the literal tabBarActiveTintColor/tabBarInactiveTintColor values,
                        // which have the identical stuck-on-the-wrong-color problem on web.
                        tabBarLabel: ({ focused, children }: { focused: boolean; children: string }) => (
                            <Text className={focused ? 'text-tab-active' : 'text-tab-inactive'} style={{ fontSize: 10 }}>
                                {children}
                            </Text>
                        ),
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: "Search",
                            tabBarIcon: renderTabIcon('search'),
                        }}
                    />
                    <Tabs.Screen
                        name="words-list"
                        options={{
                            title: "Words",
                            tabBarIcon: renderTabIcon('list'),
                        }}
                    />
                    <Tabs.Screen
                        name="read-list"
                        options={{
                            title: "Library",
                            tabBarIcon: renderTabIcon('list-circle'),
                        }}
                    />
                    <Tabs.Screen
                        name="memory-words"
                        options={{
                            title: "Memory",
                            tabBarIcon: renderTabIcon('alarm'),
                        }}
                    />
                    <Tabs.Screen
                        name="more"
                        options={{
                            title: "More",
                            tabBarIcon: renderTabIcon('ellipsis-horizontal'),
                        }}
                    />
                    <Tabs.Screen
                        name="custom-book"
                        options={{ href: null, title: "Custom Book" }}
                    />
                    <Tabs.Screen
                        name="about"
                        options={{ href: null, title: "About" }}
                    />
                    <Tabs.Screen
                        name="support"
                        options={{ href: null, title: "Support" }}
                    />
                    <Tabs.Screen
                        name="analyze"
                        options={{ href: null, title: "Analyze" }}
                    />
                    <Tabs.Screen
                        name="stats"
                        options={{ href: null, title: "Stats" }}
                    />
                </Tabs>
                <FloatingActionButton />
            </View>
        </ScrollProvider>
    );
}
