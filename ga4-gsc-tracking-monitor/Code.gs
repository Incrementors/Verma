/** @OnlyCurrentDoc */
/**
 * GA4 + Search Console Tracking Monitor  (v1.0)
 *
 * Lists every GA4 property and Search Console site the reporting account can see,
 * checks each one (weekly, or on demand), colours problems red / amber, keeps a dated
 * history column per run and emails alerts.
 *
 * Install: Extensions → Apps Script → paste this file as Code.gs and Sidebar.html as an
 * HTML file named "Sidebar" → save → reload the sheet → menu "Tracking Monitor" → Open settings.
 *
 * The connection URL and API token are stored in the private User Properties of the person who saves them.
 * They never appear in the sheet, and other editors can't read them.
 */

// ───────────────────────────── Settings ─────────────────────────────

const THM = {
  VERSION: '1.0',
  MENU: 'Tracking Monitor',
  SHEETS: { ga: 'GA4 Properties', gsc: 'Search Console', issues: 'Open Issues', log: 'Run Log' },
  BANNER_ROW: 1,
  HEADER_ROW: 2,
  FIRST_ROW: 3,
  SLICE_MS: 270000,          // stop after 4.5 min and continue in a fresh run (Apps Script limit is 6 min)
  STALE_RUN_MS: 3 * 3600000, // a run unfinished after 3 h is abandoned and restarted
  BATCH_GA: 6,               // GA4 properties checked in parallel
  BATCH_GSC: 4,              // Search Console sites checked in parallel (2 requests each)
  BATCH_STREAMS: 10,
  COLORS: {
    red: '#f4c7c3', amber: '#fce8b2', green: '#d9ead3', grey: '#eeeeee', none: '#ffffff',
    header: '#263238', banner: '#eceff1'
  }
};

const DEFAULTS = {
  account: '',           // the reporting account in the dashboard (set in the sidebar); nothing else is ever queried
  emailOn: true,
  recipients: '',
  alertMode: 'all',      // 'all' = email every run while anything is open; 'new' = only when something new breaks
  allClear: true,        // email "all clear" too, so a missing email means the check itself stopped
  fromName: 'Tracking Monitor',
  redDrop: 50,           // % drop vs normal that turns a row red
  amberDrop: 30,         // % drop that turns a row amber
  minWeeklySessions: 20, // ignore % drops on properties smaller than this (too noisy)
  minWeeklyImpressions: 50,
  gapDays: 2,            // days with zero data in the last 7 that count as "gaps"…
  gapMinDaily: 5,        // …but only for properties that normally get this many sessions a day
  ratioCheck: true,      // compare GA4 sessions with Google search clicks for the same site
  ratioMinClicks: 20,
  ratioPct: 50,          // red if GA4 sessions < 50% of search clicks in the same week
  tagCheck: true,        // look for the Measurement ID in the homepage code / GTM container
  newMonitorDefault: 'Yes'
};

const CODES = {
  NO_ACCESS:      { sev: 'red',   label: '🔴 No access' },
  REMOVED:        { sev: 'red',   label: '🔴 Access removed' },
  NO_STREAM:      { sev: 'red',   label: '🔴 Not collecting' },
  NO_DATA:        { sev: 'red',   label: '🔴 Not tracking' },
  NO_DATA_EVER:   { sev: 'red',   label: '🔴 No data (5 wks)' },
  NO_DATA_LIVE:   { sev: 'red',   label: '🔴 Not tracking' },
  DROP:           { sev: 'red',   label: '🔴 Tracking drop' },
  UNDER_TRACKING: { sev: 'red',   label: '🔴 Under-tracking' },
  REAL_DROP:      { sev: 'amber', label: '🟠 Traffic drop' },
  GAPS:           { sev: 'amber', label: '🟠 Data gaps' },
  SOFT_DROP:      { sev: 'amber', label: '🟠 Dropping' },
  WRONG_TAG:      { sev: 'amber', label: '🟠 Different tag' },
  TAG_MISSING:    { sev: 'amber', label: '🟠 Tag not found' },
  SITE_DOWN:      { sev: 'amber', label: '🟠 Website error' },
  CHECK_FAILED:   { sev: 'amber', label: '🟠 Check failed' },
  DUPLICATE:      { sev: 'green', label: '⚪ Alternate version' },
  OK:             { sev: 'green', label: '🟢 OK' }
};
const GSC_LABELS = { NO_DATA: '🔴 No impressions', DROP: '🔴 Impressions drop' };
const GA_LABELS = { DUPLICATE: '⚪ Duplicate property' };
const DORMANT_CODES = ['NO_DATA_EVER', 'NO_STREAM']; // no data and no sign of a live site: listed compactly in emails
const MIN_TRACKED_SESSIONS = 5;      // a property below this many sessions/week was never really "tracking"
const MIN_TRACKED_IMPRESSIONS = 10;
const STICKY_CODES = ['DROP', 'NO_DATA', 'UNDER_TRACKING'];

const GA_COLS = [
  { k: 'status', h: 'Status', w: 150, n: 'Red = fix now. Amber = check soon. Green = fine. Grey = not monitored (Monitor? = No).' },
  { k: 'property', h: 'GA4 property', w: 220 },
  { k: 'website', h: 'Website', w: 200, n: 'From the property\'s web data stream(s).' },
  { k: 'issue', h: 'What to check', w: 380, wrap: true },
  { k: 's7', h: 'Sessions (last 7 days)', w: 100, f: '#,##0', n: 'Sessions in the last 7 complete days (ending yesterday).' },
  { k: 'base', h: 'Weekly avg (prior 4 wks)', w: 100, f: '#,##0', n: 'Average sessions per week in the 4 weeks before that.' },
  { k: 'change', h: 'Change', w: 75, f: '+0%;-0%;0%', n: 'Last 7 days vs normal. During an open problem this compares with "Normal weekly level".' },
  { k: 'zero', h: 'Days with no data (last 7)', w: 95, f: '0' },
  { k: 'lastData', h: 'Last day with data', w: 105, f: 'yyyy-mm-dd' },
  { k: 'tag', h: 'Tag on website', w: 210, n: 'Looks for this property\'s Measurement ID in the homepage code, directly or inside its Google Tag Manager container.' },
  { k: 'gsc', h: 'Search Console (same site)', w: 200, n: 'Google search clicks for the same website (7 days, ~3 days behind). Steady clicks + falling GA4 sessions = tracking fault, not a real traffic drop.' },
  { k: 'since', h: 'Problem since', w: 100, f: 'yyyy-mm-dd' },
  { k: 'monitor', h: 'Monitor?', w: 80, n: 'Yes = include in alerts. No = keep listing it but never alert (old, test or duplicate properties).' },
  { k: 'notes', h: 'Team notes', w: 220, wrap: true, n: 'Free text for the team. The script never overwrites this column.' },
  { k: 'account', h: 'GA4 account', w: 170 },
  { k: 'pid', h: 'Property ID', w: 145 },
  { k: 'mid', h: 'Measurement ID', w: 125 },
  { k: 'normal', h: 'Normal weekly level', w: 100, f: '#,##0', n: 'Weekly sessions when this property was last healthy. During a drop the script compares with this, so a long outage never becomes "the new normal". Clear or lower it if the lower level really is the new normal.' },
  { k: 'checked', h: 'Last checked', w: 130, f: 'dd mmm yyyy hh:mm' },
  { k: 'code', h: '_code', w: 60, hidden: true },
  { k: 'rank', h: '_rank', w: 60, hidden: true },
  { k: 'streamsAt', h: '_streams', w: 60, hidden: true }
];

const GSC_COLS = [
  { k: 'status', h: 'Status', w: 150, n: 'Red = fix now. Amber = check soon. Green = fine. Grey = not monitored (Monitor? = No).' },
  { k: 'site', h: 'Search Console property', w: 260 },
  { k: 'issue', h: 'What to check', w: 380, wrap: true },
  { k: 'clicks7', h: 'Clicks (last 7 days)', w: 95, f: '#,##0', n: '7 days ending 3 days ago (Search Console data runs ~2-3 days behind).' },
  { k: 'clicksChange', h: 'Clicks change', w: 80, f: '+0%;-0%;0%' },
  { k: 'impr7', h: 'Impressions (last 7 days)', w: 110, f: '#,##0' },
  { k: 'imprBase', h: 'Weekly avg impressions (prior 4 wks)', w: 120, f: '#,##0' },
  { k: 'imprChange', h: 'Impressions change', w: 95, f: '+0%;-0%;0%' },
  { k: 'position', h: 'Avg position', w: 80, f: '0.0' },
  { k: 'access', h: 'Access level', w: 140, n: '"Unverified" means the account is listed but site ownership verification is gone, so no data can be read.' },
  { k: 'since', h: 'Problem since', w: 100, f: 'yyyy-mm-dd' },
  { k: 'monitor', h: 'Monitor?', w: 80, n: 'Yes = include in alerts. No = keep listing it but never alert.' },
  { k: 'notes', h: 'Team notes', w: 220, wrap: true, n: 'Free text for the team. The script never overwrites this column.' },
  { k: 'normal', h: 'Normal weekly impressions', w: 110, f: '#,##0', n: 'Weekly impressions when this site was last healthy. Used during a drop so a long outage never becomes "normal".' },
  { k: 'checked', h: 'Last checked', w: 130, f: 'dd mmm yyyy hh:mm' },
  { k: 'code', h: '_code', w: 60, hidden: true },
  { k: 'rank', h: '_rank', w: 60, hidden: true }
];

const ISSUE_HEADERS = ['Severity', 'Source', 'Property / site', 'Website', 'What to check', 'Problem since', 'Days open', 'Last 7 days', 'Team notes'];
const LOG_HEADERS = ['Started', 'Finished', 'Run type', 'GA4 checked', 'Search Console checked', 'Red', 'Amber', 'New problems', 'Email', 'Notes'];

// ───────────────────────────── Menu & sidebar ─────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu(THM.MENU)
    .addItem('Open settings', 'thmOpenSidebar')
    .addItem('Run check now', 'thmRunFromMenu')
    .addSeparator()
    .addItem('Set up / repair tabs', 'thmSetupFromMenu')
    .addToUi();
  try { warnIfStale_(); } catch (e) { /* never block opening the sheet */ }
}

function thmOpenSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle(THM.MENU));
}

function thmRunFromMenu() {
  const ss = SpreadsheetApp.getActive();
  ss.toast('Checking every GA4 property and Search Console site. This can take a few minutes.', THM.MENU, 10);
  const r = runCheck_('Manual', { email: false });
  ss.toast(r.message, THM.MENU, 20);
}

function thmSetupFromMenu() {
  ensureSheets_();
  SpreadsheetApp.getActive().toast('Tabs are ready. Next: Tracking Monitor → Open settings.', THM.MENU, 8);
}

/** Everything the sidebar needs to draw itself. */
function thmGetState() {
  const me = me_();
  const url = getConnUrl_();
  const sch = getJson_('THM_SCHEDULE');
  let active = null;
  if (sch && sch.owner && sch.owner === me) active = myTriggers_('thmScheduledRun').length > 0;
  return {
    version: THM.VERSION,
    me: me,
    tz: Session.getScriptTimeZone(),
    config: getConfig_(),
    conn: { savedForMe: !!url, masked: url ? maskUrl_(url) : '', tokenSaved: !!getConnToken_(), tokenMasked: maskToken_(getConnToken_()), info: getJson_('THM_CONN') },
    schedule: sch ? Object.assign({}, sch, { mine: !!me && sch.owner === me, active: active }) : null,
    lastRun: getJson_('THM_LAST_RUN'),
    running: !!getRunState_()
  };
}

