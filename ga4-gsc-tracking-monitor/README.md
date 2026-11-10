# GA4 & Search Console Tracking Monitor (Google Sheets)

A Google Sheet that checks every GA4 property and Search Console site your reporting account can see, once a week. It turns broken or disconnected ones red and emails the team, so a missing tracking code gets caught in days, not months.

It runs entirely inside the sheet (Apps Script). You can paste it into any Google Sheet on any Google account.

## What it checks

| Check | Turns red when | Turns amber when |
|---|---|---|
| **Access** | The reporting account can't read a property, it disappeared from the account, or Search Console shows it as *unverified* | – |
| **GA4 data** | 0 sessions last week, or sessions fell ≥ 50% vs normal | Fell 30–50%, or 2+ days with no data at all |
| **GA4 vs Google search** | GA4 shows fewer sessions than Google search clicks alone for the same site (tag missing on pages) | Both fell together (likely a real traffic drop, not tracking) |
| **Tag on website** | – | The property's `G-` ID isn't in the homepage code or its GTM container, or a *different* `G-` ID is there |
| **Search Console** | 0 impressions, or impressions fell ≥ 50% | Fell 30–50% |

Why "drop", not just "zero": when a site is migrated and the tag is left off, GA4 rarely goes to zero, because a few pages or a booking widget keep firing. A big drop is the real signal.

Why it never "gets used to" an outage: while a drop is open, the row is compared with its **Normal weekly level** (the last healthy week), not the last 4 weeks. A three-month outage stays red for three months.

## One-time setup (about 5 minutes)

1. Open (or create) the Google Sheet, logged in as the account that should send the alerts.
2. **Extensions → Apps Script.** Delete the sample code and paste `Code.gs`.
3. Click **+ → HTML**, name it exactly `Sidebar`, and paste `Sidebar.html`.
4. Save, go back to the sheet and reload it. A **Tracking Monitor** menu appears.
5. **Tracking Monitor → Open settings.** Google asks for permission the first time; approve it.
6. In the sidebar:
   1. **Data connection**: paste the dashboard connection URL (`https://…/mcp?key=…`) and the reporting account email, then click **Save & test**. You should see how many properties and sites it can see.
   2. **Email alerts**: add the recipients. Keep "Also email when everything is fine" on, so a missing Monday email tells you the check itself stopped.
   3. **Weekly schedule**: pick a day and hour, then click **Turn on**.
7. Click **Run check now** once to fill the sheet.

The first run lists everything. Set **Monitor? = No** on old, test or duplicate properties; they stay listed but never alert. Names containing "old", "test", "staging" or "do not use" start as No.

## The tabs

- **GA4 Properties**: one row per property. Shows status, what to check, sessions (last 7 days), the 4-week average, change, days with no data, last day with data, tag found on the site, and Search Console clicks for the same site. **Team notes** and **Monitor?** are yours; the script never overwrites them.
- **Search Console**: one row per site. Shows clicks, impressions, change, position and access level.
- **Dated columns** (newest first, right after the fixed columns): one column per run. GA4 shows weekly sessions; Search Console shows weekly impressions. Each cell is coloured by that week's status, and hovering shows the reason. This is the history of when something broke.
- **Open Issues**: just the problems, new ones first, rebuilt every run.
- **Run Log**: every run, what it found, and whether the email was sent.

Problems are sorted to the top: new red first, then older red, amber, green, and not monitored.

## When something is red

| Status | Usually means | What to do |
|---|---|---|
| 🔴 Tracking drop / Not tracking | The tag was removed or broken (migration, redesign, new theme, consent banner) | Check the site with Tag Assistant; ask the developer to re-add the GA4/GTM code |
| 🔴 Under-tracking | The tag is missing on some pages or blocked | Check page templates and GTM triggers |
| 🔴 No access / Access removed | The client removed the reporting account, or Search Console verification was lost | Ask the client to re-add the account (GA4 Admin → Property access; Search Console → Users and permissions) |
| 🔴 No impressions / Impressions drop | Site de-indexed (noindex, robots.txt, redirects) or the property is wrong | Check indexing in Search Console |
| 🟠 Traffic drop | A real traffic fall, seen in both GA4 and Google search | SEO review, not a tracking fix |
| 🟠 Tag not found / Different tag | The tag may load another way, or the site sends data to another property | Confirm with Tag Assistant |
| ⚪ Alternate version | An empty http/www copy of a site whose main version has data | Nothing; set Monitor? = No |

When a drop really is the new normal (e.g. the site was rebuilt smaller), clear or lower **Normal weekly level** on that row.

## Good to know

- **Date windows.** GA4 uses the last 7 complete days (ending yesterday) compared with the 28 days before. Search Console uses the same windows shifted 3 days back, because its data is delayed.
- **Emails.** Manual runs don't email unless you tick "Email the results of this run". Scheduled runs follow the email settings. If the check can't run at all (connection down, account disconnected), it emails a "could not run" alert instead of failing silently.
- **Safety net.** If more than half the properties disappear at once, the script treats it as a connection problem and marks nothing.
- **Long lists.** If a run needs more than about 4.5 minutes (Google's limit is 6), it saves its place and carries on automatically a minute later. The email goes out once, when everything is done.
- **Privacy.** The connection URL is saved in the private *User Properties* of the person who saves it. It never appears in the sheet, and other editors can't read it. The weekly schedule runs as that person. Only the reporting account set in the sidebar is ever queried.
- **Ownership.** The schedule belongs to the person who turned it on (that's how Google triggers work). If that person leaves, someone else saves the connection and turns the schedule on again. Schedule times use the Apps Script project's time zone (Apps Script → Project Settings), shown in the sidebar.
- **Updating.** To update the script, paste the new `Code.gs` / `Sidebar.html` over the old ones. The sheet and its history stay. Use **Tracking Monitor → Set up / repair tabs** if a column was deleted by accident.

## Troubleshooting

| Message | Fix |
|---|---|
| "The data connection is not saved for …" | That person hasn't saved the URL in the sidebar (each person's copy is private) |
| "Could not list GA4 properties …" / "could not run" email | Reconnect the reporting account in the dashboard, then click **Save & test** |
| "Site blocks automated checks (HTTP 403)" in *Tag on website* | Normal for sites behind bot protection; only the tag check is skipped |
| A row says "Check failed" | A temporary API error; it retries on the next run |
