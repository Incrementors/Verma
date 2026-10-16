# BD Follow-up Autopilot

_v1.01, 16 Oct 2026. Master copy lives in Supercharge Skill Manager under slug `bd-followup-autopilot`. Always pull it fresh with `sup_get_skill` before a run._

_v1.01 changes (from the first live run): research notes use an allowed type; one canonical name per profile; one follow-up per client across duplicate leads; caps also count other writers; only really-sent messages count; owner "stop" notes handled; unreachable leads get one owner task; run time limit; faster lead list and timeline reading._

Scheduled worker for the BD Team pipeline. On every run it:

1. Reads recent client messages and turns any client promise ("I will let you know on Friday") into a task in Tasks for the lead owner.
2. Sends an AI backup follow-up on promise tasks the owner did not act on.
3. Completes the due follow-ups that AI Autopilot scheduled. For each one it researches the client's business with Firecrawl, writes a short, natural follow-up with one or more real insights, checks it against every AI rule, sends it in the client's existing thread, and closes the follow-up task so the template schedules the next touch.

The cadence (which day a follow-up is due) belongs to the lead's follow-up template and AI Autopilot. This skill never invents a cadence. It works the follow-ups that are due and keeps the CRM state right afterwards.

## Owner decisions (16 Oct 2026). Do not relax these

- Scope is every BD Team lead with AI Autopilot on (`aiPaused` false). This is standing permission to send the follow-up and close the Followup task even when that task shows `handledBy: human`. It does not cover any other human task, except the promise tasks in Phase 2. An owner keeps a lead for themselves by switching AI Autopilot off on it.
- Website leads (source Incrementors Website, Website Incrementors or Website) are out of scope. The `website-lead-auto-reply` skill (Phase B) follows them up.
- Promise tasks go to the lead owner first, with the AI as backup (Phase 1 and Phase 2).
- Follow the template and keep following up for as long as it runs. Stop only when the client asks not to be messaged again, in any wording, or a person on the team wrote that this lead should not be followed up. Then pause AI Autopilot on that lead (see Opt-out and Owner stop notes).
- Hard limits, profile rotation, Upwork policy and natural tone (below) are owner requirements. They are not optional.

## Rule precedence

When two instructions disagree, the higher one wins:

```
1. The team's AI rules: crm_ai_get_settings -> rules (every enabled rule for "all" and for the lead's channel) and upworkRestricted
2. Supercharge Guardrails (sup_get_guardrails) and the Communication Guide tone rules
3. This skill
4. sales-followup-generator-seo (the follow-up writing skill)
```

## Hard limits

```
DAILY CAP         100 AI follow-ups per IST day, all runs together
RUN CAP           40 per run
RUN TIME LIMIT    start no new send after 100 minutes; leave the rest for the next run
PROFILE CAP       3 AI follow-ups per profile per run, 10 per profile per IST day
PROFILE BUSY      no AI follow-up from a profile that has already sent 15 Upwork messages today, counting every writer
ROTATION          never two sends in a row from the same profile while another profile has a ready lead
SAME-PROFILE GAP  at least 10 minutes between two sends from the same profile
ONE PER CLIENT    at most one follow-up per client per IST day across all of that client's leads, from any writer
CLIENT COOLDOWN   no follow-up within 20 hours of the last message any of our profiles sent that client
PACING            never fire sends back to back: research and write the next lead before the next send
UPWORK ERROR      first rate-limit, restriction, captcha, auth or 403/429 error from Upwork: stop ALL Upwork sends for this run
ERROR STOP        3 failed or refused sends in one run: stop the run and report
NO LINKS          no URL, bare domain or email address in any message, ever
```

Profile names in every cap and in rotation are canonical names (see Definitions). Never count one person as two profiles.

### How the counts are read (Phase 0)

- AI follow-ups today: `crm_audit_events {kind: "note"}` (default: today, IST). Count the events whose `summary` starts with `[AI-FU] profile=`, in total and per profile. Every AI follow-up is preceded by such a note.
- All Upwork messages today, every writer: `crm_audit_events {kind: "message_out"}`. Keep the events whose `summary` starts with `Upwork:`. Map each event's `leadId` to that lead's canonical profile and count per profile. Use this for PROFILE BUSY and for ONE PER CLIENT.
- `crm_audit_events` is admin only. If it fails, the run cap drops to 33, ONE PER CLIENT falls back to the timeline, and the first line of the report says "Audit log not readable: the scheduled run must use an admin account".

