import type { ReadStatus } from "@/models/read-list-book";
import { READ_STATUS_LABELS, READ_STATUS_ORDER } from "@/models/read-list-book";

import { Pressable, View } from "react-native";

import FitText from "@/components/FitText";

type ReadStatusSelectorProps = {
    value: ReadStatus;
    onChange: (status: ReadStatus) => void;
};

export default function ReadStatusSelector({ value, onChange }: ReadStatusSelectorProps) {
    return (
        <View className="flex-row gap-2">
            {READ_STATUS_ORDER.map((status) => {
                const selected = status === value;
                return (
                    <Pressable
                        key={status}
                        onPress={() => onChange(status)}
                        className={`flex-1 items-center justify-center rounded-lg border py-2 ${selected ? "border-accent bg-accent" : "border-border-input bg-input"}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={READ_STATUS_LABELS[status]}
                    >
                        <FitText className={`text-[13px] font-semibold ${selected ? "text-white" : "text-muted"}`} fontSize={13}>
                            {READ_STATUS_LABELS[status]}
                        </FitText>
                    </Pressable>
                );
            })}
        </View>
    );
}
