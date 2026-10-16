# Sprint 3.4 — Boot Fit Finder UI

## Scope and audit

`/boot-fit-finder` now connects the existing private Foot Profile, deterministic recommendation engine and privacy-preserving review analysis. It preserves the technical `/boot-fit/preview`. No Sprint 3.5, database migration, new dependency, environment variable, cloud resource or deployment is introduced.

The existing repository has **no product comparison tool**, despite the sprint brief assuming one. Prior architecture/review documents confirm this. No fake Compare button or nonexistent route was added. Detail and review actions are connected only when entry ID, slug, generation, brand, tier, outsole, colorway and exact variant match the static catalogue's real routes. Comparison integration remains a prerequisite gap, not a feature claimed as tested.

The catalogue still has eight sample entries/seven exact variants, with no live verified prices or real fit conclusions. No synthetic product evidence or reviews were inserted into development or Neon. Browser/integration fixtures are confined to disposable local databases. Guests can view the landing/catalogue; recommendation queries still require an active verified account. This limit is explained before any measurements are collected.

## User flow

1. Open Finder from desktop navigation, mobile menu or account settings. The hero states the supplied headline and explicitly rejects guaranteed physical fit.
2. Sign in if necessary. The browser requests only the authenticated user's private profile through existing `GET /api/account/foot-profile`, with no-store and abort-on-unmount. No profile values are embedded in initial page HTML. A successful preload fills the wizard; no missing profile is required to be created. If loading fails, retry or continue with blank inputs and **saving disabled**.
3. **Measurements:** optional left length/width, optional separate right foot, exact cm/mm conversion, shape/instep and the existing measurement guide. No missing foot is silently copied from the other. Both feet are required for comparable-reviewer matching, not for querying the catalogue.
4. **Playing preferences:** required surface, optional position/sensation/snugness/brands/tiers and current worn size/system. Position is not a hard gate. Outsole explanations specifically reject universal FG→AG suitability.
5. **Budget:** optional amount/currency together, using the existing ISO currency list. No FX conversion. Budget remains a preference; an actual same-currency verified price is needed to establish a budget match. Results can be refined to within-budget or within/near (existing10% policy).
6. **Review:** see all supplied values and navigate back to edit. Explicit processing consent is required. The separate **save privately and enable saved-profile Fit Finder** checkbox is off by default. Only explicit final submission runs recommendations.
7. Results separate eligible recommendations from unverified catalogue entries and show snapshot/rules/bounds. Each exact-variant card links to available detail/review routes and explains reasons, community context, source references, unknowns and cautions. No results or personal inputs are put into a URL.
8. Refresh evidence reruns the submitted snapshot without resaving. Edit preferences returns to the in-memory draft. Reloading/leaving the page discards transient inputs/results; saved profile data is retained only through an explicitly requested save.

## API integration and privacy

Existing `POST /api/boot-fit/recommendations` gains one additive mode:

```ts
{
  limit: 20, // existing1–20 bound
  preferences: { /* validated finder fields only; unit cm/mm */ },
  processingConsent: true
}
```

Preferences/processingConsent must appear together. Guest requests, forged user IDs, version/permission fields inside preferences, client scores, arbitrary evidence and saveProfile flags are rejected. The existing `{limit}` saved-profile mode still requires stored consent and rechecks its version/revision under the user lock. Transient mode requires per-request consent and active server-side authentication, normalizes through the existing profile validation and does not read another profile or persist measurements. Existing same-origin/body/rate limits and private/no-store responses remain unchanged. Operational HMAC rate-limit counters still update; “not saved” refers to personal preference/profile data, not absence of all database writes.

The existing engine still applies surface gates before ranking. The UI does not recalculate scores, price eligibility, similarity, consent or review cohorts. Added `brandId`, `brand`, `generation` result fields come directly from the existing candidate identity. Community counts/breakdowns retain Sprint 3.3 suppression (`null` means withheld, never zero). Reviewers' private profiles and identities are never returned by the analysis service.

Saving is a separate existing `PUT /api/account/foot-profile` after a successful recommendation request, and only when explicitly selected. It projects allowed fields, merges unrelated profile details and uses version/revision concurrency checks. Changed measurement values clear the old date/method rather than falsely attaching old context to new measurements. Optional fields supplied by the wizard replace their prior values; other profile preferences are preserved. No public-sharing consent is granted. A failed save leaves the results usable with a notice that the profile was **not confirmed saved**; the UI never retries saving silently. A stale profile is not overwritten.

No localStorage/sessionStorage, share endpoint, query-string measurements, matching histories, analytics events or external AI calls were added. Authenticated private API requests are the only source of saved profile data. Errors display bounded human-readable messages rather than raw responses or secrets.

## Presentation and accessibility

