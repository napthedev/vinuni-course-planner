/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    fetchAllCoursePages,
    fetchAndWriteCourseData,
    getHeadlessOption,
    sanitizeCoursePages,
    serializeRawData,
    validateCoursePage,
    writeRawDataAtomically,
} = require('./index');

function createPage(page, total, resultCount, overrides = {}) {
    return {
        success: true,
        requestId: `request-${page}`,
        traceId: `trace-${page}`,
        data: {
            page,
            skip: (page - 1) * 100,
            limit: 100,
            total,
            result: Array.from(
                { length: resultCount },
                (_, index) => ({ id: `${page}-${index}` })
            ),
        },
        ...overrides,
    };
}

function createTemporaryFile(t, contents = 'existing data') {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'course-monitor-'));
    const filePath = path.join(directory, 'raw-data.js');
    fs.writeFileSync(filePath, contents, 'utf8');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return filePath;
}

test('importing the monitor exposes helpers without starting automation', () => {
    assert.equal(typeof fetchAndWriteCourseData, 'function');
});

test('getHeadlessOption validates and parses the command-line option', () => {
    assert.equal(getHeadlessOption(['node', 'index.js']), true);
    assert.equal(getHeadlessOption(['node', 'index.js', '--headless=false']), false);
    assert.throws(
        () => getHeadlessOption(['node', 'index.js', '--headless=invalid']),
        /must be either true or false/
    );
});

test('serialization removes volatile request identifiers', () => {
    const page = createPage(1, 1, 1);
    const stablePages = sanitizeCoursePages([page]);
    const output = serializeRawData([page]);
    const json = output.match(/^export const TABLES = ([\s\S]+);\n$/)[1];

    assert.deepEqual(Object.keys(stablePages[0]), ['success', 'data']);
    assert.equal(output.includes('requestId'), false);
    assert.equal(output.includes('traceId'), false);
    assert.deepEqual(JSON.parse(json), stablePages);
});

test('fetchAllCoursePages derives and fetches more than four pages', async () => {
    const requestedPages = [];
    const fetchPage = async (pageNumber) => {
        requestedPages.push(pageNumber);
        return createPage(pageNumber, 450, pageNumber === 5 ? 50 : 100);
    };

    const pages = await fetchAllCoursePages('Bearer token', {}, fetchPage);

    assert.equal(pages.length, 5);
    assert.deepEqual(requestedPages.sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('validation rejects malformed and inconsistent pages', async () => {
    assert.throws(
        () => validateCoursePage(createPage(2, 1, 1), 1),
        /reported page 2/
    );
    assert.throws(
        () => validateCoursePage(createPage(1, 1, 1, { success: false }), 1),
        /was not successful/
    );

    await assert.rejects(
        fetchAllCoursePages('Bearer token', {}, async (pageNumber) =>
            createPage(pageNumber, pageNumber === 1 ? 150 : 151, pageNumber === 1 ? 100 : 50)
        ),
        /inconsistent total/
    );
});

test('writeRawDataAtomically leaves identical content untouched', async (t) => {
    const filePath = createTemporaryFile(t, 'same content');
    const before = fs.statSync(filePath);

    assert.equal(
        await writeRawDataAtomically('same content', filePath),
        false
    );

    const after = fs.statSync(filePath);
    assert.equal(after.ino, before.ino);
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'same content');
});

test('incomplete fetches preserve the existing raw-data file', async (t) => {
    const filePath = createTemporaryFile(t);
    const fetchPage = async (pageNumber) =>
        createPage(pageNumber, 201, pageNumber < 3 ? 100 : 0);

    await assert.rejects(
        fetchAndWriteCourseData('Bearer token', {}, {
            fetchPage,
            outputPath: filePath,
        }),
        /expected 201 records but found 200/
    );

    assert.equal(fs.readFileSync(filePath, 'utf8'), 'existing data');
});

test('a complete changed fetch replaces the raw-data file', async (t) => {
    const filePath = createTemporaryFile(t);
    const result = await fetchAndWriteCourseData('Bearer token', {}, {
        fetchPage: async () => createPage(1, 1, 1),
        outputPath: filePath,
    });

    assert.deepEqual(result, { changed: true, pageCount: 1, recordCount: 1 });
    assert.match(fs.readFileSync(filePath, 'utf8'), /^export const TABLES = /);
});
