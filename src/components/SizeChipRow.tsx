import { useState } from "react";

import { Pressable, Text, View } from "react-native";

import { useColorScheme } from "@/context/theme-context";

import { ROUND_SIZE_OPTIONS, type RoundSize } from "@/storage/notifications-storage";

import { Colors } from "@/styles/global";

import Chip from "@/components/Chip";
import ClearableTextInput from "@/components/ClearableTextInput";

type SizeChipRowProps = {
    value: RoundSize;
    onChange: (value: RoundSize) => void;
    maxAllowedInputValue: number;
};

// Either a preset round size or a custom value that gets validated.
type SizeOption =
    | { kind: "preset"; value: RoundSize; label: string }
    | { kind: "custom" };

/**
 * A row of "5 / 10 / 20 / All / Custom" chips — shared by the in-session
 * round-size picker and the reminder's word-count target picker so both look
 * and behave identically. "Custom" isn't a value itself — tapping it just
 * reveals a small number field below the row; the size only actually changes
 * once a number is typed and confirmed there, same as tapping any other chip.
 *
 * @param {SizeChipRowProps} props The selected value, its change handler, and the pool-size cap.
 * @returns {JSX.Element} The rendered chip row, plus the custom input once revealed.
 *
 */
export default function SizeChipRow({ value, onChange, maxAllowedInputValue }: SizeChipRowProps) {
    const placeholderColor = Colors[useColorScheme()].textPlaceholder;

    // Whether the current value is one of the fixed presets, or a custom
    // number instead — drives whether the "Custom" chip shows as selected
    // (and shows the actual number) and whether its input starts open.
    const isPreset = ROUND_SIZE_OPTIONS.some((option) => option.value === value);
    const [showCustomInput, setShowCustomInput] = useState<boolean>(!isPreset);
    const [customText, setCustomText] = useState<string>(isPreset ? "" : String(value));

    /**
     * Strips the typed text down to digits only.
     * If it's empty (so the field can still be cleared),
     * or its numeric value is lower than or equal to `maxAllowedInputValue`,
     * then we allow it to pass.
     *
     * @param {string} inputCandidate The text typed in the input field.
     * @returns {void} Returns nothing.
     *
     */
    function validateCustomInput(inputCandidate: string): void {
        const allowedInput: string = inputCandidate.replace(/[^0-9]/g, "");
        if (allowedInput === "" || parseInt(allowedInput) <= maxAllowedInputValue) {
            setCustomText(allowedInput);
        }
    }

    /**
     * Parses the typed custom size and applies it
     * if it's a valid whole number between 1 and the `maxAllowedInputValue`.
     * We also hide the custom input field after it passes
     * @returns {void} Returns nothing.
     *
     */
    function applyCustomSize(): void {
        const parsedNumber: number = parseInt(customText);
        if (Number.isInteger(parsedNumber) && parsedNumber > 0 && parsedNumber <= maxAllowedInputValue) {
            onChange(parsedNumber);
            setShowCustomInput(false);
        }
    }

    // The presets plus the "Custom" action chip, as one array
    const chipOptions: SizeOption[] = [
        ...ROUND_SIZE_OPTIONS.map((option): SizeOption =>
            ({ kind: "preset", ...option })),
        { kind: "custom" },
    ];

    return (
        <View className="gap-2">
            <View className="flex-row gap-2">
                {chipOptions.map((option: SizeOption) => {
                    if (option.kind === "preset") {
                        return (
                            <Chip
                                key={option.label}
                                label={option.label}
                                // Not selected while the custom input is open, even if `value`
                                // still matches this preset — the input being open means you're
                                // actively choosing a different (custom) size right now.
                                selected={!showCustomInput && value === option.value}
                                onPress={() => {
                                    setShowCustomInput(false);
                                    onChange(option.value);
                                }}
                            />
                        );
                    }
                    // Shows the input field where we can enter a value
                    return (
                        <Chip
                            key="custom"
                            label={isPreset ? "Custom" : `${value}`}
                            // Selected once a custom value is actually committed (!isPreset), OR
                            // while the input is still open and not yet confirmed (showCustomInput)
                            // — otherwise tapping "Custom" wouldn't visibly react until "Set".
                            selected={!isPreset || showCustomInput}
                            onPress={() => setShowCustomInput(true)}
                        />
                    );
                })}
            </View>

            {showCustomInput ? (
                <View className="flex-row items-center gap-2">
                    <ClearableTextInput
                        containerClassName="flex-1"
                        className="rounded-lg border border-border-input bg-input p-2.5 text-[14px] android:leading-[21px] text-fg"
                        placeholder={`Enter a number (max ${maxAllowedInputValue})`}
                        placeholderTextColor={placeholderColor}
                        keyboardType="number-pad"
                        value={customText}
                        onChangeText={(text: string) => {
                            validateCustomInput(text);
                        }}
                        onSubmitEditing={applyCustomSize}
                        returnKeyType="done"
                        autoFocus={true}
                    />
                    <Pressable onPress={applyCustomSize} className="items-center rounded-lg bg-accent p-2.5">
                        <Text className="text-xs font-semibold text-white">Set</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}