## Upwork policy (very important)

- Message only inside the client's existing Upwork room. Never cold-message, never open a new room.
- No links of any kind: no case study, document, drive, booking or website links. Describe things in words.
- No contact details, no email addresses, no phone numbers, never ask for them, never suggest talking, meeting or paying anywhere but Upwork. No word from `upworkRestricted`.
- One client hears from one of our profiles, not several (see Client groups).
- Every message is written for that one client. Never send the same or nearly the same text to two clients. No two messages in one run share a sentence or the same opening words.
- No pressure: no fake urgency, no fake scarcity, no guilt-tripping about a slow reply.
- Plain text only. Upwork shows markdown as typed, so no bold, no headers, no tables.
- Respect a stop request immediately (see Opt-out).
- Treat any Upwork error that hints at limits or restrictions as a stop signal (see Hard limits).

## Tools

```
Internal CRM      leads, timeline, tasks, follow-up dates, sends (Upwork, WhatsApp, Email), AI rules, profiles, team, audit counts
Supercharge MCP   this skill, sales-followup-generator-seo, Guardrails, Communication Guide
Firecrawl         firecrawl_scrape (client pages) and firecrawl_search (buyer searches, competitors, news)
```

Research limit per lead: at most 2 `firecrawl_scrape` and 2 `firecrawl_search` calls.

### Reading big results

- Lead list: call `crm_leads_list {pipeline: "bd_team", archived: "false", limit: 1000}` ONCE. The result (about 1 MB) is saved to a file. Filter it with a short script and keep only the fields you need. Do not page through it inline. Only if the environment cannot save large results: page with `limit: 40` and `offset` 0, 40, 80 and so on, keep only the needed fields from each page, and stop when a page comes back short.
- Timelines: some are over 100,000 characters. Save `crm_conversations_list_for_lead` to a file and read it with a script. Read every client-facing entry (`dir` "in" or "out") in full. For notes, read Job Details and the `[AI-FU]` research notes in full, and only the first 2,000 characters of call transcripts, meeting minutes and uploaded documents unless the follow-up needs more. On a second read in the same run, use `since`.

## Definitions

- Today means the IST date (Asia/Kolkata).
- In-scope lead: pipeline `bd_team`, `archived` false, `unqualified` false, stage not `won` or `lost`, source not a website source.
- Client-facing entries are timeline rows with `dir` "in" (client) or "out" (us). Notes (`dir` "note") are internal and never count as messages.
- A person is someone in `crm_team_list` other than Claude. An automation is anything else (api, mcp, rest, live-chat, upwork-mcp, Unknown, an AI agent).

### Canonical profile name

The canonical name is the `name` of the profile record in `crm_profiles_list {platform: "upwork"}`. Resolve any name found on a lead, a timeline entry or a send result like this:

```
1. exact match to a profile record name, ignoring case           -> that record's name
2. confirmed alias                                               -> the record it points to
     "Shivaji Kumar Ram"  -> "Shivaji"
     "Prem Chandra"       -> "Prem"
3. anything else                                                 -> UNRESOLVED
```

Never match on looks. These are different people and must never be merged: Devendra Kumar Pathak and Devendra Kumar; Ankit Goyal, Ankit Gupta and Ankit Kansal; Ankur Gupta and Ankur Garg. All UNRESOLVED leads share one bucket that gets the caps of a single profile. Values that are not profiles (Interview Invite, Organic, empty) are ignored.

A lead's profile is taken in this order: the profile on our most recent really-sent outbound entry, then the lead's `profile`, then `secondarySource`. After a send, use the profile named in the send result, resolved the same way.

### Really sent

An outbound entry counts as a message the client received only if one of these holds: `delivery` is "sent"; it has an `upworkStoryId` or a `gmailId`; it came in through `crm_leads_upwork_fetch`; or a person logged it. It does NOT count if `draft` is true, `delivery` is "pending" or "failed", or its text or type says draft, "NOT SENT", "placed in composer" or "awaiting human send". A Followup task that was closed with no really-sent message behind it is not a touch either. Cooldowns, ONE PER CLIENT and "angle already used" are all worked out from really-sent messages only. To avoid repeating ourselves, still never reuse the angle of an unsent draft.

