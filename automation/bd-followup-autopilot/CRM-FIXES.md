# CRM code changes for the follow-up autopilot

Code changes only. Each one fixes its problem in the CRM itself, with no dependence on people changing habits. Found in the first live run of `bd-followup-autopilot` (16 Oct 2026). Ordered by impact.

## 1. Link leads that belong to the same client

Problem: 34 clients have more than one active BD lead (78 leads in total), usually one per profile that bid on the same Upwork job. Each lead has its own cadence, so one client can get two follow-ups the same day from two profiles. Examples: LD-3086, LD-3087 and LD-3088 (Vanessa Grace Calvo); LD-3095 and LD-3096 (Greg D.); LD-3073 and LD-3074 (Houston Anderson).

Change:
- Add `primaryLeadId` (or a `clientGroupId`) on leads.
- When a lead is created, auto-link it to existing leads with the same Upwork job id (the part of `jobUrl` after the `~`) or the same `upworkRoomId`. If none, link on same name, company and country.
- The primary lead is the one where the client wrote most recently (else the oldest). Only the primary gets a cadence and Followup tasks. Linked leads show "Follow-ups run on LD-xxxx".
- One-time migration to link the existing 78.
- A merge action on the lead page.

Done when: the follow-up task job never creates two open Followup tasks for one client group, and `crm_leads_list` returns `primaryLeadId`.

## 2. Send guard inside the CRM, for every writer

Problem: several automations send follow-ups on the same BD leads. The skill's caps only see its own sends, so real volume per profile and per client is higher than the caps show.

Change:
- Enforce two checks in `crm_leads_upwork_send` (and the email and WhatsApp send paths for agents):
  - at most one outbound message to a client group per IST day for automated follow-ups;
  - a per-profile daily limit on Upwork sends.
- Refuse the send with a clear reason when either limit is hit, whoever the caller is.
- Store `sentBy` (the writer: skill name, live-chat, auto-check, person) on every outbound entry.

Done when: a second automated follow-up to the same client on the same day is refused, and every outbound row shows which writer sent it.

## 3. A non-admin "sent today" count

Problem: the daily cap is counted from `crm_audit_events`, which is admin only. On a non-admin account the count fails.

Change: add a small endpoint, for example `crm_outbound_counts {date}`, readable by agents. It returns outbound counts for the IST day: in total, per canonical profile, per writer, and per client group.

Done when: a non-admin agent can read today's counts in one call.

## 4. Profile id on leads, one canonical name

Problem: the same profile appears as `Shivaji` and `Shivaji Kumar Ram` (11 leads), and as `Prem` and `Prem Chandra` (19 leads). Send results return the short name. Name-based counts can count one person as two.

Change:
- Store `profileId` (the profile record id) on leads, and return it from sends.
- Validate `profile` and `secondarySource` against the profile records on write, or derive the name from `profileId`.
- Migration: map the 30 variant values to the record names.

Done when: every Upwork lead has a `profileId`, and no lead holds a profile name that is not a profile record name.

## 5. Closing a Followup task needs a structured outcome

Problem: Followup tasks get closed with no message behind them ("Confirmed done by Sahil on 13 Oct"). Owners write "no need to follow up" in the note but the lead stays on Autopilot. Unsent messages are logged as normal outbound entries ("placed in composer, NOT SENT", "awaiting human send").

Change:
- `crm_tasks_complete` and the close dialog take a required `outcome` for Followup tasks:
  - `sent`: needs a linked outbound message with `delivery` sent, an Upwork story id or a Gmail id;
  - `stop`: sets `followupStopped` and pauses AI Autopilot on the lead;
  - `not_a_touch`: needs a reason, and does not count as a follow-up or advance `followupsTaken`.
- `crm_conversations_log` stores an unsent outbound as `delivery: "draft"` (or pending), never as a plain sent message.

Done when: no Followup task can be closed without an outcome, and `followupsTaken` only counts `sent` outcomes.

## 6. Save the Upwork room id when the lead is created

Problem: six of the due leads had no `upworkRoomId`. The room finder found five, and one has none.

Change: when the auto-check or lead capture creates a lead from an Upwork room, save the room id on it. Add a nightly backfill that runs the room finder on Upwork leads with no room and saves confident matches.

Done when: new Upwork leads always have `upworkRoomId`, and system health counts Upwork leads with no room.

## 7. Cadence stops on leads with no reachable channel

Problem: five LinkedIn leads (LD-2522 to LD-2526) have been due since 29 Aug, and there is no LinkedIn send route. LD-2039 has been due since 7 Jul with no room, and its website field holds an Upwork job link.

Change:
- Add a system health check: "follow-up due, but the lead has no reachable channel" (no Upwork room, no mobile with a country code, no email thread, and no LinkedIn send route).
- The follow-up task job assigns such leads to the owner as a manual follow-up, so they stop counting as AI follow-ups.
- The website field rejects platform links (upwork, linkedin and similar) on write.

Done when: the health check lists these leads, and no AI follow-up is due on an unreachable lead.

## 8. An internal note message type

Problem: the message type field only accepts fixed types, none of which means an internal note. The autopilot logs research as `Client Background Info`.

Change: add an internal type such as `AI Follow-up Research` (or `Internal Note`) to the allowed list.

Done when: `crm_conversations_log {dir: "note", type: "AI Follow-up Research"}` is accepted.

## 9. A "due follow-ups" query

Problem: `crm_leads_list` cannot filter by next follow-up date, AI Autopilot or source. The BD pipeline comes back as about 1 MB, just to build a queue of about 34 leads. Paging with `offset` itself works correctly.

Change: add filters `dueBy` (date), `aiPaused`, `followupStopped`, `sourceNot` and `fields` (to return only chosen columns) to `crm_leads_list`. Or add `crm_leads_due_followups {dueBy, pipeline}`, which returns only the fields a follow-up run needs.

Done when: one call returns today's due queue in a few kilobytes.

## 10. Timeline paging and filtering

Problem: some lead timelines are over 100,000 characters, mostly call transcripts and uploaded documents.

Change: add `dir` (in, out, note), `types`, `limit` and `before` to `crm_conversations_list_for_lead`, plus a `maxTextChars` option that truncates long notes.

Done when: an agent can read every client message of a lead without loading transcripts.
