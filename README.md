# VinUni Course Planner

VinUni Course Planner is an independent web app for exploring Fall 2026 course sections and building a workable semester schedule before registration. It turns the VinUniDigi course list into a searchable, visual planning experience with automatic conflict detection, credit totals, and calendar export.

![VinUni Course Planner preview](public/preview.png)

> [!IMPORTANT]
> This is an unofficial project and is not affiliated with or endorsed by VinUniversity. Course offerings and schedules can change. Always verify your final plan in VinUniDigi and through official VinUniversity channels.

## Project objectives

- Make course discovery faster with search by course code, title, section, instructor, day, and time.
- Help students compare sections and identify timetable conflicts before registration.
- Present a schedule clearly on both desktop and mobile devices.
- Keep planning lightweight by saving selections and filters in the browser without requiring an account.
- Let students reuse a completed plan as a text list or an `.ics` calendar file.
- Provide a repeatable, tested workflow for fetching the latest VinUniDigi course list and converting it into application data.

## Features

- Searchable course and section catalogue
- Day and time filters, including morning, afternoon, evening, and weekday presets
- Option to hide courses that conflict with the current selection
- Automatic schedule-clash warnings and total-credit calculation
- Weekly calendar on desktop and agenda view on mobile
- Persistent course selections and filters using `localStorage`
- Copyable plain-text course list
- Conflict-free `.ics` export with recurring class events and reminders
- Registration countdown, responsive layout, and light/dark themes
- Visible course-data update date and stale-data warning

## Tech stack

