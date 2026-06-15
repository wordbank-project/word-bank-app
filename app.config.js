const { version } = require('./package.json');

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const appName = IS_DEV ? 'Word Bank (Dev)' : IS_PREVIEW ? 'Word Bank (Preview)' : 'Word Bank';
const packageName = IS_DEV
    ? 'com.jensrot.wordbank.dev'
    : IS_PREVIEW
    ? 'com.jensrot.wordbank.preview'
    : 'com.jensrot.wordbank';

module.exports = {
    expo: {
        name: appName,
        slug: "word-bank",
        version,
        runtimeVersion: {
            policy: "appVersion"
        },
        updates: {
            url: "https://u.expo.dev/f48edafb-5402-4acf-8ffb-b3f5bf6c26df",
            enabled: true,
            checkAutomatically: "ON_LOAD"
        },
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "wordbank",
        userInterfaceStyle: "automatic",
        ios: {
            icon: "./assets/expo.icon",
            bundleIdentifier: packageName,
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
                NSPhotoLibraryUsageDescription: "Pick a cover image for your custom book.",
                NSCameraUsageDescription: "Take a photo to use as your book cover."
            }
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#E6F4FE",
                foregroundImage: "./assets/images/android-icon-foreground.png",
                backgroundImage: "./assets/images/android-icon-background.png",
                monochromeImage: "./assets/images/android-icon-monochrome.png"
            },
            predictiveBackGestureEnabled: false,
            package: packageName
        },
        web: {
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: [
            "expo-router",
            [
                "expo-image-picker",
                {
                    photosPermission: "Pick a cover image for your custom book.",
                    cameraPermission: "Take a photo to use as your book cover."
                }
            ],
            [
                "expo-splash-screen",
                {
                    backgroundColor: "#208AEF",
                    android: {
                        image: "./assets/images/splash-icon.png",
                        imageWidth: 76
                    }
                }
            ],
            [
                "expo-notifications",
                {
                    color: "#208AEF"
                }
            ]
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true
        },
        extra: {
            router: {},
            eas: {
                projectId: "f48edafb-5402-4acf-8ffb-b3f5bf6c26df"
            }
        },
        owner: "jensrot"
    }
};
