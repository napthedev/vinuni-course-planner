/* eslint-disable @typescript-eslint/no-require-imports */
const { promises: fs } = require('fs');
const path = require('path');

const { chromium } = require('./browser');

const PORTAL_URL =
    'https://one.vinuni.edu.vn/student/hoc-tap/dang-ky-tin-chi';
const API_ORIGIN = 'https://one-apigw.vinuni.edu.vn';
const COURSE_LIST_PATH =
    '/connect/qldt/dang-ky-tin-chi/sinh-vien/lop-hoc-phan/' +
    'by-hoc-phan/hoc-ky/20261/loai/tat-ca/page';

const AUTH_PATH = path.join(__dirname, 'auth.json');
const RAW_DATA_PATH = path.join(__dirname, '..', 'scripts', 'raw-data.js');
const TOKEN_CAPTURE_TIMEOUT_MS = 30_000;
const COURSE_LIMIT = 100;
const COURSE_SORT = {
    maHocPhan: 1,
    ten: 1,
};
const COURSE_CONDITION = {
    loai: 'C',
    trangThaiLop: 'Mở',
    idDot: '6a8bfb8e26633a76cfe6f432',
};

const BROWSER_HEADER_NAMES = [
    'accept-language',
    'priority',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'user-agent',
];

function getHeadlessOption(argumentsList = process.argv) {
    const option = argumentsList.find((argument) =>
        argument.startsWith('--headless=')
    );

    if (!option) return true;

    const value = option.split('=', 2)[1].toLowerCase();

    if (value !== 'true' && value !== 'false') {
        throw new Error('--headless must be either true or false');
    }

    return value === 'true';
}

function timestamp() {
    return new Date().toLocaleString();
}

function selectBrowserHeaders(headers) {
    return Object.fromEntries(
        BROWSER_HEADER_NAMES
            .filter((name) => headers[name])
            .map((name) => [name, headers[name]])
    );
}

async function loadPageAndCaptureAuthorization(page, loadPage) {
    let timeout;
    let onRequest;

    const authorizationPromise = new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
            reject(new Error(
                `No authorized request to ${API_ORIGIN} was observed within ` +
                `${TOKEN_CAPTURE_TIMEOUT_MS / 1000} seconds`
            ));
        }, TOKEN_CAPTURE_TIMEOUT_MS);

        onRequest = async (request) => {
            try {
                if (new URL(request.url()).origin !== API_ORIGIN) return;

                const [authorization, requestHeaders] = await Promise.all([
                    request.headerValue('authorization'),
                    request.allHeaders(),
                ]);

                if (!/^Bearer\s+\S+$/i.test(authorization ?? '')) return;

                resolve({
                    authorization,
                    browserHeaders: selectBrowserHeaders(requestHeaders),
                });
            } catch (error) {
                console.warn(
                    `[${timestamp()}] Could not inspect an API request: ` +
                    error.message
                );
            }
        };

        page.on('request', onRequest);
    });

    try {
        const [, capturedRequest] = await Promise.all([
            loadPage(),
            authorizationPromise,
        ]);
        return capturedRequest;
    } finally {
        clearTimeout(timeout);
        page.off('request', onRequest);
    }
}

function buildCourseListUrl(pageNumber) {
    const url = new URL(COURSE_LIST_PATH, API_ORIGIN);
    url.searchParams.set('page', String(pageNumber));
    url.searchParams.set('limit', String(COURSE_LIMIT));
    url.searchParams.set('sort', JSON.stringify(COURSE_SORT));
    url.searchParams.set('condition', JSON.stringify(COURSE_CONDITION));
    return url;
}

