// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// Extract<..., string>: SymbolViewProps['name'] also allows a per-platform
// object ({ ios?, android?, web? }) as of expo-symbols' SDK 55 types, but this
// file only ever maps plain SF Symbol strings (see MAPPING below), and a
// Record key must be string | number | symbol anyway.
type IconMapping = Record<Extract<SymbolViewProps['name'], string>, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
    'house.fill': 'home',
    'paperplane.fill': 'send',
    'chevron.left.forwardslash.chevron.right': 'code',
    'chevron.right': 'chevron-right',
    'bookmark.fill': 'bookmark',
    'moon.fill': 'dark-mode',
    'sun.max.fill': 'light-mode',
    'books.vertical.fill': 'auto-stories',
    'star.fill': 'star',
    'star': 'star-border',
    'sparkles': 'auto-awesome',
    'square.and.arrow.up': 'ios-share',
    'square.and.arrow.down': 'file-download',
    'trash.fill': 'delete',
    'chart.bar.fill': 'bar-chart',
    'square': 'check-box-outline-blank',
    'checkmark.square.fill': 'check-box',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export default function IconSymbol({
    name,
    size = 24,
    color,
    style,
}: {
    name: IconSymbolName;
    size?: number;
    color: string | OpaqueColorValue;
    style?: StyleProp<TextStyle>;
    weight?: SymbolWeight;
}) {
    return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
