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

### Checks

- `npm test`: photo-frame unit tests.
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
