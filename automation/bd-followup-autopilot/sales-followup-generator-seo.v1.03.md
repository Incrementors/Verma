# sales\_followup\_generator

Rewrite of the "Followup Generator" n8n workflow as a single Claude-native skill. Generates a persuasive, value-first sales follow-up message to an existing lead, built entirely from that lead's real history in Internal CRM - no n8n, no Google Sheets, no Pinecone.

Complementary to the existing `sales-message-generator` Supercharge skill (which drafts general/first-touch replies to a prospect). This skill is specifically for the **follow-up cadence** case: nudging a lead who's gone quiet, is mid-negotiation, or needs a next-step push - with the discipline of always adding new value and escalating momentum rather than repeating the same pitch.

## Rule Precedence (read first)

The team's AI rules override this skill. Before drafting, call `crm_ai_get_settings` and follow every enabled rule for "all" and for the lead's channel. On Upwork, also keep out every word in `upworkRestricted`. Supercharge Guardrails come next, then this skill. A caller skill (for example `bd-followup-autopilot`) may add stricter rules on top.

## Required Input

-   **Lead ID** - the Internal CRM lead code (e.g. `LD-1079`). Required - if not given, ask for it. If given but not found in CRM, say so and stop; never guess at lead details.

-   **Message** - optional context for this specific follow-up (e.g. "they haven't replied in 5 days," a specific new development to mention, or research facts gathered by the caller). If not given, treat it as a generic scheduled nudge and let the conversation history alone drive the content.

-   **Messaging Platform** - optional (Upwork, LinkedIn, WhatsApp, Email). Channel names are never mentioned in the body, but the platform decides which AI rules apply and matters if/when the sent message gets logged (see Step 6).

## Step 1 - Pull the Lead's Real Context

-   `crm_leads_get({ id: leadId })` - name, company, website, requirement, source, stage, country.

-   `crm_conversations_list_for_lead({ leadId })` - the FULL conversation timeline. Read all of it, not just the latest message. Work out:

    -   What's already been offered, explained, or pitched (never repeat it).

    -   What objections or hesitations they've raised (a follow-up should address these more directly than a first message would).

    -   Their engagement level - warm and replying, or gone quiet.

    -   How much time has passed since the last message - acknowledge that gap if it's been days/weeks rather than pretending no time passed.

-   `crm_lead_suggestions_list({ leadId })` - what the team told the AI to do next on this lead. Follow the active ones where they fit.

-   **If there's no conversation history at all**: treat this as an initial outreach message instead of a follow-up - don't fabricate a "following up on our last conversation" framing when there wasn't one.

## Step 2 - Sales Q&A / Objection-Handling Reference

Knowledgebase entry KB-1007 ("Business Developer Messages Wikipedia") is now reachable: ask `crm_knowledge_search({ q: "[the objection or situation in plain words]" })` and read the passages that come back. Use them only as a secondary reference for tone and objection handling. The conversation history from Step 1 still drives what the message says.

**Never copy a link, a payment link, a price, a document reference or a template placeholder from a knowledge passage.** KB-1007 contains old Google Sheets, form and payment links. None of them may appear in a follow-up.

## Step 3 - Website Insight

