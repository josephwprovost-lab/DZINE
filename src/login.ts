#!/usr/bin/env node

/**
 * DZINE AI Login Helper
 *
 * Opens a browser window for you to log in with your Google account.
 * The login session is saved for use by the MCP server.
 */

import { DzineBrowser } from './dzine-browser.js';

async function main() {
  const browser = new DzineBrowser({ headless: false });

  console.log('\n🔐 DZINE AI Login Helper\n');

  // Check if already logged in
  console.log('Checking existing login status...');
  const isLoggedIn = await browser.isLoggedIn();

  if (isLoggedIn) {
    console.log('✅ You are already logged in to DZINE AI!');
    console.log('Your session is saved and ready to use.\n');
    await browser.close();
    process.exit(0);
  }

  console.log('Opening browser for login...\n');

  try {
    await browser.openForLogin();

    // Verify login was successful
    const nowLoggedIn = await browser.isLoggedIn();

    if (nowLoggedIn) {
      console.log('\n✅ Login successful! Your session has been saved.');
      console.log('You can now use the DZINE MCP server.\n');
    } else {
      console.log('\n⚠️  Login may not have completed. Please try again.');
      console.log('Run: npm run login\n');
    }
  } catch (error) {
    console.error('\n❌ Login error:', error instanceof Error ? error.message : error);
    console.log('Please try again: npm run login\n');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