function thmSaveSettings(form) {
  form = form || {};
  // A token pasted into the URL box is still a token.
  if (form.url && /^sk_/i.test(String(form.url).trim()) && !form.token) { form.token = form.url; form.url = ''; }
  const up = PropertiesService.getUserProperties();
  if (form.url) {
    const url = String(form.url).trim();
    if (!/^https:\/\/\S+$/i.test(url)) throw new Error('The connection URL should be the full https:// address of the dashboard endpoint (…/mcp).');
    up.setProperty('THM_URL', url);
  }
  if (form.token) {
    const token = String(form.token).trim().replace(/^Bearer\s+/i, '');
    if (/\s/.test(token) || token.length < 10) throw new Error('That API token doesn\'t look right. Paste the whole token (it starts with sk_).');
    up.setProperty('THM_TOKEN', token);
  }
  if (form.url || form.token) setJson_('THM_CONN', { owner: me_(), savedAt: Date.now(), host: hostOf_(getConnUrl_()) });
  const c = getConfig_();
  const n = (v, d, lo, hi) => {
    if (v === '' || v == null) return d;
    v = Number(v);
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  const has = k => Object.prototype.hasOwnProperty.call(form, k);
  const cfg = {
    account: has('account') && String(form.account).trim() ? String(form.account).trim() : c.account,
    emailOn: has('emailOn') ? !!form.emailOn : c.emailOn,
    recipients: has('recipients') ? parseEmails_(form.recipients).join(', ') : c.recipients,
    alertMode: has('alertMode') ? (form.alertMode === 'new' ? 'new' : 'all') : c.alertMode,
    allClear: has('allClear') ? !!form.allClear : c.allClear,
    fromName: has('fromName') && String(form.fromName).trim() ? String(form.fromName).trim().slice(0, 60) : c.fromName,
    redDrop: has('redDrop') ? n(form.redDrop, c.redDrop, 10, 95) : c.redDrop,
    amberDrop: has('amberDrop') ? n(form.amberDrop, c.amberDrop, 5, 90) : c.amberDrop,
    minWeeklySessions: has('minWeeklySessions') ? n(form.minWeeklySessions, c.minWeeklySessions, 0, 100000) : c.minWeeklySessions,
    minWeeklyImpressions: has('minWeeklyImpressions') ? n(form.minWeeklyImpressions, c.minWeeklyImpressions, 0, 1000000) : c.minWeeklyImpressions,
    gapDays: has('gapDays') ? n(form.gapDays, c.gapDays, 1, 7) : c.gapDays,
    gapMinDaily: has('gapMinDaily') ? n(form.gapMinDaily, c.gapMinDaily, 0, 100000) : c.gapMinDaily,
    ratioCheck: has('ratioCheck') ? !!form.ratioCheck : c.ratioCheck,
    ratioMinClicks: has('ratioMinClicks') ? n(form.ratioMinClicks, c.ratioMinClicks, 1, 100000) : c.ratioMinClicks,
    ratioPct: has('ratioPct') ? n(form.ratioPct, c.ratioPct, 5, 100) : c.ratioPct,
    tagCheck: has('tagCheck') ? !!form.tagCheck : c.tagCheck,
    newMonitorDefault: has('newMonitorDefault') ? (form.newMonitorDefault === 'No' ? 'No' : 'Yes') : c.newMonitorDefault
  };
  if (cfg.amberDrop >= cfg.redDrop) cfg.amberDrop = Math.max(5, cfg.redDrop - 10);
  setJson_('THM_CONFIG', cfg);
  return thmGetState();
}

function thmClearConnection() {
  PropertiesService.getUserProperties().deleteProperty('THM_URL');
  PropertiesService.getUserProperties().deleteProperty('THM_TOKEN');
  const info = getJson_('THM_CONN');
  if (info && info.owner === me_()) PropertiesService.getDocumentProperties().deleteProperty('THM_CONN');
  return thmGetState();
}

function thmTestConnection() {
  const url = getConnUrl_();
  if (!url) throw new Error('No connection is saved for your account yet. Paste the URL and save.');
  const cfg = getConfig_();
  if (!cfg.account) throw new Error('Enter the reporting account (the Google account connected in the dashboard) and save.');
  const found = discover_(new McpClient_(url, getConnToken_()), cfg);
  return 'Connected ✓  ' + cfg.account + ' can see ' + found.props.length + ' GA4 properties (in ' +
    found.gaAccounts + ' accounts) and ' + found.sites.length + ' Search Console sites.';
}

function thmSendTestEmail() {
  const cfg = getConfig_();
  const to = parseEmails_(cfg.recipients);
  if (!to.length) throw new Error('Add at least one email address and save first.');
  MailApp.sendEmail({
    to: to.join(','),
    subject: 'Test: GA4 & Search Console tracking alerts',
    name: cfg.fromName,
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px">This is a test from the tracking sheet <a href="' +
      SpreadsheetApp.getActive().getUrl() + '">' + esc_(SpreadsheetApp.getActive().getName()) +
      '</a>. Alerts for broken or disconnected GA4 / Search Console properties will arrive like this.</div>'
  });
  return 'Test email sent to ' + to.join(', ');
}

function thmSetSchedule(day, hour) {
  const me = me_();
  const sch = getJson_('THM_SCHEDULE');
  if (sch && sch.owner && me && sch.owner !== me) {
    throw new Error('The weekly check is already set up by ' + sch.owner + '. Ask them to turn it off first, so it does not run twice.');
  }
  if (!getConnUrl_()) throw new Error('Save the data connection first. The weekly check runs under your account and uses your saved connection.');
  day = String(day || '').toUpperCase();
  if (!ScriptApp.WeekDay[day]) throw new Error('Pick a day of the week.');
  hour = Math.max(0, Math.min(23, Math.floor(Number(hour) || 0)));
  deleteMyTriggers_('thmScheduledRun');
  ScriptApp.newTrigger('thmScheduledRun').timeBased().onWeekDay(ScriptApp.WeekDay[day]).atHour(hour).create();
  setJson_('THM_SCHEDULE', { day: day, hour: hour, owner: me, createdAt: Date.now(), tz: Session.getScriptTimeZone() });
  return thmGetState();
}

function thmRemoveSchedule() {
  const me = me_();
  const sch = getJson_('THM_SCHEDULE');
  if (sch && sch.owner && me && sch.owner !== me) {
    throw new Error('Only ' + sch.owner + ' can turn this schedule off (Google ties schedules to the person who created them).');
  }
  deleteMyTriggers_('thmScheduledRun');
  PropertiesService.getDocumentProperties().deleteProperty('THM_SCHEDULE');
  return thmGetState();
}

/** Manual runs only email when asked to, so testing never spams the team. Scheduled runs always follow the email settings. */
function thmRunNow(sendEmail) {
  return runCheck_('Manual', { email: !!sendEmail });
}

function thmSetup() {
  ensureSheets_();
  return 'Tabs are ready.';
}

// ───────────────────────────── Triggers ─────────────────────────────

function thmScheduledRun() {
  runCheck_('Schedule');
}

function thmContinueRun() {
  deleteMyTriggers_('thmContinueRun');
  const r = runCheck_('Continue');
  if (r.busy) scheduleContinuation_();
}

// ───────────────────────────── Run engine ─────────────────────────────

function runCheck_(trigger, opts) {
  opts = opts || {};
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return { ok: false, busy: true, message: 'Another check is running right now. Try again in a few minutes.' };
  let state = null;
  try {
    const cfg = getConfig_();
    const url = getConnUrl_();
    if (!url) {
      throw userErr_('The data connection is not saved for ' + (me_() || 'this account') +
        '. Open Tracking Monitor → Open settings and save it (it is stored privately for the person who runs the check).');
    }
    if (!cfg.account) throw userErr_('Set the reporting account (e.g. reports@yourdomain.com) in Tracking Monitor → Open settings.');
    const deadline = Date.now() + THM.SLICE_MS;
    const client = new McpClient_(url, getConnToken_());
    state = getRunState_();
    if (state && Date.now() - state.startedAt > THM.STALE_RUN_MS) { clearRunState_(); state = null; }
    if (!state && trigger === 'Continue') return { ok: true, message: 'Nothing left to continue.' };
    if (!state) state = startRun_(client, cfg, trigger, trigger !== 'Manual' || !!opts.email);
    return advance_(client, cfg, state, deadline);
  } catch (e) {
    handleFailure_(e, state, trigger);
    return { ok: false, message: (e && e.message) || String(e) };
  } finally {
    lock.releaseLock();
  }
}

function startRun_(client, cfg, trigger, email) {
  const sheets = ensureSheets_();
  const state = {
    id: Utilities.getUuid(),
    startedAt: Math.floor(Date.now() / 1000) * 1000 - 1000, // rows stamped before this still need checking this run
    runDate: today_(),
    trigger: trigger,
    email: email,
    phase: 'gsc',
    firstRun: !getJson_('THM_LAST_RUN'),
    stats: { newGa: 0, newGsc: 0, removed: 0, failed: 0, checkedGa: 0, checkedGsc: 0 }
  };
  const found = discover_(client, cfg);
  syncGa_(sheets.ga, found.props, state, cfg);
  syncGsc_(sheets.gsc, found.sites, state, cfg);
  saveRunState_(state);
  return state;
}

function advance_(client, cfg, state, deadline) {
  const steps = { gsc: phaseGsc_, streams: phaseStreams_, ga: phaseGa_ };
  const next = { gsc: 'streams', streams: 'ga', ga: 'finalize' };
  while (state.phase !== 'finalize') {
    const done = steps[state.phase](client, state, cfg, deadline);
    if (!done) {
      saveRunState_(state);
      scheduleContinuation_();
      return { ok: true, partial: true, message: 'Checked part of the list. The rest continues automatically in about a minute.' };
    }
    state.phase = next[state.phase];
    saveRunState_(state);
  }
  const summary = finalize_(state, cfg);
  clearRunState_();
  return { ok: true, message: summary };
}

function scheduleContinuation_() {
  deleteMyTriggers_('thmContinueRun');
  ScriptApp.newTrigger('thmContinueRun').timeBased().after(60 * 1000).create();
}

function handleFailure_(e, state, trigger) {
  const msg = (e && e.message) || String(e);
  const runType = (state && state.trigger) || trigger;
  try {
    appendLog_([state ? new Date(state.startedAt) : new Date(), new Date(), runType, '', '', '', '', '',
      '', (e && e.isConnection ? 'Connection problem: ' : 'Stopped: ') + msg]);
  } catch (x) { /* log tab may be missing */ }
  clearRunState_();
  deleteMyTriggers_('thmContinueRun');
  // A person who clicked "Run check now" sees the message. Unattended runs must never fail silently.
  if (runType === 'Manual' && !(state && state.email)) return;
  const cfg = getConfig_();
  const to = parseEmails_(cfg.recipients);
  if (!to.length) return;
  try {
    MailApp.sendEmail({
      to: to.join(','),
      subject: '⚠ Tracking check could not run: ' + prettyDate_(today_()),
      name: cfg.fromName,
      htmlBody: failureHtml_(msg, e && e.isConnection, cfg)
    });
  } catch (x) { /* email quota or permissions */ }
}

// ───────────────────────────── Discovery ─────────────────────────────

function discover_(client, cfg) {
  const res = client.callMany([
    { name: 'list_ga_properties', args: { account: cfg.account } },
    { name: 'list_gsc_sites', args: { account: cfg.account } }
  ]);
  const ga = res[0], gsc = res[1];
  if (!ga.ok) throw connErr_('Could not list GA4 properties for ' + cfg.account + ': ' + ga.error);
  if (!gsc.ok) throw connErr_('Could not list Search Console sites for ' + cfg.account + ': ' + gsc.error);
  [ga, gsc].forEach(r => {
    const email = r.data && r.data.email;
    if (email && /@/.test(cfg.account) && String(email).toLowerCase() !== cfg.account.toLowerCase()) {
      throw connErr_('The connection answered for ' + email + ' instead of ' + cfg.account + '. Check the reporting account in settings.');
    }
  });
  const props = [];
  const accounts = Array.isArray(ga.data) ? ga.data : ((ga.data && ga.data.ga_accounts) || []);
  accounts.forEach(a => (a.properties || []).forEach(p => {
    if (p && p.property_id) props.push({ account: a.account || '', pid: String(p.property_id), name: p.name || p.property_id });
  }));
  const siteList = Array.isArray(gsc.data) ? gsc.data : ((gsc.data && gsc.data.sites) || []);
  const sites = siteList.filter(s => s && s.site_url)
    .map(s => ({ site: String(s.site_url), access: accessLabel_(s.permission_level) }));
  return { props: props, sites: sites, gaAccounts: accounts.length };
}

function syncGa_(sh, props, state, cfg) {
  const t = readTable_(sh, GA_COLS);
  const byId = {};
  t.rows.forEach(r => { if (r.pid) byId[r.pid] = r; });
  const seen = {};
  props.forEach(p => {
    let r = byId[p.pid];
    if (!r) {
      r = newRow_(t);
      r.pid = p.pid;
      r.monitor = defaultMonitor_(p.name, cfg);
      r.status = '🆕 New';
      byId[p.pid] = r;
      state.stats.newGa++;
    }
    r.property = p.name;
    r.account = p.account;
    seen[p.pid] = true;
  });
  markMissing_(t, r => r.pid, seen, 'ga', state,
    cfg.account + ' can no longer see this property: access was removed or the property was deleted. Ask the client to re-add ' +
    cfg.account + ' as a Viewer (GA4 Admin → Property access management).', 'GA4 properties',
    { s7: '', change: '', zero: '', tag: '—', gsc: '—' });
  writeTable_(t);
}

function syncGsc_(sh, sites, state, cfg) {
  const t = readTable_(sh, GSC_COLS);
  const bySite = {};
  t.rows.forEach(r => { if (r.site) bySite[r.site] = r; });
  const seen = {};
  sites.forEach(s => {
    let r = bySite[s.site];
    if (!r) {
      r = newRow_(t);
      r.site = s.site;
      r.monitor = cfg.newMonitorDefault || 'Yes';
      r.status = '🆕 New';
      bySite[s.site] = r;
      state.stats.newGsc++;
    }
    r.access = s.access;
    seen[s.site] = true;
  });
  markMissing_(t, r => r.site, seen, 'gsc', state,
    cfg.account + ' is no longer a user on this Search Console property. Ask the site owner to re-add ' + cfg.account +
    ' (Search Console → Settings → Users and permissions).', 'Search Console sites',
    { clicks7: '', clicksChange: '', impr7: '', imprChange: '', position: '' });
  writeTable_(t);
}

/** Rows that are no longer returned by the account = access removed. Refuses to mass-flag (that's a connection problem). */
function markMissing_(t, keyOf, seen, source, state, issue, what, blank) {
  const notSeen = t.rows.filter(r => keyOf(r) && !seen[keyOf(r)]);
  const newlyMissing = notSeen.filter(r => r.code !== 'REMOVED');
  const active = t.rows.filter(r => keyOf(r) && r.code !== 'REMOVED' && !r._isNew).length;
  if (active >= 5 && newlyMissing.length > active / 2) {
    throw connErr_(newlyMissing.length + ' of ' + active + ' ' + what + ' disappeared at once. That looks like a problem with the ' +
      'reporting account\'s connection rather than real access changes, so nothing was marked. Check the account in the reporting dashboard.');
  }
  notSeen.forEach(r => {
    applyResult_(r, source, Object.assign({}, blank, { code: 'REMOVED', issue: issue }), state);
    if (newlyMissing.indexOf(r) >= 0) state.stats.removed++;
  });
}

// ───────────────────────────── Search Console checks ─────────────────────────────

function phaseGsc_(client, state, cfg, deadline) {
  const t = readTable_(sheet_(THM.SHEETS.gsc), GSC_COLS);
  const d = windows_(state.runDate);
  const pending = t.rows.filter(r => r.site && checkedMs_(r) < state.startedAt);
  for (let i = 0; i < pending.length; i += THM.BATCH_GSC) {
    if (i > 0 && Date.now() > deadline) { writeTable_(t); return false; } // always finish at least one batch per run
    const batch = pending.slice(i, i + THM.BATCH_GSC);
    const live = batch.filter(r => !isUnverified_(r.access));
    const calls = [];
    live.forEach(r => {
      calls.push({ name: 'get_gsc_overview', args: { account: cfg.account, site_url: r.site, start_date: d.gscStart, end_date: d.gscEnd } });
      calls.push({ name: 'get_gsc_overview', args: { account: cfg.account, site_url: r.site, start_date: d.gscBaseStart, end_date: d.gscBaseEnd } });
    });
    const res = calls.length ? client.callMany(calls) : [];
    batch.forEach(r => {
      const k = live.indexOf(r);
      const out = k < 0 ? gscUnverified_(cfg) : evaluateGsc_(r, res[2 * k], res[2 * k + 1], cfg);
      if (out.code === 'CHECK_FAILED') state.stats.failed++;
      applyResult_(r, 'gsc', out, state);
      state.stats.checkedGsc++;
    });
    writeTable_(t);
  }
  markGscDuplicates_(t, state);
  writeTable_(t);
  return true;
}

function gscUnverified_(cfg) {
  return {
    code: 'NO_ACCESS', clicks7: '', clicksChange: '', impr7: '', imprBase: '', imprChange: '', position: '',
    issue: cfg.account + ' is listed on this property but as "unverified", so no data can be read (ownership verification was lost or the ' +
      'owner left). Ask the site owner to re-verify the property or re-add ' + cfg.account + ' as a Full user.'
  };
}

function evaluateGsc_(r, cur, base, cfg) {
  const bad = !cur.ok ? cur : (!base.ok ? base : null);
  const empty = { clicks7: '', clicksChange: '', impr7: '', imprBase: '', imprChange: '', position: '' };
  if (bad) {
    if (bad.kind === 'access') {
      return Object.assign(empty, { code: 'NO_ACCESS', issue: cfg.account + ' can\'t read this Search Console property (' + bad.error +
        '). Ask the site owner to re-add ' + cfg.account + ' (Search Console → Settings → Users and permissions).' });
    }
    return Object.assign(empty, { code: 'CHECK_FAILED', issue: 'Couldn\'t read Search Console data this run (' + bad.error + '). It will be retried next run.' });
  }
  const c = cur.data || {}, b = base.data || {};
  const clicks7 = num_(c.clicks), impr7 = num_(c.impressions);
  const clicksBase = num_(b.clicks) / 4, imprBase = num_(b.impressions) / 4;
  const normal = num_(r.normal);
  const sticky = (r.code === 'DROP' || r.code === 'NO_DATA') && normal > 0;
  const ref = sticky ? normal : imprBase;
  const imprChange = ref > 0 ? impr7 / ref - 1 : '';
  const out = {
    clicks7: clicks7, clicksChange: clicksBase > 0 ? clicks7 / clicksBase - 1 : '', impr7: impr7,
    imprBase: Math.round(imprBase), imprChange: imprChange,
    position: impr7 > 0 && c.avg_position != null && c.avg_position !== '' ? Number(c.avg_position) : ''
  };
  const red = cfg.redDrop / 100, amber = cfg.amberDrop / 100;
  const fix = ' Check the site can still be indexed: no "noindex" tags, robots.txt not blocking, sitemap submitted, redirects correct, ' +
    'no manual actions. This happens most often after a redesign or migration.';
  if (impr7 === 0 && imprBase < MIN_TRACKED_IMPRESSIONS && !sticky) {
    out.code = 'NO_DATA_EVER';
    out.issue = (imprBase > 0 ? 'Almost no search impressions in the last 5 weeks (' + fmtN_(imprBase * 4) + ' in total).' : 'No search impressions at all in the last 5 weeks.') +
      ' If this site is live, Google isn\'t showing it.' + fix + ' If this property is unused, set Monitor? = No.';
  } else if (impr7 === 0) {
    out.code = 'NO_DATA';
    out.issue = '0 impressions in the last 7 days (normally ~' + fmtN_(ref) + '/week).' + fix;
  } else if (ref >= cfg.minWeeklyImpressions && imprChange <= -red) {
    out.code = 'DROP';
    out.issue = 'Impressions down ' + pctAbs_(imprChange) + ' vs ' + (sticky ? 'normal' : 'the previous 4 weeks') +
      ' (' + fmtN_(ref) + '/week → ' + fmtN_(impr7) + ').' + fix;
  } else if (ref >= cfg.minWeeklyImpressions && imprChange <= -amber) {
    out.code = 'SOFT_DROP';
    out.issue = 'Impressions down ' + pctAbs_(imprChange) + ' vs ' + (sticky ? 'normal' : 'the previous 4 weeks') + '. Keep an eye on it.';
  } else {
    out.code = 'OK';
    out.issue = '';
  }
  if (out.code === 'OK') { if (imprBase > 0) out.normal = Math.round(imprBase); }
  else if (!normal && imprBase > 0) out.normal = Math.round(imprBase);
  return out;
}

/** http/https/www versions of the same site: an empty one is fine if a sibling has data. */
function markGscDuplicates_(t, state) {
  const withData = t.rows.filter(r => r.site && num_(r.impr7) > 0);
  t.rows.forEach(r => {
    if (r.code !== 'NO_DATA_EVER' && r.code !== 'NO_DATA') return;
    const base = gscBase_(r.site);
    const sib = withData.filter(o => o !== r && gscBase_(o.site) === base)[0];
    if (sib) {
      applyResult_(r, 'gsc', {
        code: 'DUPLICATE',
        issue: 'No data here, but ' + sib.site + ' (same website) has data, so this is just an unused version of the site (http/https/www). ' +
          'Nothing to fix; you can set Monitor? = No.'
      }, state);
    }
  });
}

// ───────────────────────────── GA4 checks ─────────────────────────────

function phaseStreams_(client, state, cfg, deadline) {
  const t = readTable_(sheet_(THM.SHEETS.ga), GA_COLS);
  if (!state.streamQueue) {
    state.streamQueue = t.rows.filter(r => r.pid && r.code !== 'REMOVED' && needsStreams_(r, state.runDate)).map(r => r.pid);
    saveRunState_(state);
  }
  const byId = {};
  t.rows.forEach(r => { if (r.pid) byId[r.pid] = r; });
  let first = true;
  while (state.streamQueue.length) {
    if (!first && Date.now() > deadline) { writeTable_(t); return false; }
    first = false;
    const ids = state.streamQueue.slice(0, THM.BATCH_STREAMS);
    const res = client.callMany(ids.map(pid => ({ name: 'list_data_streams', args: { account: cfg.account, property_id: pid } })));
    ids.forEach((pid, k) => { if (byId[pid]) applyStreams_(byId[pid], res[k], state.runDate); });
    state.streamQueue = state.streamQueue.slice(ids.length);
    writeTable_(t);
    saveRunState_(state);
  }
  return true;
}

function needsStreams_(r, runDate) {
  const at = toYmd_(r.streamsAt);
  return !at || daysBetween_(at, runDate) >= 28; // refresh the website / Measurement ID about once a month
}

function applyStreams_(r, res, runDate) {
  if (!res || !res.ok) return; // an access problem will show up in the report check
  const list = (res.data && res.data.data_streams) || [];
  const web = list.filter(s => String(s.type || '').indexOf('WEB') >= 0);
  if (web.length) {
    r.website = web.map(s => s.default_uri || '').filter(String).join(', ') || '(web stream, no URL)';
    r.mid = web.map(s => s.measurement_id || '').filter(String).join(', ');
  } else if (list.length) {
    r.website = '(app only)';
    r.mid = '';
  } else {
    r.website = '(no data stream)';
    r.mid = '';
  }
  r.streamsAt = runDate;
}

function phaseGa_(client, state, cfg, deadline) {
  const t = readTable_(sheet_(THM.SHEETS.ga), GA_COLS);
  const d = windows_(state.runDate);
  const gscIdx = buildGscIndex_();
  const hostCounts = {};
  t.rows.forEach(r => {
    if (!r.pid || !isMonitored_(r) || ['REMOVED', 'NO_ACCESS', 'NO_DATA_EVER', 'NO_STREAM', 'DUPLICATE'].indexOf(r.code) >= 0) return;
    const h = siteBase_(firstUrl_(r.website));
    if (h) hostCounts[h] = (hostCounts[h] || 0) + 1;
  });
  const pending = t.rows.filter(r => r.pid && checkedMs_(r) < state.startedAt);
  const cache = { html: {}, js: {} };
  for (let i = 0; i < pending.length; i += THM.BATCH_GA) {
    if (i > 0 && Date.now() > deadline) { writeTable_(t); return false; }
    const batch = pending.slice(i, i + THM.BATCH_GA);
    const res = client.callMany(batch.map(r => ({
      name: 'get_ga_report',
      args: { account: cfg.account, property_id: r.pid, start_date: d.gaBaseStart, end_date: d.gaEnd, dimensions: 'date', limit: 60 }
    })));
    const tags = cfg.tagCheck ? checkTags_(batch.filter((r, k) => res[k].ok), cache) : {};
    batch.forEach((r, k) => {
      const url = firstUrl_(r.website);
      const host = siteBase_(url);
      const gsc = url ? matchGsc_(url, gscIdx) : null;
      const unique = !!host && hostCounts[host] === 1 && isRootUrl_(url);
      const out = evaluateGa_(r, res[k], tags[r.pid] || null, gsc, { unique: unique }, cfg, d);
      if (out.code === 'CHECK_FAILED') state.stats.failed++;
      applyResult_(r, 'ga', out, state);
      state.stats.checkedGa++;
    });
    writeTable_(t);
  }
  markGaDuplicates_(t, state);
  writeTable_(t);
  return true;
}

/** An empty GA4 property whose website reports into another property is an old/duplicate one, not a fault. */
function markGaDuplicates_(t, state) {
  const live = t.rows.filter(r => r.pid && num_(r.s7) > 0 && siteBase_(firstUrl_(r.website)));
  t.rows.forEach(r => {
    if (r.code !== 'NO_DATA_EVER' && r.code !== 'NO_DATA_LIVE') return;
    const base = siteBase_(firstUrl_(r.website));
    if (!base) return;
    const sib = live.filter(o => o !== r && siteBase_(firstUrl_(o.website)) === base).sort((a, b) => num_(b.s7) - num_(a.s7))[0];
    if (sib) {
      applyResult_(r, 'ga', {
        code: 'DUPLICATE',
        issue: 'No data here, but "' + sib.property + '" (' + sib.pid + ') receives this website\'s data, so this looks like an old or duplicate property. ' +
          'Nothing to fix; you can set Monitor? = No.'
      }, state);
    }
  });
}

function evaluateGa_(r, rep, tag, gsc, opt, cfg, d) {
  const acct = cfg.account;
  const site = firstUrl_(r.website);
  const out = {
    s7: '', base: '', change: '', zero: '', lastData: '',
    tag: tag ? tag.text : (!cfg.tagCheck ? 'Check turned off' : (site && firstMid_(r.mid) ? 'Not checked this run' : '—')),
    gsc: gscText_(gsc)
  };
  if (!rep.ok) {
    if (rep.kind === 'access') {
      return Object.assign(out, { code: 'NO_ACCESS', issue: acct + ' can\'t read this property any more. Ask the client to re-add ' + acct +
        ' as a Viewer (GA4 Admin → Property access management).' });
    }
    if (rep.kind === 'notfound') {
      return Object.assign(out, { code: 'REMOVED', issue: 'Property not found: it may have been deleted. Confirm with the client which GA4 property the site uses now.' });
    }
    return Object.assign(out, { code: 'CHECK_FAILED', issue: 'Couldn\'t read GA4 data this run (' + rep.error + '). It will be retried next run.' });
  }
  const daily = dailyMap_(rep.data);
  const s7 = sumDays_(daily, d.gaStart, d.gaEnd);
  const base28 = sumDays_(daily, d.gaBaseStart, d.gaBaseEnd);
  const rolling = base28 / 4;
  let zero = 0;
  eachDay_(d.gaStart, d.gaEnd, day => { if (!daily[day]) zero++; });
  const lastData = Object.keys(daily).filter(k => daily[k] > 0).sort().pop() || '';
  const normal = num_(r.normal);
  const sticky = STICKY_CODES.indexOf(r.code) >= 0 && normal > 0;
  const ref = sticky ? normal : rolling;
  const change = ref > 0 ? s7 / ref - 1 : null;
  const gaInGscWindow = sumDays_(daily, d.gscStart, d.gscEnd);
  Object.assign(out, { s7: s7, base: Math.round(rolling), change: change === null ? '' : change, zero: zero, lastData: lastData || 'None in 5 wks' });

  const red = cfg.redDrop / 100, amber = cfg.amberDrop / 100;
  const mid = firstMid_(r.mid) || 'the GA4 tag';
  const tagNote = tagNote_(tag, mid);
  const gscNote = gscNote_(gsc);
  let code = 'OK', issue = '';

  const searchClicks = gsc && gsc.clicks7 !== '' ? num_(gsc.clicks7) : 0;
  const hardlyAny = base28 > 0 ? 'Almost no sessions in the last 5 weeks (' + fmtN_(base28) + ' in total)' : 'No sessions at all in the last 5 weeks';
  if (s7 === 0 && rolling < MIN_TRACKED_SESSIONS && !sticky) {
    if (r.website === '(no data stream)') {
      code = 'NO_STREAM';
      issue = 'This property has no data stream, so it can\'t collect website data. If a site should report here, create a web stream and install its tag. If it\'s unused, set Monitor? = No.';
    } else if (searchClicks >= 10) {
      code = 'NO_DATA_LIVE';
      issue = hardlyAny + ', but Google search sent ' + fmtN_(searchClicks) + ' clicks to this site last week, so the site is live and GA4 isn\'t recording it.' +
        tagNote + ' If the client now uses a different GA4 property, set Monitor? = No here.';
    } else {
      code = 'NO_DATA_EVER';
      issue = hardlyAny + '. If this website is live, the GA4 tag is missing or broken.' + tagNote +
        ' If this is an old, test or duplicate property, set Monitor? = No.';
    }
  } else if (s7 === 0) {
    code = 'NO_DATA';
    issue = 'Tracking has stopped: 0 sessions in the last 7 days (normally ~' + fmtN_(ref) + '/week). Last data: ' +
      (lastData ? prettyDate_(lastData) : 'more than 5 weeks ago') + '.' + tagNote + gscNote +
      ' Check whether the site was recently changed, migrated or redesigned.';
  } else if (ref >= cfg.minWeeklySessions && change <= -red) {
    const gscBase = gsc && gsc.clicksChange !== '' ? num_(gsc.clicks7) / (1 + Number(gsc.clicksChange)) : 0;
    const realDrop = !sticky && gsc && gsc.clicksChange !== '' && gscBase >= 10 && gsc.clicksChange <= -0.25 && gsc.clicksChange <= change + 0.25;
    if (realDrop) {
      code = 'REAL_DROP';
      issue = 'Sessions down ' + pctAbs_(change) + ' (' + fmtN_(ref) + '/week → ' + fmtN_(s7) + '), and Google search clicks fell too (' +
        fmtPct_(gsc.clicksChange) + '). Looks like a real traffic drop rather than a tracking fault. Worth an SEO review.';
    } else {
      code = 'DROP';
      issue = 'Sessions down ' + pctAbs_(change) + ' vs normal (' + fmtN_(ref) + '/week → ' + fmtN_(s7) + '). Tracking is probably broken on some or all pages.' +
        gscNote + tagNote + ' Check for a recent migration, redesign or consent-banner change.';
    }
  } else if (cfg.ratioCheck && opt.unique && gsc && gsc.clicks7 !== '' && num_(gsc.clicks7) >= cfg.ratioMinClicks &&
             gaInGscWindow < (cfg.ratioPct / 100) * num_(gsc.clicks7)) {
    code = 'UNDER_TRACKING';
    issue = 'GA4 recorded only ' + fmtN_(gaInGscWindow) + ' sessions in a week when Google search alone sent ' + fmtN_(gsc.clicks7) +
      ' clicks. GA4 should be higher, because search is only part of the traffic. The tag is probably missing on some pages or being blocked.' + tagNote;
  } else if (zero >= cfg.gapDays && rolling / 7 >= cfg.gapMinDaily) {
    code = 'GAPS';
    issue = zero + ' of the last 7 days have no data at all (normally ~' + fmtN_(rolling / 7) + ' sessions/day). Tracking may be switching on and off.' + tagNote;
  } else if (ref >= cfg.minWeeklySessions && change <= -amber) {
    code = 'SOFT_DROP';
    issue = 'Sessions down ' + pctAbs_(change) + ' vs ' + (sticky ? 'normal' : 'the previous 4 weeks') + ' (' + fmtN_(ref) + '/week → ' + fmtN_(s7) +
      '). Keep an eye on it.' + gscNote;
  } else if (tag && tag.state === 'other') {
    code = 'WRONG_TAG';
    issue = 'Data is still arriving, but the homepage has ' + tag.others.join(', ') + ' instead of ' + mid +
      '. The site may be sending data to a different GA4 property. Confirm which one the client uses.';
  } else if (tag && (tag.state === 'missing' || tag.state === 'container_missing')) {
    code = 'TAG_MISSING';
    issue = 'Data is still arriving, but ' + mid + ' wasn\'t found in the homepage code' + (tag.state === 'container_missing' ? ' or its GTM container' : '') +
      '. It may be loaded another way. Confirm with Google Tag Assistant, especially if the site was rebuilt.';
  } else if (tag && tag.state === 'down') {
    code = 'SITE_DOWN';
    issue = 'Tracking looks fine, but the homepage check failed: ' + tag.detail + '.';
  }
  if (code === 'OK') { if (rolling > 0) out.normal = Math.round(rolling); }
  else if (!normal && rolling > 0) out.normal = Math.round(rolling);
  out.code = code;
  out.issue = issue;
  return out;
}

function tagNote_(tag, mid) {
  if (!tag) return '';
  switch (tag.state) {
    case 'missing': return ' The tag (' + mid + ') was NOT found on the homepage, so it has probably been removed.';
    case 'other': return ' The homepage has a different GA4 tag (' + tag.others.join(', ') + '), not ' + mid + '.';
    case 'container_missing': return ' The GTM container on the site does not load ' + mid + '.';
    case 'found': return ' The tag is still on the homepage, so check other pages, GTM triggers or the cookie/consent banner.';
    case 'down': return ' The homepage check also failed (' + tag.detail + ').';
    default: return '';
  }
}

function gscNote_(gsc) {
  if (!gsc || gsc.clicksChange === '' || gsc.clicks7 === '') return '';
  return Number(gsc.clicksChange) > -0.2
    ? ' Google search clicks for this site are steady (' + fmtPct_(gsc.clicksChange) + '), so visitors are still arriving and GA4 just isn\'t recording them.'
    : ' Google search clicks are also down ' + pctAbs_(gsc.clicksChange) + '.';
}

function gscText_(gsc) {
  if (!gsc) return 'No matching Search Console site';
  if (gsc.code === 'NO_ACCESS' || gsc.code === 'REMOVED') return 'No access · ' + shortSite_(gsc.site);
  if (gsc.clicks7 === '') return '— · ' + shortSite_(gsc.site);
  return 'Clicks ' + fmtN_(gsc.clicks7) + (gsc.clicksChange !== '' ? ' (' + fmtPct_(gsc.clicksChange) + ')' : '') + ' · ' + shortSite_(gsc.site);
}

function buildGscIndex_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(THM.SHEETS.gsc);
  if (!sh) return [];
  return readTable_(sh, GSC_COLS).rows.filter(r => r.site).map(r => {
    const site = String(r.site);
    const isDomain = /^sc-domain:/i.test(site);
    const host = isDomain ? site.replace(/^sc-domain:/i, '').toLowerCase() : hostOf_(site);
    return {
      site: site, type: isDomain ? 'domain' : 'url', host: host, base: host.replace(/^www\./, ''),
      clicks7: r.clicks7 === '' || r.clicks7 == null ? '' : num_(r.clicks7),
      clicksChange: r.clicksChange === '' || r.clicksChange == null ? '' : Number(r.clicksChange),
      code: r.code
    };
  });
}

