import { Book } from "@/models/book";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function BookItem({ book }: { book: Book }) {
    const { key, title, author_name, first_publish_year, cover_i } = book;
    return (
        <Pressable
            style={styles.bookRow}
            onPress={() =>
                router.push({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pathname: "/book" as any,
                    params: {
                        key,
                        title,
                        author: author_name?.slice(0, 2).join(", ") ?? "",
                        year: first_publish_year?.toString() ?? "",
                        cover_i: cover_i?.toString() ?? "",
                    },
                })
            }
        >
            {cover_i ? (
                <Image
                    source={{ uri: `https://covers.openlibrary.org/b/id/${cover_i}-S.jpg` }}
                    style={styles.cover}
                />
            ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
            )}
            <View style={styles.bookInfo}>
                <Text style={styles.title} numberOfLines={2}>{title}</Text>
                {author_name && (
                    <Text style={styles.author} numberOfLines={1}>
                        {author_name.slice(0, 2).join(", ")}
                    </Text>
                )}
                {first_publish_year && (
                    <Text style={styles.year}>{first_publish_year}</Text>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bookRow: {
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e0e0e0",
    },
    cover: {
        width: 48,
        height: 64,
        borderRadius: 4,
    },
    coverPlaceholder: {
        backgroundColor: "#ddd",
    },
    bookInfo: {
        flex: 1,
        justifyContent: "center",
        gap: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: "600",
        color: "#11181C",
    },
    author: {
        fontSize: 13,
        color: "#555",
    },
    year: {
        fontSize: 12,
        color: "#888",
    },
});
