import { Pressable, View } from "react-native";

import { useColorScheme } from "@/context/theme-context";
import { Colors } from "@/styles/global";

import IconSymbol from "@/components/ui/IconSymbol";

const STARS = [1, 2, 3, 4, 5];

type StarRatingProps = {
    value: number;                        // current rating, 0–5
    onChange?: (rating: number) => void;  // omit for a read-only display
    size?: number;
};

/** Renders a 0–5 star rating, optionally interactive.
 * @param {StarRatingProps} props the component props
 * @returns {JSX.Element} the rendered star rating component
 * 
 */
export default function StarRating({ value, onChange, size = 28 }: StarRatingProps) {
    const scheme = useColorScheme();
    const filledColor = Colors[scheme].star;
    const emptyColor = Colors[scheme].textFaded;
    const readOnly = !onChange;

    return (
        <View className="flex-row gap-1 mx-0 my-2">
            {STARS.map((n) => {
                const filled = n <= value;
                const icon = (
                    <IconSymbol
                        name={filled ? "star.fill" : "star"}
                        size={size}
                        color={filled ? filledColor : emptyColor}
                    />
                );

                if (readOnly) {
                    return <View key={n}>{icon}</View>;
                }

                return (
                    <Pressable
                        key={n}
                        hitSlop={4}
                        onPress={() => onChange(n === value ? 0 : n)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filled }}
                        accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
                    >
                        {icon}
                    </Pressable>
                );
            })}
        </View>
    );
}
