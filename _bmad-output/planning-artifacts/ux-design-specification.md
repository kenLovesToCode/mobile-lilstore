---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - "/Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.md"
  - "/Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.validation-report.md"
lastStep: 14
completedAt: "2026-03-02T11:02:36+0800"
---

# UX Design Specification LilStore

**Author:** myjmyj
**Date:** 2026-03-02 05:15 PST

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

LilStore replaces a messy, error-prone “credit shopping” process (handwritten notes + later computation) with a fast, shared-device flow: shopper enters a PIN, scans barcodes, sets quantities, confirms, and the session ends immediately. The owner gets complete, reliable records (per-shopper history and total owed) without depending on shoppers to write legible notes—especially during rush periods.

### Target Users

**Store Owner / Admin (tech-savvy)**
- Maintains the product catalog and the published shopping list (what’s allowed for sale).
- Needs accurate per-shopper purchase history and an always-correct total credit owed.
- Uses the app daily and is comfortable with “software-y” admin workflows.

**Shopper (not tech-savvy; normal office staff)**
- Wants convenience: grab food, scan, set quantity, done.
- Often in a rush (e.g., near breaktime end), which causes missed/late/unclear handwritten recording today.
- Uses the owner’s device like a dedicated scanner terminal (not installed per shopper).

### Key Design Challenges

- **Speed under pressure:** The flow must stay fast during rush hour; any extra taps, text entry, or ambiguity will cause drop-off and “do it later” behavior.
- **Low tech comfort:** Shoppers should succeed without training; the UI needs clear, large, forgiving interactions.
- **Shared-device safety:** Prevent “wrong person” purchases via PIN gating and immediate auto-logout after confirm.
- **Error prevention:** Avoid wrong items/quantities and prevent purchases beyond available quantity; make “not available” states obvious and recoverable.
- **Owner trust in records:** The ledger/history must feel authoritative and easy to audit so it truly replaces manual computation.

### Design Opportunities

- **Scan-first, zero-typing shopper UX:** Barcode scan + big quantity controls + a simple cart review to reduce mistakes without slowing checkout.
- **Strong “availability” feedback:** Instant, unmistakable feedback when an item isn’t in the published shopping list, with quick return to scanning.
- **Confidence-building confirmation + logout:** A clear “purchase recorded” moment that reassures shoppers and owners, followed by auto-logout to protect identity on a shared device.
- **Owner-centric auditability:** Fast per-shopper views (history + balance) that directly eliminate the tedious per-shopper computation work.

## Core User Experience

### Defining Experience

LilStore’s core experience is a shared-device “credit purchase” loop optimized for rush-hour usage: a shopper unlocks a short session via PIN, scans barcodes (no typing product names), sets quantities quickly, reviews a simple cart for mistakes, confirms, and is immediately logged out. The value is two-sided: shoppers finish fast and consistently; the owner gets complete, legible, per-shopper records without manual note-taking or later computation.

### Platform Strategy

- Mobile app on a single shared owner device (used like a dedicated scanner terminal).
- Touch-first interactions with camera-based barcode scanning.
- Offline-first: the core loop must work with no connectivity, every time.
- Shared-device safety: user identity must not persist beyond a completed purchase session.

### Effortless Interactions

- “Start shopping” is obvious and fast (no browsing, no typing).
- PIN entry is quick and forgiving for non-tech-savvy users.
- Scan feedback is immediate and unambiguous (recognized vs not allowed/not found).
- Quantity selection is fast for common cases (small numbers) and still possible for uncommon cases.
- Cart review is lightweight but prevents the most common mistakes (wrong item, wrong quantity).
- Confirmation feels final and trustworthy (then auto-logout happens automatically).

### Critical Success Moments

- **Unlock moment:** shopper enters PIN and immediately understands they’re “in” and ready to scan.
- **Scan moment:** the app instantly confirms “this is allowed” or clearly blocks “not available.”
- **Confirm moment:** purchase is recorded, quantities/balance are updated, and both parties trust it happened.
- **Auto-logout moment:** shopper sees the session end, preventing wrong-person purchases.

### Experience Principles

- **Scan-first, zero-typing:** default to camera scanning and big taps; avoid text entry for shoppers.
- **Rush-hour resilient:** minimize steps and decision points; optimize for fast repeat use.
- **Shared-device safe by design:** PIN gates identity; auto-logout prevents lingering sessions.
- **Mistakes prevented, not corrected later:** block unavailable items and invalid quantities before confirm.
- **Owner-grade audit trail:** every purchase creates records that remove the need for manual computation.

## Desired Emotional Response

### Primary Emotional Goals

**Shopper**
- Feel fast and unblocked (“I can do this quickly even when I’m rushing.”)
- Feel confident (“I know what I scanned and what I’m confirming.”)
- Feel safe / non-embarrassed (“I won’t mess this up in front of others.”)

**Owner**
- Feel full trust and control (“Records are accurate; I don’t need manual computation.”)
- Feel calm (“No chasing people for notes; no deciphering handwriting.”)

### Emotional Journey Mapping

- **Home / Start:** Clear and confident (“I know exactly what to tap.”)
- **PIN unlock:** Reassured and legitimate (“This is my session.”)
- **Scanning:** High certainty (“Recognized / Not available” is instant and obvious.)
- **Quantity + cart review:** In control (“I can correct mistakes before it’s final.”)
- **Confirm + auto-logout:** Closure and trust (“It’s recorded; session is done.”)
- **When something goes wrong:** Supported, not blamed (“I can recover without panic.”)

### Micro-Emotions

- Confidence over confusion (especially for non-tech-savvy shoppers)
- Trust over skepticism (for owner reliance on ledger/history)
- Calm over anxiety (rush-hour usage)
- Accomplishment over frustration (quick “done” feeling)

### Design Implications

