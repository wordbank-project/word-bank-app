# Cutting a production release (Android APK → GitHub Release)

The runbook for shipping a public Android build. For *which* build type to use in the first place — dev client vs local APK vs EAS cloud — see [build-and-deploy.md](build-and-deploy.md); this doc assumes you've already decided you want a public release.

The output is an APK attached to a [GitHub Release](https://github.com/wordbank-project/word-bank-app/releases/latest). Both the README badge and the site's Download section point at `/releases/latest`, so **neither needs editing when you ship a new version** — publishing the release is the whole deploy.

## Why the `production` profile, not `preview`

`preview` builds `com.jensrot.wordbank.preview`, which installs as a *separate app* called "Word Bank (Preview)". A different package id means different AsyncStorage: anyone who installs a preview build and later installs the real app gets two apps side by side and **loses every saved book and word**. Only `com.jensrot.wordbank` can become a Play Store update later.

So the public download is built from `production` even while it's a beta. That profile carries `"android": { "buildType": "apk" }` in [`eas.json`](../eas.json) — without it EAS emits an AAB, which is Play-only and cannot be sideloaded.

`preview` is still the right thing for internal testers, who install from the EAS build page's QR.

## 0. Prerequisites

- `gh auth status` — logged in with `repo` scope
- Android build-tools on hand for verification (`aapt2`, `apksigner`), e.g. `~/Library/Android/sdk/build-tools/<version>/`
- A clean-ish working tree — see the gotcha in step 1

## 1. Get the tree into the state you want to ship

> **EAS builds the working tree, not the commit.** `eas build` uploads your current files (respecting `.gitignore`) and stamps the build with `HEAD`'s hash for reference only. Uncommitted changes **do** end up in the APK, and committed-but-later-changed files do not. The stamped commit can therefore be a lie about what's inside the binary.

Commit everything first. It costs nothing and it's the only way the release tag honestly describes the artifact.

```bash
git status --short     # must be empty
git log -1 --format='%H %s'
```

Bump `version` in [`package.json`](../package.json) if this release deserves a new version name — that value becomes `versionName` in the APK. `versionCode` is handled for you (`autoIncrement: true` plus `appVersionSource: "remote"` in `eas.json`), so it climbs on its own with every production build.

## 2. Build

```bash
npx eas build --platform android --profile production --non-interactive
```

Takes roughly 25–30 minutes. It prints the artifact URL when it finishes; if you lose the terminal:

```bash
npx eas build:list --platform android --limit 1 --non-interactive
```

The first production build also creates the `production` EAS Update channel, so these APKs receive OTA updates from that channel (`eas update --branch production`).

## 3. Download

```bash
curl -L -o word-bank-<version>.apk "<Application Archive URL>"
```

Name the file after the version — it's what people see in the release's asset list.

## 4. Verify before publishing

Never publish a binary you haven't inspected. Three checks, all fast:

```bash
AAPT=~/Library/Android/sdk/build-tools/37.0.0/aapt2
SIGNER=~/Library/Android/sdk/build-tools/37.0.0/apksigner

# a) right variant?
$AAPT dump badging word-bank-<version>.apk \
  | grep -E "^package:|application-label:|minSdkVersion|targetSdkVersion|native-code"
```

Expect `com.jensrot.wordbank` and `Word Bank` — **not** `.preview` / `Word Bank (Preview)`. That single check catches the most damaging mistake available here.

```bash
# b) right backends baked in?
unzip -q -o word-bank-<version>.apk -d x 'assets/*'
strings -a x/assets/index.android.bundle > bundle.txt
grep -c "dict.wordbankapp.com"  bundle.txt   # expect 1
grep -c "words.wordbankapp.com" bundle.txt   # expect 1
grep -c "example.com"           bundle.txt   # expect 0
```

`EXPO_PUBLIC_*` values are **inlined into the JS bundle at build time**, not read at runtime, so this is the only way to know what the APK will actually talk to. The bundle is Hermes bytecode — plain `grep` finds nothing, hence `strings -a`.

```bash
# c) signed, and with which key?
$SIGNER verify --verbose --print-certs word-bank-<version>.apk
```

Expect `Verifies` and a v2 signature.

## 5. Publish the release

```bash
gh release create v<version> word-bank-<version>.apk \
  --repo wordbank-project/word-bank-app \
  --title "v<version> — Android beta" \
  --notes-file RELEASE_NOTES.md \
  --prerelease \
  --target <commit from step 1>
```

Drop `--prerelease` once it's no longer a beta.

`--target` pins the tag to the exact commit you verified, but it must be a **full 40-character SHA or a branch name** — a short SHA is rejected with a confusing `HTTP 422: Release.target_commitish is invalid`, which sounds like the commit is missing when it's really just abbreviated. Get the full one with `git rev-parse <short-sha>`, or pass `main`.

The commit must also already exist **on the remote**: `gh release create` does not push for you, and the same 422 appears if you've only committed locally.

Release notes should cover: how to install, the "unknown source" warning Android shows for sideloaded apps, minimum Android version, which dictionary languages are actually served, and what changed.

## 6. After publishing

```bash
curl -sIL https://github.com/wordbank-project/word-bank-app/releases/latest | head -1
```

Nothing else to update — the README badge and the site both resolve through `/releases/latest`. See [track_downloads.md](track_downloads.md) for reading the download numbers afterwards.

## The signing key

**Each package id gets its own keystore on EAS**, so the production key differs from the preview one. Once a release is public, that key *is* the identity of `com.jensrot.wordbank`:

- Users can only update to APKs signed with the same key. Lose it and existing installs are stranded — the only way out is a new package id, which means a fresh app and no data migration.
- A later Play Store upload must match it, unless you enrol in Play App Signing.

The key lives on Expo's servers. Back it up before a release goes public:

```bash
eas credentials    # Android → production → download/export the keystore
```

## Quick checklist

1. Working tree committed and clean
2. `package.json` version bumped if needed
3. `eas build --profile production --platform android`
4. Download the artifact
5. Verify: package id, baked URLs, signature
6. Push the commit, then `gh release create … --target <full SHA or branch>`
7. Confirm `/releases/latest` resolves
