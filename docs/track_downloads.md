# Tracking APK downloads

The public Android build is distributed as an APK attached to a [GitHub Release](https://github.com/wordbank-project/word-bank-app/releases/latest). GitHub counts every asset fetch, so the download numbers come for free — there is nothing to install, no analytics SDK in the app, and no tracking added to the APK itself.

Three layers answer three different questions:

| Layer | Question it answers | Where |
|---|---|---|
| GitHub `download_count` | How many times was the APK fetched? | this repo's releases |
| Shields badge | Same number, visible on the README | `README.md` |
| PostHog `download_click` | How many people on the site *chose* to download? | `word-bank-site` |

The app itself contains no analytics, crash reporter, or ad SDK, and this does not change that — every number below is measured outside the app.

## 1. The real number: GitHub's `download_count`

Every release asset carries a `download_count` the REST API exposes. Current release:

```bash
gh api repos/wordbank-project/word-bank-app/releases/latest \
  --jq '.assets[] | "\(.name)  \(.download_count)"'
```

Totals per release, newest first — useful for seeing whether a new beta is picking up:

```bash
gh api repos/wordbank-project/word-bank-app/releases \
  --jq '.[] | "\(.tag_name)  \([.assets[].download_count] | add // 0)"'
```

All-time total across every release:

```bash
gh api repos/wordbank-project/word-bank-app/releases \
  --jq '[.[].assets[].download_count] | add // 0'
```

> Until the first release exists these return nothing (and the badge below reads
> `no releases found`). That is expected, not a broken command.

### What the number does and doesn't mean

`download_count` counts **asset fetches, not people and not installs**:

- Bots, crawlers, and mirrors are included. Expect a baseline of automated traffic that has nothing to do with real users.
- A resumed or retried download can count more than once.
- It is **per release**. A new tag starts at zero; only the all-time query above spans versions.
- It says nothing about whether the APK was ever installed, let alone opened.

Read it as a trend line between releases, not a user count.

## 2. A live badge in the README

Same data, rendered by shields.io, no setup:

```markdown
[![Downloads](https://img.shields.io/github/downloads/wordbank-project/word-bank-app/total?logo=github)](https://github.com/wordbank-project/word-bank-app/releases)
```

`total` sums every release. Swap it for a tag (`.../downloads/<owner>/<repo>/v1.0.0-beta.1/total`) to show a single version instead.

## 3. Intent, from the site: PostHog

`word-bank-site` already instruments every link that points at the release. Each carries:

```
data-ph-event="download_click"
data-ph-platform="android" | "web"
data-ph-location="hero" | "download_section"
```

So PostHog answers a question GitHub cannot: **where on the page people decide to download**, and how many visitors get that far at all. The `data-ph-location` split exists specifically to compare the hero button against the dedicated Download section.

The URLs themselves live in one place — `ANDROID_RELEASE_URL` and `WEB_APP_URL` in `word-bank-site/src/content.ts` — so a new call site should import from there and keep the same `data-ph-*` attributes, or it will silently drop out of these numbers.

## Reading the three together

The gap between them is the interesting part:

- **PostHog clicks ≫ GitHub downloads** — people are clicking through but the release page is losing them (wrong asset name, confusing page, scared off by the unknown-source warning).
- **GitHub downloads ≫ PostHog clicks** — traffic is arriving somewhere other than the site: the README badge, a direct link, an aggregator, or bots.
- Neither tells you about **retention**. The app stores everything locally and phones home only for the features described in the README's privacy table, so there is deliberately no install or active-user metric. If that ever matters, the honest options are a Play Console listing (which reports installs) or asking users directly — not adding telemetry to the app.
