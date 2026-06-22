// Regenerate the app launcher icon + adaptive icon + splash from the SVG sources
// in assets/brand/ (single source of truth, kept in sync with the site brand
// mark). Run after editing any of those SVGs:  npm run gen:icons
//
// Outputs (Expo rasterizes platform variants from these at prebuild/build time):
//   assets/icon.png                         1024² opaque  — iOS + base launcher icon
//   assets/adaptive-icon-foreground.png     1024² alpha   — Android adaptive foreground
//   assets/images/android-icon-monochrome.png 1024² alpha — Android 13+ themed icon
//   assets/splash.png / assets/splash-dark.png  alpha     — splash (mark + wordmark)
//
// Icons/splash are native assets — changing them needs a rebuild, not an OTA.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ACCENT = '#208AEF';
const root = fileURLToPath(new URL('..', import.meta.url));
const src = (name) => readFileSync(`${root}assets/brand/${name}`);
// High density so the SVGs downscale crisply to the target raster sizes.
const render = (name, density = 1024) => sharp(src(name), { density });

// iOS / base icon — must be square and fully opaque (the OS masks the corners).
await render('icon.svg').resize(1024, 1024).flatten({ background: ACCENT }).removeAlpha()
    .png().toFile(`${root}assets/icon.png`);

// Android adaptive foreground — transparent, content inside the safe zone.
await render('adaptive-foreground.svg').resize(1024, 1024)
    .png().toFile(`${root}assets/adaptive-icon-foreground.png`);

// Android themed (monochrome) icon — transparent white silhouette.
await render('monochrome.svg').resize(1024, 1024)
    .png().toFile(`${root}assets/images/android-icon-monochrome.png`);

// Splash image (mark + wordmark) — transparent; reused for light + dark since
// white reads on both the accent and near-black backgrounds. Width-driven; height
// follows the 560×400 viewBox aspect.
for (const out of ['assets/splash.png', 'assets/splash-dark.png']) {
    await render('splash.svg').resize({ width: 1024 })
        .png().toFile(`${root}${out}`);
}

console.log('Generated icon.png, adaptive-icon-foreground.png, android-icon-monochrome.png, splash.png, splash-dark.png');
