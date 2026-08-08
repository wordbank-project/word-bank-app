import type { ReadListBook, ReadStatus } from "@/models/read-list-book";
import { READ_STATUS_LABELS } from "@/models/read-list-book";

import { Fonts } from "@/styles/global";
import { coverUri } from "@/utils/cover-uri";
import { Pressable, Text, View } from "react-native";

import CoverImage from "@/components/CoverImage";
import CoverPlaceholder from "@/components/CoverPlaceholder";
import StarRating from "@/components/StarRating";

// Per-status badge styling (border/fill) and label color.
const STATUS_BADGE: Record<ReadStatus, string> = {
    want: 'border-border',
    currently_reading: 'border-accent',
    read: 'border-accent bg-accent',
};
const STATUS_TEXT: Record<ReadStatus, string> = {
    want: 'text-muted',
    currently_reading: 'text-accent',
    read: 'text-white',
};

type ReadListItemProps = {
    item: ReadListBook;
    wordCount: number;
    onPress: () => void;
    onRemove: () => void;
    onChangeStatus: () => void;
};

export default function ReadListItem({ item, wordCount, onPress, onRemove, onChangeStatus }: ReadListItemProps) {
    const cover = coverUri(item.cover_i, 'S');

    return (
        <View className="flex-row items-center border-b border-border">
            <Pressable className="flex-1 flex-row items-center gap-3 py-3" onPress={onPress}>
                <CoverImage uri={cover} className="h-16 w-12 rounded" placeholder={<CoverPlaceholder size={20} />} />
                <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-semibold text-fg" style={{ fontFamily: Fonts.serif }} numberOfLines={2}>{item.title}</Text>
                    {item.author ? (
                        <Text className="text-[13px] text-secondary" numberOfLines={1}>{item.author}</Text>
                    ) : null}
                    {item.year ? (
                        <Text className="text-xs text-muted">{item.year}</Text>
                    ) : null}
                    <Pressable
                        onPress={onChangeStatus}
                        hitSlop={6}
                        className={`mt-1 self-start rounded border px-1.75 py-0.5 ${STATUS_BADGE[item.status]}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Status: ${READ_STATUS_LABELS[item.status]}. Tap to change.`}
                    >
                        <Text className={`text-[11px] font-semibold ${STATUS_TEXT[item.status]}`}>
                            {READ_STATUS_LABELS[item.status]}
                        </Text>
                    </Pressable>
                    {item.status === 'read' && item.rating ? (
                        <View className="mt-1">
                            <StarRating value={item.rating} size={12} />
                        </View>
                    ) : null}
                </View>
                <View className="min-w-11 items-center">
                    <Text className="text-xl font-bold text-accent">{wordCount}</Text>
                    <Text className="text-[11px] text-muted">
                        {wordCount === 1 ? 'word' : 'words'}
                    </Text>
                </View>
            </Pressable>
            <Pressable onPress={onRemove} className="p-3" hitSlop={8}>
                <Text className="text-base text-remove-icon">✕</Text>
            </Pressable>
        </View>
    );
}
