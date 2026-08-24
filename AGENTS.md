# Repository Guidelines

## Project Structure & Module Organization

This Next.js 16 App Router project keeps routes and global styles in `src/app/`. Feature components belong in `src/components/`, while reusable shadcn/Radix primitives are under `src/components/ui/`. Put shared logic in `src/lib/`, client state hooks in `src/hooks/`, and domain types in `src/types/`. Static files belong in `public/`.

Course records in `src/data/` are generated from `scripts/index.html` by `scripts/parse-courses.js`; do not edit the JSON outputs manually. Parser tests live beside the script in `scripts/parse-courses.test.js`.

## Build, Test, and Development Commands

Use Bun, matching the committed `bun.lock`:

- `bun install` installs dependencies.
- `bun run dev` regenerates course data and starts the local server at `http://localhost:3000`.
- `bun run build` regenerates data and creates a production build.
- `bun run start` serves an existing production build.
- `bun run lint` runs the Next.js Core Web Vitals and TypeScript ESLint rules.
- `bun run test` runs the Node built-in test suite.
- `bun run parse` regenerates `courses.json` and `courses.meta.json` only.

## Coding Style & Naming Conventions

TypeScript runs in strict mode. Follow existing formatting: two-space indentation, semicolons, double quotes in TypeScript/TSX, and single quotes in CommonJS parser files. Use `PascalCase` for React components and types, `camelCase` for functions and variables, and kebab-case filenames such as `weekly-calendar.tsx`. Name hooks with a `use-` filename and `use...` export. Prefer the `@/` alias for imports from `src/`, and reuse `src/components/ui/` primitives before adding new controls.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Add parser cases to `scripts/parse-courses.test.js` with behavior-focused names. Cover validation failures, Git metadata behavior, and file-write edge cases when changing the importer. There is no enforced coverage threshold; bug fixes should include a focused regression test. Run `bun run test`, `bun run lint`, and `bun run build` before opening a PR.

## Course Data Updates

Replace `scripts/index.html`, run `bun run parse`, and commit the source HTML together with both generated files in `src/data/`. Verify the diff for unexpected course removals or malformed schedules. The metadata date is derived from Git history, with Vietnam time used for uncommitted previews.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit prefixes, chiefly `feat:` and `chore:`. Write concise, imperative subjects (for example, `feat: add schedule conflict filter`). Keep commits focused. PRs should explain user-visible impact, list verification commands, link relevant issues, and include screenshots for UI changes. Call out regenerated course data and any assumptions about VinUniDigi source content.
