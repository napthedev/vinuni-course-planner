/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    getDateInTimeZone,
    getGitState,
    hashSource,
    parseAndValidateCourses,
    resolveLastUpdated,
    writeFileIfChanged,
} = require('./parse-courses');

function createCourseRow({
    course,
    section,
    schedule,
    scheduleTitle,
}) {
    const scheduleMarkup = scheduleTitle === undefined
        ? schedule
        : `<span id="lnkDetails" title="${scheduleTitle}">${schedule}</span>`;

    return `
        <tr>
            <td></td>
            <td>${course}</td>
            <td>${course} title</td>
            <td>${section}</td>
            <td>2/9/2026 to 6/5/2026</td>
            <td>3.00</td>
            <td>${scheduleMarkup}</td>
            <td>Instructor</td>
            <td>Classroom</td>
        </tr>
    `;
}

function createCourseTable(rows) {
    return `<table id="CourseList"><tbody>${rows.join('')}</tbody></table>`;
}

test('hashSource returns a stable SHA-256 hash', () => {
    const hash = hashSource('course data');

    assert.equal(hash, hashSource('course data'));
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, hashSource('different course data'));
});

test('getDateInTimeZone uses the Vietnam calendar date', () => {
    const date = new Date('2026-08-09T18:00:00.000Z');

    assert.equal(getDateInTimeZone(date), '2026-08-10');
});

test('resolveLastUpdated uses today for an uncommitted source change', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'new-hash',
        existingMetadata: { sourceHash: 'old-hash', lastUpdated: '2026-06-29' },
        gitState: { dirty: true, committedDate: null },
        today: '2026-08-09',
    }), '2026-08-09');
});

test('resolveLastUpdated prefers the committed source date', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: { sourceHash: 'same-hash', lastUpdated: '2026-08-09' },
        gitState: { dirty: false, committedDate: '2026-08-10' },
        today: '2026-08-11',
    }), '2026-08-10');
});

test('resolveLastUpdated preserves matching metadata without Git history', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: { sourceHash: 'same-hash', lastUpdated: '2026-06-29' },
        gitState: null,
        today: '2026-08-09',
    }), '2026-06-29');
});

test('resolveLastUpdated falls back to today for changed content without Git history', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'new-hash',
        existingMetadata: { sourceHash: 'old-hash', lastUpdated: '2026-06-29' },
        gitState: null,
        today: '2026-08-09',
    }), '2026-08-09');
});

test('getGitState distinguishes committed and uncommitted source content', () => {
    const inputFile = '/repo/scripts/index.html';
    const committedGit = (_command, args) => {
        if (args[0] === 'log') {
            return '2026-06-29\n';
        }

        return '';
    };

    assert.deepEqual(getGitState(inputFile, '/repo', committedGit), {
        dirty: false,
        committedDate: '2026-06-29',
    });

    const dirtyGit = () => {
        const error = new Error('Source differs from HEAD');
        error.status = 1;
        throw error;
    };

    assert.deepEqual(getGitState(inputFile, '/repo', dirtyGit), {
        dirty: true,
        committedDate: null,
    });
});

test('writeFileIfChanged does not rewrite identical content', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'course-parser-'));
    const file = path.join(directory, 'output.json');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    assert.equal(writeFileIfChanged(file, 'same content'), true);
    const firstStat = fs.statSync(file);
    assert.equal(writeFileIfChanged(file, 'same content'), false);
    const secondStat = fs.statSync(file);

    assert.equal(fs.readFileSync(file, 'utf-8'), 'same content');
    assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);
});

test('invalid course HTML fails before generated data can be produced', () => {
    assert.throws(
        () => parseAndValidateCourses('<html><body>No course table</body></html>'),
        /No courses found/,
    );
});

test('course parsing excludes rows without a usable schedule', () => {
    const html = createCourseTable([
        createCourseRow({
            course: 'VALID1010',
            section: 'VALID1',
            schedule: 'MW 9:00AM- 10:15AM',
            scheduleTitle: 'MW 9:00AM- 10:15AM',
        }),
        createCourseRow({
            course: 'TBA1010',
            section: 'TBA1',
            schedule: 'No scheduled meetings',
        }),
        createCourseRow({
            course: 'BLANK1010',
            section: 'BLANK1',
            schedule: '',
        }),
        createCourseRow({
            course: 'UNKNOWN1010',
            section: 'UNKNOWN1',
            schedule: 'Schedule forthcoming',
        }),
    ]);

    const courses = parseAndValidateCourses(html);

    assert.equal(courses.length, 1);
    assert.equal(courses[0].Course, 'VALID1010');
    assert.deepEqual(courses[0].Schedule, [
        { day: 'Monday', time: '9:00AM to 10:15AM' },
        { day: 'Wednesday', time: '9:00AM to 10:15AM' },
    ]);
});

test('course parsing rejects input containing only unscheduled courses', () => {
    const html = createCourseTable([
        createCourseRow({
            course: 'TBA1010',
            section: 'TBA1',
            schedule: 'No scheduled meetings',
        }),
    ]);

    assert.throws(() => parseAndValidateCourses(html), /No courses found/);
});
