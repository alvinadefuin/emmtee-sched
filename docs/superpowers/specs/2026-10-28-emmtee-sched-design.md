# emmtee-sched — Design Spec

Date: 2026-10-28
Status: Draft for review

## 1. Purpose

A no-login web app for assigning volunteers to Sunday duties each month. The organiser shares one link; volunteers pick their name, claim the dates/roles they can do, and can request swaps with each other. After a deadline, the organiser auto-fills gaps, reviews a draft, and publishes. The published schedule is exported as a shareable portrait image in the style of the existing monthly posters.

## 2. Domain

### 2.1 Roles

| Role key   | Label (UI / image)        | Cardinality                  |
|------------|---------------------------|------------------------------|
| `laptop`   | Laptop — Operator         | 1 per Sunday                 |
| `assist`   | Laptop — Assist (intern)  | 0 or 1 per Sunday            |
| `photog`   | Photog                    | 1 per Sunday                 |
| `poster`   | Poster                    | 1 per month (not per Sunday) |

- The `assist` role is for a trainee observing/assisting the laptop operator. An empty assist slot is normal and is shown as `---`.
- Each volunteer has a set of eligible roles. A volunteer may be eligible for more than one role.

### 2.2 Dates

- A month's service dates are every Sunday in that month (4 or 5 dates), generated automatically.
- The organiser can remove a date (e.g. a cancelled service) or add a non-Sunday date manually.
- All times use **Asia/Manila** (Philippine time).

### 2.3 Patterns observed in past schedules (inform auto-fill and defaults)

Derived from Feb–Oct 2026 posters. Real names are kept out of this repo; the local file `local/roster-notes.md` (gitignored) maps these to people.

- **Poster rotation:** a fixed cycle of 5 volunteers, one per month, repeating in the same order. The next month's poster is pre-filled as the next person in the cycle.
- **Twice a month:** with 4–5 Sundays and only ~4 eligible people per role, some volunteers serve twice. Second assignments are usually 2+ weeks apart (often first and last Sunday). 5-Sunday months always produce at least one double.
- **No same-day double:** a volunteer eligible for two roles never holds both on the same Sunday.
- **Unfilled slots** are shown as `---`.

## 3. Architecture

- **Framework:** Next.js 16 (App Router, server actions), React 19, TypeScript, Tailwind CSS 4. Matches the existing `rto-tracker` project.
- **Database:** Neon Postgres via `@neondatabase/serverless` + Drizzle ORM (schema and migrations in TypeScript).
- **Hosting:** Vercel. Secrets as Vercel environment variables only.
- **Image generation:** `next/og` (`ImageResponse`) rendering a 1500×2000 PNG.
- **Repository:** public GitHub repo (see §9).

### 3.1 Environment variables

| Name            | Purpose                                         |
|-----------------|-------------------------------------------------|
| `DATABASE_URL`  | Neon connection string                          |
| `ORGANISER_PIN` | 6-digit organiser PIN (compared server-side)    |
| `SESSION_SECRET`| Signs the organiser session cookie              |

A committed `.env.example` lists these names with empty values.

## 4. Pages

### 4.1 `/` — Poll (the shared link)

1. **Name picker.** Dropdown of active volunteers. The choice is stored in `localStorage` (wrapped in try/catch; if unavailable, the user re-picks each visit). A "Not you?" link switches name.
2. **Header.** Month name, status, and a deadline countdown ("Closes in 2 days 4 hrs") while open.
3. **Swap alerts.** Banner listing pending swap requests addressed to the selected name, each linking to `/swap/[id]`.
4. **Grid.** Rows = dates; columns = Laptop (Operator | Assist), Photog. The month's Poster is shown above or beside the grid.
   - Empty cell + selected name eligible + poll open → **Claim**.
   - Own cell + poll open → **Release**.
   - Cell held by someone else → **Request swap** (open or published state; see §6).
   - Ineligible cells are visibly disabled.
5. **After publish:** the grid becomes read-only (except swaps) and shows **Share image** (Web Share API with the PNG file on mobile; falls back to **Download PNG**).

### 4.2 `/swap/[id]` — Swap request

Shows requester, the two slots involved (or "hand-over" if one-sided), and status. Accept / Decline buttons for the target; Cancel for the requester. Identity is the name picker selection (honour system). Shows a clear reason if the request is no longer valid.

