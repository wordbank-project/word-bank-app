import { Pressable, Text } from "react-native";

type ChipProps = {
    label: string;
    selected: boolean;
    onPress: () => void;
};

/**
 * One selectable pill — the shared visual for every chip in a SizeChipRow,
 * whether it's a fixed preset or the "Custom" action chip, so both look and
 * behave identically.
 *
 * @param {ChipProps} props The chip's label, selected state, and press handler.
 * @returns {JSX.Element} The rendered chip.
 *
 */
export default function Chip({ label, selected, onPress }: ChipProps) {
    return (
        <Pressable
            onPress={onPress}
            className={`flex-1 items-center justify-center rounded-lg border px-1 py-1.75 ${selected ? "border-accent bg-accent" : "border-border-input bg-input"}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
        >
            <Text
                className={`text-xs font-semibold ${selected ? "text-white" : "text-muted"}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
            >
                {label}
            </Text>
        </Pressable>
    );
}
