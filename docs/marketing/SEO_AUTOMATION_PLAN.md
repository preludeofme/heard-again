# Heard Again — SEO Automation Plan

> Status: **Ready for cron activation**  
> Last updated: 2026-08-09  
> Maintainer: Ryan (review + approve; agent handles drafting)

---

## Overview

This plan defines the weekly SEO cadence for Heard Again. An agent (Hermes) drafts content following these specs; Ryan reviews and approves everything before it goes live. Nothing auto-publishes.

### Guiding Principles

- **Human-first positioning** — no AI hype. Lead with warmth, editorial integrity, and real human stories.
- **Consent + audit trail** — every mention of voice cloning includes the consent framework and who owns the data.
- **No auto-publish** — agent generates; Ryan reviews → approves → posts.
- **Trustworthy tone** — blog reads like a thoughtful editor wrote it, not a content mill.

---

## Weekly Automation Cadence

| Day | Time | Job | Description |
|-----|------|-----|-------------|
| **Monday** | 08:00 UTC | `weekly-blog-draft` | Write 1 long-form blog post targeting a keyword from the list below. Agent drafts markdown + metadata; saves to `docs/marketing/drafts/`. Notifies Ryan for review. |
| **Tuesday** | 08:00 UTC | `weekly-social-drafts` | Generate social post variants (X thread, Reddit post, LinkedIn article, Facebook group post) from Monday's article. Each variant adapted to platform tone. Saved to `docs/marketing/drafts/social/`. |
| **Wednesday** | 08:00 UTC | `weekly-seo-audit` | Run a lightweight SEO health scan: check sitemap freshness, broken links on blog, meta tag completeness, Core Web Vitals snapshot (if Lighthouse CLI available). Report to `docs/marketing/reports/`. |
| **Thursday** | 08:00 UTC | `weekly-content-refresh` | Identify 1-2 older blog posts that could be updated (new data, better examples, seasonal relevance). Draft changelog. |
| **Saturday** | 08:00 UTC | `monthly-competitor-report` | (1st Saturday of month only) Monitor 3-5 competitors in family memory / digital legacy space. What are they writing about? What keywords are they targeting? What features shipped? Report to `docs/marketing/reports/competitor/`. |
| **Sunday** | 08:00 UTC | `monthly-seo-report` | (1st Sunday of month only) Compile monthly SEO report: organic traffic (if GA4 available), best-performing content, keyword ranking movements, backlinks gained. Report to `docs/marketing/reports/monthly/`. |

### Cron Job Specifications

```cron
# Heard Again SEO Automation — cron job specifications
# NOTE: These are SPECS ONLY. Do not activate until Ryan confirms.
# To activate: hermes cron add <job-name> --schedule "<cron>" --prompt-file <path>

# Weekly blog draft — Mondays 8am UTC
# Job name: heard-again-blog-draft
0 8 * * 1
# Prompt: "Write a long-form SEO blog post for Heard Again (family voice preservation). 
# Target this week's keyword from the content calendar. Follow the style guide in 
# docs/marketing/SEO_AUTOMATION_PLAN.md. Save draft to docs/marketing/drafts/."
# Skills needed: marketing-gtm, humanizer, grounded-citations
# Model: claude-sonnet-4 or equivalent writing-capable model

# Weekly social drafts — Tuesdays 8am UTC
# Job name: heard-again-social-drafts
0 8 * * 2
# Prompt: "Generate social media posts (X thread, Reddit post, LinkedIn article, 
# Facebook group post) from this week's blog draft at docs/marketing/drafts/. 
# Adapt each to the platform's tone and conventions. Save to docs/marketing/drafts/social/."
# Skills needed: marketing-gtm, humanizer

# Weekly SEO audit — Wednesdays 8am UTC
# Job name: heard-again-seo-audit
0 8 * * 3
# Prompt: "Run an SEO health scan for heardagain.com: check sitemap.xml, robots.txt, 
# crawl all blog URLs for 404s, verify meta tags (title, description, og:image) on 
# key pages, run Lighthouse if available. Report findings to docs/marketing/reports/."
# Skills needed: marketing-gtm, browser-flow-automation

# Weekly content refresh — Thursdays 8am UTC
# Job name: heard-again-content-refresh
0 8 * * 4
# Prompt: "Review Heard Again blog posts older than 60 days. Identify 1-2 that would 
# benefit from updates. Draft refresh changelog. Save to docs/marketing/drafts/refreshes/."
# Skills needed: marketing-gtm

# Monthly competitor report — 1st Saturday 8am UTC
# Job name: heard-again-competitor-report
0 8 1-7 * 6
# Prompt: "Research current content and product activity from Heard Again competitors 
# in the family voice preservation and digital legacy space. Write a competitor 
# intelligence report. Save to docs/marketing/reports/competitor/."
# Skills needed: marketing-gtm, competitor-news-monitor, grounded-citations

# Monthly SEO report — 1st Sunday 8am UTC
# Job name: heard-again-monthly-seo
0 8 1-7 * 7
# Prompt: "Compile monthly SEO performance report for heardagain.com: include organic 
# traffic trends, top-performing content, keyword position changes, backlinks gained, 
# and recommendations. Save to docs/marketing/reports/monthly/."
# Skills needed: marketing-gtm
```

