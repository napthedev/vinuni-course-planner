#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');

const REPO_ROOT = path.join(__dirname, '..');
const INPUT_FILE = path.join(__dirname, 'raw-data.js');
const OUTPUT_FILE = path.join(REPO_ROOT, 'src', 'data', 'courses.json');
const METADATA_FILE = path.join(REPO_ROOT, 'src', 'data', 'courses.meta.json');
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const DELIVERY_METHOD_MAP = {
    'Trực tiếp': 'Classroom',
    'Trực tuyến': 'Online',
    'Kết hợp': 'Hybrid',
};

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function normalizeText(value) {
    if (typeof value !== 'string') {
        return '';
    }

    const $ = cheerio.load('<textarea></textarea>');
    $('textarea').html(value);

    return $('textarea').text().replace(/\s+/g, ' ').trim();
}

function parseRawDataSource(source) {
    const match = source.match(
        /^\s*export\s+const\s+TABLES\s*=\s*([\s\S]*?)\s*;?\s*$/,
    );

    if (!match) {
        throw new Error('Raw data must use the format "export const TABLES = [...]"');
    }

    let tables;

    try {
        tables = JSON.parse(match[1]);
    } catch (error) {
        throw new Error(`Unable to parse TABLES JSON: ${error.message}`);
    }

    if (!Array.isArray(tables) || tables.length === 0) {
        throw new Error('TABLES must be a non-empty array');
    }

    return tables;
}

function combineTableResults(tables) {
    const pages = tables.map((table, index) => {
        if (!table || table.success !== true) {
            throw new Error(`TABLES entry ${index + 1} is not a successful response`);
        }

        const { data } = table;

        if (!data || !Array.isArray(data.result)) {
            throw new Error(`TABLES entry ${index + 1} is missing data.result`);
        }

        if (!Number.isInteger(data.page) || data.page < 1) {
            throw new Error(`TABLES entry ${index + 1} has an invalid page number`);
        }

        if (!Number.isInteger(data.total) || data.total < 0) {
            throw new Error(`TABLES entry ${index + 1} has an invalid total`);
        }

        return {
            page: data.page,
            total: data.total,
            result: data.result,
        };
    });

    const pageNumbers = pages.map(({ page }) => page);

    if (new Set(pageNumbers).size !== pageNumbers.length) {
        throw new Error('TABLES contains duplicate page numbers');
    }

    pages.sort((a, b) => a.page - b.page);

    for (let index = 0; index < pages.length; index += 1) {
        const expectedPage = index + 1;

        if (pages[index].page !== expectedPage) {
            throw new Error(`TABLES is missing page ${expectedPage}`);
        }
    }

    const expectedTotal = pages[0].total;

    if (pages.some(({ total }) => total !== expectedTotal)) {
        throw new Error('TABLES pages report inconsistent totals');
    }

    const records = pages.flatMap(({ result }) => result);

    if (records.length !== expectedTotal) {
        throw new Error(
            `Incomplete TABLES data: expected ${expectedTotal} records but found ${records.length}`,
        );
    }

    return records;
}

function parseIsoDate(value, context) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${context} has an invalid meeting date`);
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        throw new Error(`${context} has an invalid meeting date`);
    }

    return date;
}

function getTimeParts(date) {
    const parts = Object.fromEntries(
        TIME_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
    );

    return {
        hour: Number(parts.hour),
        minute: Number(parts.minute),
    };
}

function getDateKeyInTimeZone(date) {
    const parts = Object.fromEntries(
        DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTime({ hour, minute }) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, '0')}${period}`;
}

function formatDate(value) {
    const [year, month, day] = value.split('-');

    return `${Number(month)}/${Number(day)}/${year}`;
}

