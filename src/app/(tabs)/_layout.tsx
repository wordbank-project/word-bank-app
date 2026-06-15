import FloatingActionButton from '@/components/FloatingActionButton';
import ThemeToggle from '@/components/ThemeToggle';

import { ScrollProvider } from '@/context/scroll-context';
import { useColorScheme } from '@/context/theme-context';

import { Colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';

import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const C = Colors[colorScheme];

    return (
        <ScrollProvider>
            <View style={{ flex: 1 }}>
                <Tabs
                    screenOptions={{
                        headerShown: true,
                        headerStyle: {
                            backgroundColor: C.background,
                        },
                        headerTitleStyle: {
                            color: C.text,
                            fontWeight: 'bold',
                            fontVariant: ['small-caps'],
                            fontSize: 20,
                        },
                        headerTitleAlign: 'center',
                        headerRight: () => <ThemeToggle />,
                        tabBarStyle: {
                            backgroundColor: C.background,
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
                        name="read-list"
                        options={{
                            title: "Read List",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="list-circle" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="words-list"
                        options={{
                            title: "Words List",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="list" size={size} color={color} />
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
                        name="notifications-settings"
                        options={{ href: null, title: "Notifications" }}
                    />
                </Tabs>
                <FloatingActionButton />
            </View>
        </ScrollProvider>
    );
}
