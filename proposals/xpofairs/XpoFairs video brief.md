# XpoFairs Video Audit Brief

Input for `upwork-video-audit-proposal` Steps 3 to 7 on the Mac pipeline (`~/Apps/case-study-videos`).
Copy `jobs/atticare-proposal/storyboard.json` to `jobs/xpofairs-proposal/storyboard.json` and fill it from this brief.

## Job

| Field | Value |
|---|---|
| Job | SEO & AEO Specialist / Agency, B2B Trade Show Network |
| URL | https://www.upwork.com/jobs/~022112535898385083910 |
| Posted | 2026-10-20 13:26 UTC |
| Contract | Hourly, no rate stated, 30+ hrs/week, 3 to 6 months, Expert |
| Proposals | 20 to 50 |
| Hiring activity | 0 invites, 0 interviews, 0 offers, 0 hired |
| Client | United Kingdom (Europe/London), spend 690 USD, 4 hires, 1 review rated 4.0 by freelancers |
| Connects | 16 (Ankur Gupta balance 91) |
| Website | XpoFairs.com, named in the post as the hub of 7 sites |
| Client name | Not given anywhere, open with "Hi" |
| Required first word | None |
| Contact rule | None stated, outro uses "Reply here on Upwork" |
| CRM check | No team cover for this job URL in crm_cover_submissions_list since 2026-10-19 |

## Scenes

Top level: `"screenShare": true`, `"music": false`, `"outputSuffix": "video-audit"`, voice block exactly as in the atticare example.
Capture: kind url, viewport 1600x860. Setup: accept or hide the cookie banner on every scene except Scene 3, where it is a finding.

### Scene 1 - Live on the homepage

URL: https://xpofairs.com/
Actions: wait, inspect rows `title`, `schema`, `h1`; zoom onto `#__cs_insp`; mark the title row, then the schema row (bad).
Narration (58 words):
> Hi, I'm on xpofairs.com right now. The page title is Trade Shows. Faster. Cheaper. Easier. Better. It never says XpoFairs, and it never says online trade show. And when I check the page code, there is no structured data at all. No Organization markup, so AI tools have nothing solid to read the brand from.

### Scene 2 - robots.txt and sitemap.xml

URL: https://xpofairs.com/robots.txt, then goto https://xpofairs.com/sitemap.xml (idle false).
Actions: mark the nginx "404 Not Found" heading; goto sitemap; mark the "404 Look like you're lost" heading.
Narration (54 words):
> Now the two files crawlers look for first. robots.txt returns a 404 from the server. sitemap.xml lands on this 404 page too. So Google and the AI crawlers get no map of the shows, the event pages or the exhibitor lists. They have to find every page by following links.

speech: "robots dot T X T", "sitemap dot X M L"

### Scene 3 - The Gift Fair UK 2026 event page

URL: https://xpofairs.com/events-box-office/eventdetails/uk-gift-fair-sep-2026
Actions: wait for the exhibitor table; inspect rows `h1` (bad), `schema` (bad); mark the details box ("Type: TRADE_ONLY", empty Industry and Website); mark the cookie banner text.
Narration (66 words):
> This is The Gift Fair UK 2026 page, with 122 exhibitors listed. There is no H1, and no Event markup with the dates and the venue. The details box shows Type, TRADE underscore ONLY, with Industry and Website left empty. And the cookie banner still says, so the deal is, we want to spy on you. That is template copy every new buyer sees.

### Scene 4 - What AI search says today (rows)

Run on the Mac, 3 times each, and fill the pills from the results (format "XpoFairs 0 of 3", tone bad only if it is 0):
1. best online trade shows for gift retailers
2. online gift trade show UK 2026
3. virtual trade show platform for exhibitors
4. online toy trade show for buyers

Command: `node scratch/ai-answers.mjs /work/ai-answers.json "XpoFairs"` plus the 4 questions. State the run date on screen.
Narration: write after the run, 30 to 50 words, naming who AI tools recommend instead.

### Scene 5 - Live Search Console proof

Copy the GSC scene from `jobs/soundbreak-ai-proposal` (Neolemon, sc-domain:neolemon.com). Follow the GSC clip recipe in the skill.
Narration (44 words):
> Here is a live Search Console account. Neolemon, an AI cartoon app. The query ai cartoon generator moved from position 10 to 5.8, and clicks went from 280 to 1,706, comparing November to January with February to April.

### Scene 6 - The plan (rows, mapped to the post's two phases)

