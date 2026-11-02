# Newsletter collection

`newsletter.gs` runs as a Google Apps Script web app. The website posts an
email address and consent value to its `/exec` URL. The response confirms a
saved signup or displays an error; subscriber records are never returned.

The private spreadsheet receives a `Subscribers` tab with email, UTC signup
timestamp, and consent version. Addresses are normalized and deduplicated
under a script lock. Email cells are stored as literal text.

## Deployment

1. Paste `newsletter.gs` into the Apps Script project associated with the
   selected spreadsheet (or a standalone project).
2. Deploy as **Web app**, executing as **Me**, accessible to **Anyone**.
3. Authorize spreadsheet access in your Google account. Keep the spreadsheet
   private; do not publish it or enable public link sharing.
4. Set the website form's `action` to the deployment URL ending in `/exec`.
5. When changing backend code, update the deployment to a new version.

Run `node scripts/newsletter-check.js` for backend logic checks. A live form
submission still needs verification after deployment.

This version only collects signups; it does not send mail or verify ownership
of an address. The honeypot blocks basic form-filling bots, not determined
abuse. Google Apps Script quotas apply. Handle removal requests manually in
the Sheet; never commit exported subscribers to the public repository.
