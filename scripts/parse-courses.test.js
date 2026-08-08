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
