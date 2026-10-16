// Builds the two Total Uptime / Edgenexus Statements of Work as PDFs.
// Usage: node contracts/total-uptime/build.cjs
// Edit PROVIDER / CLIENT / ISSUE_DATE below and re-run to regenerate both PDFs.

const path = require('path');
const { chromium } = require('playwright');

const OUT_DIR = __dirname;

const PROVIDER = {
  name: 'Incrementors Web Solutions',
  address: ['2025 W El Camino Ave, Apt 102', 'Sacramento, CA 95833, USA'],
  email: 'crm@incrementors.com',
  phone: '+1 (916) 273-6673',
  web: 'www.incrementors.com',
};

const CLIENT = {
  name: 'Total Uptime Technologies LLC',
  contact: 'Greg Howett',
  address: ['PO Box 2228', 'Skyland, NC 28776, USA'],
};

const ISSUE_DATE = 'October 16, 2026';

// ---------------------------------------------------------------------------

const CSS = `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: 'Carlito', 'Liberation Sans', sans-serif;
    font-size: 10.6pt;
    line-height: 1.55;
    color: #1E293B;
    background: #fff;
  }
  .brand-row {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-bottom: 14px; border-bottom: 2px solid #0E1E3B;
  }
  .brand { font-family: 'Caladea', 'Liberation Serif', serif; font-weight: 700; font-size: 16.5pt; color: #0E1E3B; }
  .brand small { display: block; font-family: 'Carlito', 'Liberation Sans', sans-serif; font-weight: 500; font-size: 8.4pt; letter-spacing: 0.14em; text-transform: uppercase; color: #00808A; margin-top: 1px; }
  .doc-type { text-align: right; font-size: 8.4pt; letter-spacing: 0.14em; text-transform: uppercase; color: #64748B; font-weight: 600; }
  .doc-type b { display: block; color: #0E1E3B; font-size: 9.2pt; letter-spacing: 0.04em; margin-top: 2px; }

  h1 {
    font-family: 'Caladea', 'Liberation Serif', serif; font-weight: 700;
    font-size: 23.1pt; line-height: 1.15; letter-spacing: 0;
    color: #0E1E3B; margin: 22px 0 6px;
  }
  .lede { margin: 0 0 18px; color: #475569; font-size: 11.4pt; }

  .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #D5DEE8; border-radius: 6px; overflow: hidden; margin: 0 0 18px; }
  .meta div { padding: 9px 12px; border-right: 1px solid #D5DEE8; background: #F5F8FB; }
  .meta div:last-child { border-right: 0; }
  .meta dt { font-size: 7.7pt; letter-spacing: 0.12em; text-transform: uppercase; color: #64748B; font-weight: 600; margin: 0 0 2px; }
  .meta dd { margin: 0; font-weight: 600; color: #0E1E3B; font-size: 10.6pt; }
  .meta div.hl { background: #0E1E3B; }
  .meta div.hl dt { color: #8FD9CF; }
  .meta div.hl dd { color: #fff; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0 0 8px; }
  .party { border: 1px solid #D5DEE8; border-top: 3px solid #00808A; border-radius: 4px; padding: 11px 14px; break-inside: avoid; }
  .party .role { font-size: 7.7pt; letter-spacing: 0.12em; text-transform: uppercase; color: #00808A; font-weight: 700; margin-bottom: 3px; }
  .party .name { font-weight: 700; color: #0E1E3B; font-size: 11.2pt; margin-bottom: 2px; }
  .party p { margin: 0; color: #334155; }
  .party .sub { color: #64748B; margin-top: 5px; }

  h2 {
    font-family: 'Caladea', 'Liberation Serif', serif; font-weight: 700;
    font-size: 12.8pt; color: #0E1E3B; margin: 22px 0 8px;
    padding-bottom: 5px; border-bottom: 1px solid #D5DEE8;
    break-after: avoid;
  }
  h2 .n { color: #00808A; margin-right: 6px; }
  h3 { font-size: 10.8pt; font-weight: 700; color: #0E1E3B; margin: 12px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; }

  .clauses { list-style: none; padding: 0; margin: 0; }
  .clauses > li { display: grid; grid-template-columns: 30px 1fr; margin: 0 0 7px; break-inside: avoid; }
  .clauses > li > .k { color: #00808A; font-weight: 600; }
  .clauses > li b { color: #0E1E3B; }

  ul.dots { margin: 2px 0 8px; padding-left: 16px; }
  ul.dots li { margin: 0 0 3px; }
  ul.dots li::marker { color: #00808A; }

  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 9.9pt; }
  td.num, .meta dd, .goal .v { font-variant-numeric: tabular-nums; }
  thead th { background: #0E1E3B; color: #fff; text-align: left; font-weight: 600; font-size: 8.6pt; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 9px; }
  tbody td { padding: 7px 9px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  tbody tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #F7F9FB; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.now { color: #B42318; font-weight: 600; }
  td.strong { font-weight: 600; color: #0E1E3B; }
  tfoot td { padding: 9px; font-weight: 700; color: #0E1E3B; border-top: 2px solid #0E1E3B; font-size: 11pt; }
  .pill { display: inline-block; font-size: 8.1pt; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: #FDECEC; color: #B42318; letter-spacing: 0.02em; }

  .phase td:first-child { width: 150px; }
  .phase .q { font-weight: 700; color: #0E1E3B; display: block; }
  .phase .m { color: #64748B; font-size: 9pt; display: block; }
  .phase .t { display: inline-block; white-space: nowrap; margin-top: 4px; font-size: 8.4pt; font-weight: 600; color: #00646C; background: #E3F4F2; padding: 1px 7px; border-radius: 10px; }
  .phase ul { margin: 0; padding-left: 14px; }
  .phase li { margin: 0 0 2px; }
  .phase li::marker { color: #00808A; }

  .goals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 6px 0 12px; }
  .goal { border: 1px solid #D5DEE8; border-radius: 6px; padding: 9px 11px; break-inside: avoid; }
  .goal .l { font-size: 7.9pt; letter-spacing: 0.1em; text-transform: uppercase; color: #64748B; font-weight: 600; }
  .goal .v { font-family: 'Caladea', 'Liberation Serif', serif; font-size: 14.3pt; font-weight: 700; color: #0E1E3B; margin-top: 2px; white-space: nowrap; }
  .goal .v span { font-family: 'Carlito', 'Liberation Sans', sans-serif; color: #94A3B8; font-weight: 400; margin: 0 5px; }
  .goal .v em { font-style: normal; color: #00808A; }

  .note { background: #F5F8FB; border-left: 3px solid #00808A; padding: 9px 12px; color: #334155; margin: 8px 0 10px; break-inside: avoid; }

  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 12px; break-inside: avoid; }
  .sign .for { font-size: 8.1pt; letter-spacing: 0.12em; text-transform: uppercase; color: #00808A; font-weight: 700; }
  .sign .org { font-weight: 700; color: #0E1E3B; margin: 1px 0 6px; }
  .line { display: grid; grid-template-columns: 62px 1fr; align-items: end; margin-top: 16px; }
  .line span { font-size: 8.8pt; color: #64748B; }
  .line i { border-bottom: 1px solid #94A3B8; height: 18px; font-style: normal; color: #0E1E3B; font-weight: 600; padding-left: 2px; line-height: 18px; }
  .line.sig { margin-top: 26px; }
  .keep { break-inside: avoid; }
`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function header({ ref, title, lede, meta }) {
  const cells = meta
    .map((m) => `<div class="${m.hl ? 'hl' : ''}"><dt>${m.label}</dt><dd>${m.value}</dd></div>`)
    .join('');
  return `
    <div class="brand-row">
      <div class="brand">Incrementors<small>Web Solutions</small></div>
      <div class="doc-type">Statement of Work<b>${ref}</b></div>
    </div>
    <h1>${title}</h1>
    <p class="lede">${lede}</p>
    <dl class="meta">${cells}</dl>`;
}