---

## Content Calendar — First 4 Weeks

### Week 1 — Foundation & Trust
| Day | Keyword | Title | Type | Notes |
|-----|---------|-------|------|-------|
| Mon | "how to record family stories before it's too late" | *The Questions I Wish I'd Asked: How to Record Your Family's Stories Before They're Lost* | Editorial / personal essay | Lead with personal story, end with practical guide |
| Tue | — | Social drafts from Mon article | Multi-platform | X thread: storytelling tips. Reddit: r/Genealogy discussion. LinkedIn: legacy planning angle. |

### Week 2 — Practical Guide
| Day | Keyword | Title | Type | Notes |
|-----|---------|-------|------|-------|
| Mon | "oral history interview questions for grandparents" | *50 Questions to Ask Your Grandparents (Before It's Too Late)* | Listicle / resource | Structured by life stages: childhood, young adulthood, love, career, wisdom |
| Tue | — | Social drafts | Multi-platform | X: thread of top 10 questions. Reddit: shareable resource. |

### Week 3 — Technology & Ethics
| Day | Keyword | Title | Type | Notes |
|-----|---------|-------|------|-------|
| Mon | "ethical voice cloning for family memories" | *When AI Meets Memory: The Ethics of Preserving a Loved One's Voice* | Long-form essay | Discuss consent, ownership, the uncanny valley, Heard Again's approach |
| Tue | — | Social drafts | Multi-platform | Thoughtful angles. No hype. |

### Week 4 — Self-Hosting & Privacy
| Day | Keyword | Title | Type | Notes |
|-----|---------|-------|------|-------|
| Mon | "self-hosted family memory platform" | *Why Your Family Memories Don't Belong in the Cloud* | Persuasive / technical | Privacy, data ownership, self-hosting arguments. Link to setup guide. |
| Tue | — | Social drafts | Multi-platform | r/selfhosted cross-post. LinkedIn: data sovereignty angle. |

### Weeks 5–8 (to plan next cycle)
| Week | Cluster | Sample Titles |
|------|---------|---------------|
| 5 | Genealogy + tech | *How Open Source Is Changing Genealogy*, *Building a Digital Family Archive* |
| 6 | Practical recording | *Best Voice Recorders for Family Oral History*, *How to Digitize Old Family Audio Tapes* |
| 7 | Grief & legacy | *What Happens to Your Digital Memories When You're Gone*, *Leaving a Voice Legacy: A Practical Guide* |
| 8 | Community stories | "Your Stories" roundup — user-submitted family memory stories (anonymized) |

---

## Keyword Target List

Researched for the family voice preservation + genealogy oral history niche. Keywords selected for long-tail, low-competition, high-intent patterns.

| # | Keyword | Category | Intent | Est. Volume | Difficulty |
|---|---------|----------|--------|-------------|------------|
| 1 | how to record family stories before it's too late | Urgency / emotional | Informational (guide) | Medium | Low |
| 2 | oral history interview questions for grandparents | Practical | Informational (resource) | Medium | Low-Med |
| 3 | preserve grandparents voice recording | Emotional / personal | Transactional | Low-Med | Low |
| 4 | ethical voice cloning for family memories | Ethics / tech | Informational | Low | Very Low |
| 5 | self-hosted family memory platform | Privacy / tech | Transactional | Low | Very Low |
| 6 | digital legacy preservation | Legacy planning | Informational | Medium | Medium |
| 7 | family oral history recording tips | Practical | Informational | Low-Med | Low |
| 8 | best questions to ask elderly relatives | Emotional / practical | Informational (list) | Medium | Medium |
| 9 | open source genealogy platform | Tech / genealogy | Transactional | Low-Med | Low |
| 10 | how to preserve family memories digitally | General | Informational | Medium | Medium |
| 11 | recording family history interviews | Practical | Informational | Low-Med | Low-Med |
| 12 | voice recording for family tree genealogy | Genealogy | Informational | Low | Very Low |
| 13 | AI family history storytelling | Tech / creative | Informational | Low | Very Low |
| 14 | consent-first voice AI platform | Ethics / positioning | Transactional | Very Low | Very Low |
| 15 | what happens to digital memories after death | Legacy / legal | Informational | Low-Med | Low |

### Keyword Research Methodology

Since live search tools were unavailable during planning, these keywords were built from domain knowledge of the family history, oral history, and digital legacy niches, using real patterns observed across:
- Genealogy community forums (r/Genealogy, r/FamilyHistory, WikiTree)
- Self-hosting and open-source communities (r/selfhosted, r/opensource)
- Digital legacy / death-tech discourse (The Order of the Good Death, death cafes)
- Voice AI and ethics conversations (AI ethics publications, consent frameworks)

**Validation step:** When external tools are available, run each keyword through Ahrefs / Semrush / Google Keyword Planner to get actual search volume data and refine the list. Priority should go to keywords with:
- **Volume:** 100–2,000 monthly searches
- **KD (Keyword Difficulty):** <30
- **Intent:** Informational or transactional (not navigational)
- **Relevance:** Directly connects to Heard Again's value props

---

## Distribution Checklist (Per Article)

Every blog post gets a distribution pass. Agent drafts platform-specific versions; Ryan approves then posts.

### X (Twitter)

- [ ] 5–7 tweet thread version (hook → story → insight → call to action)
- [ ] Single-tweet version (for quote-tweeting or standalone)
- [ ] 1–2 key stats or provocative questions as standalone tweets
- [ ] Hashtags: `#FamilyHistory` `#OralHistory` `#Genealogy` `#DigitalLegacy` `#VoicePreservation`
- [ ] Tag relevant accounts (genealogy orgs, writers with overlapping audience) — only if genuinely relevant

### Reddit

- [ ] Identify 1–2 target subreddits (r/Genealogy, r/FamilyHistory, r/selfhosted, r/opensource, r/DataHoarder depending on topic)
- [ ] Write native-style post (not a link drop) — follow the r/selfhosted & r/Genealogy playbook from `marketing.md`
- [ ] Share as text post with article link in body (not link post)
- [ ] Spend 15 min engaging in subreddit before posting
- [ ] Reply to every comment

### LinkedIn

- [ ] Professional/thought-leadership version (500–800 words)
- [ ] Lead with insight, not promotion
- [ ] Tag 2–3 relevant people or orgs if genuinely connected
- [ ] Format: short paragraphs, line breaks, no external link in first paragraph

### Facebook

- [ ] Genealogy & Family History groups — write a discussion-starter version
- [ ] Warm, conversational tone
- [ ] Personal story angle works best here
- [ ] Link to article in comments (prevents link-penalty in some groups)

### Newsletter / Email

- [ ] 3-paragraph summary version for email subscribers (when newsletter exists)
- [ ] Subject line tested: emotional hook vs. curiosity gap
- [ ] One clear CTA

### Hacker News (selective)

- [ ] Only for technical/philosophical pieces (self-hosting, open source, AI ethics)
- [ ] Title must be honest and non-clickbaity
- [ ] Be present in thread for first 2 hours

---

## Success Metrics to Track

### Weekly (in SEO audit report)

- [ ] New blog post published? (binary)
- [ ] Social posts drafted? (binary, per platform)
- [ ] Broken links on blog section? (count)
- [ ] Sitemap lastmod dates current? (binary)
- [ ] All blog pages have meta title + description? (binary check)
- [ ] New backlinks detected? (count + domain authority)

### Monthly (in monthly SEO report)

| Metric | Tool | Target (Month 3) |
|--------|------|-------------------|
| Organic search traffic | Google Search Console / GA4 | 500+ visits/month |
| Average position for target keywords | GSC | Top 30 for 5+ keywords |
| Blog pages indexed | GSC coverage report | 100% of published posts |
| Backlinks gained | Ahrefs / GSC | 5+ new referring domains/month |
| Social shares (total) | Platform analytics + manual count | 50+ per article |
| Reddit post engagement | Reddit analytics | 10+ comments per post |
| Newsletter signups | Platform analytics | 20+/month from content |
| Time on page (blog) | GA4 | >3 min avg |
| Bounce rate (blog) | GA4 | <70% |
| Returning visitors | GA4 | >15% of total |

### Quarterly

- [ ] Keyword portfolio review: which keywords moved up/down? Any new keyword opportunities?
- [ ] Content audit: which posts performed best? Refresh underperformers.
- [ ] Competitor gap analysis: what keywords are competitors ranking for that we aren't?
- [ ] Technical SEO re-audit: Core Web Vitals, mobile, structured data

---

## Directory Structure

```
docs/marketing/
├── SEO_AUTOMATION_PLAN.md        (this file)
├── drafts/                        (weekly blog drafts)
│   ├── YYYY-MM-DD-slug.md
│   └── social/
│       └── YYYY-MM-DD-platform.md
├── reports/
│   ├── weekly-seo/
│   │   └── YYYY-MM-DD.md
│   ├── monthly/
│   │   └── YYYY-MM.md
│   └── competitor/
│       └── YYYY-MM.md
└── marketing.md                   (Reddit launch plan — existing)
```

---

## Activation Checklist

Before activating cron jobs:

- [ ] Ryan reviews and approves this plan
- [ ] Create `docs/marketing/drafts/` directory
- [ ] Create `docs/marketing/drafts/social/` directory
- [ ] Create `docs/marketing/reports/weekly-seo/` directory
- [ ] Create `docs/marketing/reports/monthly/` directory
- [ ] Create `docs/marketing/reports/competitor/` directory
- [ ] Verify Hermes cron infrastructure is configured (`hermes cron list`)
- [ ] Test one manual run of `weekly-blog-draft` before activating schedule
- [ ] Confirm Ryan has notification channel set up (email, Telegram, or Slack)
- [ ] Set up Google Search Console for heardagain.com (if not already)
- [ ] Set up GA4 for heardagain.com (if not already)
- [ ] Validate all target keywords with live search volume data
- [ ] Adjust crawl-delay in robots.txt (5s is reasonable for most crawlers)

---

## Style Guide (for Agent-Written Content)

### Voice

- **Warm, not saccharine.** Write like you're having coffee with someone you respect.
- **Editorial, not promotional.** The article should stand on its own as good writing, not as an ad for Heard Again.
- **Specific, not vague.** Use real examples, concrete details, named tools/methods.
- **Never hype AI.** Frame voice cloning as a tool, not magic. Always mention consent and ownership.
- **Cite sources.** Link to research, news articles, or reputable organizations when making claims.

### Structure

- Title: Emotional hook, keyword-aware but not keyword-stuffed
- Opening: Personal story or provocative question (first 100 words matter most)
- Body: Structured sections, short paragraphs, subheads for scanning
- Close: One clear takeaway or call to action, gentle, not salesy
- Meta description: 150–160 characters, includes primary keyword, tells reader what they'll learn

### Anti-Patterns (Agent Must Avoid)

- ❌ "In today's fast-paced digital world..."
- ❌ "Leveraging cutting-edge AI technology..."
- ❌ "Revolutionizing the way families..."
- ❌ Lists of "10 Reasons Why..."
- ❌ Fake urgency ("Don't wait — act now!")
- ❌ Overuse of em dashes and semicolons
- ❌ GPT-isms: "delve," "tapestry," "it's not just X, it's Y," "unlock your potential"
- ❌ Mentioning Heard Again in the first paragraph
