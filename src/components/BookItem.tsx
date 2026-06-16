import { useThemedStyles } from "@/hooks/use-themed-styles";
import { Book } from "@/models/book";
import { Colors, Fonts } from "@/styles/global";
import { coverUri } from "@/utils/cover-uri";
import { openBook } from "@/utils/open-book";
import { Pressable, StyleSheet, Text, View } from "react-native";

import CoverImage from "./CoverImage";
import CoverPlaceholder from "./CoverPlaceholder";

export default function BookItem({ book }: { book: Book }) {
    const styles = useThemedStyles(lightStyles, darkStyles);

    const { key, title, author_name, first_publish_year, cover_i } = book;
    return (
        <Pressable
            style={styles.bookRow}
            onPress={() =>
                openBook({
                    key,
                    title,
                    author: author_name?.slice(0, 2).join(", ") ?? "",
                    year: first_publish_year?.toString() ?? "",
                    cover_i: cover_i?.toString() ?? "",
                })
            }
        >
            <CoverImage uri={coverUri(cover_i, 'S')} style={styles.cover} placeholder={<CoverPlaceholder size={20} />} />
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

function buildStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        bookRow: {
            flexDirection: "row",
            gap: 12,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: C.border,
        },
        cover: {
            width: 48,
            height: 64,
            borderRadius: 4,
        },
        bookInfo: {
            flex: 1,
            justifyContent: "center",
            gap: 4,
        },
        title: {
            fontSize: 15,
            fontWeight: "600",
            color: C.text,
            fontFamily: Fonts.serif,
        },
        author: {
            fontSize: 13,
            color: C.textSecondary,
        },
        year: {
            fontSize: 12,
            color: C.textMuted,
        },
    });
}

const lightStyles = buildStyles(Colors.light);
const darkStyles = buildStyles(Colors.dark);