function parties(website) {
  return `
    <div class="parties">
      <div class="party">
        <div class="role">Service Provider</div>
        <div class="name">${PROVIDER.name}</div>
        <p>${PROVIDER.address.join('<br>')}</p>
        <p class="sub">${PROVIDER.email} · ${PROVIDER.phone}</p>
      </div>
      <div class="party">
        <div class="role">Client</div>
        <div class="name">${CLIENT.name}</div>
        <p>Attn: ${CLIENT.contact}<br>${CLIENT.address.join('<br>')}</p>
        <p class="sub">Website covered: ${website}</p>
      </div>
    </div>`;
}

function signatures(n, heading = 'Acceptance', lead = 'By signing below, both parties agree to the terms of this Statement of Work.') {
  const block = (forLabel, org, name) => `
    <div>
      <div class="for">${forLabel}</div>
      <div class="org">${org}</div>
      <div class="line sig"><span>Signature</span><i></i></div>
      <div class="line"><span>Name</span><i>${name || ''}</i></div>
      <div class="line"><span>Title</span><i></i></div>
      <div class="line"><span>Date</span><i></i></div>
    </div>`;
  return `
    <div class="keep">
      <h2><span class="n">${n}.</span>${heading}</h2>
      <p>${lead}</p>
      <div class="sign">
        ${block('For the Service Provider', PROVIDER.name, '')}
        ${block('For the Client', CLIENT.name, CLIENT.contact)}
      </div>
    </div>`;
}

