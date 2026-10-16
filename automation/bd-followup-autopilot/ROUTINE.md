# BD Follow-up Autopilot: routine setup

## Schedule

Three runs a day, India time:

```
16:40 IST  (11:10 UTC)  UK afternoon, Australia evening; after the CRM's 16:00 IST follow-up task job
21:40 IST  (16:10 UTC)  UK late afternoon, US East midday
01:40 IST  (20:10 UTC)  US East afternoon, US West midday
```

Cron: `CRON_TZ=Asia/Kolkata 40 1,16,21 * * *`

All three runs fall inside the team's 2 PM to 2 AM IST call window, so a client who answers a follow-up and wants to talk reaches the team while they are working.

The runs are at least 4 hours apart, and the skill stops starting new sends after 100 minutes, so two runs never overlap. Keep any new schedule at least 2 hours apart.

## Connectors the routine needs

- Internal CRM, connected with an ADMIN account. The daily cap and the per-profile counts read the admin-only audit log. Without admin access, the run drops to 33 sends and says so on the first line of its report.
- Supercharge MCP (Skill Manager)
- Firecrawl

## Routine prompt (paste as is)

```
Run the BD Follow-up Autopilot for the BD Team pipeline.

1. Pull the skill "bd-followup-autopilot" fresh from Supercharge Skill Manager with sup_get_skill and follow it exactly. Also pull "sales-followup-generator-seo" fresh, as that skill says.
2. Do one full run: Phase 0 checks, Phase 1 promise sweep, Phase 2 promise backups, Phase 3 due follow-ups, then the report.
3. This is an unattended scheduled run. Do not ask questions. When something needs a person, hold it and list it under "Needs a person" in the report.
4. Respect every hard limit in the skill: 100 AI follow-ups per IST day across all runs, 40 per run, 100 minutes per run, canonical profile names, 3 per profile per run, 10 per profile per day, no sends from a profile with 15 Upwork messages today from any writer, one follow-up per client per day across all their leads, round-robin profiles, at least 10 minutes between two sends from the same profile, and stop all Upwork sends at the first Upwork limit or restriction error.
5. If any Phase 0 check fails, send nothing and report why.
6. End with the report in the format the skill gives.
```

## First run: dry run (recommended)

Run this once by hand before you switch the schedule on. It researches and writes the follow-ups but sends and changes nothing:

```
DRY RUN. Run the BD Follow-up Autopilot for the BD Team pipeline in dry-run mode: pull "bd-followup-autopilot" and "sales-followup-generator-seo" fresh from Supercharge Skill Manager, follow the skill's Dry run section, and process at most 10 due leads. Send nothing and change nothing in the CRM. Report every message that would have been sent (full text, profile, angle, facts and sources) and every task that would have been created.
```

## Kill switches

```
one lead       switch AI Autopilot off on the lead (aiPaused), or Block AI on the lead page
everything     pause or delete the routine
```