- **Confidence** → big, clear scan feedback; visible cart contents; simple language
- **Trust** → unambiguous confirmation state; clear timestamps/records in admin
- **Calm** → minimal steps; forgiving inputs; fast recovery paths on errors
- **Avoid embarrassment** → prevent “gotcha” errors; don’t show scary warnings for normal mistakes

### Emotional Design Principles

- Default to clarity over cleverness (especially in shopper flow)
- Make the correct path the fastest path
- Make “not allowed / not available” unmistakable, then instantly recoverable
- Make confirmation feel final, and make logout feel protective (not punitive)

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Instagram**
- Strong sense of “polish” through motion: smooth transitions, subtle micro-animations, and immediate feedback to taps.
- Clear primary actions with recognizable iconography and consistent placement.
- Content is visually engaging (color, imagery, layered surfaces) while still feeling lightweight to use repeatedly.

**Facebook**
- Familiar, low-learning-curve UI patterns that “normal users” already understand.
- Fast interaction loops with clear feedback (tap → something happens immediately).
- Consistent layout patterns that help users operate quickly without thinking.

**Key takeaway for LilStore**
Even though LilStore is not a social app, we can borrow the *feeling*: visually engaging, modern, and animated—without borrowing the *structure* (feeds, infinite scroll, heavy navigation).

### Transferable UX Patterns

- **High feedback, low thinking:** Every tap produces immediate visual feedback (press states, small animations).
- **Polished motion language:** Quick, consistent transitions for screen changes, confirmations, and error states.
- **Delight without complexity:** Small “moments” (success animation, scan “ping” feedback) that make the app feel cute and entertaining.
- **Recognizable icon + label pairs:** Helpful for non-tech-savvy users (icon alone can be ambiguous).
- **Card/surface hierarchy:** Layered UI (cards/sheets) that keeps key actions visually separated and easy to find.

### Anti-Patterns to Avoid

- **Low-contrast neumorphism:** Soft UI can look “cute” but often makes buttons/inputs hard to see; that would increase shopper mistakes.
- **Over-animated interactions:** Too much motion slows rush-hour flow and can feel distracting or laggy on low-end devices.
- **Tiny tap targets / subtle states:** Shoppers need big, obvious buttons and unmistakable states.
- **Visual clutter near scanning:** The scanner UI must prioritize clarity and speed over decoration.

### Design Inspiration Strategy

**What to Adopt**
- A “cute, girly, entertaining” visual direction using playful color, friendly shapes, and polished motion.
- Consistent micro-interactions: press states, subtle bounce/scale on primary buttons, crisp success/failure feedback.

**What to Adapt**
- **Skeuomorphic / Soft UI (hybrid approach):**
  - Use soft depth (shadows, raised surfaces) for *large primary controls* (Buy Now, Confirm, quantity controls).
  - Keep text and critical status surfaces high-contrast and flat-enough to read instantly.
- Social-app polish applied to utilitarian flows:
  - Smooth transitions between PIN → Scanner → Cart → Confirm, tuned for speed (short durations, minimal flourish).

**What to Avoid**
- Neumorphic-only UI where boundaries disappear (especially for quantity controls and confirm actions).
- Decorative backgrounds that reduce readability or compete with scan feedback.

## Design System Foundation

### 1.1 Design System Choice

**Chosen approach:** Custom token-based design system (Skeuomorphic / Soft UI hybrid), built specifically for LilStore’s shared-device, scan-first workflows.

### Rationale for Selection

- The product needs a “cute, girly, entertaining” look with tactile depth (skeuo/soft surfaces) that established systems won’t match cleanly.
- Shoppers are often rushed and not tech-savvy, so controls must be obvious, large, and high-contrast (guardrails against low-contrast neumorphism).
- The app’s scope is focused (PIN → scan → quantity → cart → confirm), so a small custom component set is realistic and keeps UX consistent.

### Implementation Approach

- Define **design tokens** first (color, typography, radius, spacing, elevation/shadows, motion).
- Build a small, reusable component kit tailored to the core loop:
  - `PrimaryButton`, `SecondaryButton`, `IconLabelButton`
  - `SoftCard` (raised surface), `BottomSheet`, `Toast/Snackbar`
  - `PinPad`, `QuantityStepper`, `CartLineItem`
  - `StatusBanner` (Success / Warning / Error), `EmptyState`
- Motion foundation:
  - Fast, consistent transitions (short durations) for PIN → Scanner → Cart → Confirm.
  - Micro-interactions (press states, subtle bounce) to feel “alive” without slowing rush-hour use.

### Customization Strategy

- **Soft UI, but readable:** soft surfaces + playful gradients for backgrounds/cards, while keeping text and critical actions high-contrast.
- **Cute/girly palette:** warm pink/peach accents with creamy neutrals; avoid “flat white on gray” boredom.
- **Scanner-first clarity rules:** keep scanning UI visually simple; decorative elements stay outside the scan viewport.
- **Accessibility guardrails:** minimum contrast targets for text and critical buttons; large tap targets; unmistakable disabled/error states.

## 2. Core User Experience

### 2.1 Defining Experience

**Self-service honest store checkout**
LilStore’s defining experience is a fast, shared-device, PIN-gated self-checkout that feels trustworthy: scan items, set quantity, confirm, and *know for sure* the purchase was recorded before the app returns to Home. The experience should feel cute/entertaining in visuals and transitions, but never at the expense of clarity, speed, or record accuracy.

### 2.2 User Mental Model

**How shoppers think today**
- “I’m just getting snacks—this should be quick.”
- “I don’t want to write product names; I’ll tell the owner later” (often forgotten or illegible during rush).
- “I need to be sure the store owner will know what I took.”

**What shoppers expect in-app**
- A flow that behaves like a simple scanner terminal (not a ‘big app’ to learn).
- Obvious feedback after scanning and especially after confirming.
- Immediate return to Home so the next person can use it (shared device).

