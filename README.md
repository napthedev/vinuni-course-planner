# VinUni Course Planner

VinUni Course Planner is an independent web app that helps VinUniversity students explore course sections and build a workable semester schedule before registration. It turns the published course list into a searchable, visual planning experience with automatic conflict detection, credit totals, and calendar export.

> [!IMPORTANT]
> This is an unofficial project and is not affiliated with or endorsed by VinUniversity. Course offerings and schedules can change. Always verify your final plan in SIS and through official VinUniversity channels.

## Project objectives

- Make course discovery faster with search by course code, title, section, instructor, day, and time.
- Help students compare sections and identify timetable conflicts before registration.
- Present a schedule clearly on both desktop and mobile devices.
- Keep planning lightweight by saving selections and filters in the browser without requiring an account.
- Let students reuse a completed plan as a text list or an `.ics` calendar file.
- Provide a repeatable, tested workflow for converting the latest SIS course-list HTML into application data.

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

## Updating course data

Course JSON is generated and should not be edited by hand.

1. Replace `scripts/index.html` with the latest course-list HTML.
2. Run `bun run parse`.
3. Review the changes to `src/data/courses.json` and `src/data/courses.meta.json` for missing courses or malformed schedules.
4. Commit the source HTML and both generated JSON files together.

The parser reads the `#CourseList` table, normalizes course fields and meeting times, and writes the data consumed by the app. The displayed update date comes from the latest Git commit that changed `scripts/index.html`. For an uncommitted update, the parser uses the current date in Vietnam time. If the input has not changed, generated files are left untouched.

## Project structure

```text
src/app/          Routes, layout, metadata, and global styles
src/components/   Course-planning features and UI components
src/hooks/        Persistent selection and filter state
src/lib/          Schedule, conflict, and iCalendar utilities
src/types/        Course domain types
src/data/         Generated course data and metadata
scripts/          SIS HTML source, parser, and parser tests
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

When opening a pull request, describe the user-visible impact, list the validation commands you ran, and call out any regenerated course data or assumptions about the SIS source.