function matchGsc_(url, idx) {
  const host = hostOf_(url);
  if (!host) return null;
  const base = host.replace(/^www\./, '');
  const tiers = [
    idx.filter(e => e.type === 'url' && e.base === base), // http/https/www versions of the same site: the one with the clicks wins
    idx.filter(e => e.type === 'domain' && (base === e.base || base.slice(-(e.base.length + 1)) === '.' + e.base))
  ];
  let fallback = null;
  for (let i = 0; i < tiers.length; i++) {
    const usable = tiers[i].filter(e => e.clicks7 !== '').sort((a, b) => b.clicks7 - a.clicks7);
    if (usable.length) return usable[0];
    if (!fallback && tiers[i].length) fallback = tiers[i][0];
  }
  return fallback;
}

// ───────────────────────────── Website tag check ─────────────────────────────

const TAG_ORDER = { missing: 0, other: 1, container_missing: 2, down: 3, blocked: 4, found: 5 };

function checkTags_(rows, cache) {
  const items = [];
  rows.forEach(r => {
    const urls = String(r.website || '').split(/\s*,\s*/).filter(isHttpUrl_);
    const mids = String(r.mid || '').split(/\s*,\s*/).filter(m => /^G-/i.test(m));
    for (let k = 0; k < Math.min(urls.length, mids.length, 2); k++) items.push({ pid: r.pid, url: urls[k], mid: mids[k].toUpperCase() });
  });
  if (!items.length) return {};
  fetchInto_(uniq_(items.map(i => i.url)).filter(u => !(u in cache.html)).map(u => ({ key: u, url: u })), cache.html);
  const needJs = [];
  items.forEach(it => {
    const page = cache.html[it.url];
    it.ids = []; it.containers = [];
    if (!page || !page.ok) return;
    const html = page.body || '';
    it.ids = uniq_(html.match(/\bG-[A-Z0-9]{6,12}\b/g) || []);
    it.containers = uniq_(html.match(/\b(?:GTM|GT)-[A-Z0-9]{4,12}\b/g) || []).slice(0, 4);
    if (it.ids.indexOf(it.mid) < 0) it.containers.forEach(c => { if (!(c in cache.js)) needJs.push(c); });
  });
  fetchInto_(uniq_(needJs).map(c => ({
    key: c,
    url: /^GTM-/.test(c) ? 'https://www.googletagmanager.com/gtm.js?id=' + c : 'https://www.googletagmanager.com/gtag/js?id=' + c
  })), cache.js);
  const out = {};
  items.forEach(it => {
    const v = tagVerdict_(it, cache);
    if (!out[it.pid] || TAG_ORDER[v.state] < TAG_ORDER[out[it.pid].state]) out[it.pid] = v;
  });
  return out;
}

