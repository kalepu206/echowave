# Google Play listing: ready-to-paste answers

Replace `yourdomain` with your real domain everywhere.

## Store listing

**App name** (max 30): `EchoWave: Local Live Updates`

**Short description** (max 80):
`See what's happening near you: traffic, rain, outages, deals & alerts, live.`

**Full description:**
```
EchoWave is your neighbourhood's live feed. Share and discover what's happening around you right now: traffic jams, heavy rain, power cuts, road closures, local events, deals, and lost & found.

• LIVE LOCAL FEED: See broadcasts from people near you, within 2 to 50 km.
• BROADCAST IN SECONDS: Up to 280 characters, with an optional photo and approximate location.
• TRENDING: The most-liked updates rise to the top, and AI sums up what's happening in a few lines.
• URGENT ALERTS: Accidents, floods and closures are highlighted so you see them first.
• SAFE BY DESIGN: Every post is checked by AI for abuse, spam and scams before it appears. Report or block anyone in one tap.
• PRIVATE BY DEFAULT: Your exact location is never stored. Posts disappear after 48 hours.
• ACCESSIBLE: AI writes descriptions of photos for screen-reader users; light and dark themes.

EchoWave is not an emergency service. In an emergency, call 112.
```

**Category:** Social (or News & Magazines) · **Tags:** local, community, news
**Contact email:** your support email · **Website:** https://yourdomain
**Graphics:** `store-graphics/play-icon-512.png`, `store-graphics/feature-graphic-1024x500.png`.
**Screenshots:** at least 2 phone screenshots. Open your site on your phone (or Chrome DevTools phone mode) and capture the feed, posting a broadcast, and trending.

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | `https://yourdomain/privacy` |
| Ads | No, the app does not contain ads |
| App access | All functionality is available without special access. To review posting, reviewers can sign in with Google. If you want, create a test email account and give its login here |
| Content rating | Fill in the questionnaire. Answer **Yes** to "users can interact / share content" (user-generated content). No violence, sex, gambling etc. in the app itself |
| Target audience | 13–15, 16–17, 18+ (do **not** select under 13) |
| News app | No (it's user-generated local updates, not a news publisher) |
| Government app | No |
| Financial features | None |
| Health | None |
| User-generated content | Yes. Users must accept Terms; content is moderated by AI + human review; users can report content and block users in-app |
| Account deletion | Users can delete in-app (Profile → Delete account). Web link: `https://yourdomain/delete-account` |

## Data safety form

**Does your app collect or share user data?** Yes, collects. Data is **not shared** with third parties (Cloudflare and Google act as service providers, which doesn't count as sharing).
**Encrypted in transit?** Yes. **Can users request deletion?** Yes.

| Data type | Collected | Optional? | Purpose |
|---|---|---|---|
| Location → Approximate location | Yes | Optional | App functionality |
| Personal info → Email address | Yes | Required | Account management |
| Personal info → User IDs | Yes | Required | Account management, App functionality |
| Photos and videos → Photos | Yes | Optional | App functionality |
| Messages → Other in-app messages (posts and comments) | Yes | Required to post | App functionality, Fraud prevention / security |
| App activity → Other user-generated content (likes, reports) | Yes | Optional | App functionality |

Not collected: precise location, contacts, financial info, health, files, audio, calendar, device IDs, crash logs.

## Release checklist

1. Closed testing track → upload `.aab` → add a tester email list of 15–20 people → share the opt-in link.
2. Wait until at least 12 testers have stayed opted in for 14 days in a row.
3. Dashboard → **Apply for production**, answering the questions about your test (what you tested, feedback you got, what you changed).
4. After approval: Production → Create release → upload the same or newer `.aab` → roll out.
