/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    combineTableResults,
    getDateInTimeZone,
    getGitState,
    getTimestampInTimeZone,
    hashSource,
    parseAndValidateCourseData,
    parseAndValidateCourses,
    parseRawDataSource,
    resolveLastUpdated,
    writeFileIfChanged,
} = require('./parse-courses');

function createMeeting({
    date = '2026-09-21',
    start = '2026-09-21T02:00:00.000Z',
    end = '2026-09-21T03:59:00.000Z',
} = {}) {
    return {
        ngay: date,
        thoiGianBatDau: start,
        thoiGianKetThuc: end,
    };
}

function createRecord({
    course = 'TEST1010',
    title = 'Test Course',
    englishTitle = title,
    section = 'TESTFA261',
    credits = 3,
    instructors = ['Instructor One'],
    deliveryMethod = 'Trực tiếp',
    meetings = [createMeeting()],
} = {}) {
    return {
        maHocPhan: course,
        ten: section,
        hocPhan: {
            ten: title,
            tenTiengAnh: englishTitle,
            soTinChi: credits,
        },
        nhanSuList: instructors.map((tenNhanSu) => ({ tenNhanSu })),
        hinhThucGiangDay: deliveryMethod,
        thoiKhoaBieuList: meetings,
    };
}

function createTable(page, total, result, overrides = {}) {
    return {
        success: true,
        data: {
            page,
            total,
            result,
        },
        ...overrides,
    };
}

function createSource(tables) {
    return `export const TABLES = ${JSON.stringify(tables, null, 4)}`;
}

test('parseRawDataSource parses only the TABLES export wrapper', () => {
    const tables = [createTable(1, 0, [])];

    assert.deepEqual(parseRawDataSource(`${createSource(tables)};\n`), tables);
    assert.throws(
        () => parseRawDataSource(`const TABLES = ${JSON.stringify(tables)}`),
        /export const TABLES/,
    );
    assert.throws(
        () => parseRawDataSource('export const TABLES = [invalid]'),
        /Unable to parse TABLES JSON/,
    );
    assert.throws(
        () => parseRawDataSource('export const TABLES = []'),
        /non-empty array/,
    );
});

test('combineTableResults validates pagination and combines pages in order', () => {
    const first = createRecord({ section: 'FIRST' });
    const second = createRecord({ section: 'SECOND' });
    const tables = [
        createTable(2, 2, [second]),
        createTable(1, 2, [first]),
    ];

    assert.deepEqual(combineTableResults(tables), [first, second]);
});

test('combineTableResults rejects failed and malformed responses', () => {
    assert.throws(
        () => combineTableResults([{ success: false, data: {} }]),
        /not a successful response/,
    );
    assert.throws(
        () => combineTableResults([{ success: true, data: { page: 1, total: 0 } }]),
        /missing data.result/,
    );
    assert.throws(
        () => combineTableResults([createTable(0, 0, [])]),
        /invalid page number/,
    );
    assert.throws(
        () => combineTableResults([createTable(1, -1, [])]),
        /invalid total/,
    );
});

test('combineTableResults rejects duplicate, missing, and incomplete pages', () => {
    assert.throws(
        () => combineTableResults([
            createTable(1, 0, []),
            createTable(1, 0, []),
        ]),
        /duplicate page numbers/,
    );
    assert.throws(
        () => combineTableResults([
            createTable(1, 0, []),
            createTable(3, 0, []),
        ]),
        /missing page 2/,
    );
    assert.throws(
        () => combineTableResults([
            createTable(1, 1, []),
            createTable(2, 2, []),
        ]),
        /inconsistent totals/,
    );
    assert.throws(
        () => combineTableResults([createTable(1, 2, [createRecord()])]),
        /expected 2 records but found 1/,
    );
});

test('course parsing preserves the Course schema and maps raw fields', () => {
    const record = createRecord({
        course: 'DATA2020',
        title: 'Fallback title',
        englishTitle: 'Research &amp; Data',
        section: 'DATAFA261',
        credits: 2.5,
        instructors: ['Instructor One', 'Instructor Two', 'Instructor One'],
        deliveryMethod: 'Trực tiếp',
    });
    const courses = parseAndValidateCourses(createSource([
        createTable(1, 1, [record]),
    ]));

    assert.deepEqual(courses, [{
        Course: 'DATA2020',
        'Course Title': 'Research & Data',
        Section: 'DATAFA261',
        Dates: '9/21/2026 to 9/21/2026',
        Credits: '2.50',
        Instructor: 'Instructor One, Instructor Two',
        'Delivery Method': 'Classroom',
        Schedule: [{ day: 'Monday', time: '9:00AM to 11:00AM' }],
    }]);
});