function tagVerdict_(it, cache) {
  const p = cache.html[it.url];
  if (!p || !p.ok) {
    const code = p ? p.code : 0;
    const blocked = code === 401 || code === 403 || code === 429 || (code === 503 && /cloudflare|captcha|challenge/i.test((p && p.body) || ''));
    if (blocked) return { state: 'blocked', text: 'Not checked: site blocks automated checks (HTTP ' + code + ')' };
    const detail = code ? 'homepage returned HTTP ' + code : 'homepage could not be reached' + (p && p.error ? ' (' + p.error + ')' : '');
    return { state: 'down', text: '⚠ ' + detail.charAt(0).toUpperCase() + detail.slice(1), detail: detail };
  }
  if (it.ids.indexOf(it.mid) >= 0) return { state: 'found', text: '✓ ' + it.mid + ' on homepage' };
  for (let i = 0; i < it.containers.length; i++) {
    const js = cache.js[it.containers[i]];
    if (js && js.ok && String(js.body || '').toUpperCase().indexOf(it.mid) >= 0) return { state: 'found', text: '✓ ' + it.mid + ' via ' + it.containers[i] };
  }
  if (it.containers.length) return { state: 'container_missing', text: '✗ ' + it.containers.join(', ') + ' on site, but it doesn\'t load ' + it.mid };
  const others = it.ids.filter(x => x !== it.mid).slice(0, 3);
  if (others.length) return { state: 'other', text: '✗ Site has ' + others.join(', ') + ', not ' + it.mid, others: others };
  return { state: 'missing', text: '✗ No Google tag found on homepage' };
}