function validateCoursePage(responseBody, expectedPage) {
    if (
        responseBody === null ||
        typeof responseBody !== 'object' ||
        Array.isArray(responseBody)
    ) {
        throw new Error(`Course-list page ${expectedPage} is not a JSON object`);
    }

    if (responseBody.success !== true) {
        throw new Error(`Course-list page ${expectedPage} was not successful`);
    }

    const { data } = responseBody;

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Course-list page ${expectedPage} is missing data`);
    }

    if (data.page !== expectedPage) {
        throw new Error(
            `Course-list page ${expectedPage} reported page ${data.page}`
        );
    }

    if (!Number.isInteger(data.total) || data.total < 0) {
        throw new Error(`Course-list page ${expectedPage} has an invalid total`);
    }

    if (!Number.isInteger(data.limit) || data.limit < 1) {
        throw new Error(`Course-list page ${expectedPage} has an invalid limit`);
    }

    if (!Array.isArray(data.result)) {
        throw new Error(`Course-list page ${expectedPage} is missing data.result`);
    }

    return responseBody;
}

async function fetchCoursePage(
    pageNumber,
    authorization,
    browserHeaders,
    fetchImplementation = fetch
) {
    const response = await fetchImplementation(buildCourseListUrl(pageNumber), {
        method: 'GET',
        headers: {
            ...browserHeaders,
            accept: 'application/json, text/plain, */*',
            authorization,
            referer: 'https://one.vinuni.edu.vn/',
            'x-vinuni-client-app': 'web-connect',
        },
    });

    if (!response.ok) {
        throw new Error(
            `Course-list page ${pageNumber} returned HTTP ${response.status}`
        );
    }

    let responseBody;

    try {
        responseBody = await response.json();
    } catch {
        throw new Error(
            `Course-list page ${pageNumber} returned invalid JSON ` +
            `(HTTP ${response.status})`
        );
    }

    return validateCoursePage(responseBody, pageNumber);
}

async function fetchAllCoursePages(
    authorization,
    browserHeaders,
    fetchPage = fetchCoursePage
) {
    const firstPage = validateCoursePage(
        await fetchPage(1, authorization, browserHeaders),
        1
    );
    const { limit, total } = firstPage.data;
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const remainingPages = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) => index + 2)
            .map((pageNumber) =>
                fetchPage(pageNumber, authorization, browserHeaders)
            )
    );
    const pages = [firstPage, ...remainingPages].map((page, index) =>
        validateCoursePage(page, index + 1)
    );

    for (const [index, page] of pages.entries()) {
        if (page.data.total !== total) {
            throw new Error(
                `Course-list page ${index + 1} reports an inconsistent total`
            );
        }

        if (page.data.limit !== limit) {
            throw new Error(
                `Course-list page ${index + 1} reports an inconsistent limit`
            );
        }
    }

    const recordCount = pages.reduce(
        (count, page) => count + page.data.result.length,
        0
    );

    if (recordCount !== total) {
        throw new Error(
            `Incomplete course data: expected ${total} records but found ` +
            `${recordCount}`
        );
    }

    return pages;
}

function sanitizeCoursePages(pages) {
    return pages.map(({ success, data }) => ({ success, data }));
}

function serializeRawData(pages) {
    const stablePages = sanitizeCoursePages(pages);

    return `export const TABLES = ${JSON.stringify(stablePages, null, 2)};\n`;
}

async function writeRawDataAtomically(
    contents,
    outputPath = RAW_DATA_PATH
) {
    try {
        if (await fs.readFile(outputPath, 'utf8') === contents) {
            return false;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

    try {
        await fs.writeFile(temporaryPath, contents, {
            encoding: 'utf8',
            flag: 'wx',
        });
        await fs.rename(temporaryPath, outputPath);
    } catch (error) {
        try {
            await fs.unlink(temporaryPath);
        } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
                console.warn(
                    `[${timestamp()}] Could not remove temporary data file: ` +
                    cleanupError.message
                );
            }
        }

        throw error;
    }

    return true;
}

async function fetchAndWriteCourseData(
    authorization,
    browserHeaders,
    {
        fetchPage = fetchCoursePage,
        outputPath = RAW_DATA_PATH,
    } = {}
) {
    const pages = await fetchAllCoursePages(
        authorization,
        browserHeaders,
        fetchPage
    );
    const changed = await writeRawDataAtomically(
        serializeRawData(pages),
        outputPath
    );

    return { changed, pageCount: pages.length, recordCount: pages[0].data.total };
}

async function captureAuthorization(headless) {
    let browser;

    try {
        console.log(`Launching browser with headless=${headless}`);
        browser = await chromium.launch({ headless });

        const context = await browser.newContext({ storageState: AUTH_PATH });
        const page = await context.newPage();

        return await loadPageAndCaptureAuthorization(
            page,
            () => page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' })
        );
    } finally {
        await browser?.close();
    }
}

async function runAutomation() {
    const headless = getHeadlessOption();
    const { authorization, browserHeaders } =
        await captureAuthorization(headless);

    console.log(`[${timestamp()}] Bearer token captured.`);

    const { changed, pageCount, recordCount } =
        await fetchAndWriteCourseData(authorization, browserHeaders);
    const status = changed ? 'Updated' : 'No changes to';

    console.log(
        `[${timestamp()}] ${status} scripts/raw-data.js with ` +
        `${recordCount} records across ${pageCount} pages.`
    );
}

if (require.main === module) {
    runAutomation().catch((error) => {
        console.error(`[${timestamp()}] Fatal error: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    fetchAllCoursePages,
    fetchAndWriteCourseData,
    getHeadlessOption,
    sanitizeCoursePages,
    serializeRawData,
    validateCoursePage,
    writeRawDataAtomically,
};
