/**
 * Google Apps Script: receives the daily database backups and files them in Google Drive.
 *
 * Not part of the app. It lives in your own Google account (script.google.com), and
 * .github/workflows/backup.yml posts each night's encrypted dump to it. One deployment serves
 * every app: each gets its own folder under "App backups" (lingo3, and concordia or glowis if
 * their repositories get the same workflow).
 *
 * Setup, once, from a phone or a computer (README, "Backups"):
 *   1. script.google.com → New project → replace everything with this file.
 *   2. Change SECRET below to a long random text (letters and digits only). The same text
 *      goes into the GitHub secret BACKUP_UPLOAD_SECRET.
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *      Allow the Drive permission it asks for. Copy the Web app URL into the GitHub
 *      secret BACKUP_UPLOAD_URL.
 *
 * "Anyone" only means the URL accepts a request; without SECRET nothing is written.
 * The files are encrypted before they leave GitHub, so Drive holds nothing readable
 * without BACKUP_PASSPHRASE.
 */
const SECRET = 'CHANGE-ME-to-a-long-random-text';
const ROOT_FOLDER = 'App backups';
const KEEP_DAYS = 30;

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply('bad request');
  }
  if (SECRET.indexOf('CHANGE-ME') === 0 || body.secret !== SECRET) return reply('forbidden');
  const app = String(body.app || '').replace(/[^a-z0-9-]/g, '');
  const name = String(body.name || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!app || !name || !body.data) return reply('bad request');

  const folder = child(child(DriveApp.getRootFolder(), ROOT_FOLDER), app);
  const bytes = Utilities.base64Decode(body.data);
  folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', name));

  // Keep the last KEEP_DAYS days; never bin the copy just written.
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName() !== name && file.getDateCreated().getTime() < cutoff) file.setTrashed(true);
  }
  return reply('ok ' + name + ' ' + bytes.length);
}

function child(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function reply(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