function fetchInto_(list, store) {
  if (!list.length) return;
  const opts = { method: 'get', muteHttpExceptions: true, followRedirects: true };
  const reqs = list.map(x => Object.assign({ url: x.url }, opts));
  let resps = null;
  try { resps = UrlFetchApp.fetchAll(reqs); } catch (e) { resps = null; } // one bad host fails the whole batch → retry one by one
  list.forEach((x, k) => {
    let resp = resps ? resps[k] : null;
    if (!resp) {
      try { resp = UrlFetchApp.fetch(x.url, opts); } catch (e) { store[x.key] = { ok: false, code: 0, error: short_(e.message, 80) }; return; }
    }
    const code = resp.getResponseCode();
    let body = '';
    try { body = resp.getContentText(); } catch (e) { body = ''; }
    store[x.key] = { ok: code >= 200 && code < 300, code: code, body: body.length > 3000000 ? body.slice(0, 3000000) : body };
  });
}

// ───────────────────────────── Shared result handling ─────────────────────────────

function applyResult_(r, source, res, state) {
  const prev = r.code;
  Object.keys(res).forEach(k => { if (k !== 'code' && k !== 'issue') r[k] = res[k]; });
  r.code = res.code;
  r.issue = res.issue || '';
  if (isProblem_(res.code)) { if (!r.since || !isProblem_(prev)) r.since = state.runDate; }
  else r.since = '';
  r.status = isMonitored_(r) ? labelFor_(source, res.code) : '⚪ Not monitored';
  r.checked = new Date();
  r.rank = rankFor_(r, state);
}

function labelFor_(source, code) {
  if (source === 'gsc' && GSC_LABELS[code]) return GSC_LABELS[code];
  if (source === 'ga' && GA_LABELS[code]) return GA_LABELS[code];
  return (CODES[code] || CODES.OK).label;
}

function isProblem_(code) {
  const c = CODES[code];
  return !!c && (c.sev === 'red' || c.sev === 'amber');
}

function isMonitored_(r) {
  return String(r.monitor == null ? '' : r.monitor).trim().toLowerCase() !== 'no';
}

function sevOf_(r) {
  if (!isMonitored_(r)) return 'grey';
  return CODES[r.code] ? CODES[r.code].sev : 'none';
}

function rankFor_(r, state) {
  const sev = sevOf_(r);
  if (sev === 'red') return toYmd_(r.since) === state.runDate ? 0 : 1;
  return { amber: 2, green: 3, grey: 4 }[sev] || 5;
}

function colorFor_(r) {
  return THM.COLORS[sevOf_(r)] || THM.COLORS.none;
}

function defaultMonitor_(name, cfg) {
  if (/\b(old|test|testing|staging|dev|do not use|deprecated|backup|archive[d]?)\b/i.test(String(name))) return 'No';
  return cfg.newMonitorDefault || 'Yes';
}

// ───────────────────────────── Finish a run ─────────────────────────────