### 4.3 `/organiser` — Organiser controls (PIN)

PIN entry form. On success, sets a signed, HTTP-only session cookie (12-hour expiry).

Functions:
- **Create month:** pick year/month → Sundays generated, poster pre-filled from rotation, deadline defaulted (§5), status `open`.
- **Edit month:** deadline, poster, add/remove dates, image theme (`teal` or `peach`), notes.
- **Roster:** add/deactivate volunteers, set eligible roles, set poster rotation order.
- **Lock / Auto-fill / Draft review:** see §7.
- **Manual edit:** set or clear any slot at any status.
- **Publish / Unpublish.**
- **Reset month:** from any status, in a collapsed "Danger zone" that needs the word RESET typed (re-checked on the server). In one transaction it clears every slot (name and source), cancels all pending swap requests on the month (reason "The organiser reset the month."), clears the stored auto-fill seed and sets the status to `open`. It keeps the month, dates, deadline, theme, notes, poster and accepted/declined swap history. If the deadline has passed the poll reads as locked, and the message says to move the deadline later.

### 4.4 `/api/months/[yyyy-mm]/image` — Schedule PNG

Returns the published schedule as PNG (see §8). Returns 404 for unpublished months.

### 4.5 Live updates

Open pages pick up other people's changes without a manual reload.

- **Version endpoints.** `GET /api/months/[yyyy-mm|latest]/version` and `GET /api/swaps/[id]/version` return `{ "v": "<16 hex>" }`, a SHA-256 fingerprint of a canonical, order-independent serialisation of what the page shows: for a month, the month list, stored and effective status (an open month past its deadline counts as locked), deadline, theme, poster, notes, service dates, slot holders, the month's swap requests (id and status) and the roster (names, active, roles, poster order); for a swap, its status and reason, its slots' holders, the month's effective status and the roster names. `latest` follows the month the poll page shows. The value is opaque, so it is safe to expose publicly. Unknown months or swaps return 404. Responses are dynamic and sent with `Cache-Control: no-store`.
- **Polling.** A client component (`LiveRefresh`) fetches the version every 10 s while the tab is visible, stops while it is hidden, and checks at once when the tab becomes visible, gains focus or comes back online. One request at a time; network errors are ignored until the next tick. When the version changes it calls `router.refresh()`, which re-renders server data while keeping client state (chosen name, open pickers, scroll).
- **Organiser edit protection.** On `/organiser` a refresh is held back while focus is in an input, select or textarea, or while any form has unsaved changes (forms touched by input events, confirmed by comparing values with their rendered defaults, and cleared on submit). The held refresh is applied as soon as it is safe.
- **Why not push.** Vercel functions are short-lived and cannot hold WebSocket or long-lived SSE connections cheaply, and a hosted pub/sub service would add a dependency for a small group of users. Polling a tiny, uncached endpoint every 10 s is simple and costs a few small queries per open page.

## 5. Month lifecycle and deadline

```
open ──(deadline passes or organiser locks)──▶ locked ──(Auto-fill)──▶ draft ──(Publish)──▶ published
  ▲                                                                       │
  └──────────────────────(organiser reopens)──────────────────────────────┘
```

- **Default deadline:** the last Friday strictly before the 1st of the month, 23:59 Asia/Manila. Example: December 2026 → Friday 27 November 2026, 23:59.
- Deadline is enforced on the server at request time (no cron): once `now > deadline`, claim/release actions are rejected and the UI shows "Closed — waiting for organiser". Status transitions to `locked` lazily on read or when the organiser opens the page.
- The organiser can edit the deadline or reopen the month.
- Swaps are allowed in `open` and `published` states. They are blocked in `locked` and `draft` states so that the draft does not change under review.

## 6. Swaps

### 6.1 Types

- **Exchange:** requester offers one of their slots in return for the target's slot.
- **Hand-over:** requester asks the target to take the requester's slot; nothing in return.

### 6.2 Validation (on create and again on accept)

- Both people are eligible for the role of the slot they would receive.
- Neither person ends up with two roles on the same date.
- Each slot is still held by the person named in the request.
- At most one `pending` request per slot.
- Month status is `open` or `published`.

### 6.3 Accept

Runs in one database transaction: re-validate (§6.2) with row locks on both slots, exchange or move volunteer IDs, mark request `accepted`, and mark any other pending requests that touch either slot as `cancelled`. If validation fails, the request is marked `invalid` with a reason shown to both parties.