function section(n, title, inner, { keep = false } = {}) {
  const html = `<h2><span class="n">${n}.</span>${title}</h2>${inner}`;
  return keep ? `<div class="keep">${html}</div>` : html;
}

function clauses(n, items) {
  return `<ol class="clauses">${items
    .map((c, i) => `<li><span class="k">${n}.${i + 1}</span><div>${c}</div></li>`)
    .join('')}</ol>`;
}

// ---------------------------------------------------------------------------
// SOW 1: edgenexus.io, services already rendered (June and July 2026)

function edgenexusSow() {
  const ref = 'INC-SOW-EDX-2026-01';
  const body = `
    ${header({
      ref,
      title: 'SEO &amp; GEO Services for edgenexus.io',
      lede: 'Record of services provided June 1 to July 31, 2026, and confirmation of the outstanding balance for that period.',
      meta: [
        { label: 'Date issued', value: ISSUE_DATE },
        { label: 'Service period', value: 'Jun 1 – Jul 31, 2026' },
        { label: 'Monthly fee', value: 'USD 200.00' },
        { label: 'Amount due', value: 'USD 400.00', hl: true },
      ],
    })}
    ${parties('https://www.edgenexus.io/')}

    ${section(1, 'Purpose', `
      <p>This Statement of Work (“SOW”) records the search engine optimization (SEO) and generative engine optimization (GEO) services that ${PROVIDER.name} (“Incrementors”) provided for <b>edgenexus.io</b> during June and July 2026, and confirms the fees that remain outstanding for that period.</p>
      <p>Edgenexus is now part of Total Uptime. This SOW is therefore issued to ${CLIENT.name} (the “Client”) as the contracting party for edgenexus.io.</p>
    `)}

    ${section(2, 'Services Covered', `
      <p>The monthly fee for edgenexus.io covered the following services during the Service Period:</p>
      <h3>Search Engine Optimization (SEO)</h3>
      <ul class="dots">
        <li><b>Technical SEO:</b> crawl and indexation monitoring, site health checks, page-speed and Core Web Vitals review, and redirect and broken-link fixes.</li>
        <li><b>On-page SEO:</b> title tags, meta descriptions, heading structure, internal linking and content optimization for priority product pages.</li>
        <li><b>Keyword research and tracking:</b> ranking tracking for load balancer, ADC, WAF and GSLB keyword sets.</li>
        <li><b>Content and authority building:</b> content recommendations, and relevant backlinks and listings to support domain authority.</li>
      </ul>
      <h3>Generative Engine Optimization (GEO)</h3>
      <ul class="dots">
        <li><b>AI search visibility monitoring</b> across ChatGPT, Google AI Overviews, Google AI Mode, Gemini and Perplexity.</li>
        <li><b>Structured data and answer-ready formatting</b> (schema markup, FAQ blocks, direct-answer copy) so AI platforms can cite the site.</li>
        <li><b>Entity and brand consistency</b> so AI platforms describe Edgenexus products accurately.</li>
      </ul>
      <h3>Reporting</h3>
      <ul class="dots">
        <li>Performance tracking through Google Search Console and Google Analytics, with progress updates shared with the Client.</li>
      </ul>
    `)}

    ${section(3, 'Fees and Outstanding Balance', `
      <table>
        <thead><tr><th>Billing period</th><th>Description</th><th>Status</th><th class="num">Amount (USD)</th></tr></thead>
        <tbody>
          <tr><td class="strong">June 2026<br><span style="color:#64748B;font-weight:400">Jun 1 – Jun 30</span></td><td>SEO &amp; GEO monthly retainer, edgenexus.io</td><td><span class="pill">Outstanding</span></td><td class="num">200.00</td></tr>
          <tr><td class="strong">July 2026<br><span style="color:#64748B;font-weight:400">Jul 1 – Jul 31</span></td><td>SEO &amp; GEO monthly retainer, edgenexus.io</td><td><span class="pill">Outstanding</span></td><td class="num">200.00</td></tr>
        </tbody>
        <tfoot><tr><td colspan="3">Total amount due</td><td class="num">USD 400.00</td></tr></tfoot>
      </table>
    `)}

    ${section(4, 'Payment Terms', clauses(4, [
      'The outstanding balance of <b>USD 400.00</b> is due within seven (7) days of the Client’s receipt of this SOW.',
      'Payment is made in US dollars through the payment links Incrementors has shared for June 2026 and July 2026 (one link per month), or by another method both parties agree in writing.',
      'Once full payment is received, Incrementors will confirm in writing that the edgenexus.io account is settled for the period June 1 to July 31, 2026.',
    ]))}

    ${section(5, 'General Terms', clauses(5, [
      '<b>Results.</b> SEO and GEO outcomes depend on search engine and AI platform algorithms that Incrementors does not control. No specific rankings, traffic levels or AI citations are guaranteed.',
      '<b>Ownership.</b> Once full payment is received, all content, reports and recommendations delivered for edgenexus.io during the Service Period belong to the Client.',
      '<b>Confidentiality.</b> Each party keeps the other’s non-public information, including account access and performance data, confidential.',
      '<b>Entire agreement.</b> This SOW is the complete agreement for the Service Period. Any change must be made in writing and agreed by both parties. Services for totaluptime.com are covered by a separate SOW.',
    ]))}

    ${signatures(6, 'Client Acknowledgement and Acceptance', 'By signing below, the Client confirms that the services in Section 2 were provided for edgenexus.io during the Service Period at the agreed rate of USD 200.00 per month, and that USD 400.00 remains outstanding. Both parties agree to the terms of this Statement of Work.')}
  `;
  return { ref, site: 'edgenexus.io', file: 'Edgenexus_SOW_SEO-GEO_Jun-Jul-2026.pdf', title: 'Edgenexus SOW: SEO & GEO (June–July 2026)', html: shell('Edgenexus SOW', body) };
}

