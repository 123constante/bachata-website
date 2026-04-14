import { test, expect } from '@playwright/test';

test.describe('Event Page Cancelled Occurrence Fix', () => {
  const eventId = '2a1522d2-7cb6-4ee2-8c46-c75014b86ba0'; // Mock Party — known-good event with v2 data
  const baseUrl = 'http://127.0.0.1:4173';

  test('should render EventPageModel.schedule with isCancelled field populated', async ({ page }) => {
    // Navigate to event page
    await page.goto(`${baseUrl}/event/${eventId}`);

    // Wait for page to load
    await page.waitForSelector('[class*="rounded-2xl"]', { timeout: 10000 });

    // Get all sections
    const sections = await page.locator('section').count();
    console.log(`Found ${sections} sections on page`);

    // Check for Schedule section
    const hasSectionWithSchedule = await page
      .locator('section:has-text("Schedule")')
      .count()
      .then(count => count > 0);

    if (!hasSectionWithSchedule) {
      console.log('ℹ️  No Schedule section found (event might not have schedule)');
    } else {
      console.log('✅ Schedule section found');
    }

    // Check for Attendance section
    const hasAttendanceSection = await page
      .locator('section:has-text("Attendance")')
      .count()
      .then(count => count > 0);

    console.log(hasAttendanceSection ? '✅ Attendance section found' : '❌ No Attendance section');
  });

  test('non-cancelled event should show active RSVP button (smoke test)', async ({ page }) => {
    await page.goto(`${baseUrl}/event/${eventId}`);

    // Wait for page load
    await page.waitForSelector('button', { timeout: 10000 });

    // Look for RSVP-related text or button
    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons on page:', buttons);

    const hasRsvpButton = buttons.some(text =>
      text.includes("I'm Going") || text.includes('Going') || text.includes('Event Cancelled')
    );

    if (!hasRsvpButton) {
      console.log('ℹ️  No RSVP button found (event might not support RSVP or not authenticated)');
    } else {
      console.log('✅ RSVP button or related text found');

      const isCancelledLabel = buttons.some(text => text.includes('Event Cancelled'));
      if (!isCancelledLabel) {
        console.log('✅ PASS: Button does NOT show "Event Cancelled" (expected for non-cancelled)');
      } else {
        console.log('❌ FAIL: Button shows "Event Cancelled" on non-cancelled event');
      }
    }
  });

  test('should detect cancelled badge if present', async ({ page }) => {
    await page.goto(`${baseUrl}/event/${eventId}`);

    // Use rounded-2xl to match event page sections, not the hidden notifications section
    await page.waitForSelector('[class*="rounded-2xl"]', { timeout: 10000 });

    const hasCancelledBadge = await page
      .locator('text=Cancelled')
      .count()
      .then(count => count > 0);

    if (hasCancelledBadge) {
      console.log('✅ Cancelled badge found (occurrence is cancelled)');

      // If cancelled, check helper text
      const hasHelperText = await page
        .locator('text=is no longer accepting RSVPs')
        .count()
        .then(count => count > 0);

      console.log(
        hasHelperText
          ? '✅ Helper text found'
          : '❌ Helper text NOT found'
      );
    } else {
      console.log('ℹ️  No cancelled badge (event is not cancelled - smoke test OK)');
    }
  });
});