test('course parsing falls back to the default title and maps delivery methods', () => {
    const records = [
        createRecord({
            section: 'ONLINE',
            englishTitle: null,
            title: 'Fallback &amp; Title',
            deliveryMethod: 'Trực tuyến',
        }),
        createRecord({ section: 'HYBRID', deliveryMethod: 'Kết hợp' }),
        createRecord({ section: 'CUSTOM', deliveryMethod: 'Field Work' }),
    ];
    const courses = parseAndValidateCourses(createSource([
        createTable(1, records.length, records),
    ]));

    assert.equal(courses[0]['Course Title'], 'Fallback & Title');
    assert.equal(courses[0]['Delivery Method'], 'Online');
    assert.equal(courses[1]['Delivery Method'], 'Hybrid');
    assert.equal(courses[2]['Delivery Method'], 'Field Work');
});

test('course parsing deduplicates and sorts normalized Vietnam meeting times', () => {
    const record = createRecord({
        meetings: [
            createMeeting({
                date: '2026-09-22',
                start: '2026-09-22T06:30:00.000Z',
                end: '2026-09-22T07:29:59.000Z',
            }),
            createMeeting({
                date: '2026-09-21',
                start: '2026-09-21T02:00:00.000Z',
                end: '2026-09-21T04:59:00.000Z',
            }),
            createMeeting({
                date: '2026-09-28',
                start: '2026-09-28T02:00:00.000Z',
                end: '2026-09-28T04:59:00.000Z',
            }),
            createMeeting({
                date: '2026-09-21',
                start: '2026-09-21T01:00:00.000Z',
                end: '2026-09-21T01:59:00.000Z',
            }),
        ],
    });
    const [course] = parseAndValidateCourses(createSource([
        createTable(1, 1, [record]),
    ]));

    assert.equal(course.Dates, '9/21/2026 to 9/28/2026');
    assert.deepEqual(course.Schedule, [
        { day: 'Monday', time: '8:00AM to 9:00AM' },
        { day: 'Monday', time: '9:00AM to 12:00PM' },
        { day: 'Tuesday', time: '1:30PM to 2:30PM' },
    ]);
});

test('course parsing puts Sunday after Saturday', () => {
    const record = createRecord({
        meetings: [
            createMeeting({
                date: '2026-09-20',
                start: '2026-09-20T02:00:00.000Z',
                end: '2026-09-20T02:59:00.000Z',
            }),
            createMeeting({
                date: '2026-09-19',
                start: '2026-09-19T02:00:00.000Z',
                end: '2026-09-19T02:59:00.000Z',
            }),
        ],
    });
    const [course] = parseAndValidateCourses(createSource([
        createTable(1, 1, [record]),
    ]));

    assert.deepEqual(course.Schedule.map(({ day }) => day), ['Saturday', 'Sunday']);
});

test('course parsing excludes records without scheduled meetings', () => {
    const records = [
        createRecord({ section: 'SCHEDULED' }),
        createRecord({ section: 'UNSCHEDULED', meetings: [] }),
    ];
    const courses = parseAndValidateCourses(createSource([
        createTable(1, records.length, records),
    ]));

    assert.equal(courses.length, 1);
    assert.equal(courses[0].Section, 'SCHEDULED');
});

test('course parsing reports records omitted for having no scheduled meetings', () => {
    const records = [
        createRecord({
            course: 'NOSCHEDULE1010',
            englishTitle: 'Course Without a Schedule',
            section: 'UNSCHEDULED',
            meetings: [],
        }),
        createRecord({ section: 'SCHEDULED' }),
    ];
    const result = parseAndValidateCourseData(createSource([
        createTable(1, records.length, records),
    ]));

    assert.equal(result.courses.length, 1);
    assert.deepEqual(result.omittedCourses, [{
        courseCode: 'NOSCHEDULE1010',
        title: 'Course Without a Schedule',
        section: 'UNSCHEDULED',
        reason: 'no scheduled meetings',
    }]);
});

test('course parsing rejects input containing only unscheduled courses', () => {
    const record = createRecord({ meetings: [] });

    assert.throws(
        () => parseAndValidateCourses(createSource([createTable(1, 1, [record])])),
        /No scheduled courses found/,
    );
});

