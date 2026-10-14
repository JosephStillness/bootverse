# BootVerse UI system

## Direction

Light, minimal football boot discovery. Preserve the existing routes and sample catalogue logic. The supplied redesign brief takes precedence over the skill database's generic luxury/glass recommendation. No glass effects, neon UI accents, fake activity, or unimplemented navigation items.

## Tokens

The source of truth is `src/app/globals.css`.

| Role                        | Token                | Value     |
| --------------------------- | -------------------- | --------- |
| Page                        | `--background`       | `#F6F6F4` |
| Surface                     | `--surface`          | `#FFFFFF` |
| Action                      | `--primary`          | `#202020` |
| Text                        | `--foreground`       | `#161616` |
| Secondary text              | `--secondary-text`   | `#737373` |
| Readable muted text on page | `--muted-foreground` | `#6B6B6B` |
| Decorative border           | `--border`           | `#E5E5E2` |
| Interactive field boundary  | `--input-border`     | `#858580` |
| Hover                       | `--hover`            | `#EBEBE8` |

The extra muted and input tokens strengthen contrast on the off-white background. Destructive actions have a semantic error color; it is not a decorative accent.

Geist is self-hosted with swap rendering. Body text is 16px; small supporting labels are 12-14px. Headings use a shared scale. Spacing follows a 4px rhythm, with shared section/gutter tokens. Inputs/buttons use 8px corners; product surfaces use 12px. Badges use 6px corners. Interactive buttons have at least 44px touch targets.

## Components and layouts

- `BootCard`: shared identity, colorway, surface, sample label, visible keyboard focus, optional catalogue return URL.
- `BootArt`: shared concept asset, caller-specific responsive sizes and loading policy.
- `Sheet`: existing Base UI Dialog primitives, accessible title/description, Escape/outside dismissal, focus trap/restore, page scroll lock, scrollable body, safe-area footer. Used for mobile navigation and filters.
- `FilterFields`: shared desktop/mobile controls, options derived from the supplied boot records.
- `CatalogueBackLink`: validates the return URL and retains query context.
- `SampleNotice`: concise truthful disclaimer without importing fixtures into the client tree.

Home includes featured samples, functional brand/surface links, and an explanation of the catalogue. Catalogue uses a sidebar at 900px+, a filter drawer below 900px, two result columns below 1024px, and one below 640px. Navigation becomes a menu below 960px to accommodate Community without crowding the header. Details stack below 768px and use section links, including the live Reviews section.

Catalogue is request-rendered so boot links and query-specific results exist in initial HTML. Home and boot detail bodies retain static generation. Filter changes continue to use native history integration without a full reload. Details preserve the originating catalogue URL through a small client return link with a static fallback.

## Scope and imagery

All eight configurations remain unverified mock entries. The existing unbranded AI concept artwork is reused with visible disclaimers. There are no real product photos, prices, fit conclusions, endorsements, comparison tools, or Fit Finder. Sprint 2.2 discussions use white feed/detail/editor surfaces, the existing tokens, responsive category navigation, compact text boot references, and a safe shared Markdown preview/renderer. Counts come only from stored public discussions; no fake community engagement is shown. Sprint 2.1 adds working email sign-in, settings and public profile pages using the same tokens, with an initial avatar and visible form validation. Avatar uploads and activity content remain deferred. Add those UI surfaces only alongside real data/working implementations.

## QA

Run typecheck, lint, tests, and build. Browser checks should cover 375/768/1024/1440 widths, mobile sheets, keyboard focus, Escape and focus restoration, rapid filter updates, sorting, reload/history, invalid filter values, return navigation, and 404s. CSS disables transitions and skeleton animation for reduced motion.

Sprint 2.4 uses the same tokens for review summaries, real distributions, responsive cards and form disclosures. Ratings use native labelled radio groups with 44px targets and keyboard focus. Private foot information requires an unchecked consent control. Reviews load independently of static catalogue details, with explicit loading/empty/error/retry states. See [review delivery notes](phase-2-reviews.md).
