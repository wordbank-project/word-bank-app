import React, { useState } from "react";

import { Platform, Text, View, type LayoutChangeEvent } from "react-native";

// A one-line label that shrinks to fit its container — for pill/chip buttons laid
// out with flex-1 (the Read List filters, ReadStatusSelector, Chip).
//
// iOS/Android: plain `adjustsFontSizeToFit`. React Native Web ignores that prop
// (the label would just get cut off), so on web this measures the space
// available and the label's natural width (canvas `measureText`), scales the font
// down to fit on one line — never below `minimumFontScale` — and, if even that
// isn't enough, lets the label wrap onto a second line rather than clipping it.

type FitTextProps = {
    children: string;
    // Text classes, including the size (e.g. "text-xs font-semibold text-muted").
    className: string;
    // The label's full font size in px on web — must match the size in `className`.
    fontSize: number;
    // Font weight used for the web measurement — must match `className`.
    fontWeight?: number;
    // Smallest scale the font may shrink to, like `adjustsFontSizeToFit`'s.
    minimumFontScale?: number;
};

// Matches React Native Web's default system font stack closely enough for measuring.
const WEB_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * Measures how wide `text` renders on one line in the given font, using a shared
 * offscreen canvas. Web only.
 *
 * @param {string} text The label to measure.
 * @param {number} fontSize The font size in px.
 * @param {number} fontWeight The font weight.
 * @returns {number | null} The width in px, or `null` if no canvas is available.
 *
 */
function measureTextWidth(text: string, fontSize: number, fontWeight: number): number | null {
    if (measureContext === undefined) {
        measureContext = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    }
    if (!measureContext) {
        return null;
    }
    measureContext.font = `${fontWeight} ${fontSize}px ${WEB_FONT_FAMILY}`;
    return measureContext.measureText(text).width;
}

/**
 * Renders a label that always fits its container: shrinks on every platform, and
 * on web wraps to a second line as a last resort.
 *
 * @param {FitTextProps} props The label, its text classes, and its web font metrics.
 * @returns {React.JSX.Element} The fitted label.
 *
 */
export default function FitText({ children, className, fontSize, fontWeight = 600, minimumFontScale = 0.7 }: FitTextProps): React.JSX.Element {
    const [availableWidth, setAvailableWidth] = useState<number>(0);

    if (Platform.OS !== "web") {
        return (
            <Text className={className} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minimumFontScale}>
                {children}
            </Text>
        );
    }

    // Until the first layout pass there's nothing to fit against — render at full size.
    const naturalWidth = availableWidth > 0 ? measureTextWidth(children, fontSize, fontWeight) : null;
    // 4% headroom: the canvas font stack can measure a hair narrower than what the
    // browser actually renders, which would still ellipsize a label that "just fits".
    const scale = naturalWidth ? Math.min(1, (availableWidth * 0.96) / naturalWidth) : 1;
    const fitsOnOneLine = scale >= minimumFontScale;
    const fittedFontSize = fitsOnOneLine ? fontSize * scale : fontSize * minimumFontScale;

    /**
     * Records how much width the label may use.
     *
     * @param {LayoutChangeEvent} event The wrapper's layout event.
     * @returns {void} Returns nothing.
     *
     */
    function handleLayout(event: LayoutChangeEvent): void {
        const width = event.nativeEvent.layout.width;
        // Ignore sub-pixel jitter so a re-render can never keep re-triggering layout.
        setAvailableWidth((previous) => (Math.abs(previous - width) < 0.5 ? previous : width));
    }

    return (
        // w-full: the wrapper's width comes from the pill (flex-1), never from the
        // label — measuring a wrapper that shrink-wraps the text would feed each
        // shrink back into the next measurement and spiral down to the minimum.
        <View className="w-full" onLayout={handleLayout}>
            <Text
                className={`${className} text-center`}
                // Always set on web, so the rendered size is exactly the size measured
                // above (a class-derived size could differ from `fontSize` and throw it off).
                style={{ fontSize: fittedFontSize, lineHeight: Math.round(fittedFontSize * 1.3) }}
                numberOfLines={fitsOnOneLine ? 1 : 2}
            >
                {children}
            </Text>
        </View>
    );
}
