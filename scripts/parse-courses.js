#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');

const REPO_ROOT = path.join(__dirname, '..');
const INPUT_FILE = path.join(__dirname, 'index.html');
const OUTPUT_FILE = path.join(REPO_ROOT, 'src', 'data', 'courses.json');
const METADATA_FILE = path.join(REPO_ROOT, 'src', 'data', 'courses.meta.json');
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Day mapping configuration
const DAY_MAP = {
    M: 'Monday',
    T: 'Tuesday',
    W: 'Wednesday',
    H: 'Thursday',
    F: 'Friday',
    S: 'Saturday',
    U: 'Sunday',
};

/**
 * Extract course data from HTML
 * Mirrors the logic from main.py
 */
function extractCourseData(htmlSource) {
    const $ = cheerio.load(htmlSource);
    const table = $('#CourseList');

    if (table.length === 0) {
        console.warn('Warning: CourseList table not found');
        return [];
    }

    const results = [];

    // Extract rows from tbody
    table.find('tbody tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length === 0) {
            return;
        }

        const rowData = {};

        // Extract course information from specific cell indices
        // 1: Course, 2: Course Title, 3: Section, 4: Dates, 5: Credits, 7: Instructor, 8: Delivery Method
        // Helper function to normalize whitespace like Python's strip=True
        const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

        rowData.Course = normalizeText($(cells[1]).text());
        rowData['Course Title'] = normalizeText($(cells[2]).text());
        rowData.Section = normalizeText($(cells[3]).text());
        rowData.Dates = normalizeText($(cells[4]).text());
        rowData.Credits = normalizeText($(cells[5]).text());
        rowData.Instructor = normalizeText($(cells[7]).text());
        rowData['Delivery Method'] = normalizeText($(cells[8]).text());

        // Special handling for Schedule column (Index 6)
        const scheduleCell = $(cells[6]);
        const scheduleSpan = scheduleCell.find('span[id="lnkDetails"]');

        let rawScheduleText = '';

        // Prioritize the 'title' attribute if it exists, otherwise use text
        if (scheduleSpan.length > 0) {
            rawScheduleText = scheduleSpan.attr('title') || scheduleSpan.text().trim();
        } else {
            rawScheduleText = scheduleCell.text().trim();
        }

        const parsedSchedule = [];

        if (rawScheduleText && rawScheduleText !== 'No scheduled meetings') {
            // Split by semicolon or newlines to handle multiple schedules
            const scheduleParts = rawScheduleText.split(/[;\n]+/);

            for (const part of scheduleParts) {
                const trimmedPart = part.trim();
                if (!trimmedPart) continue;

                // Regex to separate Day Codes from Time
                // Looks for one or more letters [MTWHFSU] at start, followed by space
                const match = trimmedPart.match(/^([MTWHFSU]+)\s+(.*)/);

                if (match) {
                    const daysCode = match[1];
                    let timeStr = match[2].trim();

                    // Iterate through day codes (e.g., "WF" -> W, F)
                    for (const char of daysCode) {
                        if (char in DAY_MAP) {
                            parsedSchedule.push({
                                day: DAY_MAP[char],
                                time: timeStr,
                            });
                        }
                    }
                }
            }
        }

        rowData.Schedule = parsedSchedule;
        results.push(rowData);
    });

    return results;
}

/**
 * Modify schedule times
 * Mirrors the logic from modify.py
 */
function modifyScheduleTimes(courses) {
    for (const course of courses) {
        // Skip if Schedule is missing or empty
        if (!course.Schedule || course.Schedule.length === 0) {
            continue;
        }

        const newSchedule = [];

        for (const item of course.Schedule) {
            // Skip items without a time field
            if (!item.time) {
                continue;
            }

            // Replace "- " with " to "
            let timeStr = item.time.replace(/- /g, ' to ');

            // Split on ", " if present (e.g., "9:00AM to 12:00PM, 3:30PM to 5:20PM")
            if (timeStr.includes(', ')) {
                const times = timeStr.split(', ');
                for (const t of times) {
                    newSchedule.push({
                        day: item.day || '',
                        time: t,
                    });
                }
            } else {
                newSchedule.push({
                    day: item.day || '',
                    time: timeStr,
                });
            }
        }

        course.Schedule = newSchedule;
    }

    return courses;
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
            ['log', '-1', '--format=%cs', '--', relativeInput],
            { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
        ).trim();

        return committedDate ? { dirty: false, committedDate } : null;
    } catch {
        return null;
    }
}

function isIsoDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveLastUpdated({ sourceHash, existingMetadata, gitState, today }) {
    if (gitState?.dirty) {
        return today;
    }

    if (isIsoDate(gitState?.committedDate)) {
        return gitState.committedDate;
    }

    if (
        existingMetadata?.sourceHash === sourceHash
        && isIsoDate(existingMetadata.lastUpdated)
    ) {
        return existingMetadata.lastUpdated;
    }

    return today;
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

function parseAndValidateCourses(htmlContent) {
    const courses = modifyScheduleTimes(extractCourseData(htmlContent))
        .filter((course) => course.Schedule?.length > 0);

    if (courses.length === 0) {
        throw new Error('No courses found in the HTML. Ensure the table has id="CourseList"');
    }

    return courses;
}

/**
 * Main execution
 */
async function main() {
    try {
        // Check if input file exists
        if (!fs.existsSync(INPUT_FILE)) {
            console.warn(`\n⚠️  Input file not found: ${INPUT_FILE}`);
            console.warn('Please place your HTML file at scripts/index.html\n');
            return;
        }

        // Read HTML file
        const htmlContent = fs.readFileSync(INPUT_FILE, 'utf-8');

        // Build and validate every output before writing either generated file.
        const courses = parseAndValidateCourses(htmlContent);
        const sourceHash = hashSource(htmlContent);
        const existingMetadata = readMetadata();
        const lastUpdated = resolveLastUpdated({
            sourceHash,
            existingMetadata,
            gitState: getGitState(),
            today: getDateInTimeZone(),
        });
        const coursesOutput = JSON.stringify(courses, null, 4);
        const metadataOutput = `${JSON.stringify({ lastUpdated, sourceHash }, null, 4)}\n`;

        const coursesChanged = writeFileIfChanged(OUTPUT_FILE, coursesOutput);
        const metadataChanged = writeFileIfChanged(METADATA_FILE, metadataOutput);

        console.log(`✓ Successfully parsed ${courses.length} courses`);
        console.log(`✓ Course data ${coursesChanged ? 'updated' : 'unchanged'}: ${OUTPUT_FILE}`);
        console.log(`✓ Metadata ${metadataChanged ? 'updated' : 'unchanged'}: ${METADATA_FILE}`);
    } catch (error) {
        console.error('❌ Error during parsing:', error.message);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    extractCourseData,
    getDateInTimeZone,
    getGitState,
    hashSource,
    modifyScheduleTimes,
    parseAndValidateCourses,
    readMetadata,
    resolveLastUpdated,
    writeFileIfChanged,
};