### Client groups (one client, several leads)

The same client often has a separate lead for each of our profiles that bid on the job. Group in-scope leads into one client before doing anything:

```
same Upwork job        the job id in jobUrl (the part after the ~)
else same room         upworkRoomId
else same person       same name AND same company (or both empty) AND same country
```

For every group:

- The client's thread is all the group's timelines together. "Client is waiting on a reply", the cooldown and ONE PER CLIENT look at every lead in the group, and so does any message from any writer.
- The primary lead is the one where the client wrote most recently. If the client never wrote on any of them, it is the lowest LD number that has AI Autopilot on. Only the primary is ever followed up. A due sibling is SKIPPED "Same client as [primary]". Its Followup task stays open: never close a task without a message behind it.
- If two or more leads in the group have AI Autopilot on and one of them is due, create one Other Task for the primary's owner, unless one is open: title `Same client on [LD codes]: merge or switch off extras`, kind `other`, category `General`, priority `medium`, date today. Description: the codes, the profile on each, and "AI follows up only on [primary]. Switch AI Autopilot off on the others, or merge them."

### Promise task

An Other Task (kind `other`, category `General`) whose title starts with `Client promise:`.

## Dry run

When the run prompt says DRY RUN, do every read, the research, the writing and the validation, but change nothing. Do not send, do not log notes, do not create, update or complete tasks, do not change leads or follow-up dates. Do not run `crm_leads_upwork_fetch` or `crm_leads_upwork_find_room` either, because both write to the lead. The report then lists each message that would have been sent (full text, profile, angle, the facts and their sources) and each task that would have been created.

## Phase 0. Load and check (stop on any failure, send nothing)

1. `sup_get_skill` `bd-followup-autopilot` and `sales-followup-generator-seo`, fresh.
2. `crm_ai_get_settings`. Keep the enabled rules and `upworkRestricted`.
3. `sup_get_guardrails` and the Communication Guide (`sup_get_long_term_context` slug `communication-guide`). Read them once per run.
4. `crm_profiles_list {platform: "upwork"}` for canonical names, and `crm_team_list` for who counts as a person.
5. The lead list (see Reading big results). Build the client groups.
6. The counts from the audit log (see How the counts are read). Work out what is left of every cap. Note the run start time for the run time limit.

## Phase 1. Promise sweep: client says when they will get back

Goal: when a client commits to a time ("I will let you know on Friday", "back next week", "deciding by end of month"), the team sees it in Tasks, and the autopilot does not nudge the client before that time.

1. Candidates: leads in the list whose `lastContact` is today or yesterday, plus every lead in the due queue. Keep in-scope leads only.
2. For each, read the client messages (`dir` "in") from the last 16 hours (`crm_conversations_list_for_lead {leadId, since}`).
3. A promise is the CLIENT saying when THEY will reply, decide, be back, or have something ready. Our own promises do not count. Neither does a vague "I will think about it" with no time in it.
4. Work out the promised date P from the message's own timestamp, not from today:

```
named weekday ("Friday")        -> the next such day on or after the message date
"tomorrow"                      -> message date + 1 day
"end of the week"               -> Friday of that week
"next week"                     -> Monday of the next week
"end of the month"              -> last day of that month
"in a few days"                 -> message date + 3 days
an event with a known date      -> that date
anything you cannot pin down    -> message date + 7 days, and say "date estimated" in the task
```

5. Task due date D is the next business day (Mon to Fri) after P. AI backup date B is the next business day after D. If D is already in the past, use today for D and the next business day for B.
6. Put the task on the group's primary lead. Dedupe: if any lead in the group already has an open promise task, do not create a second one. If the client gave a new date, move that task to the new D with `crm_tasks_update` and add the new quote to its description.
7. Create the task:

```
crm_tasks_create {
  leadId:      "LD-####",
  title:       "Client promise: reply by [Fri 17 Oct]. Follow up",
  kind:        "other",
  category:    "General",
  assignee:    [lead owner, or "Claude" when the owner is ai, Claude or empty],
  priority:    "high",
  date:        [D],
  description: [the client's exact words, when and on which channel they said it,
                "date estimated" if it was, and this line:
                "If this task is still open on (B), the AI will send a follow-up that mentions this promise and close the task."]
}
```

