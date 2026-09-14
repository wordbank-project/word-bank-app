import FloatingActionButton from '@/components/FloatingActionButton';
import ThemeToggle from '@/components/ThemeToggle';

import { ScrollProvider } from '@/context/scroll-context';
import { useColorScheme } from '@/context/theme-context';

import { Colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';

import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const C = Colors[colorScheme];

    return (
        <ScrollProvider>
            {/* bg-background (CSS, not JS) shows through the header/tab-bar below,
                which are made transparent instead of colored via C.background —
                a web static export bakes the wrong color into their inline
                styles at build time (no visitor-specific window at build time),
                and no pre-hydration script can repaint an already-rendered
                node's own inline style. className is already correct from the
                very first frame, same as every other themed element. */}
            <View style={{ flex: 1 }} className="bg-background">
                <Tabs
                    screenOptions={{
                        headerShown: true,
                        headerStyle: {
                            backgroundColor: 'transparent',
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
                            backgroundColor: 'transparent',
                            borderTopColor: C.border,
                            paddingBottom: 50,
                            height: 105,
                        },
                        tabBarActiveTintColor: C.tint,
                        tabBarInactiveTintColor: C.tabIconDefault,
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: "Search",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="search" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="words-list"
                        options={{
                            title: "Words",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="list" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="read-list"
                        options={{
                            title: "Library",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="list-circle" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="memory-words"
                        options={{
                            title: "Memory",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="alarm" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="more"
                        options={{
                            title: "More",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="ellipsis-horizontal" size={size} color={color} />
                            ),
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
