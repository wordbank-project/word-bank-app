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
                            fontSize: 25,
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
                            title: "All Books",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="home" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="saved-books"
                        options={{
                            title: "Saved Books",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="book" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="read-list"
                        options={{
                            title: "Read List",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="list" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="export-books"
                        options={{
                            title: "Export Books",
                            tabBarIcon: ({ color, size }) => (
                                <Ionicons name="share" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="custom-book"
                        options={{ href: null }}
                    />
                </Tabs>
                <FloatingActionButton />
            </View>
        </ScrollProvider>
    );
}
