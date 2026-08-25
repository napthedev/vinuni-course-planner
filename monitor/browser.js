/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply the stealth evasions before any browser is launched. Exporting this
// configured instance keeps the login and monitoring sessions consistent.
chromium.use(StealthPlugin());

module.exports = { chromium };
