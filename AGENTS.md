# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# Development Workflow (without Expo Go)

This project uses a **development client** instead of Expo Go. Expo Go does not support SDK 55 on all devices.

## First-time setup
Build and install the dev client APK on your Android device (only needed once, or when adding new native packages):
```bash
npm run build:dev
```
Install the APK from the EAS build page on your phone.

## Daily development
Start the dev server and connect your phone via the installed dev client app:
```bash
npm run dev-client
```
Scan the QR code shown in the terminal with the dev client app.
