import { Platform } from 'react-native';

export const ACCENT = '#0a7ea4';
export const ERROR = '#e05252';

export const Colors = {
    light: {
        text: '#11181C',
        textSecondary: '#555',
        textMuted: '#888',
        textBody: '#333',
        textMeta: '#444',
        textFaded: '#aaa',
        textPlaceholder: '#888',
        background: '#fff',
        backgroundCard: '#f5f8fa',
        backgroundInput: '#f9f9f9',
        border: '#e0e0e0',
        borderInput: '#ccc',
        borderEdit: '#dde',
        coverPlaceholder: '#ddd',
        removeIcon: '#aaa',
        tint: ACCENT,
        icon: '#687076',
        tabIconDefault: '#687076',
        tabIconSelected: ACCENT,
    },
    dark: {
        text: '#ECEDEE',
        textSecondary: '#9BA1A6',
        textMuted: '#687076',
        textBody: '#c0c8cc',
        textMeta: '#9BA1A6',
        textFaded: '#555',
        textPlaceholder: '#666',
        background: '#151718',
        backgroundCard: '#1e2426',
        backgroundInput: '#252b2d',
        border: '#2d3438',
        borderInput: '#3d4245',
        borderEdit: '#2d3438',
        coverPlaceholder: '#2d3438',
        removeIcon: '#555',
        tint: '#fff',
        icon: '#9BA1A6',
        tabIconDefault: '#9BA1A6',
        tabIconSelected: '#fff',
    },
};

export const Fonts = Platform.select({
    ios: {
        sans: 'system-ui',
        serif: 'ui-serif',
        rounded: 'ui-rounded',
        mono: 'ui-monospace',
    },
    default: {
        sans: 'normal',
        serif: 'serif',
        rounded: 'normal',
        mono: 'monospace',
    },
    web: {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
        mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
});