function buildSchedule(meetings, context) {
    const slots = new Map();

    for (const [index, meeting] of meetings.entries()) {
        const meetingContext = `${context} meeting ${index + 1}`;

        if (!meeting || typeof meeting !== 'object') {
            throw new Error(`${meetingContext} is invalid`);
        }

        const meetingDate = parseIsoDate(meeting.ngay, meetingContext);
        const start = new Date(meeting.thoiGianBatDau);
        const inclusiveEnd = new Date(meeting.thoiGianKetThuc);

        if (Number.isNaN(start.getTime()) || Number.isNaN(inclusiveEnd.getTime())) {
            throw new Error(`${meetingContext} has an invalid timestamp`);
        }

        if (inclusiveEnd <= start) {
            throw new Error(`${meetingContext} must end after it starts`);
        }

        if (getDateKeyInTimeZone(start) !== meeting.ngay) {
            throw new Error(`${meetingContext} date does not match its start timestamp`);
        }

        // The API stores an inclusive final minute. Round it down to that minute,
        // then advance once to produce the exclusive end used by the application.
        const end = new Date(
            Math.floor(inclusiveEnd.getTime() / 60_000) * 60_000 + 60_000,
        );

        if (getDateKeyInTimeZone(end) !== meeting.ngay) {
            throw new Error(`${meetingContext} crosses midnight`);
        }

        const dayIndex = meetingDate.getUTCDay();
        const startTime = getTimeParts(start);
        const endTime = getTimeParts(end);
        const startMinutes = startTime.hour * 60 + startTime.minute;
        const endMinutes = endTime.hour * 60 + endTime.minute;

        if (endMinutes <= startMinutes) {
            throw new Error(`${meetingContext} has an invalid local time range`);
        }

        const key = `${dayIndex}:${startMinutes}:${endMinutes}`;

        if (!slots.has(key)) {
            slots.set(key, {
                day: DAYS[dayIndex],
                time: `${formatTime(startTime)} to ${formatTime(endTime)}`,
                dayOrder: dayIndex === 0 ? 7 : dayIndex,
                startMinutes,
            });
        }
    }

    return [...slots.values()]
        .sort((a, b) => a.dayOrder - b.dayOrder || a.startMinutes - b.startMinutes)
        .map(({ day, time }) => ({ day, time }));
}

function transformCourseRecord(record, index) {
    const recordContext = `Course record ${index + 1}`;

    if (!record || typeof record !== 'object') {
        throw new Error(`${recordContext} is invalid`);
    }

    const courseCode = normalizeText(record.maHocPhan);
    const section = normalizeText(record.ten);
    const englishTitle = normalizeText(record.hocPhan?.tenTiengAnh);
    const fallbackTitle = normalizeText(record.hocPhan?.ten);
    const title = englishTitle || fallbackTitle;
    const deliveryMethod = normalizeText(record.hinhThucGiangDay);
    const context = `${recordContext} (${courseCode || 'unknown course'}`
        + ` / ${section || 'unknown section'})`;

    if (!courseCode) {
        throw new Error(`${context} is missing maHocPhan`);
    }

    if (!section) {
        throw new Error(`${context} is missing ten`);
    }

    if (!title) {
        throw new Error(`${context} is missing a course title`);
    }

    if (!deliveryMethod) {
        throw new Error(`${context} is missing hinhThucGiangDay`);
    }

    const rawCredits = record.hocPhan?.soTinChi;
    const credits = Number(rawCredits);

    if (typeof rawCredits !== 'number' || !Number.isFinite(credits) || credits < 0) {
        throw new Error(`${context} has invalid course credits`);
    }

    if (!Array.isArray(record.nhanSuList)) {
        throw new Error(`${context} is missing nhanSuList`);
    }

    if (record.nhanSuList.length === 0) {
        throw new Error(`${context} has no instructors in nhanSuList`);
    }

    const instructorNames = record.nhanSuList.map((instructor, instructorIndex) => {
        const name = normalizeText(instructor?.tenNhanSu)
            || normalizeText(instructor?.maNhanSu);

        if (!name) {
            const received = JSON.stringify({
                tenNhanSu: instructor?.tenNhanSu,
                maNhanSu: instructor?.maNhanSu,
            });

            throw new Error(
                `${context} has invalid instructor data at nhanSuList[${instructorIndex}]: `
                + `expected a non-empty tenNhanSu or maNhanSu; received ${received}`,
            );
        }

        return name;
    });

    const instructors = [...new Set(instructorNames)];

    if (!Array.isArray(record.thoiKhoaBieuList)) {
        throw new Error(`${context} is missing thoiKhoaBieuList`);
    }

    if (record.thoiKhoaBieuList.length === 0) {
        return {
            section,
            course: null,
            omittedCourse: {
                courseCode,
                title,
                section,
                reason: 'no scheduled meetings',
            },
        };
    }

    const schedule = buildSchedule(record.thoiKhoaBieuList, context);
    const meetingDates = record.thoiKhoaBieuList.map(({ ngay }, meetingIndex) => {
        parseIsoDate(ngay, `${context} meeting ${meetingIndex + 1}`);
        return ngay;
    }).sort();

    return {
        section,
        omittedCourse: null,
        course: {
            Course: courseCode,
            'Course Title': title,
            Section: section,
            Dates: `${formatDate(meetingDates[0])} to ${formatDate(meetingDates.at(-1))}`,
            Credits: credits.toFixed(2),
            Instructor: instructors.join(', '),
            'Delivery Method': DELIVERY_METHOD_MAP[deliveryMethod] || deliveryMethod,
            Schedule: schedule,
        },
    };
}

function hashSource(source) {
    return crypto.createHash('sha256').update(source).digest('hex');
}

function getDateInTimeZone(date = new Date(), timeZone = VIETNAM_TIME_ZONE) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return `${values.year}-${values.month}-${values.day}`;
}

