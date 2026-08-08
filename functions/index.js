const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

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

  for (const t of tasks) {
    if (t.done || t.reminderFired || !t.dueDate) continue;
    const dueMs = new Date(`${t.dueDate}T${t.dueTime || '17:00'}:00`).getTime();
    if (isNaN(dueMs)) continue;
    const minutesLeft = (dueMs - now) / 60000;
    if (minutesLeft <= reminderMinutes && minutesLeft > reminderMinutes - 6) {
      t.reminderFired = true;
      changed = true;
      const message = {
        notification: {
          title: 'Deadline nadert — ' + t.text,
          body: `Moet af zijn op ${t.dueDate} om ${t.dueTime || '17:00'}.`,
        },
        tokens,
      };
      try {
        const resp = await admin.messaging().sendEachForMulticast(message);
        resp.responses.forEach((r, i) => {
          if (!r.success && r.error && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error.code)) {
            db.ref('werkplaats/fcmTokens/' + tokens[i]).remove();
          }
        });
      } catch (e) { console.error('Push versturen mislukt', e); }
    }
  }

  if (changed) await db.ref('werkplaats/tasks-data').set(JSON.stringify(tasks));
});
