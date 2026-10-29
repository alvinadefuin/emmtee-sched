# UI refresh: responsive layout, theme switcher, live countdown

Approved by the user on 2026-10-29. This extends `2026-10-28-emmtee-sched-design.md` and changes only the web UI. The shareable PNG is unchanged.

## 1. Responsive layout

- **Mobile first.** It must work from a 320px width up to desktop, with no horizontal scrolling at any width.
- **Poll page (`/`)**
  - **Phones:** one card per Sunday, in a single column. Each card shows the date and all four roles: Laptop operator, Laptop assist, Photog and Poster.
  - **Tablet:** two columns from about 640px.
  - **Desktop:** three columns from about 1024px.
- **Organiser page and swap page.** Same treatment. Forms and controls stack on phones. Tables, such as "Who has what", must not overflow; they either reflow into cards or scroll inside their own container.
- **Touch.** Buttons, name chips and links are at least 44×44px. Form inputs use at least 16px text, so iOS does not zoom in on focus.
- **Device safe areas.** The viewport uses `viewport-fit=cover`, and the layout respects `env(safe-area-inset-*)` for iPhone notches and home bars.
- **Browsers.** Support current iOS Safari, Android Chrome, and desktop Chrome, Safari, Firefox and Edge. Do not rely on CSS that lacks support in iOS Safari 16 or later.

## 2. Light and dark themes (dark by default)

- **Colour tokens.** Colours are CSS custom properties defined in `globals.css` and exposed to Tailwind 4 via `@theme`. Components use the tokens only, never hard-coded `bg-white` or `neutral-*` classes.
- **Dark (default).** A deep navy background with a teal accent, taken from the teal poster theme.
- **Light.** A soft off-white background, the same teal accent, and peach as a warm secondary accent.
- **Contrast.** Every text and background pair meets WCAG AA in both themes: 4.5:1 for body text, 3:1 for large text and UI boundaries. This covers status badges, the auto-fill highlight, swap banners, disabled states and focus rings.
- **Switcher.** A sun/moon button in a shared header on every page, with an accessible label.
  - The choice is stored per device in `localStorage` (read and write wrapped in `try`/`catch`).
  - With no stored choice, the theme is dark. It does not follow the operating system setting.
- **No flash of the wrong theme.** A tiny inline script in `<head>` sets `data-theme` on `<html>` before the first paint, and `suppressHydrationWarning` goes on `<html>`. The `color-scheme` property is set per theme, so form controls and scrollbars match. The `theme-color` meta tag follows the theme.

## 3. Live countdown

- **Ticking display.** The countdown updates every second as segments: days, hours, minutes and seconds. Below it, it shows the exact deadline: "Closes Fri 30 Oct, 11:59 PM (PH time)".
- **Urgency colours.** The countdown uses the normal accent colour by default, amber when under 24 hours remain and red when under 1 hour remains. Both colours meet contrast requirements in both themes.
- **At zero.** The countdown shows "Poll closed — waiting for the organiser" and asks the page to refresh, so the closed state appears.
- **Time zones.** The countdown is computed from the stored UTC deadline, so it is correct in any device time zone.
- **No hydration errors.** It renders a placeholder until mounted, and it uses `aria-live="off"` so screen readers are not flooded every second. It also has an accessible text summary.

## Out of scope

- No new features and no change to data or server code.
- No change to the image route or `src/image`.
