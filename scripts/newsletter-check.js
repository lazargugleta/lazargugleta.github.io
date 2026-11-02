const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const rows = [];
let locked = false;
let busy = false;
let fail = false;
const sheet = {
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    getRange: () => ({ createTextFinder: email => {
        const finder = {
            matchEntireCell: () => finder,
            matchCase: () => finder,
            useRegularExpression: () => finder,
            findNext: () => rows.slice(1).some(row => row[0].replace(/^'/, '') === email)
        };
        return finder;
    } })
};
const context = vm.createContext({
    HtmlService: { createHtmlOutput: html => html },
    LockService: { getScriptLock: () => ({
        tryLock: () => { locked = !busy; return locked; },
        releaseLock: () => { locked = false; }
    }) },
    SpreadsheetApp: { openById: () => {
        if (fail) throw new Error('Storage unavailable');
        return { getSheetByName: () => sheet };
    } }
});
vm.runInContext(fs.readFileSync(`${__dirname}/newsletter.gs`, 'utf8'), context);
const submit = (email, extra = {}) => context.doPost({ parameter: { email, consent: 'yes', ...extra } });
assert.match(submit(' Alice@Example.com '), /Thank you!/);
assert.equal(rows[1][0], "'alice@example.com");
assert.equal(locked, false);
submit('alice@example.com');
assert.equal(rows.length, 2, 'Duplicate must not add a row');
for (const email of ['', 'invalid', 'a@b', 'a\nb@example.com', 'x'.repeat(255) + '@example.com']) {
    assert.match(submit(email), /valid email/);
}
assert.match(submit('bot@example.com', { website: 'spam' }), /valid email/);
assert.match(submit('a@example.com', { consent: '' }), /valid email/);
assert.equal(rows.length, 2);
submit('=test@example.com');
assert.equal(rows[2][0], "'=test@example.com", 'Formula-like input must be stored as text');
busy = true;
assert.match(submit('busy@example.com'), /Signup is busy/);
busy = false;
fail = true;
assert.match(submit('failure@example.com'), /could not be saved/);
assert.equal(locked, false, 'Storage errors must release lock');
assert.doesNotMatch(context.doGet(), /alice@example.com/);
console.log('Newsletter checks passed: validation, consent, duplicates, literal storage, lock and failure handling.');