8. Hold the autopilot: for every lead in the group with AI Autopilot on and `nextFollowup` before B, call `crm_leads_set_followup {id, date: B, mode: [that lead's current followupMode]}`. Never pull a later date earlier.
9. Send nothing in this phase. The reply autopilot answers the client's message itself.

## Phase 2. Promise backups: the owner did not act

1. `crm_tasks_list {category: "General"}`: keep open tasks titled `Client promise:` with a date before today.
2. For each one, read the group's timelines since the task was created:

```
the client wrote since then                      -> crm_tasks_complete, note "Client replied on [date]. No chase needed. Closed by AI."
a person sent the client a message since then     -> crm_tasks_complete, note "Owner followed up on [date]. Closed by AI."
neither                                           -> queue the primary lead for Phase 3 as a PROMISE follow-up (sent first)
```

3. After a promise follow-up is sent, complete the promise task: `[AI-FU] Client did not come back by [P]. Sent a follow-up on [channel] as [profile] mentioning their promise.`

## Phase 3. Due follow-ups

### Build the queue

Due means in scope, AI Autopilot on (`aiPaused` false), `aiSendBlocked` false, `followupStopped` false, and `nextFollowup` set and on or before today. An empty `nextFollowup` is not due.

Collapse the due leads to client groups and keep only each group's primary (siblings: SKIPPED "Same client as [primary]").

Order: promise follow-ups from Phase 2 first. Then the oldest `nextFollowup` first. On the same date, stage proposal or negotiation goes before contacted or new.

### Gates (check in this order; the first failure decides)

1. Route. Use the channel the client last wrote on. If there is none, use the lead's channel or source.
   - Upwork: needs `upworkRoomId`. If it is missing, run `crm_leads_upwork_find_room {leadId}`; a confident match is saved on the lead. If there is still no room, there is no route.
   - WhatsApp: needs a mobile number with a country code.
   - Email (non-website leads only): needs the lead's email and an Email entry with a `gmailId` on the timeline.
   - LinkedIn: there is no send route.
   - No route: create one Other Task for the owner, unless one is open: title `No send route: follow up by hand or stop the cadence`, kind `other`, category `General`, priority `medium`, date today. Description: the channel tried, and "The AI cannot reach this client from the CRM." SKIPPED "No send route". In later runs these only add to a count in the report.
2. Fresh thread. On Upwork, run `crm_leads_upwork_fetch {leadId}` first so messages the CRM missed are logged. Then read the group's FULL timelines (see Reading big results).
3. `crm_leads_reply_status {leadId}`. If `replying` is true: SKIPPED "Reply autopilot is on it".
4. Owner stop notes. Read the completion notes of the lead's tasks (`crm_tasks_list_for_lead`) and the internal notes on the timeline. See Owner stop notes below.
5. Read the thread and decide:

```
client asked us to stop messaging              -> Opt-out handling, send nothing
client's last message is newer than ours       -> SKIPPED "Client is waiting on a reply" (the reply autopilot's job); flag it if older than 6 hours
a message to this client was sent today        -> SKIPPED "Client already heard from us today" (any writer, any lead in the group)
our last really-sent message under 20 hours    -> SKIPPED "Cooldown"
an outbound waits for a person to send it      -> HELD "A message is waiting for a person to send" (delivery pending, "awaiting human send", "placed in composer")
open promise task with backup date in future   -> SKIPPED "Holding for the client's promised date"
client's last message promised a date, no task  -> date not passed yet: create the promise task (Phase 1 steps 4 to 8), SKIPPED "Holding for the client's promised date"
                                                   date already passed: send it as a PROMISE follow-up (mention their promise)
call booked and still upcoming                 -> SKIPPED "Call booked" (check crm_meetings_list {lead_id: [lead dbId]})
a time was proposed and is still unanswered    -> HELD "Scheduling pending, needs a person"
we owe them something only a person can make   -> HELD "Waiting on our quotation/proposal/files" (see below)
any entry unreadable or sender unclear         -> HELD "Thread unreadable"
otherwise                                      -> ready
```

"We owe them something" means our last really-sent message promised a quotation, proposal, plan or files ("Let me evaluate this and I will send you a detailed quotation shortly", "Let me put that together and share it here shortly"), and the timeline shows it was never sent. A nudge would ignore that. Create one Other Task for the owner, unless an open one exists: title `Owed to client: [what]`, kind `other`, category `General`, priority `high`, date today.