**How the owner thinks**
- “The app replaces handwritten notes and manual computation.”
- “Records must be accurate and auditable per shopper—no guessing.”

### 2.3 Success Criteria

**Shopper success signals**
- After confirm, the shopper sees a clear “Recorded” state (cannot be mistaken for failure).
- The confirmation shows a short summary (items count + total credit added) so they trust what was saved.
- Returning to Home feels intentional (e.g., brief success state + “Returning to Home…”), not like an abrupt reset.

**Owner success signals (primary = accuracy)**
- Every confirm produces exactly one saved purchase record tied to the correct shopper.
- Purchase record matches what the shopper confirmed (items, quantities, and pricing inputs).
- Ledger/balance updates by the **computed cart total** (including bundle pricing rules) and remains consistent with history.

### 2.4 Novel UX Patterns

**Mostly established patterns**
- Familiar self-checkout mechanics: PIN entry, scanning feedback, cart review, confirm, receipt-like success state.

**Unique twist (LilStore’s differentiator)**
- Owner-curated “allowed items only” shopping list (scan can be blocked as “not available”).
- PIN gating + auto-logout for shared-device safety.
- Pricing rules beyond “unit price only”:
  - Optional **bundle offer** pricing (bundles-first computation).
  - Optional **assorted** shopping list item grouping multiple barcodes under one shared price + shared availability pool, while cart/history still labels the underlying product as “(assorted)”.
- Stronger-than-usual emphasis on *trust and auditability* (because it replaces handwritten credit notes).

### 2.5 Experience Mechanics

**1. Initiation**
- Shopper taps `Buy Now` from Home.
- Shopper enters PIN (fast, large keypad).

**2. Interaction**
- Scanner opens immediately.
- Scan item:
  - If allowed (standard item): show product name + price rules + available qty + big quantity controls.
  - If allowed (assorted member): show `{ProductName} (assorted)` while pricing/availability come from the shared assorted entry.
  - If not allowed/not found: show unmistakable block state, then quick return to scan-ready.
- Quantity selection:
  - Prevent selecting/confirming quantities that would exceed availability (including shared assorted availability pool).
- Cart preview:
  - Shows line items with quantities.
  - Shows computed **line totals** and **cart total** (bundle pricing applied where relevant).
  - Clearly labels assorted-member lines as “(assorted)” for audit clarity.

**3. Feedback**
- On each scan/add: immediate visual confirmation (and optionally subtle haptic) that the item is in cart.
- Cart preview stays simple and editable (remove item, adjust quantity).
- On confirm:
  - Validate quantities/availability at confirm time.
  - Show a dedicated success/receipt moment so shoppers don’t doubt it recorded.

**4. Completion**
- Success moment includes:
  - “Recorded” (primary)
  - Items count + cart total credit added (trust signal)
  - Optional “Returning to Home…” countdown so auto-logout feels intentional
- Auto-logout returns to Home, ready for the next shopper.

## Visual Design Foundation

### Color System

**Theme direction:** Peach Soda (warm cute) with Soft UI / skeuo-inspired depth, but high-contrast text and unmistakable states.

**Core palette (tokens)**
- `bg`: #FFF7F1 (warm cream)
- `surface`: #FFFFFF (cards/sheets)
- `primary`: #FF6B6B (peachy coral)
- `accent`: #FFB385 (soft peach)
- `text`: #1F2937 (near-charcoal on light surfaces)
- `textMuted`: #6B7280
- `border`: #F3E6DD

**Semantic colors**
- `success`: #22C55E (used sparingly; confirmations)
- `warning`: #F59E0B (stock/availability warnings)
- `error`: #EF4444 (“Not available”, invalid PIN, restore failure)
- `info`: #3B82F6 (rare; neutral info)

**Soft UI elevation**
- Background can be slightly textured/gradient, but `surface` components stay readable.
- Elevation is primarily conveyed via:
  - subtle warm shadow (down/right) + soft highlight (up/left)
  - rounded corners (consistent radius scale)
- Scanner UI rule: keep overlays minimal; decoration stays outside scan viewport.

**State clarity rules (non-negotiable)**
- Disabled: reduce saturation + add clear label/icon; never rely on shadow changes only.
- Error/blocked (“Not available”): use color + icon + clear message; immediate “Scan next item” action.
- Success (“Recorded”): primary success color + receipt-like summary (items count + total).

### Typography System

**Vibe:** Rounded friendly (approachable, non-intimidating for shoppers).

**Recommended fonts**
- Primary: Nunito (preferred) or Quicksand (acceptable alternative)
- Fallback: platform default rounded-friendly sans (if custom font not available)

**Type scale (mobile-first, readability > density)**
- H1 / Screen title: 24–28, weight 800/700
- H2 / Section title: 20–22, weight 700
- H3 / Card title: 18–20, weight 700
- Body: 16–18, weight 600/500
- Helper/caption: 13–14, weight 600/500
- Numeric totals: 20–24, weight 800 (cart total / recorded total)

**Language style**
- Short, plain, reassuring copy (avoid technical terms).
- Prefer action labels: “Scan”, “Add”, “Confirm”, “Recorded”.

### Spacing & Layout Foundation

**Spacing system**
- 8pt grid (8 / 12 / 16 / 24 / 32)
- Default screen padding: 16–20
- Card padding: 16
- Vertical rhythm: 12–16 between groups; 24 between sections

**Touch targets**
- Minimum tap target: 44x44
- Primary actions: large, centered, high-contrast, with obvious press feedback

**Layout principles**
- Shopper flow is “one decision per screen” (PIN → Scan → Qty → Cart → Confirm).
- Keep critical info above the fold:
  - cart total + confirm button always prominent
  - availability constraints visible at quantity time
