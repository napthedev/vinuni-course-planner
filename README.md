# VinUni Course Planner

VinUni Course Planner is an independent web app that helps VinUniversity students explore course sections and build a workable semester schedule before registration. It turns the published course list into a searchable, visual planning experience with automatic conflict detection, credit totals, and calendar export.

> [!IMPORTANT]
> This is an unofficial project and is not affiliated with or endorsed by VinUniversity. Course offerings and schedules can change. Always verify your final plan in VinUniDigi and through official VinUniversity channels.

## Project objectives

- Make course discovery faster with search by course code, title, section, instructor, day, and time.
- Help students compare sections and identify timetable conflicts before registration.
- Present a schedule clearly on both desktop and mobile devices.
- Keep planning lightweight by saving selections and filters in the browser without requiring an account.
- Let students reuse a completed plan as a text list or an `.ics` calendar file.
- Provide a repeatable, tested workflow for converting the latest VinUniDigi course-list API export into application data.

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
- [Playwright](https://playwright.dev/) for authenticated course-data monitoring

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
| `bun run test` | Run parser and calendar-export tests |
| `bun run lint` | Run ESLint |
| `bun run monitor:login` | Create or refresh the local monitor authentication state |
| `bun run monitor:headless` | Query the current course list and update the raw source |
| `bun run monitor:test` | Run the monitor unit tests |

## Updating course data

Course JSON is generated and should not be edited by hand.

1. Replace `scripts/raw-data.js` with the latest paginated course-list API responses.
2. Run `bun run parse`.
3. Review the changes to `src/data/courses.json` and `src/data/courses.meta.json` for missing courses or malformed schedules.
4. Commit the raw source and both generated JSON files together.

The parser combines every page exported in `scripts/raw-data.js`, normalizes course fields and meeting times, and writes the data consumed by the app. The displayed update date comes from the latest Git commit that changed `scripts/raw-data.js`. For an uncommitted update, the parser uses the current date in Vietnam time. If the input has not changed, generated files are left untouched.

### Automated updates

The `Update course data` GitHub Actions workflow queries VinUniDigi at minutes 7, 17, 27, 37, 47, and 57 of every hour. It removes volatile API request identifiers and compares the stable response with `scripts/raw-data.js`. When the course data changes, the workflow runs `bun run build`, commits the raw and generated data as `github-actions[bot]`, and pushes the commit to `main`. It can also be run manually from the repository's Actions tab.

GitHub schedules are not an exact timer: runs can be delayed or dropped during periods of high load. Scheduled workflows in public repositories can also be disabled after 60 days without repository activity.

#### Configure the authentication secret

The monitor uses a Playwright storage-state file containing authenticated session cookies. Treat `monitor/auth.json` like a password: never commit it, print it in logs, or upload it as an artifact. The file is covered by `monitor/.gitignore`.

First, install the workspace dependencies and complete the interactive Microsoft login locally:

```bash
bun install
bun run monitor:login
```

After the browser closes, upload the file as the `VINUNI_AUTH_JSON` repository secret with [GitHub CLI](https://cli.github.com/):

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

The current authentication file fits GitHub's 48 KB encrypted-secret limit and can be stored directly. Base64 encoding is unnecessary and is not encryption. The workflow creates `monitor/auth.json` with restrictive permissions immediately before the query and removes it before installing or building the application.

When the stored session expires, rerun `bun run monitor:login` and the same `gh secret set` command to replace it. If the file is ever exposed, revoke the session before generating and uploading a replacement.

## Project structure

```text
src/app/          Routes, layout, metadata, and global styles
src/components/   Course-planning features and UI components
src/hooks/        Persistent selection and filter state
src/lib/          Schedule, conflict, and iCalendar utilities
src/types/        Course domain types
src/data/         Generated course data and metadata
scripts/          VinUniDigi raw data source, parser, and parser tests
monitor/          Authenticated Playwright course-data monitor
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

When changing the importer, add focused cases to `scripts/parse-courses.test.js`. Calendar-export behavior is covered in `src/lib/ics-generator.test.ts`.

## Contributing

Contributions are welcome. Keep changes focused, follow the existing TypeScript and component conventions, and include screenshots for user-interface changes. Use concise Conventional Commit subjects such as `feat: add schedule conflict filter`.

When opening a pull request, describe the user-visible impact, list the validation commands you ran, and call out any regenerated course data or assumptions about the VinUniDigi source.