6. Caps and time. If the daily cap, run cap, the profile's caps or PROFILE BUSY are used up, or the run time limit has passed: DEFERRED "[which limit]". The template keeps the lead due, and the next run picks it up.

### Owner stop notes

Sometimes a teammate writes "no need to follow up", "stop the cadence", "recommend stopping" or similar in a task note or a timeline note, but leaves AI Autopilot on.

```
written by a person (completedBy / loggedBy is on the team)   -> treat it as the owner switching the lead off:
                                                                 crm_leads_update {id, aiPaused: "true"},
                                                                 crm_activity_log {leadId, kind: "field", field: "AI Autopilot", from: "on", to: "paused (owner note: [their words])"},
                                                                 PAUSED "Owner note"
written by an automation, or relayed ("confirmed by Sahil")    -> HELD "Note says stop, needs the owner"; one Other Task for the owner, unless one is open:
                                                                 title "Note says stop following up: switch AI Autopilot off if you agree",
                                                                 kind other, category General, priority medium, date today
```

A note that only says a follow-up was done is not a stop note.

### Send order and rotation

Group the ready leads by canonical profile and take them round-robin: one lead from profile A, then B, then C, then back to A. Never send twice in a row from one profile while another profile has a ready lead. Leave at least 10 minutes between two sends from the same profile. When only one profile has leads left and its gap is not up, do another lead's research first or leave the rest for the next run.

## Research (per ready lead)

### Read first

- `crm_leads_get`, the group's full timelines, `crm_lead_suggestions_list {leadId}` (follow active suggestions where they fit), `crm_leads_research_get {leadId}`, and `crm_tasks_list_for_lead`.
- Earlier `[AI-FU]` notes on the group's leads. Never reuse an angle or an insight that an earlier note or message already used.
- Anything already pitched, offered, objected to or declined. Never pitch again what they said they do not need.
- Older outbound messages written by automations may contain figures nobody checked ("40%", "3 to 5x reach"). Never repeat a number, result or claim from an earlier automation-written message. Use only what the client said, what a person on our team wrote, the knowledge base, the examples library, and what you read during this run.

### Pick one angle that has not been used on this client

```
SITE        something concrete on their own pages: no reviews on a key product, sold-out sizes, missing details buyers compare on, a broken or empty page, no clear next step for a visitor, page title or description problems visible in the page metadata
SEARCH      what a buyer in their market actually sees for a search they would type, and whether the client shows up
COMPETITOR  one to three competitors from those results and one specific thing each does, taken only from their own page
PROOF       a matching row from crm_examples_search, described the way the library states it, by industry only: never the client's name, never a link
OBJECTION   a concrete answer to a question or worry from the thread, with the first step you would take
NEWS        a real, recent (last 90 days) change in their industry or in search/AI found with firecrawl_search, from a reputable source
```

### Firecrawl

- Website: use the lead's `website`, or a site the client wrote themselves in the thread or job post. Never a guess, never a platform page such as an Upwork job post (some leads hold one in the website field: ignore it). Scrape the homepage, plus one product, service or location page that fits the angle.
- If there is no website, research from the job post. You may search the company name and location. Use a site only if the brand name and location on it clearly match what the client gave, and never save a guessed site on the lead.
- Search like a buyer: `[product or service] [city or country]`. Note who shows up and what kind of pages win (review roundups, directories, maps, marketplaces, shops).
- Every insight must be something you actually read on a page during this run. No numbers that were not on the page. No claims about pages you did not open.

### Log the research before sending

Once the message has passed validation, and right before sending it, log the facts it uses as an internal note on the primary lead. This makes them part of the lead record (the "only real facts" rule), gives the team an audit trail, and is how the daily cap is counted. The CRM accepts only its fixed message types; use `Client Background Info`:

```
crm_conversations_log {
  leadId:  "LD-####",
  dir:     "note",
  type:    "Client Background Info",
  channel: [the route],
  text:    "[AI-FU] profile=[canonical profile] | angle=[ANGLE] | [YYYY-MM-DD]
            Facts used:
            - [fact 1]
            - [fact 2]
            Sources:
            - [page address]
            - [page address]"
}
```

If this log fails, do not send. Source addresses belong in this internal note only, never in the message.

## Writing the message