### 6.4 Notification (no accounts)

1. **Share link:** after creating a request, the requester gets a prefilled message ("Hi <name>, can we swap? My Nov 9 Laptop for your Nov 23 Laptop. Tap to accept or decline: <link>") with **Share** (Web Share API) and **Copy** buttons, to send via Messenger.
2. **In-app alert:** the banner on `/` (§4.1) when the target opens the poll with their name selected.
3. **Short links:** each request gets a random 8-character code from `23456789ABCDEFGHJKMNPQRSTVWXYZ` (no 0/O/1/I/L/U; about 39 bits, generated with `crypto.randomInt`, retried on a clash with the unique index). Shared and in-app links use `/s/<CODE>`, which normalises the case, looks the code up and answers with a temporary (307) redirect to `/swap/[id]` (unknown codes get 404). Requests made before short links have no code and keep `/swap/[id]` links, which keep working permanently.

No email, SMS or push notifications; no contact details are stored.

## 7. Auto-fill

Triggered by the organiser from `locked` status. Produces a `draft`; it never publishes.

Algorithm (deterministic given a seed; seed stored with the draft):

1. **Keep claims.** Slots with `source = claimed` or `manual` are fixed.
2. **Everyone once.** For each role, volunteers eligible for it who hold zero slots in that role are placed into empty slots, fewest-total-slots first (ties broken by seeded shuffle). A placement must satisfy the constraints in step 4.
3. **Fill remaining gaps.** For each remaining empty `laptop` or `photog` slot (in date order), choose the eligible volunteer with the lowest count in that role, then lowest total count, whose other slots in that role are ≥ 14 days away. If none satisfy the 14-day gap, relax to ≥ 7 days. `assist` slots are not force-filled beyond step 2.
4. **Constraints (hard):** eligibility; no volunteer holds two roles on the same date.
5. **Unfillable** slots stay empty (`---`) and are listed on the organiser page.
6. **Explanation:** the draft includes a per-volunteer summary (e.g. "Volunteer A: photog ×2 (Nov 1, Nov 29)") and marks each auto-filled slot with `source = auto` so it is visually distinct in review.

The organiser can manually edit any draft slot, re-run auto-fill (which discards previous `auto` slots only), or publish.

### 7.1 Required roles

Laptop Assist is optional. Laptop Operator and Photog must never be blank on a published schedule (`REQUIRED_ROLES` in `src/lib/roles.ts`).

- **Publish guard:** `publish` is refused while any Operator or Photog slot in the month is empty; the message names the empty slots. The organiser can fill them or remove the date. The Publish button is disabled with the reason shown, and the server enforces it regardless.
- **Published months:** the organiser cannot clear an Operator or Photog slot (replacing it is fine); Assist can still be cleared. Unpublish first to leave a required slot empty.
- **Poll page:** an unclaimed Operator or Photog slot is marked "Needed"; an unclaimed Assist slot is marked "Optional".
- Auto-fill is unchanged; unfillable required slots are listed and must be resolved by hand before publishing.

## 8. Shareable image

- **Size:** 1500×2000 PNG, portrait.
- **Layout (top to bottom):** month name (large serif, uppercase), year, cut-out style "Schedule" wordmark, column headings, rows, dotted bracket linking all rows to the single Poster tag on the right.

```
DATE        LAPTOP           PHOTOG        POSTER
       OPERATOR   ASSIST
[01]   [NAME]    [NAME]     [NAME]       ┐
[08]   [NAME]    [NAME]     [NAME]       ┊
[15]   [NAME]    [ --- ]    [NAME]       ├ [NAME]
[22]   [NAME]    [NAME]     [NAME]       ┊
[29]   [NAME]    [NAME]     [NAME]       ┘
```

- Names in uppercase inside rounded pale-pink tags; Assist tags slightly smaller than Operator tags. Empty slots show `---`.
- **Themes:** `teal` (teal → grey → navy gradient, dark text) and `peach` (peach → grey → cream gradient, light title text). Selected per month by the organiser.
- **Torn graph-paper corner:** drawn in code (SVG grid with an irregular torn edge) rather than using a third-party asset, so the public repo contains no licensed images.
- **Fonts:** open-licence Google Fonts chosen to approximate the current posters (a decorative display serif for the title, a brush/script serif for "Schedule", a condensed hand-drawn sans for tags). Font files are bundled for `next/og`. Final choices are confirmed with the user via a rendered sample before completion.
- The image is regenerated on each request from current data, so swaps after publishing are reflected automatically.

