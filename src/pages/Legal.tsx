import type { ReactNode } from "react";
import { Link } from "../lib/router";

// Starting templates. Have them reviewed by a lawyer before launch — they are not legal advice.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || "support@example.com";
const GRIEVANCE = import.meta.env.VITE_GRIEVANCE_OFFICER || "[Name]";
const UPDATED = "15 November 2026";

function Page({ children }: { children: ReactNode }) {
  return <article className="prose-page card mx-auto my-8 max-w-3xl p-6 sm:p-10">{children}</article>;
}

export function Guidelines() {
  return (
    <Page>
      <h1>Community guidelines</h1>
      <p>EchoWave is for useful, real-time updates about your area. Keep it helpful, honest and kind.</p>
      <h2>Great broadcasts</h2>
      <ul>
        <li>Traffic, road closures, accidents, weather, flooding, power or water cuts</li>
        <li>Local events, markets, lost &amp; found pets or items</li>
        <li>Local deals and small-business announcements (no spam, no repeats)</li>
        <li>Urgent safety alerts — only when they are real</li>
      </ul>
      <h2>Not allowed</h2>
      <ul>
        <li>Harassment, threats, insults, hate speech or discrimination</li>
        <li>Sexual content, nudity, or graphic violence</li>
        <li>Spam, chain messages, scams, phishing, MLM or get-rich-quick offers</li>
        <li>Other people's private information (phone numbers, home addresses, ID numbers, photos of people without consent)</li>
        <li>False alerts or deliberately misleading information</li>
        <li>Anything illegal, or that encourages dangerous activities</li>
        <li>Content involving minors that is sexual, abusive or exploitative — reported to authorities</li>
      </ul>
      <h2>How we enforce this</h2>
      <p>Every broadcast and comment is checked by AI before it appears. Anyone can report a broadcast; broadcasts with several reports are hidden automatically until our team reviews them. You can block anyone. Accounts that break the rules repeatedly are suspended.</p>
      <p>Spotted something? Use <strong>⋯ → Report</strong> on any broadcast, or email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We aim to act on reports within 24 hours.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page>
      <h1>Privacy policy</h1>
      <p><em>Last updated: {UPDATED}</em></p>
      <p>This policy explains what EchoWave ("we") collects, why, and your choices. Contact: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address and sign-in details (handled by Google Firebase Authentication), and the username you choose.</li>
        <li><strong>Content you post:</strong> broadcasts, photos, comments, likes and reports.</li>
        <li><strong>Approximate location — only if you choose:</strong> when you tap “Use current location” or “Near me”. Broadcast locations are rounded to about 1 km before being stored; we never store your exact position. Other users only see an approximate distance.</li>
        <li><strong>Technical data:</strong> basic logs (such as IP address and device type) kept by our hosting provider for security and abuse prevention.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run the app: show your broadcasts, the live feed, trending and notifications.</li>
        <li>For safety: broadcasts, photos and comments are sent to Google's Gemini AI service to check them for harmful content, tag topics and write image descriptions for accessibility.</li>
        <li>We do not sell your data and we do not show ads.</li>
      </ul>
      <h2>Who processes it</h2>
      <ul>
        <li>Cloudflare (hosting, database, photo storage)</li>
        <li>Google Firebase (sign-in) and Google Gemini API (content moderation)</li>
      </ul>
      <h2>How long we keep it</h2>
      <ul>
        <li>Broadcasts leave the feed after 48 hours and are permanently deleted about a day later, together with their photos, likes and comments.</li>
        <li>Notifications are deleted after 30 days.</li>
        <li>Your account is kept until you delete it.</li>
      </ul>
      <h2>Your choices and rights</h2>
      <ul>
        <li>Delete any broadcast or comment at any time.</li>
        <li>Delete your whole account in the app (Profile → Delete account). See <Link to="/delete-account">how to delete your account</Link>.</li>
        <li>Ask us for a copy of your data or to correct it by emailing <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</li>
      </ul>
      <h2>Children</h2>
      <p>EchoWave is not for children under 13. If you are under 18, you need permission from a parent or guardian.</p>
      <h2>Changes</h2>
      <p>We will post any changes here and update the date above.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page>
      <h1>Terms of use</h1>
      <p><em>Last updated: {UPDATED}</em></p>
      <p>By using EchoWave you agree to these terms and our <Link to="/guidelines">Community guidelines</Link>.</p>
      <h2>Your content</h2>
      <p>You are responsible for what you post. You keep ownership of it and give EchoWave permission to display it in the app for as long as it is live. Don't post anything you don't have the right to share.</p>
      <h2>No emergency service</h2>
      <p>EchoWave is not an emergency service and information posted by users may be wrong. In an emergency, contact local emergency services (112 in India).</p>
      <h2>Moderation</h2>
      <p>We may remove content or suspend accounts that break our guidelines or the law, with or without notice. Automated (AI) checks can make mistakes — if your content was removed unfairly, email us.</p>
      <h2>Grievance officer</h2>
      <p>Complaints about content or these terms can be sent to our Grievance Officer: {GRIEVANCE}, <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</p>
      <h2>Liability</h2>
      <p>EchoWave is provided “as is”. To the extent allowed by law, we are not liable for losses arising from user content or from using the app.</p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use means you accept the new version.</p>
    </Page>
  );
}

/** Public page Google Play requires: tells people how to delete their account and data, even without the app. */
export function DeleteAccountInfo() {
  return (
    <Page>
      <h1>Delete your EchoWave account</h1>
      <h2>In the app or website</h2>
      <ul>
        <li>Log in and open your <strong>Profile</strong> (top right).</li>
        <li>Scroll to <strong>Delete account</strong> and confirm.</li>
      </ul>
      <h2>Without logging in</h2>
      <p>Email <a href={`mailto:${CONTACT}?subject=Delete%20my%20EchoWave%20account`}>{CONTACT}</a> from the email address on your account with the subject “Delete my EchoWave account”. We'll delete it within 7 days.</p>
      <h2>What gets deleted</h2>
      <p>Your account, username, all broadcasts and photos, comments, likes, reports, blocks and notifications. Nothing is kept, except server security logs that expire automatically.</p>
    </Page>
  );
}