function finalize_(state, cfg) {
  const gaSh = sheet_(THM.SHEETS.ga), gscSh = sheet_(THM.SHEETS.gsc);
  sortTable_(gaSh, GA_COLS, ['rank', 'account', 'property']);
  sortTable_(gscSh, GSC_COLS, ['rank', 'site']);
  const ga = readTable_(gaSh, GA_COLS), gsc = readTable_(gscSh, GSC_COLS);
  const d = windows_(state.runDate);
  addHistory_(ga, state.runDate, 's7', 'Sessions in the 7 days ' + prettyRange_(d.gaStart, d.gaEnd));
  addHistory_(gsc, state.runDate, 'impr7', 'Search impressions in the 7 days ' + prettyRange_(d.gscStart, d.gscEnd));

  const issues = collectIssues_(ga, 'GA4', state).concat(collectIssues_(gsc, 'Search Console', state));
  const order = { red: 0, amber: 1 };
  issues.sort((a, b) => (a.dormant === b.dormant ? 0 : a.dormant ? 1 : -1) || (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1) ||
    order[a.sev] - order[b.sev] || String(a.since).localeCompare(String(b.since)));
  writeIssues_(issues, state);

  const cGa = countSev_(ga, r => r.pid), cGsc = countSev_(gsc, r => r.site);
  const when = Utilities.formatDate(new Date(), tz_(), 'd MMM yyyy HH:mm');
  writeBanner_(gaSh, 'Last check: ' + when + ' (' + state.trigger + ')  ·  🔴 ' + cGa.red + '   🟠 ' + cGa.amber + '   🟢 ' + cGa.green +
    '   ⚪ ' + cGa.grey + ' not monitored  ·  Sessions = ' + prettyRange_(d.gaStart, d.gaEnd) + '  ·  Dated columns on the right = weekly history (newest first)');
  writeBanner_(gscSh, 'Last check: ' + when + ' (' + state.trigger + ')  ·  🔴 ' + cGsc.red + '   🟠 ' + cGsc.amber + '   🟢 ' + cGsc.green +
    '   ⚪ ' + cGsc.grey + ' not monitored  ·  Data = ' + prettyRange_(d.gscStart, d.gscEnd) + ' (Search Console runs ~3 days behind)  ·  Dated columns = weekly impressions');

  const totals = { red: cGa.red + cGsc.red, amber: cGa.amber + cGsc.amber, green: cGa.green + cGsc.green, ga: cGa.total, gsc: cGsc.total };
  let email;
  if (state.email === false) email = 'Manual run, no email sent';
  else { try { email = sendReport_(issues, totals, state, cfg); } catch (e) { email = 'Email failed: ' + e.message; } }
  const fresh = issues.filter(i => i.isNew).length;
  const notes = [];
  if (state.stats.newGa || state.stats.newGsc) notes.push('New: ' + state.stats.newGa + ' GA4, ' + state.stats.newGsc + ' Search Console');
  if (state.stats.removed) notes.push(state.stats.removed + ' lost access');
  if (state.stats.failed) notes.push(state.stats.failed + ' checks failed');
  appendLog_([new Date(state.startedAt), new Date(), state.trigger, state.stats.checkedGa, state.stats.checkedGsc,
    totals.red, totals.amber, fresh, email, notes.join(' · ')]);
  setJson_('THM_LAST_RUN', {
    finishedAt: Date.now(), runDate: state.runDate, trigger: state.trigger, red: totals.red, amber: totals.amber,
    green: totals.green, fresh: fresh, ga: cGa.total, gsc: cGsc.total, email: email
  });
  return 'Done. 🔴 ' + totals.red + '  🟠 ' + totals.amber + '  🟢 ' + totals.green + (fresh ? '  (' + fresh + ' new)' : '') + '. ' + email + '.';
}

function addHistory_(t, runDate, key, note) {
  const sh = t.sh, n = t.rows.length;
  const lastCol = sh.getLastColumn();
  const hdr = sh.getRange(THM.HEADER_ROW, 1, 1, lastCol).getValues()[0];
  let col = 0;
  for (let c = t.F; c < lastCol; c++) if (toYmd_(hdr[c]) === runDate) { col = c + 1; break; }
  if (!col) {
    sh.insertColumnAfter(t.F); // newest history column sits right after the fixed columns
    col = t.F + 1;
    sh.showColumns(col);
  }
  sh.setColumnWidth(col, 90);
  sh.getRange(THM.HEADER_ROW, col).setNumberFormat('@').setValue(runDate).setNote(note + '. Cell colour = status that week; hover for details.')
    .setFontWeight('bold').setFontColor('#ffffff').setBackground(THM.COLORS.header).setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  if (!n) return;
  sh.getRange(THM.FIRST_ROW, col, n, 1)
    .setValues(t.rows.map(r => [r[key] === '' || r[key] == null ? '' : r[key]]))
    .setBackgrounds(t.rows.map(r => [colorFor_(r)]))
    .setNotes(t.rows.map(r => [r.status ? r.status + (r.issue ? ': ' + String(r.issue).slice(0, 400) : '') : '']))
    .setNumberFormat('#,##0').setFontColor('#000000').setFontWeight('normal').setHorizontalAlignment('right').setWrap(false);
}

function collectIssues_(t, source, state) {
  return t.rows.filter(r => (r.pid || r.site) && isMonitored_(r) && isProblem_(r.code)).map(r => ({
    sev: CODES[r.code].sev,
    status: r.status,
    source: source,
    name: source === 'GA4' ? r.property : r.site,
    account: r.account || '',
    website: source === 'GA4' ? (firstUrl_(r.website) || r.website || '') : '',
    issue: r.issue,
    since: toYmd_(r.since),
    isNew: toYmd_(r.since) === state.runDate,
    latest: source === 'GA4' ? r.s7 : r.impr7,
    latestLabel: source === 'GA4' ? 'sessions' : 'impressions',
    notes: r.notes || '',
    dormant: DORMANT_CODES.indexOf(r.code) >= 0
  }));
}

function writeIssues_(issues, state) {
  const sh = sheet_(THM.SHEETS.issues);
  const last = sh.getLastRow();
  if (last >= THM.FIRST_ROW) sh.getRange(THM.FIRST_ROW, 1, last - THM.FIRST_ROW + 1, ISSUE_HEADERS.length).clearContent().setBackground(null).clearNote();
  writeBanner_(sh, 'Open problems as of ' + prettyDate_(state.runDate) + ': ' + issues.length +
    '. Rebuilt every run; write notes on the GA4 Properties / Search Console tabs, not here.');
  if (!issues.length) {
    sh.getRange(THM.FIRST_ROW, 1).setValue('🟢 Nothing open. Every monitored property is reporting normally.');
    return;
  }
  const rows = issues.map(i => [
    i.status + (i.isNew ? '  NEW' : ''), i.source, i.name + (i.account && i.account !== i.name ? ' (' + i.account + ')' : ''), i.website, i.issue,
    i.since, i.since ? daysBetween_(i.since, state.runDate) : '', i.latest === '' ? '' : i.latest, i.notes
  ]);
  sh.getRange(THM.FIRST_ROW, 1, rows.length, ISSUE_HEADERS.length).setValues(rows).setVerticalAlignment('top');
  sh.getRange(THM.FIRST_ROW, 1, rows.length, 1).setBackgrounds(issues.map(i => [THM.COLORS[i.sev]]));
  sh.getRange(THM.FIRST_ROW, 5, rows.length, 1).setWrap(true);
  sh.getRange(THM.FIRST_ROW, 6, rows.length, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(THM.FIRST_ROW, 8, rows.length, 1).setNumberFormat('#,##0');
}

function countSev_(t, keyOf) {
  const c = { red: 0, amber: 0, green: 0, grey: 0, total: 0 };
  t.rows.forEach(r => {
    if (!keyOf(r)) return;
    c.total++;
    const s = sevOf_(r);
    if (c[s] !== undefined) c[s]++;
  });
  return c;
}

function writeBanner_(sh, text) {
  sh.getRange(THM.BANNER_ROW, 1).setValue(text).setFontWeight('bold').setFontColor('#263238').setWrap(false);
  sh.getRange(THM.BANNER_ROW, 1, 1, Math.max(1, Math.min(sh.getMaxColumns(), 12))).setBackground(THM.COLORS.banner);
}

function appendLog_(row) {
  const sh = sheet_(THM.SHEETS.log);
  sh.appendRow(row);
  const r = sh.getLastRow();
  sh.getRange(r, 1, 1, 2).setNumberFormat('dd mmm yyyy hh:mm');
}

// ───────────────────────────── Email ─────────────────────────────

function sendReport_(issues, totals, state, cfg) {
  if (!cfg.emailOn) return 'Email alerts off';
  const to = parseEmails_(cfg.recipients);
  if (!to.length) return 'No email recipients set';
  const active = issues.filter(i => !i.dormant);
  const fresh = active.filter(i => i.isNew);
  const dormantNew = issues.filter(i => i.dormant && i.isNew).length;
  const dateTxt = prettyDate_(state.runDate);
  let subject;
  if (!issues.length) {
    if (!cfg.allClear) return 'All clear (no email)';
    subject = '✅ Tracking check: all clear, ' + dateTxt;
  } else if (!active.length) {
    if (cfg.alertMode === 'new' && !dormantNew) return 'No new problems (no email)';
    if (!cfg.allClear && !dormantNew) return 'Nothing broken (no email)';
    subject = '✅ Tracking check: nothing broken, ' + dateTxt;
  } else {
    if (cfg.alertMode === 'new' && !fresh.length && !dormantNew) return 'No new problems (no email)';
    const red = active.filter(i => i.sev === 'red').length;
    subject = (red ? '🔴 ' : '🟠 ') + 'Tracking check: ' + (fresh.length ? fresh.length + ' new problem' + (fresh.length > 1 ? 's' : '') + ', ' : '') +
      active.length + ' open, ' + dateTxt;
  }
  if (MailApp.getRemainingDailyQuota() < 1) return 'Daily email quota used up';
  MailApp.sendEmail({ to: to.join(','), subject: subject, name: cfg.fromName || DEFAULTS.fromName, htmlBody: reportHtml_(issues, fresh, totals, state, cfg) });
  return 'Emailed ' + to.join(', ');
}

function reportHtml_(issues, fresh, totals, state, cfg) {
  const ss = SpreadsheetApp.getActive();
  const issuesSheet = ss.getSheetByName(THM.SHEETS.issues);
  const link = ss.getUrl() + (issuesSheet ? '#gid=' + issuesSheet.getSheetId() : '');
  const d = windows_(state.runDate);
  const table = list => {
    const max = 40;
    let h = '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">' +
      '<tr style="background:#263238;color:#fff;text-align:left"><th>Status</th><th>Property / site</th><th>What to check</th><th>Since</th></tr>';
    list.slice(0, max).forEach(i => {
      h += '<tr style="border-bottom:1px solid #e0e0e0;vertical-align:top">' +
        '<td style="background:' + THM.COLORS[i.sev] + ';white-space:nowrap">' + esc_(i.status) + '</td>' +
        '<td><b>' + esc_(i.name) + '</b><br><span style="color:#5f6368">' + esc_(i.source) + (i.website ? ' · ' + esc_(i.website) : '') + '</span></td>' +
        '<td>' + esc_(i.issue) + '</td>' +
        '<td style="white-space:nowrap">' + esc_(i.since ? prettyDate_(i.since) : '') + '</td></tr>';
    });
    if (list.length > max) h += '<tr><td colspan="4">…and ' + (list.length - max) + ' more in the sheet.</td></tr>';
    return h + '</table>';
  };
  const dormantAll = issues.filter(i => i.dormant).length;
  const dormant = issues.filter(i => i.dormant && (cfg.alertMode !== 'new' || i.isNew));
  issues = issues.filter(i => !i.dormant);
  fresh = fresh.filter(i => !i.dormant);
  const ongoing = issues.filter(i => !i.isNew);
  const red = issues.filter(i => i.sev === 'red').length, amber = issues.filter(i => i.sev === 'amber').length;
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124;max-width:820px">';
  html += '<p style="font-size:16px"><b>GA4 & Search Console tracking check: ' + esc_(prettyDate_(state.runDate)) + '</b></p>';
  html += '<p>🔴 ' + red + ' need action &nbsp;·&nbsp; 🟠 ' + amber + ' to check &nbsp;·&nbsp; 🟢 ' + totals.green + ' fine' +
    (dormantAll ? ' &nbsp;·&nbsp; ' + dormantAll + ' with no data for 5+ weeks' : '') +
    ', across ' + totals.ga + ' GA4 properties and ' + totals.gsc + ' Search Console sites.</p>';
  if (state.firstRun) html += '<p style="color:#5f6368">This is the first check, so everything found is listed as new.</p>';
  if (state.stats.failed && state.stats.failed > (state.stats.checkedGa + state.stats.checkedGsc) / 2) {
    html += '<p style="background:#fce8b2;padding:8px"><b>Most checks failed this run.</b> The data connection or the reporting account (' +
      esc_(cfg.account) + ') may be having problems. The results below may be incomplete.</p>';
  }
  if (!issues.length) html += '<p>' + (dormant.length ? 'Nothing is broken among the properties that are in use.' : 'Every monitored property is reporting normally. Nothing to do.') + '</p>';
  if (fresh.length) html += '<h3 style="margin:18px 0 6px">New this week (' + fresh.length + ')</h3>' + table(fresh);
  if (ongoing.length && cfg.alertMode !== 'new') html += '<h3 style="margin:18px 0 6px">Still open (' + ongoing.length + ')</h3>' + table(ongoing);
  else if (ongoing.length) html += '<p>' + ongoing.length + ' older problem(s) are still open; see the sheet.</p>';
  if (dormant.length) {
    const maxD = 80;
    html += '<h3 style="margin:18px 0 6px">No data for 5+ weeks (' + dormant.length + ')</h3>' +
      '<p style="color:#5f6368;margin:0 0 6px">These look unused: old, test or duplicate properties, or sites that are offline. Set <b>Monitor? = No</b> on any the client ' +
      'doesn\'t use and they stop appearing. If one of them should be live, its tag is missing.</p><p style="font-size:13px;line-height:1.6">' +
      dormant.slice(0, maxD).map(i => esc_(i.name) + (i.account && i.account !== i.name ? ' <span style="color:#5f6368">(' + esc_(i.account) + ')</span>' : '') +
        (i.isNew ? ' <b style="color:#c5221f">new</b>' : '')).join('<br>') +
      (dormant.length > maxD ? '<br>…and ' + (dormant.length - maxD) + ' more in the sheet.' : '') + '</p>';
  }
  html += '<p style="margin-top:18px"><a href="' + link + '">Open the tracking sheet</a></p>';
  html += '<p style="color:#5f6368;font-size:12px">GA4 = sessions ' + esc_(prettyRange_(d.gaStart, d.gaEnd)) +
    ', compared with the 4 weeks before. Search Console = ' + esc_(prettyRange_(d.gscStart, d.gscEnd)) +
    ' (its data runs ~3 days behind). Rows set to Monitor? = No are left out.</p></div>';
  return html;
}

function failureHtml_(msg, isConnection, cfg) {
  const ss = SpreadsheetApp.getActive();
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124;max-width:700px">' +
    '<p><b>The GA4 & Search Console tracking check could not run, so nothing was checked this time.</b></p>' +
    '<p style="background:#f4c7c3;padding:8px">' + esc_(msg) + '</p>' +
    (isConnection
      ? '<p>Usual causes: the Google sign-in for <b>' + esc_(cfg.account) + '</b> expired or was disconnected in the reporting dashboard, or the connection URL/key changed. ' +
        'Reconnect the account, then open the sheet → Tracking Monitor → Open settings → <i>Save &amp; test</i>, and click <i>Run check now</i>.</p>'
      : '<p>Open the sheet → Tracking Monitor → Open settings to check the connection, then click <i>Run check now</i>.</p>') +
    '<p><a href="' + ss.getUrl() + '">Open the tracking sheet</a></p></div>';
}

// ───────────────────────────── Data connection (MCP over HTTP) ─────────────────────────────

/**
 * Minimal client for the reporting dashboard's MCP endpoint (Streamable HTTP, JSON-RPC 2.0).
 * Handles plain JSON and text/event-stream replies, optional Mcp-Session-Id, retries and parallel calls.
 */
function McpClient_(url, token) {
  this.url = url;
  this.token = token || '';
  this.sessionId = null;
  this.protocolVersion = null;
  this.ready = false;
  this.nextId = 1;
}

McpClient_.prototype.options_ = function (body, afterInit) {
  const headers = { Accept: 'application/json, text/event-stream' };
  if (this.token) headers.Authorization = 'Bearer ' + this.token;
  if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
  if (afterInit && this.protocolVersion) headers['MCP-Protocol-Version'] = this.protocolVersion;
  return { method: 'post', contentType: 'application/json', headers: headers, payload: JSON.stringify(body), muteHttpExceptions: true, followRedirects: true };
};

McpClient_.prototype.initialize_ = function () {
  this.sessionId = null;
  const id = this.nextId++;
  const resp = UrlFetchApp.fetch(this.url, this.options_({
    jsonrpc: '2.0', id: id, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'tracking-monitor', version: THM.VERSION } }
  }, false));
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code === 401 || code === 403) {
    let why = '';
    try { why = JSON.parse(text).message || ''; } catch (e) { why = short_(text, 120); }
    why = String(why).replace(/[.\s]+$/, '');
    throw connErr_('The data connection refused the credentials (HTTP ' + code + (why ? ': ' + why : '') + '). ' +
      (this.token ? 'Check the API token in settings is current.' : 'Add the API token (sk_…) in settings.'));
  }
  if (code >= 400) throw connErr_('The data connection returned HTTP ' + code + ': ' + short_(text, 160));
  const headers = lowerKeys_(resp.getAllHeaders());
  if (headers['mcp-session-id']) this.sessionId = String(headers['mcp-session-id']);
  const msg = parseRpc_(text, headers['content-type'], id);
  if (!msg) throw connErr_('Unexpected reply from the data connection: ' + short_(text, 160));
  if (msg.error) throw connErr_('Data connection error: ' + (msg.error.message || JSON.stringify(msg.error)));
  this.protocolVersion = (msg.result && msg.result.protocolVersion) || '2025-03-26';
  try { UrlFetchApp.fetch(this.url, this.options_({ jsonrpc: '2.0', method: 'notifications/initialized' }, true)); } catch (e) { /* optional */ }
  this.ready = true;
};

