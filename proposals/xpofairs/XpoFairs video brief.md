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
> Now the two files that crawlers look for first. robots.txt returns a 404 from the server. sitemap.xml lands on this 404 page too. So Google and the AI crawlers get no map of the shows, the event pages or the exhibitor lists. They have to find every page by following links.

speech: "Robots dot T X T", "Site map dot X M L", "four oh four". Scene 4 speech: "V Fairs", "Hoova" (Whova), "See-vent" (Cvent), "Expo Fairs" for XpoFairs throughout. Each one checked with a Scribe v2 transcript.

### Scene 3 - The Gift Fair UK 2026 event page

URL: https://xpofairs.com/events-box-office/eventdetails/uk-gift-fair-sep-2026
Actions: wait for the exhibitor table; inspect rows `h1` (bad), `schema` (bad); mark the details box ("Type: TRADE_ONLY", empty Industry); mark the cookie banner text.
Narration (63 words, as recorded):
> This is The Gift Fair UK 2026 page, with 122 exhibitors listed. There is no H1, and no Event markup telling Google the dates. The details box shows Type, TRADE underscore ONLY, with the Industry field left empty. And the cookie banner still says, so the deal is, we want to spy on you. That is template copy every new buyer sees.

Changed on 2026-10-20 after the local re-check: the Website field is not empty (it links to https://www.thegiftfair.com/ as "Website Link"), so only Industry is called out. "The venue" was dropped because these are online shows with no venue on the page.

### Scene 4 - What AI search says today (rows)

Run on the Mac, 3 times each, and fill the pills from the results (format "XpoFairs 0 of 3", tone bad only if it is 0):
1. best online trade shows for gift retailers
2. online gift trade show UK 2026
3. virtual trade show platform for exhibitors
4. online toy trade show for buyers

Command: `node scratch/ai-answers.mjs /work/ai-answers.json "XpoFairs"` plus the 4 questions. State the run date on screen.

Results, Perplexity (perplexity/sonar via OpenRouter), 2026-10-20 15:05 UTC, run with brand regex `xpo ?fairs`:

| Question | Named instead | Pill |
|---|---|---|
| best online trade shows for gift retailers | The Gift Fair USA and Faire Market 3 of 3 | XpoFairs 0 of 3 (bad) |
| online gift trade show UK 2026 | The Gift Fair UK 3 of 3, "Powered by the XpoFairs virtual event platform" once | XpoFairs 1 of 3 (neutral) |
| virtual trade show platform for exhibitors | vFairs 3 of 3, Whova 2 of 3, Cvent 2 of 3 | XpoFairs 0 of 3 (bad) |
| online toy trade show for buyers | Toy Fair International and ToyFairEverywhere 3 of 3 | XpoFairs 0 of 3 (bad) |

Narration (48 words, as recorded):
> I asked Perplexity 4 buyer and exhibitor questions today, 3 times each. Your show sites do get named: The Gift Fair UK, The Gift Fair USA, Toy Fair International. XpoFairs itself came up once in 12 answers. For virtual trade show platforms, it was vFairs, Whova and Cvent.

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

Narration (49 words, as recorded; "fix crawling on all 7 sites" was softened because only xpofairs.com was checked):
> Here is how the 6 months would run. Months 1 to 3: robots and sitemaps across all 7 sites, the schema, the titles, and an AI visibility baseline. Months 4 to 6: show and exhibitor content, linking the sites without them competing, outside mentions, and the same prompts re-tested every month.

### Scene 7 - Outro

"Want these fixed?" / "Reply here on Upwork."
Narration (8 words):
> Want these fixed? Just reply here on Upwork.

Final render: 2:10. Link and checks in `XpoFairs video link.md`.

## Sources

Checked 2026-10-20 through Firecrawl (live fetch, maxAge 0). Re-checked on the Mac on 2026-10-20 around 15:05 UTC with curl (desktop Chrome UA, one request at a time, 0.5 s apart) and in rendered Chrome at 1600x860. Every line below held except the event page's Website field, corrected in place.

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
| "Type: TRADE_ONLY", empty Industry (Website is filled: "Website Link" to https://www.thegiftfair.com/) | event page rendered DOM, `[class*=eventInnerPAd_info]` |
| 122 exhibitors | event page "Exhibitors 122" |
| Event title "Xpo Fairs \| The Gift Fair UK 2026" | event page `<title>` |
| Cookie banner "So the deal is, we want to spy on you. We want to know things like what you had for breakfast this morning." | rendered on the homepage and the event page; in the HTML of /events-box-office and /blog |
| The banner is template copy | Mantine UI CookiesBanner template (github.com/mantinedev/ui.mantine.dev, lib/CookiesBanner/CookiesBanner.tsx) opens with "So the deal is, we want to spy on you"; the site's banner uses `CookiesBanner_*` classes on Mantine |
| PageSpeed: no real-user data, so speed is not raised | pagespeed.web.dev mobile, 2026-10-20 20:35 IST: field data "No Data", lab Performance 37, LCP 17.6 s (https://pagespeed.web.dev/analysis/https-xpofairs-com/08b4eumafb?form_factor=mobile) |
| AI baseline: XpoFairs 1 of 12 answers | Perplexity sonar via OpenRouter, 4 questions x 3 runs, 2026-10-20 15:05 UTC; tallies in Scene 4; raw answers in `~/Apps/case-study-videos/work/xpofairs-ai-answers.json` on the Mac |
| About page reuses the homepage title and description | https://xpofairs.com/about-us metadata |
| Footer links 4 show sites: The Gift Fair UK (thegiftfair.com), The Gift Fair US (thegiftfair.us), The Toy Show (toyfairinternational.com), Sports Licensing Now! (sportslicensingnow.com) | homepage footer |
| Neolemon GSC numbers | Proof library in the skill, shown live in Search Console |

## Reserve findings (verified, not in the script)

1. Footer "Future Star Award", "Referral Scheme" and "Booth Design Award" all link to https://xpofairs.com/; "Cookie Policy" links to the Terms page; "Instruction Videos" links to the FAQ.
2. Footer Instagram icon goes to instagram.com/thegiftfair.uk, not an XpoFairs account.
3. og:url is https://xpofairs.com on the What's On, event and blog pages, so every shared link previews as the homepage.
4. Dropped: the 290 H3 count did not hold. Live at 1600x860 on 2026-10-20 the homepage has 11 H3s (attend, discover, chat, connect, meet twice each, plus "Upcoming trade shows").
5. Upcoming show images on the homepage have alt text "Trade Show 0" to "Trade Show 4", no show names.
6. The 404 page sends both "noindex" and "index, follow" robots tags.
7. Sports Licensing Now! event slug says 2026 (eu-sports-licensing-now-2026) while the dates are Sep 16 to 29 2027.

## Done on the Mac (2026-10-20)

1. Job re-checked: find_jobs get on Ankur Gupta says ACTIVE, applied false, totalHired 0, totalOffered 0. crm_cover_submissions_list since 2026-10-20 has no cover for this URL.
2. Every source line re-checked with curl and rendered Chrome. One correction (Website field), one reserve finding dropped (H3 count).
3. PageSpeed run: no real-user data, speed not raised.
4. AI baseline run for Scene 4.
5. Storyboard at `~/Apps/case-study-videos/jobs/xpofairs-proposal/storyboard.json`.
