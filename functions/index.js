const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

// Rekent datum/tijd (ingevoerd als Nederlandse lokale tijd) correct om naar een UTC-tijdstip.
function amsterdamToUtcMs(dueDate, dueTime) {
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = (dueTime || '17:00').split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(naiveUtc)).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtcIfLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = asUtcIfLocal - naiveUtc;
  return naiveUtc - offsetMs;
}

// Draait elke 5 minuten: checkt deadlines en stuurt pushberichten naar alle geregistreerde telefoons.
exports.checkTaskReminders = onSchedule('every 5 minutes', async () => {
  const db = admin.database();
  const [tasksSnap, tokensSnap, settingsSnap] = await Promise.all([
    db.ref('werkplaats/tasks-data').once('value'),
    db.ref('werkplaats/fcmTokens').once('value'),
    db.ref('werkplaats/settings-data').once('value'),
  ]);

  let tasks = [];
  try { tasks = JSON.parse(tasksSnap.val() || '[]'); } catch (e) { return; }
  const tokens = Object.keys(tokensSnap.val() || {});
  if (tokens.length === 0) return;

  let reminderMinutes = 30;
  try {
    const s = JSON.parse(settingsSnap.val() || '{}');
    if (s.reminderMinutes) reminderMinutes = s.reminderMinutes;
  } catch (e) {}

  const now = Date.now();
  let changed = false;
  console.error(`Check: ${tasks.length} taken, ${tokens.length} tokens, reminderMinutes=${reminderMinutes}`);

  for (const t of tasks) {
    if (t.done || t.reminderFired || !t.dueDate) continue;
    const dueMs = amsterdamToUtcMs(t.dueDate, t.dueTime);
    if (isNaN(dueMs)) continue;
    const minutesLeft = (dueMs - now) / 60000;
    console.error(`Taak "${t.text}": minutesLeft=${minutesLeft.toFixed(1)}`);
    if (minutesLeft <= reminderMinutes && minutesLeft > reminderMinutes - 6) {
      t.reminderFired = true;
      changed = true;
      const message = {
        notification: {
          title: 'Deadline nadert — ' + t.text,
          body: `Moet af zijn op ${t.dueDate} om ${t.dueTime || '17:00'}.`,
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { 'content-available': 1, sound: 'default' } },
        },
        webpush: { headers: { Urgency: 'high', TTL: '60' } },
        tokens,
      };
      try {
        const resp = await admin.messaging().sendEachForMulticast(message);
        console.error(`Push verstuurd: ${resp.successCount} succes, ${resp.failureCount} mislukt`);
        resp.responses.forEach((r, i) => {
          if (!r.success) console.error('Token faalde:', tokens[i], r.error && r.error.code, r.error && r.error.message);
          if (!r.success && r.error && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error.code)) {
            db.ref('werkplaats/fcmTokens/' + tokens[i]).remove();
          }
        });
      } catch (e) { console.error('Push versturen mislukt', e); }
    }
  }

  if (changed) await db.ref('werkplaats/tasks-data').set(JSON.stringify(tasks));
});