When the caller passes research facts in **Message** (for example from `bd-followup-autopilot`, which researches the client's site, their search results and their competitors), build the new value from those facts. Use only facts that were passed in or that appear in the lead record, the conversation, the knowledge base or the examples library. Never invent a finding about their site.

## Step 4 - Draft the Follow-up

-   **Never explicitly recap** what was discussed before ("as we discussed," "following up on..."). Just deliver the new thing.

-   **Every message must carry real, specific value** tailored to this client's actual business and goals - not a generic tip. E.g. a local real estate client gets a short list of directories worth listing on; a SaaS client gets a specific positioning observation. The value must be as specific as their business, not templated.

-   **50-150 words** (a caller may set its own range). No filler, no hedging, straight to the point.

-   **Natural, personable tone** - write the way a person types in a chat, not polished marketing copy. Bullets only where they genuinely help, not by default.

-   Every message should, where relevant, do all of:

    1.  Add new value (never recycled from an earlier message).

    2.  Move the conversation forward, not repeat ground already covered.

    3.  Personalize based on what they've actually said or asked.

    4.  End with one clear next step (a question about their business, a specific action, or a call booked through the calendar). Never a free trial, free audit or any other free work.

    5.  Keep building the relationship - never read as "just checking in."

    6.  Offer slightly more than the last message did.

    7.  Match their energy - formal if they're formal, casual if they're casual.

-   **Handle objections more directly than a first message would** - if they raised a concern, address it head-on this time rather than softly.

-   **Vary the structure** from whatever shape the last message(s) used - don't reuse the same opening/closing pattern every time.

-   Write in the first person ("I"). Never write as "we" unless the client is clearly looking for an agency rather than a freelancer.

-   Contractions are fine. Keep it natural.

-   Never name a communication channel (WhatsApp, Skype, etc.) anywhere in the body.

-   **No links of any kind** - no URLs, no bare domains (not even the client's own site or ours), no email addresses, no case study, document, drive or booking links. Describe things in words. The one exception is a booking link that a caller skill explicitly requires for email (website-lead-auto-reply Phase B); never add any other link, and never a link on Upwork.

-   No em dashes - use commas or plain hyphens.

-   Keep vocabulary simple and conversational - no complex words, no AI-sounding words (delve, leverage, elevate, robust, seamless, unlock).

-   Never say "just following up" or "circling back" - open with the value instead.

-   No hedge language, no unnecessary qualifiers, no filler lines.

-   **Never state a price, rate, package or contract term**, even if directly asked. If pricing comes up and the exact answer is not already in the conversation, use the team's quotation line: "Let me evaluate this and I will send you a detailed quotation shortly."

-   Output the message text only - no subject line, ready to paste directly into chat or email.

## Step 5 - Final Output

Give the user:

1.  **The follow-up message** - clean text, ready to copy-paste as-is.

2.  A one-line note only if something's worth flagging - e.g. "no conversation history existed, so this reads as initial outreach instead of a follow-up" or "it's been three weeks since the last message, so this acknowledges the gap."

## Step 6 - Logging (deliberately different from the source workflow)

The source n8n workflow appended every generated draft to the "Conversation Logs" sheet immediately, unconditionally - before anyone reviewed, edited, or actually sent it. This skill does **not** do that by default. It matches the convention already established by the sibling `sales-message-generator` skill in this same system: **draft only** - logging is the caller's responsibility once the message is actually sent, since a draft can get edited or rejected before it goes out, and logging it prematurely would leave a false record.

If/when the user confirms this exact message (or an edited version of it) was actually sent, log it with:

```
crm_conversations_log({ leadId, text: "[the message actually sent]", dir: "out", channel: "[Email|WhatsApp|Upwork|LinkedIn]", type: "Followup Message" })
```

Never call this automatically as part of generating the draft. Send tools such as `crm_leads_upwork_send` log the message themselves, so a caller that sends with them must not log it again.

## Design Notes (for whoever maintains this skill)

-   Complementary to the existing global `sales-message-generator` skill, not a replacement for it - that one handles general/first-touch prospect replies (with website scraping, live GA/GSC proof, and CRM Examples case studies); this one is specifically the scheduled/triggered follow-up cadence from the n8n workflow, with its "always escalate value, never repeat the pitch" discipline.

-   Replaced the Google Sheets "Leads Central AI" > "Conversation Logs" tab lookup with Internal CRM's own `crm_leads_get` + `crm_conversations_list_for_lead`, per instruction - keeps lead context in one system instead of a spreadsheet.

-   v1.03 (16 Oct 2026): KB-1007 wired in through `crm_knowledge_search`, with a hard rule against copying its links. The team's AI rules take precedence. Added a no-links rule. The price line now matches the AI rules' quotation line. Removed "small trial" from next steps (the AI rules forbid free work). Contractions allowed for a natural tone. Website insight now comes from caller-supplied research (`bd-followup-autopilot`).

-   This skill contains no external URLs and must stay that way.

-   Placeholders are written in [square brackets] because Supercharge deletes anything inside angle brackets.

-   Deliberately does not auto-log the generated draft (unlike the source workflow) - matches the "drafts only, caller logs after actually sending" convention already used by `sales-message-generator` elsewhere in this system, so a draft that gets edited or never sent doesn't leave a false record in the lead's conversation history.

-   Standalone - doesn't touch lead stage, pipeline, or assignment.