Follow `sales-followup-generator-seo` Step 4, with these rules on top:

- 70 to 170 words. A promise follow-up or a reply to a short "not now" can be 40 or more.
- Greeting line `Hi [first name],`, matching how earlier messages greeted them. No sign-off and no name at the end (Upwork shows the profile).
- Open with the insight itself. Two or three findings may go in a short hyphen list. One finding goes in a plain paragraph.
- End with one easy next step: usually one short question about their business. Offer a call only when the thread is warm, and only through the calendar. Never propose times. Never anything free.
- Promise follow-up: mention their promise lightly, then add the new insight. For example: "You mentioned you would have an answer by Friday, so no pressure. One thing that might help the decision: ..."
- Gap over 21 days since the last client-facing message: acknowledge it lightly, without guilt.
- They said "not interested", "went with someone else" or "not now": keep to the template, but send a short value-only note with no pitch and no call ask, and respect their choice.
- Never mention Firecrawl, scraping, tools, AI, a schedule or automation.

### Natural tone (owner requirement)

Write the way a busy person types in a chat after looking at the client's business today. Avoid polished marketing copy.

- Short sentences of mixed length. Plain words. Contractions are fine.
- Not perfectly structured. Do not use the same three-part shape every time. One small list at most.
- No flattery, no hype, no exclamation marks. At most one question.
- Never: delve, leverage, elevate, robust, seamless, unlock, game-changer, cutting-edge, tailored solution, in today's landscape, I hope this finds you well, I wanted to reach out, just following up, circling back, touching base.
- Vary the openings: no two messages in a run start with the same five words.
- No em dashes or en dashes. Use commas or plain hyphens. No emojis.

## Validation gate (all must pass)

```
V1  no links: no "http", no "www", no bare domain (any word followed by a dot and .com, .co, .net, .org, .io, .ai, .uk, .au, .ca, .in, .app, .shop, .store ...), no "@"
V2  Upwork: no word or phrase from upworkRestricted (case-insensitive), no contact details
V3  no phrase from any enabled AI rule, and nothing any enabled rule forbids: calls now or at a time, joining a call,
    checking with the team, prices or terms, free work or trials, deadlines, guaranteed results, documents never sent, another client's name
V4  no currency symbols or price figures unless repeated exactly from a person's earlier message in this conversation
V5  no em or en dash, no emoji, no markdown, no sign-off
V6  every fact traces to the research note, the lead record, what the client said, what a person on our team wrote, a knowledge passage or an examples row;
    nothing taken from an earlier automation-written message
V7  says something specific to their business; repeats no angle or sentence from any earlier message to this client, sent or not
V8  length within the limits above
V9  natural tone: no banned word or opener; does not read like a template
```

If any check fails, rewrite once. If it fails again: HELD "Failed validation: [check]", log `crm_activity_log {leadId, kind: "note", field: "AI follow-up", to: "held: [check]"}`, and send nothing. If the CRM refuses a send because of a rule, treat that as a failed check.

## Sending

```
Upwork    crm_leads_upwork_send {leadId, text}
WhatsApp  crm_whatsapp_send {leadId, text}
Email     crm_email_send {leadId, to: [lead email], subject: "Re: [subject of that thread]", body: text, inReplyTo: [latest gmailId on the timeline]}
```

These calls log the message on the timeline themselves. Do not log it again.

- Resolve the profile named in the send result to its canonical name. Rotation and profile caps use it. If it differs from the profile you expected, report it.
- An Upwork error that hints at a limit, restriction, captcha, auth problem, 403 or 429: stop all Upwork sends for this run and put it at the top of the report.
- Any other send error: SKIPPED "Send failed: [reason]". Do not try another channel.

## After each send

1. `crm_tasks_list_for_lead`. If the lead's Followup task (category `Followup`) is still open, complete it: `crm_tasks_complete {id, note: "[AI-FU] Follow-up sent on [channel] as [profile], [date]. Angle: [ANGLE]. [one line on what it said]."}`. Completing it schedules the next touch from the template. If the CRM already closed it from the logged message, leave it.
2. If the lead had no Followup task at all: `crm_leads_set_followup {id, date: today + the template's next gap, mode: [current followupMode]}`. The template gaps come from `crm_followup_templates_list`: use the gap at index `followupsTaken`, or the last gap when `repeatLast` is true and the index runs past the end.
3. `crm_leads_get` and confirm that `nextFollowup` is now in the future. If it is not, set it as in step 2.
4. Never edit `followupsTaken`. Never close a Followup task that has no really-sent message behind it.
5. For a promise follow-up, also complete the promise task (Phase 2, step 3).