- [Next.js 16](https://nextjs.org/) with the App Router
- [React 19](https://react.dev/) and strict TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/) and shadcn/ui components
- [Cheerio](https://cheerio.js.org/) for course-data parsing
- [Bun](https://bun.sh/) for dependency management and project scripts
- [Playwright](https://playwright.dev/), `playwright-extra`, and a stealth plugin for authenticated course-data monitoring
- [GitHub Actions](https://github.com/features/actions) for manually initiated data refreshes

## Getting started

### Prerequisites

Install [Bun](https://bun.sh/docs/installation), then clone the repository and install its dependencies:

```bash
git clone https://github.com/phongna07/vinuni-course-planner.git
cd vinuni-course-planner
bun install
```

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The development command regenerates the course data before starting Next.js.

## Available commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Regenerate course data and start the development server |
| `bun run build` | Regenerate course data and create a production build |
| `bun run start` | Serve an existing production build |
| `bun run parse` | Regenerate only the course JSON and metadata |
| `bun run test` | Run parser, scheduling, and calendar-export tests |
| `bun run lint` | Run ESLint |
| `bun run monitor:login` | Create or refresh the local monitor authentication state |
| `bun run monitor:headless` | Fetch the current course list and update the raw source with a headless browser |
| `bun run monitor:test` | Run the monitor unit tests |

## Updating course data

Course JSON is generated and should not be edited by hand.

1. Refresh `scripts/raw-data.js` with `bun run monitor:headless`, or replace it with a complete set of paginated course-list API responses.
2. Run `bun run parse`.
3. Review the changes to `src/data/courses.json` and `src/data/courses.meta.json` for missing courses or malformed schedules.
4. Commit the raw source and both generated JSON files together.

The parser combines every page exported in `scripts/raw-data.js`, normalizes course fields and meeting times, and writes the data consumed by the app. The displayed update date comes from the latest Git commit that changed `scripts/raw-data.js`. For an uncommitted update, the parser uses the current date in Vietnam time. If the input has not changed, generated files are left untouched.

### Course-data monitor

The `monitor/` workspace retrieves data that is only available after signing in to VinUni services. It does not store a permanent API token. Instead, it:

1. Opens the credit-registration page using the saved Playwright storage state in `monitor/auth.json`.
2. Captures a valid bearer token and the relevant browser headers from an authorized request to the VinUni API gateway.
3. Fetches page 1 of the open-course list, derives the total number of pages, and fetches the remaining pages concurrently.
4. Validates each response and refuses to replace the existing source if pages are missing, inconsistent, malformed, or incomplete.
5. Removes volatile request metadata and atomically writes stable output to `scripts/raw-data.js` only when its contents changed.

The endpoint, academic term, open-class condition, and registration round identifier currently live in `monitor/index.js`. They need to be reviewed when the active registration period changes.

To inspect a monitor run in a visible browser, run its workspace command directly:

```bash
bun run --filter monitor headed
```

### GitHub Actions update workflow

The `Update course data` workflow in `.github/workflows/update-courses.yml` currently runs **only when manually dispatched** from the repository's Actions tab. There is no active cron schedule.

Each run:

1. Installs and tests the monitor workspace, then installs Chromium.
2. Restores `monitor/auth.json` from the `VINUNI_AUTH_JSON` repository secret.
3. Runs the monitor headlessly and removes the authentication file, including after a failed query.
4. Stops without installing the full application when `scripts/raw-data.js` is unchanged.
5. When data changed, installs all dependencies, runs the production build to regenerate and validate the course JSON, commits the three data files as `github-actions[bot]`, and pushes to `main`.

The workflow has `contents: write` permission, a 15-minute timeout, and a concurrency group that prevents overlapping update jobs from cancelling one another. Because it pushes directly to `main`, run it only when the current monitor configuration and authentication state are expected to be valid.

#### Configure the authentication secret

The monitor uses a Playwright storage-state file containing authenticated session cookies. Treat `monitor/auth.json` like a password: never commit it, print it in logs, or upload it as an artifact. The file is covered by `monitor/.gitignore`.

First, install the workspace dependencies and complete the interactive Microsoft login locally:

```bash
bun install
bun run monitor:login
```

After the login flow reaches Microsoft 365 and the browser closes, upload the file as the `VINUNI_AUTH_JSON` repository secret with [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
gh secret set VINUNI_AUTH_JSON \
  --repo phongna07/vinuni-course-planner \
  < monitor/auth.json
```

Confirm that the secret name exists without revealing its value:

```bash
gh secret list --repo phongna07/vinuni-course-planner
```

The authentication state is JSON and can be stored directly; base64 encoding is unnecessary and is not encryption. The workflow creates `monitor/auth.json` with restrictive permissions immediately before the query and removes it before installing or building the application.

When the stored session expires, rerun `bun run monitor:login` and the same `gh secret set` command to replace it. If the file is ever exposed, revoke the session before generating and uploading a replacement.

## Project structure

```text
src/app/          Routes, layout, metadata, and global styles
src/components/   Course-planning features and UI components
src/hooks/        Persistent selection and filter state
src/lib/          Schedule, conflict, and iCalendar utilities
src/types/        Course domain types
src/data/         Generated course data and metadata
scripts/          VinUniDigi raw source, parser, and parser tests
monitor/          Separate authenticated Playwright monitor workspace
.github/workflows Manual course-data refresh workflow
public/           Static assets
```

Configuration for the active term, registration countdown, calendar hours, analytics, and site copy lives in `src/config.ts`.

## Validation

Before submitting a change, run:

```bash
bun run test
bun run lint
bun run build
```

When changing the importer, add focused cases to `scripts/parse-courses.test.js`. The monitor's pagination, validation, stable serialization, and atomic writes are covered in `monitor/index.test.js`. Schedule conflicts and calendar export are covered in `src/lib/schedule-utils.test.ts` and `src/lib/ics-generator.test.ts`.

## Contributing

Contributions are welcome. Keep changes focused, follow the existing TypeScript and component conventions, and include screenshots for user-interface changes. Use concise Conventional Commit subjects such as `feat: add schedule conflict filter`.

When opening a pull request, describe the user-visible impact, list the validation commands you ran, and call out any regenerated course data or assumptions about the VinUniDigi source.