- Use bottom sheets for secondary actions (edit/remove) instead of new screens when possible.

### Accessibility Considerations

- Text contrast target: 4.5:1 on `surface` for normal text; never do low-contrast neumorphism for text/buttons.
- Don’t rely on color alone: pair status colors with icons + labels.
- Motion: transitions should be short and consistent; avoid long animations that slow rush-hour use; support reduced-motion behavior.
- Feedback: use clear visual confirmation states; optional haptic “tick” for add-to-cart/recorded if device supports it.

## Design Direction Decision

### Design Directions Explored

We explored multiple visual directions (A–F) using the Peach Soda palette + rounded-friendly typography, varying:
- Soft UI depth (raised vs inset surfaces)
- Button shapes (pill vs rounded-rect)
- Background energy (subtle vs playful gradients)
- Emphasis on tactile controls vs clean utility
- Strength of the “Recorded” trust moment

### Chosen Direction

**Chosen Direction:** Direction B — “Neumorphic Touch”
- Inset/soft surfaces for keypad + key controls
- Warm, cute, girly feel through Peach Soda gradients and rounded shapes
- Motion polish inspired by social apps, but short and consistent

### Design Rationale

- Matches the “entertaining / cute / girly” goal without requiring shoppers to type or learn complex UI.
- Tactile keypad + controls support non-tech-savvy users (feels like a physical terminal).
- With contrast guardrails, it still supports the top priority: **accuracy + trust**.

### Implementation Approach

- Apply Direction B styling to the core component kit:
  - Inset keypad keys + clear pressed states
  - Large primary CTA with obvious affordance (not subtle shadows only)
  - High-contrast labels for critical actions and totals
- Enforce readability rules:
  - Never use low-contrast neumorphism for text or critical actions
  - Scanner screen stays visually simple; decoration outside scan viewport
- Strengthen the trust moment:
  - “Recorded” screen shows items count + cart total, then intentional return-to-home
- Motion:
  - Short transitions for PIN → Scan → Cart → Recorded
  - Micro-bounce/press feedback on taps (fast, not distracting)

## User Journey Flows

### Shopper Purchase (Happy Path + Totals + Auto-Logout)

Goal: shopper quickly records an accurate credit purchase on a shared device and leaves no lingering session.

```mermaid
flowchart TD
  A[Home] --> B[Tap Buy Now]
  B --> C[Enter PIN]
  C -->|Invalid PIN| C1[Show error + retry] --> C
  C -->|Valid PIN| D[Scanner Opens]

  D --> E[Scan Barcode]
  E -->|Not in published shopping list| E1[Unmissable \"Not available\" state] --> E2[Scan next item] --> D
  E -->|In list (standard item)| F[Show Item + Pricing + Available Qty]
  E -->|In list (assorted member)| F2[Show {ProductName} (assorted)\nPricing/Availability from Assorted entry]

  F --> G[Choose Quantity]
  F2 --> G
  G -->|Qty > allowed availability| G1[Guardrail: limit reached\nAdjust to max / change qty] --> G
  G --> H[Add To Cart feedback\n(visual + optional haptic)]
  H --> D

  D --> I[Open Cart Preview]
  I --> J[Show line items + qty\nShow computed line totals + cart total (₱)\n(Bundle pricing applied where relevant)\nAssorted lines labeled (assorted)]
  J --> K[Confirm Purchase]

  K -->|Validation fails\n(e.g., availability changed)| K1[Explain what changed\nHighlight affected line(s)\nReturn to cart] --> I
  K -->|Validation passes| L[Compute totals\n(bundles-first)\nWrite purchase record\nUpdate ledger by computed cart total\nDecrement quantities\n(assorted shared pool included)]
  L --> M[Recorded / Saved screen\n2 items • Total ₱X\n\"Returning to Home…\"]
  M --> N[Auto-logout → Home]
```

Key UX notes:
- Cart preview is the “accuracy checkpoint”: shoppers see computed totals in `₱` before confirm.
- “Recorded” screen removes doubt (the app returning Home feels intentional, not abrupt).

---

### Shopper Edge Cases (Not Available + Guardrails + Assorted Pool)

Goal: block mistakes early without slowing the rush-hour flow.

```mermaid
flowchart TD
  A[Scanner Open] --> B[Scan Barcode]

  B -->|Not in list| C[Blocked state:\n\"Not available\"\nNo add-to-cart] --> D[CTA: Scan next item] --> A

  B -->|In list| E[Item details shown]
  E --> F[Set Quantity]

  F -->|Qty exceeds standard item availability| G[Guardrail message\nSet to max / edit qty] --> F

  F -->|Item is assorted member and\npooled qty would exceed shared availableQty| H[Assorted pool guardrail:\n\"Assorted limit reached\"\nSuggest allowed qty] --> F

  F -->|Valid qty| I[Add to cart + feedback] --> A

  A --> J[Confirm Purchase]
  J -->|Availability changed since adding| K[Confirm blocked:\nExplain + highlight changes\nReturn to cart] --> L[Cart Edit]
  J -->|All good| M[Purchase saved → Recorded screen]
```

Key UX notes:
- Error copy should be non-judgmental (“limit reached”) and always offer the next action (“Scan next item”, “Edit cart”).
- Assorted items must stay understandable: the cart/history label uses `{ProductName} (assorted)` even though pricing/availability comes from the shared “Assorted” entry.

---

### Admin: Shopping List Setup (Unit + Bundle + Assorted)

Goal: owner quickly publishes what’s for sale, including optional bundle pricing and assorted groups.