/** calls = [{name, args}] → [{ok, data, text, error, kind}] in the same order. */
McpClient_.prototype.callMany = function (calls) {
  if (!this.ready) this.initialize_();
  const results = new Array(calls.length);
  let pending = calls.map((c, i) => i);
  for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
    if (attempt) Utilities.sleep(1500 * attempt);
    const ids = {};
    const reqs = pending.map(i => {
      const id = this.nextId++;
      ids[i] = id;
      return Object.assign({ url: this.url }, this.options_({ jsonrpc: '2.0', id: id, method: 'tools/call', params: { name: calls[i].name, arguments: calls[i].args || {} } }, true));
    });
    let resps;
    try {
      resps = UrlFetchApp.fetchAll(reqs);
    } catch (e) {
      pending.forEach(i => { results[i] = { ok: false, kind: 'error', error: 'Network error: ' + short_(e.message, 120) }; });
      continue;
    }
    const retry = [];
    let sessionLost = false;
    resps.forEach((resp, k) => {
      const i = pending[k];
      const code = resp.getResponseCode();
      const text = resp.getContentText();
      if (code === 404 && this.sessionId) { sessionLost = true; retry.push(i); results[i] = { ok: false, kind: 'error', error: 'Session expired' }; return; }
      if (code === 429 || code >= 500) { retry.push(i); results[i] = { ok: false, kind: 'error', error: 'HTTP ' + code + ' from data connection' }; return; }
      if (code === 401 || code === 403) { results[i] = { ok: false, kind: 'connection', error: 'Data connection refused the API token (HTTP ' + code + ')' }; return; }
      if (code >= 400) { results[i] = { ok: false, kind: 'error', error: 'HTTP ' + code + ': ' + short_(text, 120) }; return; }
      const headers = lowerKeys_(resp.getAllHeaders());
      results[i] = toolResult_(parseRpc_(text, headers['content-type'], ids[i]), text);
    });
    if (sessionLost) this.initialize_();
    pending = retry;
  }
  return results;
};