## 9. Public repository constraints

- No secrets in code or history. `.env*` ignored except `.env.example`.
- No real volunteer names in the repo. Seed data, the real roster and past-schedule notes live in `local/` (gitignored). Tests and examples use placeholder names ("Volunteer A", "Volunteer B"…).
- Past schedule images are not committed.
- No third-party images with unclear licences.

## 10. Data model (Drizzle / Postgres)

```
volunteers        id, name, active (bool), poster_order (int, nullable), created_at
volunteer_roles   volunteer_id → volunteers, role (enum: laptop|assist|photog|poster)   PK(volunteer_id, role)
months            id, year, month, deadline (timestamptz), status (enum: open|locked|draft|published),
                  poster_volunteer_id → volunteers (nullable), theme (enum: teal|peach),
                  autofill_seed (int, nullable), notes (text), created_at
                  UNIQUE(year, month)
service_dates     id, month_id → months, date (date)                                     UNIQUE(month_id, date)
slots             id, service_date_id → service_dates, role (enum: laptop|assist|photog),
                  volunteer_id → volunteers (nullable), source (enum: claimed|auto|manual, nullable),
                  updated_at                                                             UNIQUE(service_date_id, role)
swap_requests     id (uuid), requester_id → volunteers, target_id → volunteers,
                  requester_slot_id → slots (not null),
                  target_slot_id → slots (null for hand-over),
                  kind (enum: exchange|handover), status (enum: pending|accepted|declined|cancelled|invalid),
                  reason (text, nullable), short_code (text, nullable, UNIQUE), created_at, resolved_at
organiser_attempts ip_hash, window_start, count                                          (PIN rate limiting)
```

Swap slot semantics: `requester_slot_id` is always set (the slot the requester currently holds). For `exchange`, `target_slot_id` is the slot the requester wants. For `handover`, `target_slot_id` is null and the requester's slot moves to the target. Partial unique index: one `pending` request per `requester_slot_id` and per `target_slot_id`.

Constraint "no two roles on the same date" is enforced in application code inside transactions (a volunteer may have at most one non-null slot per `service_date_id`), backed by a partial unique index on `(service_date_id, volunteer_id) WHERE volunteer_id IS NOT NULL`.

## 11. Security and abuse

- No user accounts; volunteer identity is an honour system. Accepted risk: anyone with the link can act as any volunteer. Mitigation: every slot change and swap records `updated_at`/`source`, and the organiser can correct anything manually.
- Organiser PIN: compared in constant time; 5 failed attempts per hashed IP per 15 minutes, then locked for 15 minutes. Session cookie is signed, HTTP-only, `SameSite=Lax`, `Secure`.
- All mutations are server actions that re-validate eligibility, status and deadline on the server.
- Swap request IDs are UUIDs (not guessable sequential IDs).

## 12. Error handling

- Stale UI (someone else claimed first): server rejects, UI refreshes and shows "Already taken by <name>".
- Deadline passed while page open: claim rejected with "Poll closed".
- Invalid swap on accept: request marked `invalid`, reason displayed.
- `localStorage` unavailable: app works; name must be re-selected each visit.
- Image route errors: return 500 with plain-text message; organiser page shows a retry.

## 13. Testing

- **Unit (Vitest):** Sunday generation; default deadline calculation in Asia/Manila (including months starting on Saturday/Sunday); auto-fill (everyone once, 14-day gap and 7-day relaxation, no same-day double, `---` when short, claims preserved, determinism by seed); swap validation for exchange and hand-over.
- **Database integration (against a Neon branch or local Postgres):** concurrent accept of conflicting swaps leaves data consistent; unique constraints hold.
- **Image:** render snapshot for a 4-Sunday and a 5-Sunday month, both themes; manual visual check by the user.
- **Manual end-to-end:** create month → claim from two browsers → deadline passes → auto-fill → edit → publish → share image → swap after publish → image updates.

## 14. Out of scope

- User accounts, email/SMS/push notifications, contact details.
- Multiple teams or ministries.
- Importing historical schedules.
- Attendance tracking.