```mermaid
flowchart TD
  A[Home] --> B[Admin]
  B --> C[Admin Login]
  C -->|Invalid| C1[Error + retry] --> C
  C -->|Valid| D[Admin Dashboard]
  D --> E[Select / Switch Owner Context]

  E --> F[Shopping List]
  F --> G[Add Item]

  G --> H{Item type?}
  H -->|Standard| I[Select Product/Barcode]
  I --> J[Set Unit Price (₱)]
  J --> K{Add bundle offer?}
  K -->|No| L[Set Available Qty]
  K -->|Yes| K1[Set Bundle:\n{bundleQty, bundlePrice ₱}] --> L
  L --> M[Save + Publish/Activate]
  M --> F

  H -->|Assorted| N[Create Assorted Entry\n(Display name: \"Assorted\")]
  N --> O[Add member barcodes/products]
  O --> P[Set shared Unit Price (₱)]
  P --> Q{Add bundle offer?}
  Q -->|No| R[Set shared Available Qty pool]
  Q -->|Yes| Q1[Set Bundle:\n{bundleQty, bundlePrice ₱}] --> R
  R --> S[Save + Publish/Activate]
  S --> F

  F --> T[Update prices/qty anytime\n(weekly refresh + ad-hoc)]
  T --> D
```

Key UX notes:
- Admin screens can be denser than shopper screens, but still need clear labeling of:
  - Unit price vs bundle offer
  - Standard vs assorted entry
  - Shared availability pool for assorted

---

### Journey Patterns

- PIN-gated shared-device session (clear start, clear end)
- Scan-first, no-typing shopper flow
- Immediate feedback on add-to-cart
- Cart as accuracy checkpoint (line totals + cart total in `₱`)
- Guardrails with recovery (not available, qty limits, assorted pool)
- “Recorded” as trust moment + intentional return-to-home auto-logout

### Flow Optimization Principles

- Keep scanner “always ready” after each action (minimize dead ends)
- Make critical states unmissable (Not available, Recorded)
- Reduce cognitive load for shoppers (one decision per screen)
- Prefer fast edit paths over redoing steps (cart edit, adjust qty)
- Short, consistent transitions (Direction B motion polish without slowing the flow)

## Component Strategy

### Design System Components

**Foundation primitives (token-driven)**
- Color tokens: `bg/surface/primary/accent/text/...` + semantic `success/warning/error`
- Typography: rounded-friendly scale (titles/body/totals)
- Spacing: 8pt grid
- Radius + elevation tokens (raised vs inset surfaces)
- Motion tokens: short durations + consistent easing

**Reusable base components**
- `SoftCard` (raised surface), `InsetCard` (soft-inset surface)
- `PrimaryButton`, `SecondaryButton`, `GhostButton`
- `IconLabelButton` (icon + label for clarity)
- `Text`, `Caption`, `Title`
- `Divider`, `Spacer`
- `BottomSheet`, `Modal`
- `Toast/Snackbar` (brief feedback)
- `StatusBanner` (Success/Warning/Error)
- `EmptyState`

### Custom Components

### PinPad

**Purpose:** Fast, non-embarrassing PIN entry for shared device.
**Usage:** Shopper unlock + Admin login (if desired).
**Anatomy:** Title, masked PIN dots, keypad grid, backspace, confirm.
**States:** default, digit-entered, error (invalid PIN), locked (optional), disabled confirm.
**Variants:** shopper (minimal), admin (optional “show/hide”).
**Accessibility:** large tap targets, clear error message, supports screen reader labels.
**Interaction Behavior:** immediate feedback per tap; clear error + quick retry.

### ScannerShell

**Purpose:** Always-ready scanning experience with minimal distraction.
**Content:** camera view, scan guide, last-scan feedback, cart shortcut.
**States:** ready, scanning, found-allowed, found-assorted, not-available, permission-denied.
**Variants:** with/without “cart count” badge.
**Accessibility:** clear text alternatives, high-contrast overlays; decoration outside viewport.
**Interaction Behavior:** instant feedback; quick return to ready state.

### ItemAddPanel

**Purpose:** Convert a scan into an add-to-cart action quickly.
**Content:** product name (incl. “(assorted)” suffix), pricing (unit + bundle), available qty, quantity control.
**States:** standard, assorted-member, qty-too-high guardrail, limit-reached.
**Variants:** compact vs expanded.
**Accessibility:** clear labels; numeric controls not tiny.
**Interaction Behavior:** quantity changes update computed preview (optional), add-to-cart confirms with feedback.

### QuantityStepper

**Purpose:** Fast quantity selection with guardrails.
**States:** default, at-min, at-max, disabled, error.
**Variants:** small (admin lists), large (shopper flow).
**Accessibility:** 44x44 controls; screen reader labels.
**Interaction Behavior:** prevents exceeding standard availability or assorted shared pool.

### CartLineItem

**Purpose:** Clear audit-friendly cart entry.
**Content:** name (+ “(assorted)” if needed), qty, line total, bundle-applied hint.
**States:** normal, edited, invalid (if availability changed).
**Variants:** swipe-to-remove (optional) vs edit sheet.
**Accessibility:** clear reading order.
**Interaction Behavior:** edit/remove opens bottom sheet.

### TotalsSummary

**Purpose:** Make accuracy obvious (line totals + cart total in `₱`).
**States:** normal, recalculating (brief), error (if pricing invalid).
**Accessibility:** strong hierarchy; cart total emphasized.

### RecordedReceipt

**Purpose:** Remove shopper doubt and end session intentionally.
**Content:** “Recorded”, items count, cart total in `₱`, optional countdown.
**States:** success, saving (short), error (if save failed).
**Accessibility:** clear icon + text; don’t rely on green alone.
**Interaction Behavior:** auto-logout after short delay; “Done” as fallback.

### AssortedGroupEditor (Admin)

**Purpose:** Create/edit “Assorted” entry membership + shared pool rules.
**Content:** members list, add/remove barcode, shared availableQty, unit+bundle pricing.
**States:** default, unsaved changes, validation errors (duplicates, empty group).
**Accessibility:** searchable list; clear validation copy.