| Row | Text |
|---|---|
| Months 1 to 3 | robots.txt and sitemaps on all 7 sites |
| Months 1 to 3 | Organization and Event schema, titles and H1s |
| Months 1 to 3 | AI visibility baseline: ChatGPT, Gemini, Claude, Perplexity, Grok, AI Overviews |
| Months 4 to 6 | Show and exhibitor content, cross-site linking without overlap |
| Months 4 to 6 | Third-party mentions, re-test the same prompts every month |

Narration (52 words):
> Here is how the 6 months would run. Months 1 to 3: fix crawling on all 7 sites, add the schema, fix the titles, and set an AI visibility baseline. Months 4 to 6: show and exhibitor content, linking the sites without them competing, outside mentions, and the same prompts re-tested every month.

### Scene 7 - Outro

"Want these fixed?" / "Reply here on Upwork."
Narration (8 words):
> Want these fixed? Just reply here on Upwork.

Total before Scene 4: about 282 words, about 1:45. Scene 4 brings it to about 2:05 to 2:15.

## Sources

Checked 2026-10-20 through Firecrawl (live fetch, maxAge 0). Direct curl from the cloud session was blocked by its network policy, so re-check each line with curl on the Mac before recording.

| Claim | Source |
|---|---|
| Homepage title "Trade Shows. Faster. Cheaper. Easier. Better." | https://xpofairs.com/ `<title>` |
| Homepage H1 "online trade shows. reimagined." | https://xpofairs.com/ rendered HTML |
| No JSON-LD on the homepage | https://xpofairs.com/ rendered HTML, 0 `application/ld+json` blocks |
| No JSON-LD on What's On | https://xpofairs.com/events-box-office rendered HTML, 0 blocks |
| No JSON-LD on The Gift Fair UK 2026 | https://xpofairs.com/events-box-office/eventdetails/uk-gift-fair-sep-2026 rendered HTML, 0 blocks |
| robots.txt 404 | https://xpofairs.com/robots.txt, HTTP 404, nginx/1.28.0 page (www redirects to the same) |
| sitemap.xml 404 | https://xpofairs.com/sitemap.xml, HTTP 404, "Look like you're lost" page |
| sitemap_index.xml 404 | https://xpofairs.com/sitemap_index.xml, HTTP 404 |
| llms.txt 404 | https://xpofairs.com/llms.txt, HTTP 404 |
| Event page has no H1, only H2 "What's On / THE GIFT FAIR UK 2026" | event page rendered HTML |
| "Type: TRADE_ONLY", empty Industry and Website | event page text |
| 122 exhibitors | event page "Exhibitors 122" |
| Event title "Xpo Fairs \| The Gift Fair UK 2026" | event page `<title>` |
| Cookie banner "So the deal is, we want to spy on you. We want to know things like what you had for breakfast this morning." | events-box-office, event page and blog page text |
| About page reuses the homepage title and description | https://xpofairs.com/about-us metadata |
| Footer links 4 show sites: The Gift Fair UK (thegiftfair.com), The Gift Fair US (thegiftfair.us), The Toy Show (toyfairinternational.com), Sports Licensing Now! (sportslicensingnow.com) | homepage footer |
| Neolemon GSC numbers | Proof library in the skill, shown live in Search Console |

## Reserve findings (verified, not in the script)

1. Footer "Future Star Award", "Referral Scheme" and "Booth Design Award" all link to https://xpofairs.com/; "Cookie Policy" links to the Terms page; "Instruction Videos" links to the FAQ.
2. Footer Instagram icon goes to instagram.com/thegiftfair.uk, not an XpoFairs account.
3. og:url is https://xpofairs.com on the What's On, event and blog pages, so every shared link previews as the homepage.
4. Homepage marquee repeats "attend, discover, chat, connect, meet" as H3 headings, 58 times each (290 H3s) in Firecrawl's desktop render. Re-count live at 1600x860 before using a number.
5. Upcoming show images on the homepage have alt text "Trade Show 0" to "Trade Show 4", no show names.
6. The 404 page sends both "noindex" and "index, follow" robots tags.
7. Sports Licensing Now! event slug says 2026 (eu-sports-licensing-now-2026) while the dates are Sep 16 to 29 2027.

## Still to do on the Mac

1. Re-check every source line with curl (desktop Chrome UA, 0.5 s gaps).
2. PageSpeed: `node scratch/psi.mjs https://xpofairs.com/`. Raise speed only if Core Web Vitals fail for real users.
3. AI baseline for Scene 4.
4. Steps 3 to 7: storyboard, voice, preview, render, verify, upload Unlisted to "Proposals and Audits".
5. Put the youtu.be link into the cover, set the sign-off name, re-run the lint.
