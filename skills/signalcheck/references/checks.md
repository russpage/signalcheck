# Check catalog

Use a bounded critical-path suite daily and broader discovery periodically. This catalog is a menu, not a claim that all checks run automatically.

**Bundled** means the local runner implements the check with site configuration. **Browser** means the skill can perform a separate interactive browser check when the host exposes that capability. **Access** requires an authorized system observer and contract; no backend connectors ship with this package. **Planned** means there is no bundled automated implementation. Check the installed runner version before using newer fields.

| Area | Check | Availability and evidence boundary |
| --- | --- | --- |
| Discovery | Enumerate configured page forms, controls, scripts, frames and visible providers | Bundled; inventory only, not an unrestricted site crawl |
| Discovery | Discover routes from sitemap and internal links; deduplicate templates and prioritize journeys | Browser/manual; crawl expansion and completeness validation are planned |
| Availability | Route navigation, failed requests, JavaScript errors, recognized unavailable embedded forms | Bundled; reproduce to distinguish site errors from environment/network restrictions |
| Form structure | Expected form/control exists, required controls and basic label checks | Bundled when configured; labels present do not prove full accessibility |
| Invalid input | Required validation appears; conversion does not emit; detect an attempted write | Bundled explicit invalid-validation mode; intercepted writes are attempts, not successful delivery |
| Valid input | Fill approved fixture, submit, display success and configured event | Bundled opt-in; requires selectors, synthetic routing and success/event contract |
| Form behavior | Field format, file upload, conditional logic, reset, error recovery and retry | Browser; dedicated automated cases planned |
| Repeat submit | Double click, Enter plus click, refresh/back, resubmission and idempotency | Browser plus Access for stored-record count; bundled stress cases planned |
| Booking/checkout | Multi-step booking, cart and sandbox payment completion | Browser with configured environment; bundled transaction executor unsupported |
| CAPTCHA/auth | Approved challenge/test-key handling, authenticated journey | Browser/manual; no bypass or CAPTCHA-solving capability bundled |
| Journeys | Configured non-destructive click, URL or selector checkpoints; SPA transitions | Bundled; arbitrary multi-step form/payment workflows remain unsupported |
| Navigation | Critical links, redirects, query preservation and external handoffs | Browser; exhaustive broken-link/redirect audit planned |
| Tags | Installed supported containers/scripts and observed requests | Bundled; script presence does not prove event emission |
| Tags | Container export review: trigger overlap, variables, consent settings and redundant installations | Browser/Access or supplied export; no GTM administration connector bundled |
| Events | Sanitized dataLayer timeline and frame inventory | Bundled where hooks remain observable; workers/replaced hooks can limit this evidence |
| Events | Parse GA4 batches/Measurement Protocol, Meta pixel/CAPI captures, Google Ads conversion variants | Bundled adapters; only captured traffic is observable, no server transport generated |
| Events | Expected event names, destination IDs and count/range, including zero | Bundled; site contract required, timing/consent window matters |
| Events | Known destination allowlist, missing/unknown destination/name | Bundled; undeclared destination is a finding for review, not automatically malicious |
| Duplicates | Repeated logical IDs, suspicious temporal matches, Ads companions and Meta browser/server pair classification | Bundled; emission classification does not establish final double counting |
| Event payload | Required business properties, value/currency/item schema, identity conventions | Limited sanitized properties available; arbitrary schema assertions planned/manual |
| Consent | Fresh contexts with configured accept/reject controls and observed events | Bundled; control interaction and event differences are evidence, not full policy verification |
| Consent | Default-before-tag order, Consent Mode signals, cookies/storage, withdrawal and regrant | Browser/Tag Assistant; deterministic signal/storage observers planned |
| Consent | Jurisdiction-specific CMP behavior, locale, Global Privacy Control where required by site policy | Browser/manual plus configured environment; geo/policy matrix planned |
| Attribution | UTMs, approved click-ID fixtures, referrer and landing-to-conversion continuity | Browser plus Access; bundled attribution assertions planned |
| Identity | Anonymous-to-known transition, session continuity, cross-domain linker and iframe handoffs | Browser plus Access; server identity and reporting joins require independent evidence |
| Backend | Form/booking/order record received with run correlation | Access; separate application/CRM observer required |
| Delivery | Queue/webhook/retry, CRM/email/SMS receipt, tagging-server forwarding | Access; no connectors or cleanup executor bundled |
| Vendor processing | Meta Test Events/deduplication, GA4 debug/receipt, Ads diagnostics | Access; browser request/status cannot prove vendor processing or reporting credit |
| UX | Configured visible/enabled/accessibly named controls and screenshots | Bundled basic assertions; visual evidence is not an automatic visual-regression verdict |
| Accessibility | Keyboard path, focus, error association, screen-reader semantics, contrast | Browser; automated accessibility/contrast tools planned, no compliance certification |
| Performance | Slow critical actions, load timing, request budget, Core Web Vitals regression | Browser/manual measurements; stable automated performance budgets planned |
| Security/data | Accidental sensitive data in inspected URLs/payloads, mixed content, unsafe external redirects | Browser/manual; sanitizer protects artifacts but does not audit all leakage or security |
| Regression | Compare findings only across completed equivalent scope and expectations | Bundled; changed/failed/missing visits cannot count as resolved |
| Evidence | Sanitized JSON, Markdown/HTML summary, masked screenshots, checkpointed partial runs | Bundled; retain explicit capture failures and privacy-suppressed evidence |
| Schedule | Daily runner execution and retained prior artifact | External scheduler/reusable workflow; installing a skill alone does not create a schedule |
| Diagnosis | Evidence-based suggestion and next discriminating test | Bundled rule suggestions plus assistant review; hypotheses must remain labelled |

## Daily scope priorities

1. Confirm critical pages and configured forms are available; check errors and expected tags/events.
2. Exercise bounded navigation and negative validation cases that cannot create real records.
3. Run approved successful submissions only when QA fixtures, suppression and cleanup are ready.
4. Verify downstream receipts separately if access exists; otherwise explicitly mark them untested.
5. Report new, persisting and resolved findings alongside coverage gaps. Broaden scope weekly or after relevant releases.

Include one example of each important form implementation and template, plus high-value exceptions. A template sample can catch shared regressions; it cannot establish that every URL, product configuration or third-party provider works.