### BundlePricingEditor (Admin)

**Purpose:** Configure `{bundleQty, bundlePrice}` safely.
**States:** off, on, invalid input (bundleQty < 2, bundlePrice <= 0, etc.).
**Accessibility:** clear helper text + examples.
**Interaction Behavior:** shows example calculation preview (optional).

### Component Implementation Strategy

- Build primitives first (tokens + Soft UI elevation recipes), then layer custom components for the three critical journeys.
- Shopper surfaces prioritize clarity over depth; admin surfaces can be denser but still consistent.
- Use Direction B consistently: inset keypad + tactile controls, but keep text/buttons high-contrast.

### Implementation Roadmap

**Phase 1 (Core shopper loop)**
- `PinPad`, `ScannerShell`, `ItemAddPanel`, `QuantityStepper`, `CartLineItem`, `TotalsSummary`, `RecordedReceipt`

**Phase 2 (Guardrails + polish)**
- `StatusBanner`, `Toast/Snackbar`, “Not available” full-state, availability-change handling in cart

**Phase 3 (Admin pricing power)**
- `AssortedGroupEditor`, `BundlePricingEditor`, admin list components refinements

## UX Consistency Patterns

### Button Hierarchy

**Primary (CTA)**
- **When to use:** 1 main action per screen (e.g., `Buy Now`, `Add To Cart`, `Confirm Purchase`, `Unlock`).
- **Visual design:** High-contrast filled button (Peach Soda primary), rounded, obvious elevation (not shadow-only), clear pressed state.
- **Behavior:** Shows loading state when committing (confirm purchase / restore / save). Prevent double-tap by disabling while loading.
- **Accessibility:** Minimum 44x44 tap target; text label always present.

**Secondary**
- **When to use:** Supporting actions (e.g., `Edit Cart`, `Back to Scan`, `Manage Shopping List`).
- **Visual design:** Soft surface button (raised or inset) with clear border; never low-contrast.
- **Behavior:** No blocking spinner unless it triggers navigation/data work.
- **Accessibility:** Same tap target + label rules.

**Tertiary / Ghost**
- **When to use:** Low-priority actions (e.g., `Cancel`, `Skip`, `Close`).
- **Visual design:** Minimal, but still readable; do not hide it inside tiny icons.

**Destructive**
- **When to use:** Removing items, wiping data, restore replace-all.
- **Visual design:** Always paired with warning color + icon + confirmation dialog.
- **Behavior:** Requires explicit confirmation; never the default focused action.

---

### Feedback Patterns

**Add-to-cart feedback**
- Visual: brief “Added” confirmation and cart count update.
- Optional haptic: light “tick” (if available).
- Must not interrupt scanning; return to scan-ready quickly.

**Blocked / Not available**
- Full-width banner or card with icon + short message + next action.
- Copy is non-judgmental: “Not available” / “Not on the shopping list.”
- CTA always present: `Scan next item`.

**Guardrails (quantity limits / assorted pool limits)**
- Immediate inline message near quantity control.
- Provide allowed max and a one-tap fix: `Set to max`.

**Confirm purchase success (“Recorded”)**
- Always show a dedicated “Recorded/Saved” moment (receipt-like).
- Must include: item count + total in `₱`.
- Then intentional return-to-home (countdown optional) to remove doubt.

**Failures (save/confirm/restore)**
- Never silently fail.
- Show what happened + what to do next (`Try again`, `Back to cart`, `Cancel`).
- Keep user state intact where possible (don’t lose cart on transient errors).

**Toasts vs banners**
- Toast/snackbar: lightweight info (“Saved”, “Updated”) that doesn’t block.
- Banner/card: anything that requires user attention or action (not available, validation, permission issues).

---

### Form Patterns

**PIN entry (shopper/admin)**
- Numeric keypad with big keys; masked dots; clear backspace.
- Invalid PIN: short error + immediate retry, no blame.
- Confirm/Unlock disabled until minimum length met.

**Currency + numeric inputs (admin)**
- Always display totals/prices with `₱`.
- Prefer steppers and presets where possible; fallback to numeric keyboard input.
- Inline validation for bundle rules:
  - `bundleQty` must be >= 2
  - `bundlePrice` must be > 0
- Show an optional example preview for bundle pricing to reduce mistakes.

**Assorted group editing**
- Members list must be obvious and searchable if it grows.
- Prevent duplicates and show clear error text.
- Clearly label “shared availability pool” and “shared pricing rules”.

---

### Navigation Patterns

**Home**
- Only two obvious actions: `Buy Now` and `Admin`.

**Shopper session**
- Starts at PIN, ends at “Recorded” then auto-logout to Home.
- Provide an explicit `Cancel` path that returns to Home and clears session.

**Back behavior**
- Shopper flow: back should never expose prior shopper identity once logged out.
- Admin flow: back navigates within admin stack; logout returns to Home.

**Overlays**
- Use bottom sheets for quick edits (edit cart line item, remove item, change quantity).
- Use modals for high-risk confirmations (restore replace-all, delete owner, etc.).

---

### Additional Patterns

**Empty states**
- Empty cart: show “Scan items to start” with a `Back to Scan` CTA.
- No shopping list published: shopper flow should block with a clear message and send user to Admin.
- Admin empty lists: friendly empty state + `Add` CTA.

**Loading states**
- Keep “scan-ready” fast; don’t block scanner with long loaders.
- Use brief skeletons for admin lists if needed; avoid spinners that feel stuck.

**Motion rules (Direction B)**
- Short, consistent transitions; micro-press feedback for tactile feel.
- Motion must never hide critical state changes (Recorded, Not available).
- Respect reduced-motion where possible.

## Responsive Design & Accessibility

### Responsive Strategy