Existing Geist, semantic design tokens, Input/Button, navigation Sheet, measurement guide and labeled concept artwork are reused. UI/UX Pro Max recommendations were searched, but its generic neumorphism/new palette suggestion was rejected in favor of the supplied Clean Minimal system. Design-taste-frontend was inspected and excluded because it explicitly does not cover multi-step product UI.

Desktop uses a form surface with a guidance rail; narrow screens stack content and controls. Inputs have labels, described validation errors and44px target heights; grouped checkboxes have clickable labels. Step progress is an ordered list with current-step semantics. Back/continue never submit a query early. Invalid fields receive focus, step/result headings announce transitions, async states use status/alert regions and duplicate requests are blocked synchronously. The global reduced-motion policy remains in force; no decorative animation is added. This is targeted accessibility QA, not a complete WCAG certification.

Cards hide numerical preference-ranking scores below75% requested-factor evidence coverage. Higher-coverage scores are still labeled preference ranking, alongside a physical-fit disclaimer. Coverage percentages describe known requested factors, not fit accuracy. Missing image/price/stock and absent/suppressed review evidence remain explicit. Sample art is labeled concept artwork, not a product photo. No sourced photograph exists to show for real nonsample products, so those show a missing-image state.

Refinements (brand/tier/outsole/budget/community-quality/review availability) operate only on returned eligible/unverified arrays, preserving their engine order and membership. They cannot restore safety-excluded candidates. Unknown prices never pass verified-budget filters; withheld counts never pass “at least5 reviewers.” Bound/truncation notices explain that filters do not search an unreturned catalogue tail.

## Files

Created:
- `src/app/boot-fit-finder/{page,loading,error}.tsx`
- `src/components/recommendations/finder.tsx`:guided journey, preload, consent, explicit save and request lifecycle.
- `src/components/recommendations/finder-fields.tsx`:input sections and progressive disclosure.
- `src/components/recommendations/finder-results.tsx`:summary, cards, evidence panels and refinements.
- `src/components/recommendations/finder-client.ts`:typed existing-API access/error handling.
- `src/components/recommendations/finder.test.tsx`:presentation/privacy regressions.
- `src/lib/recommendations/finder.ts`, `finder.test.ts`:shared fields, validation, save projection, refinements and catalogue identity.
- `src/lib/recommendations/request.ts`:additive strict request contract.
- `tests/finder.integration.ts`:real auth/HTTP/PostgreSQL coverage in the existing disposable harness.
- This document.

Extended:
- `src/lib/foot-profile/validation.ts`:exports the unchanged base field definitions for reuse; existing full validation remains intact.
- `src/lib/recommendations/{service,types,engine}.ts`:transient request integration and explicit identity fields; core ranking/gates unchanged.
- `src/components/navbar.tsx`, `src/app/account/page.tsx`, `src/app/globals.css`:navigation/design integration.
- `tests/auth.integration.ts`, `README.md`, `tasks/{plan,todo}.md`.

Pending Sprint3.2/3.3 changes already in the working tree are preserved; the schema/migrations shown in the overall git diff belong to those previous sprints.

## Manual testing

Use existing guarded local setup (`npm run dev:local`) and local captured SMTP (`npm run dev:mail`), with local PostgreSQL/storage as documented in README. Production/Neon configuration was not changed.

- As guest, open `/boot-fit-finder`; inspect mobile navigation and follow the working sign-in/catalogue links. No guest measurements are collected.
- Signed in, enter a bad measurement and continue:verify inline error/focus. Enter valid cm/mm inputs and switch units;verify exact conversion. Try continuing without a surface, then select the real pitch type.
- Supply amount without currency and continue:verify pairing error. Complete budget/size preferences and review your summary.
- Submit without processing permission:verify rejection/focus. Give permission but leave save unchecked:run the real service. With current live samples, expect **no eligible recommendations**, not invented fits/prices/reviews.
- Use refinements/reset, edit inputs, refresh, supporting-evidence disclosures, detail/review links. Review unknowns and withheld labels.
- Explicitly choose saving, submit, reload and verify owner-only preload. Change the same saved profile in another tab and try stale save:expect concurrency protection, not overwritten data.
- Disconnect/abort the recommendation request and retry;inputs remain. Deny the profile-load request and continue without saving:saving stays disabled.
- Comparison cannot be tested because the existing project does not implement it. Do not assume the Community “Comparisons” category provides product comparison.

Synthetic sufficient-evidence, price and cohort scenarios must be exercised only in disposable QA databases, not populated into real community data.

## Verification record — 16 October 2026 (Sydney)

