# mobile audit

JS-based mobile compatibility check for the site. Drives the locally installed
Chrome headlessly (via `puppeteer-core`) against a tiny static server that
mimics production path mapping (`/*.html` → `html/`, assets from repo root).

## run it

```sh
cd tools/mobile-audit
npm install
npm run audit
```

Each page (`home`, `blog`, `chess`) is loaded at four mobile viewports
(iPhone SE 375px, iPhone 14 390px, Pixel 7 412px, iPad mini 768px) and checked for:

- **forced-zoom-out** — content wider than the device forced shrink-to-fit
- **horizontal-overflow** — page scrolls sideways
- **element-overflow** — individual elements sticking past the viewport edge
- **small-tap-target** — clickable things under comfortable touch size
- **tiny-font** — text below 12px
- **js-error** — console/page errors

Full-page screenshots land in `shots/` for eyeball verification.
Exit code is non-zero if any issue is found, so it can gate CI.
