# @workspace/ui

shadcn/ui components shared by every web app (new-york style, Radix, Tailwind v4, neutral theme). Source-only package: apps compile it with their own Vite, there is no build step.

```tsx
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
```

Each app's stylesheet is one line, which pulls in Tailwind, the theme tokens and a `@source` for these components:

```css
@import "@workspace/ui/globals.css";
```

## Add a component

Run the CLI from `packages/ui` (it has its own `components.json`):

```sh
cd packages/ui && pnpm dlx shadcn@latest add dialog
```

Check the result: the CLI occasionally writes `import { cn } from "cn"` (a wrong npm package, not our util) and adds a `cn` dependency. Replace the import with `@workspace/ui/lib/utils` and remove the `cn` dependency. Put new third-party dependencies in the `catalog:` in `pnpm-workspace.yaml`.

## Add an app

Give it `"@workspace/ui": "workspace:*"`, the `@workspace/ui/*` path in `tsconfig.json`, the Tailwind Vite plugin, and a `components.json` pointing `ui` at `@workspace/ui/components` (copy `apps/fraudless`).

Theme tokens live in `src/styles/globals.css`; change them there and every app follows.
