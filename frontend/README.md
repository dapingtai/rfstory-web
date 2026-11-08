# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Styling (Tailwind CSS 4)

- `app/assets/rfstory.css` imports Tailwind and Nuxt UI; the existing `@nuxt/ui` module provides the Tailwind Vite integration.
- Use utility classes in Vue templates for one-off styles. Shared controls/layouts use `@apply` in `@layer components` so utilities can override them.
- Theme utilities include `bg-studio-bg`, `bg-studio-surface`, `text-studio-fg`, `text-studio-muted`, `border-studio-border`, and `text-studio-accent`.
- Palette variables are retained for the canvas renderer and switch with `data-theme`. Do not replace them with fixed colors in canvas rendering code.
- Scoped styles using `@apply` must include `@reference "../assets/rfstory.css";` to access the theme without duplicating the global stylesheet.
- Studio layout breakpoints are 980px (tablet drawer) and 767px (mobile bottom sheet). Compact landscape screens (width ≤980px and height ≤500px) also use the mobile layout. Dynamic canvas sizing and crop/menu coordinates remain CSS variables or Vue style bindings.
- Mobile panels close via their close button, backdrop, or Escape, trap keyboard focus, and restore focus to their trigger. Photo settings include touch-accessible crop, layer ordering, and delete actions.

## Running locally

### Canvas fonts

- In global canvas settings, choose template typography, Noto Sans TC (黑體), Noto Serif TC (明體), LXGW WenKai TC (手寫楷體), Chen Yuluoyan 2.0 (繁中手寫), or Liu Jian Mao Cao (簡中草書). Chen Yuluoyan is Traditional Chinese handwriting, not traditional calligraphic cursive. Liu Jian Mao Cao lacks many Traditional Chinese characters and is explicitly labeled as Simplified Chinese cursive. Both use bundled WenKai TC for missing glyphs and load the fallback before export. The choice applies to global text and individual photo information, supports undo/redo, and is included in saved global defaults.
- Work titles support Enter/newlines and automatic wrapping, up to four visible lines. Title templates reserve space for multiline titles so descriptions and metadata do not overlap. The technical EXIF template continues to display metadata rather than a title.
- The font-size section independently adjusts global titles (12–72px), descriptions (8–36px), and labels/capture metadata (8–28px). Line spacing adjusts with font size. Reset restores template defaults; custom sizes support history, saved defaults, and export. Individual photo-information sizes are unchanged. Portrait 9:16 retains its existing typography multiplier.
- Fonts are self-hosted WOFF2 files in `public/fonts/`, loaded only when selected. Export waits for the selected font; failed loads show a message and prevent exporting with an unintended fallback font.
- Sources: [Noto Sans TC](https://github.com/google/fonts/tree/main/ofl/notosanstc), [Noto Serif TC](https://github.com/google/fonts/tree/main/ofl/notoseriftc), [LXGW WenKai TC](https://github.com/google/fonts/tree/main/ofl/lxgwwenkaitc), and [Liu Jian Mao Cao](https://github.com/google/fonts/tree/main/ofl/liujianmaocao). The Noto variable fonts were instantiated at weight 400 and all fonts converted to WOFF2 without glyph subsetting. SIL Open Font License copies accompany the assets.
- [Chen Yuluoyan 2.0 Thin](https://github.com/Chenyu-otf/chenyuluoyan_thin) is also bundled as WOFF2 without glyph subsetting, with its SIL Open Font License in `public/fonts/chenyuluoyan-OFL.txt`.

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

### GitHub Pages 自動部署

- `.github/workflows/deploy-pages.yml` 會在 `main` 的前端或 workflow 有更新時執行，也可在 Actions 頁面手動執行。
- 流程使用 Node.js 22、`npm ci`、單元測試及 `nuxt generate`，檢查靜態輸出後將 `.output/public` 部署至 Pages，不需要 Node.js 伺服器或額外部署 token。
- 在 GitHub 儲存庫的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**，然後推送至 `main` 或手動執行 workflow。
- 目標 `https://myaccount.github.io/rfstory-web/` 必須使用 `myaccount` 帳號下的 `rfstory-web` 儲存庫。此專案目前的 remote 是 `dapingtai/rfstory-web`，直接部署會對應 `https://dapingtai.github.io/rfstory-web/`；workflow 並不會變更儲存庫擁有者。
- workflow 設定 `NUXT_APP_BASE_URL=/rfstory-web/`，讓 JS、CSS 和字型使用正確的子路徑。若使用其他儲存庫名稱，請同步修改此值；帳號首頁儲存庫則使用 `/`。
- 本機開發預設仍使用 `/`。以 PowerShell 驗證 Pages 輸出：

```powershell
cd frontend
$env:NUXT_APP_BASE_URL = '/rfstory-web/'
npm run generate
npm run test:static
Remove-Item Env:NUXT_APP_BASE_URL
```

### Checks

- `npm test`: photo-frame, global-information, and font loading/asset unit tests.
- After building, `npm run test:rwd`: Chrome browser checks at 320, 390, 744, 820, 844 (landscape), and 1440px, plus upload, touch drag, photo tools, and export dialog checks. Screenshots are saved in the printed temporary directory. Set `CHROME_PATH` to override the Chrome executable and `RWD_ARTIFACT_DIR` to choose the screenshot directory.

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