| Check | Status | Actual outcome |
| --- | --- | --- |
| `npm test` | PASS |187 tests,17 files;0 skipped;15 new Finder cases |
| `npm run test:platform:local` | PASS |68 tests;0 failed,0 skipped;4 new Finder groups;fresh local DB/private bucket removed |
| `npm run typecheck` | PASS |Next route generation and TypeScript completed |
| `npm run lint` | PASS |No ESLint errors |
| `npm run build` | PASS |Final production compilation completed locally;no deployment |
| Prisma validation/status/drift | PASS |Valid schema;11 local migrations applied;No difference detected;no new migration for this sprint |
| `git diff --check` | PASS |No whitespace errors |
| Production dependency audit | PASS |0 reported vulnerabilities |
| Full dependency audit | FAIL |5 pre-existing High lint-toolchain findings;package versions unchanged |
| Client secret literal scan | PASS |43 built JS files;0 matches for configured private env values;values never printed |
| Real browser journeys | PASS |Local SMTP sign-in;guest guidance;wizard;exact unit conversion;required surface;paired budget;consent;real database-backed result/explanation/filtering;detail/review actions;explicit save and owner preload |
| Error/duplicate/privacy browser scenarios | PASS |Aborted request/retry;duplicate submit blocked;failed preload→saving disabled;no-result state;no unintended profile record;no personal query string |
| Final-build keyboard/focus | PASS |Invalid-field focus/correction;step heading focus;Space consent;Tab to save option;no remaining focus race |
| Responsive/browser rendering | PASS |Guest,form and results375/768/1024/1440px;landscape812×375px;no horizontal overflow;mobile screenshots visually inspected;mobile menu link verified |
| Reduced-motion journey | PASS |Final form/result/keyboard journey executed with reduced motion enabled |
| Final successful browser console | PASS |0 errors,0 warnings |
| Product comparison journey | NOT TESTED |Existing comparison functionality/routes are absent;no fake action introduced |
| Formal WCAG audit,load testing,live email delivery,scientific fit calibration | NOT TESTED |Outside the targeted local UI verification;no production-readiness claim |

The existing integration run still emits a pg deprecation warning about concurrent `client.query()` execution. Full audit findings remain in `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, and `eslint-config-next`. They were not silently dismissed or fixed through an unrelated/possibly incompatible dependency downgrade.

Failed attempts and fixes:initial typecheck encountered duplicate gitignored `.next` declarations (removed only those generated duplicates) and fixture type errors (corrected literal typing/cleanup lookup without suppressions). A real browser keyboard assertion exposed a deferred-focus race;focus now runs on layout commit, and the exact sequence passed on the final build. Corrected inputs now clear stale invalid indicators. An additional failing-then-passing test tightened catalogue links to reject colorway/outsole mismatches. Expected browser resource errors were deliberately produced by aborted/503 test requests;the separate final successful session had a clean console. No tests were deleted/skipped and no lint/type suppressions were added.

Targeted self-review covered normalization/step validation,explicit processing and save boundaries,optimistic concurrency,exact product identities,privacy-safe analysis display,ranking/safety preservation,client memory/URL handling,query/data bounds and maintainability. No performance improvement percentage is claimed:existing bounded queries/output and lazy sample artwork were preserved;no production load benchmark was run.

Skills actually loaded and applied:ui-ux-pro-max,frontend-ui-engineering,api-and-interface-design,test-driven-development,security-and-hardening,incremental-implementation,code-review-and-quality,playwright,planning-and-task-breakdown,and ponytail. The design-taste skill was inspected but excluded for its stated scope;performance-optimization was not claimed as used.

## Sprint 3.4 checklist and readiness

| Requirement | Status |
| --- | --- |
| Main route,hero,desktop/mobile navigation | PASS |
| Four-step guided form,measurement guide,international units/currencies | PASS |
| Own-profile preload,explicit per-request consent,optional explicit saving | PASS |
| Authenticated real recommendation/review-analysis integration | PASS |
| Guest experience | PASS — limitation disclosed;no insecure guest API added |
| Exact-variant cards,evidence explanations and supported refinements | PASS |
| Details and reviews integration | PASS |
| Comparison integration | PARTIAL — pre-existing prerequisite missing |
| Loading,empty,uncertain,error/retry states and duplicate protection | PASS |
| Targeted accessibility/responsive/privacy checks | PASS |
| Automated regression/build checks | PASS |
| Production dependency/tooling readiness | PARTIAL —runtime audit clean;existing tooling advisories/warning remain |
| Sprint 3.5 implementation/deployment | NOT STARTED |

**Ready for Sprint 3.5 local development/planning: YES for the core Finder**, with the comparison prerequisite explicitly unresolved. This is **not production launch approval**. Real catalogue verification and authorized community evidence are still missing,comparison has no implementation,privacy suppression is not a formal anonymity guarantee,and the wider platform's tooling/pg warnings need follow-up. No scientific fit assurance,live cloud database migration or email delivery was verified here. All prior working functionality remains covered by the executed regression suite.