- **Primary target:** phones only (shared device), portrait-first.
- **Small screens:** prioritize the core loop; keep one primary action visible without scrolling when possible.
- **Large phones:** use extra space for clarity (bigger totals, more breathing room), not more complexity.
- **Orientation:** support landscape gracefully, but don’t redesign layouts; ensure scanner + confirm actions remain usable.
- **Scanner view:** overlays must never cover the scan target; keep UI minimal and anchored.

### Breakpoint Strategy

Since this is a mobile app, use practical layout tiers rather than web-style breakpoints:
- **Compact:** <= ~360dp width (small phones) → tighter spacing, single-column only, larger buttons preserved.
- **Regular:** ~361–430dp width → default spacing.
- **Large:** > ~430dp width → more padding, slightly larger typography for totals and headings.

Key rule: layouts don’t “reflow” into multiple columns; they scale spacing + type and keep actions stable.

### Accessibility Strategy

**Target compliance:** WCAG AA-inspired standards (mobile-first).

- **Contrast:** meet 4.5:1 for normal text on `surface`. Avoid low-contrast neumorphism for text and critical buttons.
- **Touch targets:** minimum 44x44 for all tappable controls (especially keypad, stepper, confirm).
- **Do not rely on color alone:** statuses always include icon + label (“Not available”, “Recorded”).
- **Motion safety:** support reduced-motion; keep transitions short; never use motion as the only success indicator.
- **Readable copy:** short, plain, reassuring language; avoid jargon.
- **Focus/assistive tech:** ensure screen reader labels for buttons (e.g., “Confirm purchase”, “Increase quantity”).
- **Error recovery:** errors are clear, non-blaming, and always provide a next action.

### Testing Strategy

**Responsive testing**
- Verify flows on at least:
  - small Android phone size class
  - common iPhone size class
  - large Android phone size class
- Test portrait + landscape on scanner + cart + recorded screens.
- Validate that primary CTA remains reachable and not clipped.

**Accessibility testing**
- Contrast checks on key screens (PIN, cart totals, recorded, not available).
- Tap-target audit (keypad, stepper, close/cancel).
- Screen reader pass on core flow (labels announce clearly).
- Reduced-motion check (transitions still understandable).

### Implementation Guidelines

- Use tokenized spacing/type scales so compact/regular/large adjustments are consistent.
- Keep scanner overlays minimal; anchor essential actions and avoid decorative layers in scan viewport.
- Implement “commit” buttons with loading + disabled states to prevent double submits.
- Implement reduced-motion mode: shorten/disable non-essential transitions while preserving “Recorded” clarity.

---

## Admin Flows UX Coverage (Addendum)

This addendum fills in admin UX coverage gaps for: **owners, products, shoppers, payments, history, backup/restore, and alerts**.

### Admin Entry & Session Model

**Entry point**
- Home shows two primary actions: `Buy Now` (shopper) and `Admin` (owner/admin).
- Tapping `Admin` opens **Admin Login**.

**Admin Login**
- Username + password (as per PRD).
- Primary CTA: `Sign in`.
- Secondary: `Cancel` (returns to Home).
- Error state: “Incorrect username or password” (no detail leakage).
- Optional security hardening (post-MVP): rate limiting + temporary lockouts.

**Session behavior (shared device)**
- Admin session is **non-persistent**: on app restart, require login again.
- Inactivity timeout: show a lock screen and require re-auth to continue admin actions.
- High-risk actions require explicit re-auth (at minimum: **Restore**).

**Owner context**
- Admin UI always displays the **Active Store Owner** (e.g., chip in header).
- Switching owner context changes the scope of: products, shopping list, shoppers, ledger, history, alerts.

### Admin IA (Information Architecture)

**Admin Home (per owner context)**
- Sections/cards:
  - `Owners` (master admin only)
  - `Products`
  - `Shopping List` (for-sale list)
  - `Shoppers`
  - `Ledger & Payments`
  - `History`
  - `Backup & Restore`
  - `Alerts`
- Header shows active owner + quick `Switch`.
- Global action: `Log out`.

**Navigation style (phone-first)**
- Stack navigation from Admin Home into each module.
- Prefer bottom sheets for quick edits (availability, price tweaks) and modals for destructive/high-risk confirmations.

### Owners (Master Admin)

**Owners list**
- Rows show: owner name + summary counts (shoppers, products, shopping list items) + quick `Switch`.
- Empty state: “No store owners yet” + `Create owner`.

**Create owner**
- Fields: owner display name (required).
- After creation: prompt to `Switch to this owner` (primary).
- If additional owner-level authentication is introduced later, keep it in a separate “Owner Access” section (don’t overload MVP).

**Switch owner**
- Confirmation only if there are unsaved edits in the current screen.
- Visual confirmation after switch: banner “Switched to {OwnerName}”.

**Archive owner (preferred over delete)**
- Archive keeps all history for auditability; owner no longer appears in shopper flow.
- Confirmation modal must be explicit: “This will hide this owner and prevent new purchases for this owner. History is preserved.”

### Products (Catalog)

**Products list**
- Must scale to 200+ products: virtualized list, fast search.
- Search: by name and barcode.
- Filters: `Active` / `Archived`.
- Primary CTA: `Add product`.
- Secondary CTA: `Scan barcode` (fills barcode field in create form).

**Create/Edit product**
- Fields:
  - `Name` (required)
  - `Barcode` (required; numeric/alphanumeric; typically scan-filled)
- Validation:
  - Duplicate barcode (within active owner): block save and show existing product match with quick action `View existing`.
  - Empty required fields: inline errors.
- Archive product:
  - If referenced in shopping list: block with guidance (“Remove from shopping list first”) or offer a guided flow to remove it.