function toolResult_(msg, raw) {
  if (!msg) return { ok: false, kind: 'error', error: 'Unreadable reply: ' + short_(raw, 120) };
  if (msg.error) {
    const m = msg.error.message || JSON.stringify(msg.error);
    return { ok: false, kind: classifyError_(m), error: cleanError_(m) };
  }
  const res = msg.result || {};
  const text = (res.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('\n');
  let data = res.structuredContent || null;
  if (!data && text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
  if (res.isError || (!data && /error|denied|permission|forbidden|not found/i.test(text))) {
    return { ok: false, kind: classifyError_(text), error: cleanError_(text) };
  }
  if (data && typeof data === 'object' && data.error) {
    const m = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
    return { ok: false, kind: classifyError_(m), error: cleanError_(m) };
  }
  return { ok: true, data: data || {}, text: text };
}

function parseRpc_(text, contentType, id) {
  if (!text) return null;
  const t = String(text).trim();
  let msgs = [];
  const looksSse = /text\/event-stream/i.test(String(contentType || '')) || (t.charAt(0) !== '{' && t.charAt(0) !== '[' && /^(event|data|id|retry):/m.test(t));
  if (looksSse) {
    let buf = [];
    const flush = () => { if (buf.length) { try { msgs.push(JSON.parse(buf.join('\n'))); } catch (e) { /* skip */ } buf = []; } };
    t.split(/\r?\n/).forEach(line => {
      if (line.indexOf('data:') === 0) buf.push(line.slice(5).replace(/^ /, ''));
      else if (!line.trim()) flush();
    });
    flush();
  } else {
    try { const j = JSON.parse(t); msgs = Array.isArray(j) ? j : [j]; } catch (e) { return null; }
  }
  for (let i = 0; i < msgs.length; i++) if (msgs[i] && msgs[i].id === id) return msgs[i];
  for (let i = 0; i < msgs.length; i++) if (msgs[i] && (msgs[i].result || msgs[i].error)) return msgs[i];
  return null;
}

function classifyError_(t) {
  t = String(t || '');
  if (/invalid_grant|token has been expired|expired or revoked|reauth|unauthenticated|not connected|no (connected )?account|account not found/i.test(t)) return 'connection';
  if (/sufficient permission|permission denied|does not have|don't have access|do not have access|not have access|forbidden|not authorized|\b403\b/i.test(t)) return 'access';
  if (/not found|\b404\b|does not exist/i.test(t)) return 'notfound';
  return 'error';
}

function cleanError_(t) {
  return short_(String(t || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*(See also|To learn more)[\s\S]*$/i, '')
    .trim(), 160);
}

// ───────────────────────────── Sheet helpers ─────────────────────────────

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  const ga = ensureTable_(THM.SHEETS.ga, GA_COLS);
  const gsc = ensureTable_(THM.SHEETS.gsc, GSC_COLS);
  let issues = ss.getSheetByName(THM.SHEETS.issues);
  if (!issues) {
    issues = ss.insertSheet(THM.SHEETS.issues);
    issues.getRange(THM.HEADER_ROW, 1, 1, ISSUE_HEADERS.length).setValues([ISSUE_HEADERS]);
    styleHeaderRow_(issues, ISSUE_HEADERS.length);
    [150, 110, 240, 200, 420, 100, 75, 90, 220].forEach((w, i) => issues.setColumnWidth(i + 1, w));
    issues.setFrozenRows(THM.HEADER_ROW);
    writeBanner_(issues, 'Open problems appear here after the first check.');
  }
  let log = ss.getSheetByName(THM.SHEETS.log);
  if (!log) {
    log = ss.insertSheet(THM.SHEETS.log);
    log.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight('bold').setBackground(THM.COLORS.header).setFontColor('#ffffff');
    log.setFrozenRows(1);
    [130, 130, 90, 90, 120, 60, 60, 90, 260, 320].forEach((w, i) => log.setColumnWidth(i + 1, w));
  }
  return { ga: ga, gsc: gsc, issues: issues, log: log };
}

function ensureTable_(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastCol = Math.max(1, sh.getLastColumn());
  const hdr = sh.getRange(THM.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const pos = {};
  let F = 0;
  cols.forEach(c => { const i = hdr.indexOf(c.h); if (i >= 0) { pos[c.k] = i + 1; F = Math.max(F, i + 1); } });
  const fresh = F === 0;
  cols.forEach(c => {
    if (pos[c.k]) return;
    if (!fresh) sh.insertColumnAfter(F); // add a missing column without disturbing history columns
    else if (F + 1 > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
    F++;
    pos[c.k] = F;
    sh.getRange(THM.HEADER_ROW, F).setValue(c.h);
    sh.setColumnWidth(F, c.w || 120);
  });
  styleHeaderRow_(sh, F);
  cols.forEach(c => {
    const cell = sh.getRange(THM.HEADER_ROW, pos[c.k]);
    if (c.n) cell.setNote(c.n);
    if (c.hidden) sh.hideColumns(pos[c.k]);
  });
  sh.setFrozenRows(THM.HEADER_ROW);
  sh.setFrozenColumns(2);
  if (fresh) writeBanner_(sh, 'Not checked yet. Open Tracking Monitor → Open settings, save the connection, then Run check now.');
  return sh;
}

function styleHeaderRow_(sh, n) {
  sh.getRange(THM.HEADER_ROW, 1, 1, n).setFontWeight('bold').setFontColor('#ffffff').setBackground(THM.COLORS.header)
    .setWrap(true).setVerticalAlignment('middle');
  sh.setRowHeight(THM.HEADER_ROW, 44);
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  return sh || ensureSheets_()[{ 'GA4 Properties': 'ga', 'Search Console': 'gsc', 'Open Issues': 'issues', 'Run Log': 'log' }[name]];
}

/** Reads the fixed columns into row objects keyed by column key. Unknown columns are preserved untouched. */
function readTable_(sh, cols) {
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(1, sh.getLastColumn());
  const hdr = sh.getRange(THM.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const idx = {};
  let F = 0;
  cols.forEach(c => { const i = hdr.indexOf(c.h); if (i >= 0) { idx[c.k] = i; F = Math.max(F, i + 1); } });
  if (!F) throw new Error('The "' + sh.getName() + '" tab has no header row. Use Tracking Monitor → Set up / repair tabs.');
  const n = Math.max(0, lastRow - THM.FIRST_ROW + 1);
  const values = n ? sh.getRange(THM.FIRST_ROW, 1, n, F).getValues() : [];
  const rows = values.map(raw => {
    const r = { _raw: raw };
    Object.keys(idx).forEach(k => { r[k] = raw[idx[k]]; });
    return r;
  });
  return { sh: sh, cols: cols, idx: idx, F: F, rows: rows };
}

function newRow_(t) {
  const raw = [];
  for (let i = 0; i < t.F; i++) raw.push('');
  const r = { _raw: raw, _isNew: true };
  Object.keys(t.idx).forEach(k => { r[k] = ''; });
  t.rows.push(r);
  return r;
}

function writeTable_(t) {
  const n = t.rows.length;
  if (!n) return;
  const raws = t.rows.map(r => {
    const raw = r._raw.slice();
    while (raw.length < t.F) raw.push('');
    Object.keys(t.idx).forEach(k => { raw[t.idx[k]] = r[k] === undefined || r[k] === null ? '' : r[k]; });
    r._raw = raw;
    return raw;
  });
  t.sh.getRange(THM.FIRST_ROW, 1, n, t.F).setValues(raws);
  if (t.idx.status !== undefined) t.sh.getRange(THM.FIRST_ROW, t.idx.status + 1, n, 1).setBackgrounds(t.rows.map(r => [colorFor_(r)]));
  t.cols.forEach(c => {
    if (t.idx[c.k] === undefined) return;
    const rng = t.sh.getRange(THM.FIRST_ROW, t.idx[c.k] + 1, n, 1);
    if (c.f) rng.setNumberFormat(c.f);
    if (c.wrap) rng.setWrap(true);
  });
  if (t.idx.monitor !== undefined) {
    t.sh.getRange(THM.FIRST_ROW, t.idx.monitor + 1, n, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());
  }
}

function sortTable_(sh, cols, keys) {
  const t = readTable_(sh, cols);
  if (t.rows.length < 2) return;
  const spec = keys.filter(k => t.idx[k] !== undefined).map(k => ({ column: t.idx[k] + 1, ascending: true }));
  try { sh.getRange(THM.FIRST_ROW, 1, t.rows.length, sh.getLastColumn()).sort(spec); } catch (e) { /* e.g. a filter view is active */ }
}

function checkedMs_(r) {
  const v = r.checked;
  if (v instanceof Date) return v.getTime();
  const t = v ? new Date(v).getTime() : 0;
  return isFinite(t) ? t : 0;
}

// ───────────────────────────── Properties & triggers ─────────────────────────────

function getConfig_() {
  return Object.assign({}, DEFAULTS, getJson_('THM_CONFIG') || {});
}

function getConnUrl_() {
  return PropertiesService.getUserProperties().getProperty('THM_URL') || '';
}

function getConnToken_() {
  return PropertiesService.getUserProperties().getProperty('THM_TOKEN') || '';
}

function maskToken_(t) {
  return t ? t.slice(0, 3) + '…' + t.slice(-4) : '';
}

function getJson_(key) {
  try { const v = PropertiesService.getDocumentProperties().getProperty(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}

function setJson_(key, obj) {
  PropertiesService.getDocumentProperties().setProperty(key, JSON.stringify(obj));
}

function getRunState_() { return getJson_('THM_RUN'); }
function saveRunState_(s) { setJson_('THM_RUN', s); }
function clearRunState_() { PropertiesService.getDocumentProperties().deleteProperty('THM_RUN'); }

function myTriggers_(fn) {
  return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === fn);
}

function deleteMyTriggers_(fn) {
  myTriggers_(fn).forEach(t => ScriptApp.deleteTrigger(t));
}

function warnIfStale_() {
  const sch = getJson_('THM_SCHEDULE');
  if (!sch || !sch.day) return;
  const last = getJson_('THM_LAST_RUN');
  const since = Math.max((last && last.finishedAt) || 0, sch.createdAt || 0);
  if (Date.now() - since > 8 * 864e5) {
    SpreadsheetApp.getActive().toast('The weekly tracking check has not completed for over a week. Open Tracking Monitor → Open settings to check the connection and schedule.',
      '⚠ ' + THM.MENU, 30);
  }
}

function me_() {
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function userErr_(msg) { const e = new Error(msg); e.isUser = true; return e; }
function connErr_(msg) { const e = new Error(msg); e.isConnection = true; return e; }

// ───────────────────────────── Small utilities ─────────────────────────────

function tz_() {
  try { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); } catch (e) { return Session.getScriptTimeZone(); }
}

function today_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

function toYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
}

function addDays_(ymd, n) {
  const p = ymd.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function daysBetween_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}

function eachDay_(from, to, fn) {
  for (let d = from; d <= to; d = addDays_(d, 1)) fn(d);
}

/** Date windows for one run. GA4: last 7 complete days + 28 days before. Search Console: same, shifted 3 days for its delay. */
function windows_(runDate) {
  return {
    gaStart: addDays_(runDate, -7), gaEnd: addDays_(runDate, -1),
    gaBaseStart: addDays_(runDate, -35), gaBaseEnd: addDays_(runDate, -8),
    gscStart: addDays_(runDate, -9), gscEnd: addDays_(runDate, -3),
    gscBaseStart: addDays_(runDate, -37), gscBaseEnd: addDays_(runDate, -10)
  };
}

function dailyMap_(data) {
  const out = {};
  ((data && data.rows) || []).forEach(row => {
    const k = String(row.date || '').replace(/-/g, '');
    if (/^\d{8}$/.test(k)) out[k.slice(0, 4) + '-' + k.slice(4, 6) + '-' + k.slice(6, 8)] = num_(row.sessions);
  });
  return out;
}

function sumDays_(daily, from, to) {
  let s = 0;
  eachDay_(from, to, d => { s += daily[d] || 0; });
  return s;
}

function num_(v) {
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}

function fmtN_(n) {
  return String(Math.round(num_(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pctAbs_(x) {
  return Math.abs(Math.round(Number(x) * 100)) + '%';
}

function fmtPct_(x) {
  const p = Math.round(Number(x) * 100);
  return (p > 0 ? '+' : p < 0 ? '-' : '') + Math.abs(p) + '%';
}

const MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function prettyDate_(ymd) {
  const p = String(ymd).split('-').map(Number);
  return p.length === 3 ? p[2] + ' ' + MONTHS_[p[1] - 1] + ' ' + p[0] : String(ymd);
}

function prettyRange_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return (pa[1] === pb[1] ? pa[2] : pa[2] + ' ' + MONTHS_[pa[1] - 1]) + '–' + pb[2] + ' ' + MONTHS_[pb[1] - 1];
}

function uniq_(a) {
  const seen = {};
  return a.filter(x => (seen[x] ? false : (seen[x] = true)));
}

function isHttpUrl_(u) { return /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()); }

function firstUrl_(website) {
  return String(website || '').split(/\s*,\s*/).filter(isHttpUrl_)[0] || '';
}

function firstMid_(mid) {
  return String(mid || '').split(/\s*,\s*/).filter(m => /^G-/i.test(m))[0] || '';
}

function hostOf_(url) {
  const m = String(url || '').match(/^https?:\/\/([^\/:?#]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function siteBase_(url) { return hostOf_(url).replace(/^www\./, ''); }

function gscBase_(site) {
  site = String(site || '');
  return /^sc-domain:/i.test(site) ? site.replace(/^sc-domain:/i, '').toLowerCase().replace(/^www\./, '') : siteBase_(site);
}

function isRootUrl_(url) {
  const m = String(url || '').match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i);
  return !!m && (!m[1] || m[1] === '/');
}

function shortSite_(site) {
  return String(site || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function isUnverified_(access) { return /^unverified/i.test(String(access || '')); }

function accessLabel_(p) {
  return { siteOwner: 'Owner', siteFullUser: 'Full user', siteRestrictedUser: 'Restricted user', siteUnverifiedUser: 'Unverified (no access)' }[p] || String(p || '');
}

function parseEmails_(s) {
  return uniq_(String(s || '').split(/[\s,;]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)));
}

function maskUrl_(u) {
  const key = (String(u).match(/key=([^&]+)/) || [])[1] || '';
  return hostOf_(u) + (key ? ' · key …' + key.slice(-4) : '');
}

function lowerKeys_(o) {
  const out = {};
  Object.keys(o || {}).forEach(k => { out[k.toLowerCase()] = o[k]; });
  return out;
}

function short_(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