## Opt-out (client asks us to stop)

An opt-out is any wording that asks us to stop contacting them: "stop messaging me", "do not contact me", "please stop", "remove me", "unsubscribe", "no more follow-ups", "leave me alone", "not interested, please do not message again".

A plain "not interested", "we hired someone else", "not now" or "maybe later" is NOT an opt-out. The template continues (see Writing).

On an opt-out, for every lead in the client's group:

1. `crm_leads_update {id, aiPaused: "true"}`. This pauses AI Autopilot on the lead.
2. `crm_activity_log {leadId, kind: "field", field: "AI Autopilot", from: "on", to: "paused (client asked to stop on [date]: [their words])"}`.

Then one Other Task for the primary's owner, unless one is open: title `Client asked to stop messages. AI follow-ups paused`, kind `other`, category `General`, priority `medium`, date today. Description: their words, plus "Decide whether to close the lead or stop the cadence." Send nothing.

## Report (end of every run)

Plain text, no em dashes:

```
BD Follow-up Autopilot  [date time IST]  run time [minutes]
Daily cap: [used before run]/100 before this run, [sent] sent now, [left] left today
Sent [n] | Promise tasks [n] | Promise backups [n] | Paused [n] | Held [n] | Skipped [n] | Deferred [n] | Errors [n]
Per profile (AI follow-ups this run / all Upwork messages today): [profile] [n]/[n], ...

[LD-####] [Client] | SENT Upwork as [profile] | angle [ANGLE] | next FU [date]
[LD-####] [Client] | PROMISE TASK for [owner]: "[quote]" -> due [D], autopilot held to [B]
[LD-####] [Client] | PROMISE BACKUP sent as [profile]
[LD-####] [Client] | PAUSED: [client asked to stop / owner note]
[LD-####] [Client] | HELD: [reason]
[LD-####] [Client] | SKIPPED: [reason]
[LD-####] [Client] | DEFERRED: [which limit]

Needs a person: [lead codes with one-line reasons]
Same client on several leads: [groups, with the primary marked]
No send route (task created or already open): [count, new codes this run]
Profile name surprises: [send result names that did not match the expected profile]
```

If Upwork sends were stopped because of an error, or the audit log could not be read, that goes on the first line.

## Quick reference

```
SCOPE      BD Team, Autopilot on, not website leads, not won/lost/archived/unqualified
ORDER      promise sweep -> promise backups -> due follow-ups
NAMES      canonical = profile record name; aliases Shivaji Kumar Ram -> Shivaji, Prem Chandra -> Prem; never match on looks
CLIENTS    group duplicate leads; only the primary is followed up; one follow-up per client per day from any writer
PROMISE    task for owner, due next business day after the promise; autopilot held one more business day; AI backup after that
GATES      route -> fetch thread -> reply status -> owner stop notes -> thread state -> caps and time
SENT       only really-sent messages count; drafts and "awaiting human send" do not; never close a task with no message
RESEARCH   one new angle, max 2 scrapes + 2 searches, facts read today only, logged as a Client Background Info [AI-FU] note
WRITE      70-170 words, natural, no links, no prices, one easy question, no sign-off, no figures from old automation messages
VALIDATE   V1-V9; one rewrite; then hold
SEND       Upwork room / WhatsApp / email thread; round-robin profiles; 10 min same-profile gap
AFTER      close the Followup task (the template schedules next); confirm nextFollowup moved
LIMITS     100/day, 40/run, 100 min/run, 3/profile/run, 10/profile/day, 15 Upwork messages/profile/day all writers, 20h client cooldown
STOP       client asks to stop, or a person's note says stop -> aiPaused true + activity log (+ owner task for a client stop); nothing sent
```

## Note for maintainers

Supercharge's markdown conversion merges consecutive lines inside a list item, and it deletes anything written inside angle brackets, even inside code blocks. Keep multi-line examples and mappings inside fenced code blocks, and write every placeholder in [square brackets]. After any `sup_update_skill`, re-fetch with `sup_get_skill` and check that the code blocks and lists still read correctly.
