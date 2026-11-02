// Deploy as a web app: execute as yourself, access for Anyone.
// Keep the spreadsheet private. This endpoint never returns subscriber data.
const SHEET_ID = '1MCYwzZsDwn_eBTAyR2sf2hbX4DR0PjhXJnUt8B3Gavs';

function newsletterPage(message) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Newsletter | Lazar Gugleta</title></head>' +
    '<body style="font:18px system-ui;max-width:540px;margin:15vh auto;padding:24px;line-height:1.6">' +
    '<h1>New writing, in your inbox.</h1><p>' + message + '</p>' +
    '<a href="https://lazargugleta.com/#writing" target="_top">Back to Lazar’s website</a></body></html>'
  );
}

function doGet() {
  return newsletterPage('Please subscribe using the form on my website.');
}

function doPost(event) {
  const params = event && event.parameter || {};
  const email = String(params.email || '').trim().toLowerCase();
  if (params.website || params.consent !== 'yes' || email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) {
    return newsletterPage('Please go back and enter a valid email address.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return newsletterPage('Signup is busy. Please go back and try again in a moment.');
  }
  try {
    const book = SpreadsheetApp.openById(SHEET_ID);
    const sheet = book.getSheetByName('Subscribers') || book.insertSheet('Subscribers');
    if (sheet.getLastRow() === 0) sheet.appendRow(['Email', 'Subscribed at (UTC)', 'Consent']);
    const count = sheet.getLastRow() - 1;
    const exists = count > 0 && sheet.getRange(2, 1, count, 1)
      .createTextFinder(email).matchEntireCell(true).matchCase(false).useRegularExpression(false).findNext();
    if (!exists) {
      // Leading apostrophe stores literal text, preventing spreadsheet formulas.
      sheet.appendRow(["'" + email, new Date().toISOString(), 'Newsletter signup v1']);
    }
    return newsletterPage('Thank you! Your signup has been received.');
  } catch (error) {
    return newsletterPage('Your signup could not be saved. Please go back and try again later.');
  } finally {
    lock.releaseLock();
  }
}
