# CRM changes the follow-up autopilot needs

From the first live run of `bd-followup-autopilot` (16 Oct 2026). Skill v1.01 works around all of these, but the CRM is the right place to fix them. Ordered by impact.

## 1. One client, several leads (highest risk)

34 clients have more than one active BD lead (78 leads in total), usually one per profile that bid on the same job. Examples with AI Autopilot on for two or more of their leads: Vanessa Grace Calvo (LD-3086, LD-3087, LD-3088), Greg D. (LD-3095, LD-3096), Houston Anderson (LD-3073, LD-3074), Adam Sweeney (LD-1555, LD-1556), Chady Khouzame (LD-1109, LD-1165), Brencee Alviz (LD-1198, LD-1199).

Each lead has its own cadence, so the same client can get two follow-ups the same day from two of our profiles.

Fix: link leads for the same Upwork job (job id in `jobUrl`) or the same client. One primary lead owns the cadence, and the others follow it. A merge action on the lead page would also help.

Skill workaround: it groups these leads, follows up only on the primary lead, sends at most one follow-up per client per day, and creates a "Same client on ..." task for the owner.

## 2. One canonical name per profile

The profile records are named `Shivaji` and `Prem`. Leads store `Shivaji Kumar Ram` (11 leads) and `Prem Chandra` (19 leads) in `profile` or `secondarySource`. The send result returns the short name.

Fix: store the profile record's name, or better its id, on leads. One-time cleanup: rename those 30 values to the record names.

Skill workaround: it resolves every name to the profile record through a fixed alias table.

## 3. One writer for BD follow-ups

On 15 and 16 Oct, other automations also sent Upwork follow-ups on BD leads (for example LD-1526 and LD-1530). Their sends don't carry the `[AI-FU]` tag, so the autopilot's own counters miss them.

Fix: decide that `bd-followup-autopilot` is the only automated BD follow-up writer. Switch off other routines and sessions that send BD follow-ups, including `upwork-playwright-followups` if it is scheduled anywhere. If another writer must stay, it should log the same `[AI-FU] profile=` note before each send.

Skill workaround: the cooldown and "one per client per day" now count messages from every writer. A profile that has already sent 15 Upwork messages today (from any writer) gets no more AI follow-ups.

## 4. An internal note type

The message type field only accepts: Client Message, Our Reply, Job Details, Followup Message I sent, Call Transcript, Voice Call, Client Background Info, Documents Provided By Client, Video Transcription Provided By Client, Meeting Minutes, Document Shared by Us, Email draft, File uploaded.

Fix (optional): add an internal type such as "AI Follow-up Research".

Skill workaround: v1.01 logs research as `Client Background Info`, which the CRM accepts.

## 5. Closing a follow-up task should need a real message

Some Followup tasks were closed as "Confirmed done by Sahil on 13 Oct" with no message on the timeline. Others had messages logged as "placed in composer, NOT SENT" or "awaiting human send".

Fix: closing a Followup task should require a sent or logged outbound message, or an explicit reason that is not a touch (for example "lead lost").

Skill workaround: only messages that were really sent count. A message waiting for a person to send it makes the lead HELD.

## 6. Owners should use the switch, not a note

On three leads, the owner wrote "recommend stopping cadence" or "no need to follow up" in a task note but left AI Autopilot on.

Fix (team habit): switch AI Autopilot off, or stop the follow-up, when you mean stop. A "Stop follow-ups" button on the task close dialog would make this one click.

Skill workaround: a stop note written by a person pauses AI Autopilot. A stop note written by an automation is held and creates a task for the owner.

## 7. Save the Upwork room when the lead is created

Six of the due leads had no `upworkRoomId`. The room finder found five, and one has none.

Fix: save the room id when a lead is created from Upwork (the auto-check knows it at that point).

## 8. Leads with no way to reach them

Five LinkedIn leads (LD-2522 to LD-2526) have been due since 29 Aug, and the CRM has no LinkedIn send route. LD-2039 has been due since 7 Jul with no room, and its website field holds an Upwork job link.

Fix: a system health check for "follow-up due but no reachable channel". Also stop putting platform links (Upwork job posts) in the website field.

Skill workaround: it creates one "No send route" task per lead, then only counts these leads in later reports.

## 9. A "due follow-ups" filter

`crm_leads_list` has no filter for next follow-up date, AI Autopilot or source. The BD pipeline comes back as about 1 MB. Paging with `offset` works correctly (checked 16 Oct: offset 0 and offset 3 return different leads).

Fix: add filters `dueBy` (date), `aiPaused`, `followupStopped` and `source` to `crm_leads_list`, or add a small `crm_leads_due_followups` endpoint that returns only the fields the autopilot needs.

## 10. Timeline paging or summary

Some lead timelines are over 100,000 characters.

Fix: add `limit` and `before` paging to `crm_conversations_list_for_lead`, and a `dir` filter (in, out or note), so client-facing messages can be read without the transcripts.

## 11. Admin account for the scheduled run

The daily cap reads `crm_audit_events`, which is admin only. The routine must run under an admin account. If it doesn't, the skill drops to 33 sends per run and says so on the first line of its report.

## 12. One-time cleanup of old outbound messages

Older outbound messages from earlier writers contain figures nobody checked, such as "40%" and "3 to 5x reach". The skill now never reuses figures from automation-written messages, but a one-time review would remove the risk for every writer.