test('course parsing rejects missing required fields', () => {
    const cases = [
        ['maHocPhan', { maHocPhan: '' }],
        ['ten', { ten: '' }],
        ['course title', { hocPhan: { ten: '', tenTiengAnh: '', soTinChi: 3 } }],
        ['course credits', { hocPhan: { ten: 'Title', tenTiengAnh: 'Title', soTinChi: null } }],
        ['instructor', { nhanSuList: [] }],
        ['hinhThucGiangDay', { hinhThucGiangDay: '' }],
        ['thoiKhoaBieuList', { thoiKhoaBieuList: null }],
    ];

    for (const [message, override] of cases) {
        const record = { ...createRecord(), ...override };

        assert.throws(
            () => parseAndValidateCourses(createSource([createTable(1, 1, [record])])),
            new RegExp(message),
        );
    }
});

test('course parsing rejects invalid meetings and duplicate sections', () => {
    const invalidTimestamp = createRecord({
        meetings: [createMeeting({ start: 'not-a-date' })],
    });

    assert.throws(
        () => parseAndValidateCourses(createSource([
            createTable(1, 1, [invalidTimestamp]),
        ])),
        /invalid timestamp/,
    );

    const duplicateRecords = [
        createRecord({ section: 'DUPLICATE' }),
        createRecord({ section: 'DUPLICATE' }),
    ];

    assert.throws(
        () => parseAndValidateCourses(createSource([
            createTable(1, duplicateRecords.length, duplicateRecords),
        ])),
        /Duplicate section identifier/,
    );
});

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

test('getTimestampInTimeZone includes the exact Vietnam time and offset', () => {
    const date = new Date('2026-08-09T18:05:42.000Z');

    assert.equal(
        getTimestampInTimeZone(date),
        '2026-08-10T01:05:42+07:00',
    );
});

test('resolveLastUpdated uses the current timestamp for an uncommitted source change', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'new-hash',
        existingMetadata: {
            sourceHash: 'old-hash',
            lastUpdated: '2026-06-29T19:34:20+07:00',
        },
        gitState: { dirty: true, committedDate: null },
        currentTimestamp: '2026-08-09T14:05:01+07:00',
    }), '2026-08-09T14:05:01+07:00');
});

test('resolveLastUpdated prefers the committed source timestamp', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: {
            sourceHash: 'same-hash',
            lastUpdated: '2026-08-09T14:05:01+07:00',
        },
        gitState: {
            dirty: false,
            committedDate: '2026-08-10T09:12:34+07:00',
        },
        currentTimestamp: '2026-08-11T08:00:00+07:00',
    }), '2026-08-10T09:12:34+07:00');
});

test('resolveLastUpdated preserves matching metadata for repeated dirty builds', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: {
            sourceHash: 'same-hash',
            lastUpdated: '2026-08-09T14:05:01+07:00',
        },
        gitState: { dirty: true, committedDate: null },
        currentTimestamp: '2026-08-11T08:00:00+07:00',
    }), '2026-08-09T14:05:01+07:00');
});

test('resolveLastUpdated preserves matching metadata without Git history', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: {
            sourceHash: 'same-hash',
            lastUpdated: '2026-06-29T19:34:20+07:00',
        },
        gitState: null,
        currentTimestamp: '2026-08-09T14:05:01+07:00',
    }), '2026-06-29T19:34:20+07:00');
});

test('resolveLastUpdated replaces legacy date-only metadata', () => {
    assert.equal(resolveLastUpdated({
        sourceHash: 'same-hash',
        existingMetadata: { sourceHash: 'same-hash', lastUpdated: '2026-06-29' },
        gitState: null,
        currentTimestamp: '2026-08-09T14:05:01+07:00',
    }), '2026-08-09T14:05:01+07:00');
});

test('getGitState distinguishes committed and uncommitted raw data', () => {
    const inputFile = '/repo/scripts/raw-data.js';
    const committedGit = (_command, args) => {
        if (args[0] === 'log') {
            assert.deepEqual(args, [
                'log',
                '-1',
                '--format=%cI',
                '--',
                'scripts/raw-data.js',
            ]);
            return '2026-06-29T19:34:20+07:00\n';
        }

        return '';
    };

    assert.deepEqual(getGitState(inputFile, '/repo', committedGit), {
        dirty: false,
        committedDate: '2026-06-29T19:34:20+07:00',
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