**Barcode scanning pattern (admin)**
- Scan view is dedicated to admin tasks (not the shopper purchase scanner).
- After successful scan: show a compact confirmation (barcode value) + `Use barcode`.
- Provide manual entry fallback (camera permission denied / damaged barcode).

### Shopping List (For-Sale List)

**Shopping list overview**
- Rows show: item name, availability, unit price, bundle flag, and low/zero stock indicator.
- Quick adjustments:
  - Availability stepper (+/–) with guardrail at 0.
  - “Edit” bottom sheet for price + bundle.
- Empty state: “No items published for sale” + `Add to shopping list`.

**Add to shopping list**
- Step 1: choose product (search or scan barcode).
- Step 2: set:
  - `Unit price (₱)` (required, > 0)
  - Optional `Bundle offer` (`bundleQty` ≥ 2, `bundlePrice` > 0)
  - `Available quantity` (required, ≥ 0)
- Confirmation: show a mini “Published” card with summary + `Add another`.

**Assorted shopping list item**
- Create flow:
  - Name (e.g., “Assorted Drinks”) + select member products (search + multi-select).
  - Shared pricing rules (unit + optional bundle) + shared availability pool.
- Manage members:
  - Add/remove members with duplicate prevention.
  - Explain behavior: “Any member scan consumes the same shared available quantity.”
- Guardrail copy must be explicit and simple (assorted is the most conceptually complex admin feature in MVP).

### Shoppers

**Shoppers list**
- Rows show: shopper name + balance owed + last activity (optional).
- Search by name; optional sort by balance.
- Primary CTA: `Add shopper`.
- Empty state: “No shoppers yet” + `Add shopper`.

**Create shopper**
- Fields:
  - `Name` (required)
  - `PIN` (required; numeric; minimum 4 digits; entered via keypad)
- PIN validation:
  - Must be unique across all shoppers on the device (PRD).
  - Error state should not leak other-owner details; use neutral copy: “That PIN is already in use. Try a different PIN.”
- On save: show a “Shopper created” confirmation + `Add another` / `View shopper`.

**Edit shopper**
- Allow name edits.
- Do not display existing PIN (stored as hash).
- Provide `Reset PIN` action:
  - Requires entering a new PIN twice (confirm) via keypad.
  - Same uniqueness rules apply.

**Archive shopper**
- Archive prevents future purchases but preserves history.
- Confirmation message: “Archiving keeps purchase/payment history for records.”

### Payments (Ledger & Payments)

**Shopper detail (hub)**
- Header: shopper name + current balance.
- Actions:
  - `Record payment`
  - `View history`
- Show short summary:
  - Last purchase date
  - Last payment date

**Record payment flow**
- Default timestamp: now (editable only if needed; keep MVP simple).
- Amount entry:
  - Numeric keypad with presets: `Exact balance`, `₱50`, `₱100`, `₱200`.
  - Validation: amount > 0.
  - If amount exceeds balance:
    - Show warning and require confirmation (“This will make the balance negative.”), or clamp to balance with a one-tap fix (`Set to exact`).
- Success state:
  - “Payment recorded” receipt-style card (amount, timestamp, resulting balance) + `Done`.

### History (Purchases & Payments)

**History landing**
- Two tabs: `Purchases` and `Payments`.
- Filters:
  - Date range (default: last 7 days)
  - Shopper selector (optional)
- Performance: keep filters lightweight and fast; no heavy charts in MVP.

**Purchase history**
- Row fields: timestamp, shopper name, item count, total (₱).
- Detail view:
  - Line items: name, quantity, unit/bundle inputs used, computed line totals.
  - Total summary + “Recorded by {shopper}”.
- Immutable record principle:
  - No edit/delete UI in MVP; corrections are additive future work (void/adjustment records).

**Payment history**
- Row fields: timestamp, shopper name, amount (₱).
- Detail view: amount + resulting balance (if stored) + notes (if added later).

### Backup & Restore (Entire Database)

**Backup screen**
- Shows:
  - Last backup time (and “backup age” badge)
  - `Export backup` (primary)
  - `Restore backup` (secondary, destructive)
- Explain scope clearly: “Backup includes all store owners, shoppers (PIN hashes), products, shopping lists, and history.”

**Export backup**
- UX requirements:
  - Progress state that prevents double-tap.
  - Success state shows filename + exportedAt + share/save action.
  - Update “Last backup time” and clear “stale backup” alerts.

**Restore backup (replace-all, atomic)**
- Flow:
  1. Pick JSON file (system document picker)
  2. Validate (schemaVersion + integrity)
  3. Show summary before commit (counts by owners/shoppers/products/history records)
  4. Destructive confirmation with explicit wording:
     - “This will replace all local data on this device.”
  5. Restore progress screen (cannot be dismissed)
  6. Completion: “Restore complete” + require admin re-login
- Failure states:
  - Invalid file / schema mismatch: show actionable message, do not change local data.
  - Partial restore must never occur (atomic guarantee).

### Alerts (In-App Dashboard)

**Alert types (MVP)**
- Low/zero stock shopping list items.
- Backup freshness reminder (e.g., “No backup in X days”).

**Alerts screen**
- Group by type with clear headings.
- Each alert row includes a direct fix CTA:
  - Low stock → `Adjust availability` (opens the shopping list item bottom sheet).
  - Backup stale → `Export backup` (opens backup screen).
- Alerts should be persistent until resolved (avoid “dismiss” in MVP unless there’s a “snooze until tomorrow” rule).

### Admin UX Consistency Rules

- Prefer **explicit receipts** after critical writes: product saved, shopper created, payment recorded, backup exported, restore completed.
- Keep high-risk actions visually distinct (destructive styling + explicit copy).
- Always surface **owner context** in the header to prevent cross-owner mistakes.
- Keep admin flows fully offline-capable (including backup/restore) with clear permission prompts and recoverable failures.