// ---------------------------------------------------------------------------
// SOW 2: totaluptime.com, new 12-month engagement (USD 600 per month)

function totalUptimeSow() {
  const ref = 'INC-SOW-TU-2026-01';

  const phases = [
    {
      q: 'Q1 · Fix the Foundation', m: 'Months 1–3', t: 'Target: 500 visits/mo',
      items: [
        'Full technical SEO audit; critical issues fixed within 6 weeks of access',
        'Rescue the 447 keywords ranking in positions 21–50 (priority: DCIM, DDNS, WAAP)',
        'On-page optimization of all Managed Services and Self Hosted product pages',
        '4 targeted blog posts (e.g. “What Is DCIM?”, “DDNS vs Static DNS”, “WAAP vs WAF”)',
        'Google AI Mode push on top-cited pages (FAQ schema, direct-answer formatting)',
        'AI/GEO baseline documented, monthly tracking set up, first Perplexity Page published',
      ],
    },
    {
      q: 'Q2 · Build Authority', m: 'Months 4–6', t: 'Target: 650 visits/mo',
      items: [
        'Load balancer content cluster: pillar page plus 5 supporting posts',
        '8 SEO blog posts (DNS, server name indication, zero-day protection, buffer overflow, GSLB)',
        'Backlink outreach (Web 2.0, guest post, resource page) on DA 40+ tech and security sites',
        'Site-wide schema: FAQ, Product, HowTo, BreadcrumbList and Organization',
        '2 Perplexity Pages for “best load balancer solutions” and “best ADC for enterprise”',
        'Monthly SEO reporting dashboard',
      ],
    },
    {
      q: 'Q3 · Scale &amp; Accelerate', m: 'Months 7–9', t: 'Target: 850 visits/mo',
      items: [
        '12 articles (4 per month), including comparison content (Total Uptime vs F5, vs Citrix ADC)',
        '6 editorial guest post placements on DA 50+ networking, security and IT publications',
        'AI citations on all 5 platforms, with monthly citation monitoring',
        'CRO: landing page CTAs, trial sign-up flow and pricing page clarity',
        'International SEO for US, UK and UAE (hreflang, geo-targeted landing pages)',
        'Mid-year strategy review and updated plan for Months 10–12',
      ],
    },
    {
      q: 'Q4 · Dominate', m: 'Months 10–12', t: 'Target: 1,000+ visits/mo',
      items: [
        'Commercial keyword push: “load balancer”, “load balancing”, “global load balancer” into the top 10',
        'Authority Score 35+ campaign: digital PR, broken-link building, resource placements',
        '8 further articles to complete a 32-article library, plus a quarterly content refresh schedule',
        'Google AI Overviews: grow cited pages from 45 toward 120+',
        'Annual KPI review covering traffic, keywords, authority, AI visibility and SEO leads',
        '2027 strategy and roadmap',
      ],
    },
  ];

  const phaseRows = phases
    .map((p) => `<tr><td><span class="q">${p.q}</span><span class="m">${p.m}</span><span class="t">${p.t}</span></td><td><ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul></td></tr>`)
    .join('');

  const kpis = [
    ['Organic traffic (US, monthly)', '364', '500', '650', '850', '1,000+'],
    ['Organic keywords', '1,700', '1,900', '2,200', '2,600', '3,000+'],
    ['Top-3 keywords', '40', '55', '80', '110', '150+'],
    ['Keywords stuck in positions 21–50', '447', '350', '250', '150', '&lt;100'],
    ['Authority Score', '27', '28', '30', '33', '35+'],
    ['Referring domains', '538', '580', '640', '720', '820+'],
    ['AI Visibility Score', '14', '20', '28', '35', '40+'],
    ['AI platforms citing Total Uptime', '2 of 5', '3 of 5', '4 of 5', '5 of 5', '5 of 5'],
  ];
  const kpiRows = kpis
    .map((r) => `<tr><td class="strong">${r[0]}</td><td class="num now">${r[1]}</td>${r.slice(2).map((v) => `<td class="num">${v}</td>`).join('')}</tr>`)
    .join('');

  const body = `
    ${header({
      ref,
      title: 'SEO &amp; GEO Services for totaluptime.com',
      lede: 'Scope of work, deliverables and commercial terms for the 12-month SEO and AI search visibility roadmap.',
      meta: [
        { label: 'Date issued', value: ISSUE_DATE },
        { label: 'Term', value: '12 months' },
        { label: 'Billing', value: 'Monthly, in advance' },
        { label: 'Monthly fee', value: 'USD 600.00', hl: true },
      ],
    })}
    ${parties('https://totaluptime.com/')}

    ${section(1, 'Purpose and Objectives', `
      <p>This Statement of Work (“SOW”) sets out the search engine optimization (SEO) and generative engine optimization (GEO) services that ${PROVIDER.name} (“Incrementors”) will provide to ${CLIENT.name} (the “Client”) for <b>totaluptime.com</b>. It follows the 12-Month SEO Roadmap Incrementors shared with the Client in August 2026.</p>
      <p>The goal is to rebuild organic search traffic and make Total Uptime a cited source in AI search. Starting point (Semrush, August 18, 2026, US market) and 12-month targets:</p>
      <div class="goals">
        <div class="goal"><div class="l">Organic traffic / mo</div><div class="v">364<span>→</span><em>1,000+</em></div></div>
        <div class="goal"><div class="l">Authority Score</div><div class="v">27<span>→</span><em>35+</em></div></div>
        <div class="goal"><div class="l">AI Visibility Score</div><div class="v">14<span>→</span><em>40+</em></div></div>
        <div class="goal"><div class="l">Top-3 keywords</div><div class="v">40<span>→</span><em>150+</em></div></div>
      </div>
    `)}

    ${section(2, 'Scope of Services', clauses(2, [
      '<b>Technical SEO.</b> Full crawl of totaluptime.com for indexing errors, Core Web Vitals failures, broken links, redirect chains, duplicate content, missing schema and page speed. Critical issues are fixed within six weeks of access being granted, followed by ongoing monitoring.',
      '<b>On-page SEO.</b> Rewrite title tags, meta descriptions and H1/H2 structure for all Managed Services and Self Hosted product pages, and map each page to its primary keyword from the 1,012-keyword dataset.',
      '<b>Content.</b> 32 keyword-researched blog articles over 12 months, written, SEO-formatted and published on WordPress, plus the load balancer content cluster, comparison content and a quarterly refresh of top-performing posts.',
      '<b>Off-page and authority.</b> Backlink outreach (Web 2.0, guest post and resource-page campaigns) aimed at DA 40+ technology and cybersecurity publications, targeting around 30 quality backlinks per month, plus 6 editorial placements on DA 50+ publications in Months 7–9.',
      '<b>GEO / AI search visibility.</b> Baseline and monthly tracking across ChatGPT, Google AI Overviews, Google AI Mode, Gemini and Perplexity; FAQ schema and direct-answer formatting on top-cited pages; structured Q&amp;A hubs on load balancing, ADC, DNS and network security; entity authority (Knowledge Graph, structured data, citations); and Perplexity Pages.',
      '<b>Schema markup.</b> FAQ, Product, HowTo, BreadcrumbList and Organization schema implemented site-wide.',
      '<b>Conversion and international SEO.</b> In Months 7–9, conversion improvements on product landing pages (CTAs, trial sign-up flow, pricing page clarity) and hreflang and geo-targeted landing pages for the UK and UAE, subject to the Client confirming its target markets.',
      '<b>Reporting and reviews.</b> A monthly report covering organic traffic against target, keyword movements, backlinks built, content published, AI citations by platform and commercial keyword progress; a mid-year strategy review; and an annual KPI review with a 2027 strategy.',
    ]))}

    ${section(3, 'Roadmap and Deliverables by Phase', `
      <table class="phase">
        <thead><tr><th>Phase</th><th>Deliverables</th></tr></thead>
        <tbody>${phaseRows}</tbody>
      </table>
      <p style="color:#64748B;font-size:9.5pt">Priorities within the roadmap may be adjusted by mutual agreement, for example at the mid-year review, without changing the monthly fee.</p>
    `)}

    ${section(4, 'KPI Targets', `
      <p>The targets below are calculated from the Client’s August 2026 Semrush baseline. They are planning targets used to measure progress, not guaranteed results (see Section 9.1).</p>
      <table>
        <thead><tr><th>KPI</th><th class="num">Now (Aug 2026)</th><th class="num">Month 3</th><th class="num">Month 6</th><th class="num">Month 9</th><th class="num">Month 12</th></tr></thead>
        <tbody>${kpiRows}</tbody>
      </table>
    `)}

    ${section(5, 'Client Responsibilities', `
      <p>To start Months 1–3, the Client will provide:</p>
      ${clauses(5, [
        '<b>Google Search Console:</b> Full User access for crm@incrementors.com.',
        '<b>Google Analytics 4:</b> Analyst access to the GA4 property.',
        '<b>WordPress:</b> an Admin or Editor account for crm@incrementors.com to publish content and optimize product pages.',
        '<b>Product list:</b> all Managed Services and Self Hosted products, with target customer type and use case.',
        '<b>Target markets:</b> confirmation of primary markets (currently understood as the US, UK and UAE).',
        '<b>Content approval:</b> the named approver(s) for blog posts and the target review turnaround.',
      ])}
      <div class="note">Incrementors will begin the technical audit within 48 hours of receiving access and deliver the full technical report and updated strategy in Week 3. Delays in access or content approvals move the related timelines and targets by the same amount.</div>
    `, { keep: true })}

    ${section(6, 'Fees and Payment', clauses(6, [
      '<b>Monthly fee.</b> USD 600.00 per month for totaluptime.com, covering all services and deliverables in Sections 2 and 3.',
      '<b>Billing.</b> The fee is billed monthly in advance. The first payment is due on signing, and each later payment is due on the same date every month, through the payment link shared by Incrementors.',
      '<b>Late payment.</b> If a payment is more than seven (7) days overdue, Incrementors may pause work until the account is current. Timelines then extend by the length of the pause.',
      '<b>Not included.</b> Paid advertising, sponsored content beyond the placements listed in Section 3, third-party software licences, and website development beyond SEO-related changes are outside this fee and will be quoted separately for the Client’s approval.',
      '<b>Separate account.</b> Fees for edgenexus.io are covered by a separate SOW.',
    ]))}

    ${section(7, 'Term and Termination', clauses(7, [
      'This SOW starts on the date of the last signature below (the “Effective Date”) and runs for 12 months, following the roadmap in Section 3.',
      'Either party may end this SOW with thirty (30) days’ written notice; email is sufficient. Fees are payable for services provided up to the end of the notice period.',
      'On termination, Incrementors will hand over all completed content, reports and paid-for work in progress, and the Client may remove Incrementors’ account access.',
      'After 12 months, the engagement continues month to month at the same fee unless either party gives notice or both parties agree a new SOW.',
    ]))}

    ${section(8, 'Changes to Scope', `
      <p>If the Client requests work outside this SOW, Incrementors will confirm the request in writing. If it falls outside the agreed scope, Incrementors will share a written addendum with any added fee for the Client’s approval before that work begins.</p>
    `)}

    ${section(9, 'General Terms', clauses(9, [
      '<b>No guaranteed results.</b> Rankings, traffic and AI citations depend on Google, Bing and AI platforms, which Incrementors does not control. The KPI targets in Section 4 are not guaranteed results. Incrementors follows search engine guidelines and will not use practices that put the website at risk of penalties.',
      '<b>Ownership.</b> Content, schema code and reports created under this SOW belong to the Client once the related month has been paid.',
      '<b>Access and confidentiality.</b> Incrementors uses Client accounts only for work under this SOW and keeps credentials and non-public business data confidential. Each party keeps the other’s non-public information confidential.',
      '<b>Entire agreement.</b> This SOW, including the roadmap it references, is the complete agreement for totaluptime.com. Any change must be made in writing and agreed by both parties.',
    ]))}

    ${signatures(10)}
  `;
  return { ref, site: 'totaluptime.com', file: 'TotalUptime_SOW_SEO-GEO_12-Month.pdf', title: 'Total Uptime SOW: SEO & GEO (12-Month Roadmap)', html: shell('Total Uptime SOW', body) };
}

// ---------------------------------------------------------------------------

function footer(ref, site) {
  return `<div style="width:100%;font-family:Carlito,sans-serif;font-size:7.7pt;color:#64748B;padding:0 0.75in;display:flex;justify-content:space-between;">
    <span>${PROVIDER.name} · ${ref} · ${site}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const doc of [edgenexusSow(), totalUptimeSow()]) {
    await page.setContent(doc.html, { waitUntil: 'load' });
    await page.pdf({
      path: path.join(OUT_DIR, doc.file),
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.65in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footer(doc.ref, doc.site),
    });
    console.log('wrote', doc.file);
  }
  await browser.close();
})();