function getTimestampInTimeZone(date = new Date(), timeZone = VIETNAM_TIME_ZONE) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'longOffset',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const offset = values.timeZoneName === 'GMT'
        ? 'Z'
        : values.timeZoneName.replace('GMT', '');

    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

function readMetadata(metadataFile = METADATA_FILE) {
    try {
        return JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * Return the source file's Git state. A null result means Git history is not
 * available (for example, in a source archive or a shallow checkout that does
 * not contain the relevant commit).
 */
function getGitState(inputFile = INPUT_FILE, repoRoot = REPO_ROOT, runGit = execFileSync) {
    const relativeInput = path.relative(repoRoot, inputFile);

    try {
        runGit('git', ['diff', '--quiet', 'HEAD', '--', relativeInput], {
            cwd: repoRoot,
            stdio: 'ignore',
        });
    } catch (error) {
        if (error.status === 1) {
            return { dirty: true, committedDate: null };
        }

        return null;
    }

    try {
        const committedDate = runGit(
            'git',
            ['log', '-1', '--format=%cI', '--', relativeInput],
            { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
        ).trim();

        return committedDate ? { dirty: false, committedDate } : null;
    } catch {
        return null;
    }
}

function isIsoTimestamp(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function resolveLastUpdated({
    sourceHash,
    existingMetadata,
    gitState,
    currentTimestamp,
}) {
    if (!gitState?.dirty && isIsoTimestamp(gitState?.committedDate)) {
        return gitState.committedDate;
    }

    if (
        existingMetadata?.sourceHash === sourceHash
        && isIsoTimestamp(existingMetadata.lastUpdated)
    ) {
        return existingMetadata.lastUpdated;
    }

    return currentTimestamp;
}

function writeFileIfChanged(filePath, content) {
    try {
        if (fs.readFileSync(filePath, 'utf-8') === content) {
            return false;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
}

function parseAndValidateCourseData(source) {
    const tables = parseRawDataSource(source);
    const records = combineTableResults(tables);
    const seenSections = new Set();
    const courses = [];
    const omittedCourses = [];

    for (const [index, record] of records.entries()) {
        const { section, course, omittedCourse } = transformCourseRecord(record, index);

        if (seenSections.has(section)) {
            throw new Error(`Duplicate section identifier: ${section}`);
        }

        seenSections.add(section);

        if (course) {
            courses.push(course);
        } else {
            omittedCourses.push(omittedCourse);
        }
    }

    if (courses.length === 0) {
        throw new Error('No scheduled courses found in raw data');
    }

    return { courses, omittedCourses };
}

function parseAndValidateCourses(source) {
    return parseAndValidateCourseData(source).courses;
}

async function main() {
    try {
        if (!fs.existsSync(INPUT_FILE)) {
            console.warn(`\n⚠️  Input file not found: ${INPUT_FILE}`);
            console.warn('Please place your raw table data at scripts/raw-data.js\n');
            return;
        }

        const source = fs.readFileSync(INPUT_FILE, 'utf-8');

        // Build and validate every output before writing either generated file.
        const { courses, omittedCourses } = parseAndValidateCourseData(source);
        const sourceHash = hashSource(source);
        const existingMetadata = readMetadata();
        const lastUpdated = resolveLastUpdated({
            sourceHash,
            existingMetadata,
            gitState: getGitState(),
            currentTimestamp: getTimestampInTimeZone(),
        });
        const coursesOutput = JSON.stringify(courses, null, 4);
        const metadataOutput = `${JSON.stringify({ lastUpdated, sourceHash }, null, 4)}\n`;

        const coursesChanged = writeFileIfChanged(OUTPUT_FILE, coursesOutput);
        const metadataChanged = writeFileIfChanged(METADATA_FILE, metadataOutput);

        if (omittedCourses.length > 0) {
            console.warn(`⚠ Omitted ${omittedCourses.length} courses:`);

            for (const omittedCourse of omittedCourses) {
                console.warn(
                    `  - ${omittedCourse.courseCode} | ${omittedCourse.section}`
                    + ` | ${omittedCourse.title} (${omittedCourse.reason})`,
                );
            }
        }

        console.log(`✓ Successfully parsed ${courses.length} scheduled courses`);
        console.log(`✓ Course data ${coursesChanged ? 'updated' : 'unchanged'}: ${OUTPUT_FILE}`);
        console.log(`✓ Metadata ${metadataChanged ? 'updated' : 'unchanged'}: ${METADATA_FILE}`);
    } catch (error) {
        console.error(`❌ Error during parsing:\n${error.stack || error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    buildSchedule,
    combineTableResults,
    getDateInTimeZone,
    getGitState,
    getTimestampInTimeZone,
    hashSource,
    parseAndValidateCourseData,
    parseAndValidateCourses,
    parseRawDataSource,
    readMetadata,
    resolveLastUpdated,
    transformCourseRecord,
    writeFileIfChanged,
};
