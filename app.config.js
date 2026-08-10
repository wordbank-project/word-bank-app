const { version } = require('./package.json');

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
// F-Droid build (set FDROID=1 in the recipe's prebuild): omit the EAS Update
// config so the app ships with no proprietary phone-home updater — an F-Droid
// requirement. EAS/Play builds leave FDROID unset and keep OTA. See live.md.
const FDROID = process.env.FDROID === '1';

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
        // EAS Update (OTA) — omitted for the F-Droid build so it doesn't phone home.
        ...(FDROID ? {} : {
            runtimeVersion: {
                policy: "appVersion"
            },
            updates: {
                url: "https://u.expo.dev/f48edafb-5402-4acf-8ffb-b3f5bf6c26df",
                enabled: true,
                checkAutomatically: "ON_LOAD"
            }
        }),
        orientation: "portrait",
        icon: "./assets/icon.png",
        scheme: "wordbank",
        userInterfaceStyle: "automatic",
        ios: {
            icon: "./assets/icon.png",
            bundleIdentifier: packageName,
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
                NSPhotoLibraryUsageDescription: "Pick a cover image for your custom book.",
                NSCameraUsageDescription: "Take a photo to use as your book cover."
            }
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#208AEF",
                foregroundImage: "./assets/adaptive-icon-foreground.png",
                monochromeImage: "./assets/images/android-icon-monochrome.png"
            },
            predictiveBackGestureEnabled: false,
            package: packageName
        },
        web: {
            output: "static",
            favicon: "./assets/favicon.png"
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
                    // No `dark` variant on purpose: the native splash follows the
                    // OS appearance (it renders before JS), so a dark variant would
                    // show the dark splash on a system-dark phone even when the app
                    // theme is light. Always show the brand blue splash instead.
                    //
                    // Mark only, no wordmark — the same splash on both platforms.
                    // Android 12+ renders this through windowSplashScreenAnimatedIcon and
                    // masks it to a 192dp circle inside a 288dp canvas, which shaved the
                    // corners off the "Word Bank" wordmark in the old splash.png lockup
                    // (iOS uses a storyboard with no mask, so only Android showed it).
                    // The adaptive-icon foreground is already drawn for a circular safe
                    // zone, so it reuses cleanly: at imageWidth 260 its furthest content
                    // sits ~84dp from centre against the 96dp mask radius.
                    image: "./assets/adaptive-icon-foreground.png",
                    imageWidth: 260,
                    resizeMode: "contain",
                    backgroundColor: "#208AEF"
                }
            ]
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true
        },
        extra: {
            router: {},
            // EAS project id — omitted for the F-Droid build (EAS-only metadata).
            ...(FDROID ? {} : {
                eas: {
                    projectId: "f48edafb-5402-4acf-8ffb-b3f5bf6c26df"
                }
            })
        },
        owner: "jensrot"
    }
};
