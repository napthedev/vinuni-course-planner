/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('./browser');
const path = require('path');

const AUTH_PATH = path.join(__dirname, 'auth.json');

async function saveAuth() {
    // Launch a visible browser so you can interact with it
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to your university portal or the Microsoft login page
    await page.goto('https://login.microsoftonline.com');

    console.log('Please log in manually and complete any MFA steps...');

    // Wait for you to finish logging in. 
    // Adjust the URL to whatever page your university redirects to after success.
    await page.waitForURL('**m365.cloud.microsoft/chat**', { timeout: 300000 });

    // Save storage state (cookies, local storage, etc.) to a file
    await context.storageState({ path: AUTH_PATH });
    console.log(`Authentication state saved to ${AUTH_PATH} successfully!`);

    await browser.close();
}

if (require.main === module) {
    saveAuth().catch((error) => {
        console.error(`Unable to save authentication state: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { saveAuth };
