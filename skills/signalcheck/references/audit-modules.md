# Choose audits around the customer's action

Keep one SignalCheck skill and a shared site profile. Select relevant modules after discovering the stack and retaining the user's priority journey. Do not make users choose from fifteen technical names to begin. A module is a guided agent workflow; the catalog does not install platform connectors or execute every audit automatically.

## Contents

1. Shared contract and dashboard
2. Core website audits (1–7 and 13)
3. Connected evidence audits (8–10 and 12)
4. Decision reviews (11 and 14)
5. Recurring readout (15)
6. Current capabilities and sources

## Shared contract and dashboard

Record the exact affected `pageUrl` when a review concerns a page; omit it for a genuinely site/account-wide review. Record each selected module's owner, critical action, intended destinations, environment, device/browser, consent/region conditions, evidence window, original contract reference, review time and cadence. Keep private evidence references with the site profile. The user supplies business intent; the agent discovers selectors, payload formats and configuration.

Use `scripts/browser-qa/config/audits.example.json` for an agent review ledger. Run `node scripts/browser-qa/bin/audits.mjs --input /private/audits.json --output /private/review` and optionally `--report /private/browser/report.json`. This produces a shared HTML/Markdown dashboard and sanitized JSON. It validates supplied review structure and evidence coverage, not the authenticity or correctness of an imported conclusion. References are hashed in the output; retain the original private ledger to retrieve them. A browser report remains a separate observation, never proof of a server-only event.

Keep a row for all fifteen modules: not-selected, untested, inconclusive, issue, reviewed-no-mismatch or recommendation. These are reviewer assertions, not independently verified repairs. Missing required evidence makes reviewed-no-mismatch inconclusive. An issue may be supported at one checkpoint while the rest of the audit remains untested. No overall health percentage: showing 100% while platform stages are unavailable would hide the work left to do.

For every finding output: module, priority/severity, page/action/condition, expected versus observed, evidence checkpoint and time, business impact, observation and cause confidence, owner, next action, original-test retest and coverage gap. Route actual browser findings through `bin/actions.mjs`; preserve original contracts and regression scopes. Imported reviews cannot close that ledger as verified fixed. Reconcile receipt/counting separately with authoritative evidence. Do not infer revenue loss from a broken signal without outcome evidence.

## Core website audits

### 1. GTM Container Health Check (`gtm-health`)
- **Required inputs:** allowed site/routes, intended containers, read access/export for the published container and relevant workspace, priority action and consent policy.
- **Workflow:** discover container loads; compare published version with workspace; trace tags, triggers, variables, consent dependencies and installation owners; reproduce the selected action in preview/browser evidence.
- **Diagnostic rubric:** distinguish missing load, wrong container/environment, trigger mismatch, unavailable variable, stale configuration and shared installation overlap. Judge health per tag/action, never by container presence alone.
- **Output format:** container/version/owner inventory and tag → trigger → action → destination table, with evidence and proposed repairs.
- **Decision rules:** investigate a mismatch against intended behavior; preserve deliberate multiple containers. Missing container access leaves configuration review untested.
- **Guardrails:** no automatic publishing, disabling tags or declaring GTM absent site-wide from one document. Retest the same tag/action/consent conditions and related shared triggers after a repair.

### 2. GA4 Event Quality Audit (`ga4-quality`)
- **Required inputs:** intended property/destination, event definitions and parameter requirements, consent states, representative routes and authorized GA4 diagnostic/report reads.
- **Workflow:** capture actions and decoded requests; inspect names, types, required parameters, values/currency, source/medium continuity and unexpected personal data; compare with available GA4 receipt and reporting evidence.
- **Diagnostic rubric:** separate missing event, wrong destination, malformed data, duplicate emission, incomplete capture and reporting delay. Do not accept today's behavior as the expected contract.
- **Output format:** action → intended event → observed dispatch → received/reporting checkpoint, plus parameter defects and fixes.
- **Decision rules:** browser count tests cover decoded emissions only. Mark arbitrary parameter schemas and platform stages untested until explicitly observed.
- **Guardrails:** never print personal data, raw URLs/identifiers or infer attribution from emission. Repeat unchanged event and parameter checks after the served fix.

### 3. Google Ads Conversion Tracking Audit (`ads-conversions`)
- **Required inputs:** approved account/conversion actions, destinations/labels, primary/secondary intent, counting/value rules and diagnostic access.
- **Workflow:** trace the customer action to browser dispatch, conversion-action configuration and platform diagnostics; inspect direct versus imported conversion routes and their business purpose.
- **Diagnostic rubric:** wrong action/label, premature conversion, missing or repeated logical emission, wrong value/currency and intentionally distinct actions. Normalize known Ads companion requests.
- **Output format:** business action → conversion action → implementation owner → receipt/counting status, with proposed fix and retest.
- **Decision rules:** a click or HTTP 2xx does not prove a counted conversion. Recommend a setting change only against the user's agreed conversion intent.
- **Guardrails:** preserve intentional reporting/bidding choices; do not merge conversion actions or alter bidding settings automatically. Recheck the original browser action and platform diagnostics after the applicable delay.

### 4. Meta Pixel + CAPI Signal Quality Audit (`meta-signal`)
- **Required inputs:** intended pixel/dataset and events, browser capture, correlated server dispatch logs, Events Manager diagnostics and permitted first-party data policy.
- **Workflow:** compare browser and server coverage, event names/identity, timestamps, action source, values/currency and actual platform diagnostics. Retrieve a quality score only from Meta's own current reporting.
- **Diagnostic rubric:** distinguish browser-only coverage, server-only coverage, missing correlation, malformed fields, receipt errors and platform-reported matching quality.
- **Output format:** action → browser event → server event → received diagnostic, with missing inputs and a linked deduplication review.
- **Decision rules:** identifiers suitable for matching do not prove Meta processed/deduplicated them; use module 8 for that conclusion. Missing server or platform access leaves those stages untested.
- **Guardrails:** no invented match-quality score, raw customer identifiers or promise of restored attribution. Retest the same correlated action across the available checkpoints.

### 5. Consent Mode Impact Review (`consent-impact`)
- **Required inputs:** approved consent policy, CMP controls, default/update signals, actual region/browser conditions and comparable platform reporting windows when estimating impact.
- **Workflow:** use fresh sessions for configured choices; observe signals before/after consent and resulting storage/dispatch behavior; compare measured reports only when scope and denominators match.
- **Diagnostic rubric:** signal timing, wrong state, missing update, policy mismatch and incomplete observation. Advanced Consent Mode can legitimately send cookieless pings after denial.
- **Output format:** state/condition → expected behavior → observed signals/requests; separate measured reporting change from hypotheses.
- **Decision rules:** missing expected policy blocks a compliance judgment. Attribute impact only with suitable comparison evidence; otherwise report behavior, not a loss percentage.
- **Guardrails:** do not bypass consent, certify legal compliance or require blanket zero requests. Repeat fresh-session consent tests after a change.

### 6. Click ID + UTM Sanitization Check (`campaign-integrity`)
- **Required inputs:** campaign naming rules, approved test landing URLs, expected redirects/domains, consent policy and intended attribution destinations.
- **Workflow:** follow reviewed landing/redirect/navigation paths; inspect identifier presence, encoding, case, persistence and transfer in memory; inspect UTM fields for sensitive data. Compare against intended rules.
- **Diagnostic rubric:** accidental stripping, double encoding, inconsistent naming, inappropriate leakage and expected privacy-driven suppression.
- **Output format:** hop → permitted identifier/UTM behavior → observed result, using presence/type/hash summaries without raw identifiers.
- **Decision rules:** preserve legitimate identifiers where permitted. Do not strip all query parameters in a production fix merely because reports redact them. A fabricated click ID cannot prove ad attribution.
- **Guardrails:** no real ad clicking, invented valid click IDs, raw query output or automatic persistence beyond consent. Retest the same approved campaign fixture through the original hops.

### 7. Duplicate Event Finder (`duplicate-events`)
- **Required inputs:** logical action identity, destinations, allowed repetition, event-count contracts and complete scoped capture.
- **Workflow:** group decoded emissions by action/destination/event and hashed business identity; normalize known transport companions; trace implementation owners.
- **Diagnostic rubric:** confirmed repeated logical emission versus suspected temporal match, intended destinations, distinct actions and consent replay.
- **Output format:** each group with original requests, normalized logical count, evidence, cause confidence and original-test repair.
- **Decision rules:** without stable action/identity correlation, label suspected. Use module 8 to investigate what the platform actually deduplicated or counted.
- **Guardrails:** no automatic deletion of repeated loaders, raw order IDs or claims of doubled revenue. Preserve legitimate events in regression checks.

### 13. Ecommerce Data Layer Audit (`ecommerce-data`)
- **Required inputs:** priority shopping actions, event definitions, item/value/currency/transaction requirements, catalog reference and an authorized test environment for state-changing actions.
- **Workflow:** observe dataLayer/gtag entries before personal data is retained; check item structure and required fields; compare intended event, product/variant meaning and downstream request separately. Use `expectedCommerce` for the implemented shape checks described below.
- **Diagnostic rubric:** missing or empty items, absent item identifier/name, invalid price/quantity/value, absent currency/transaction identity, stale product data and incomplete timeline. Presence of a dataLayer entry alone does not prove a tag fired.
- **Output format:** shopping action → dataLayer shape → browser event → platform receipt, with missing fields and the last observed checkpoint.
- **Decision rules:** apply reviewed action-specific requirements; zero value can be legitimate. Product identity, totals and custom payload semantics need catalog/source comparison beyond the bundled shape observer.
- **Guardrails:** no real checkout/purchase execution; the bundled runner does not support these. Use separately authorized fixtures. Store boolean/count summaries, never item names, raw product/customer/order identities. Repeat the unchanged commerce contract after repair.

## Connected evidence audits

### 8. Conversion Deduplication Review (`conversion-dedup`)
- **Required inputs:** one permitted business action, intended conversion routes, correlated browser/server/import evidence and platform receipt/counting diagnostics.
- **Workflow:** trace the same action across routes; inspect vendor-specific identity/name rules using current documentation; verify actual deduplication diagnostics and final counting when exposed.
- **Diagnostic rubric:** missing/mismatched correlation, distinct actions mistaken for duplicates, replay/import overlap and platform processing still pending.
- **Output format:** correlated action → routes → matching requirements → processed/counting result, with stage-specific gaps.
- **Decision rules:** matching browser/server identifiers show readiness only. Do not apply one vendor's deduplication rule to GA4, Ads, Meta, TikTok and Snap indiscriminately.
- **Guardrails:** no raw business identifiers or fabricated platform evidence. Reconcile both source routes and destination results after the fix; browser-only retesting cannot close this module.

### 9. Offline Conversion Import Audit (`offline-imports`)
- **Required inputs:** CRM outcome definitions, consent/data policy, conversion-action settings, private normalized import records, delivery logs and platform upload diagnostics for one bounded window.
- **Workflow:** trace permitted source outcomes through matching/normalization, event times/timezones, values, upload response/partial errors and platform diagnostics; inspect retry/idempotency and adjustment handling against intended behavior.
- **Diagnostic rubric:** missing source outcomes, late or malformed records, wrong conversion action, rejected rows, duplicate retries and accepted versus counted records.
- **Output format:** source → eligible → sent → accepted/rejected → reporting reconciliation, with explicit units, window, lag and unknowns.
- **Decision rules:** HTTP success or job success does not establish all rows succeeded. Report row-level errors and compare compatible populations; never use a browser event as import proof.
- **Guardrails:** read-only by default; no live uploads, backfills or customer exports without scoped authorization. Retest using an approved sample and verify row outcomes after the correction.

### 10. Enhanced Conversions Readiness Check (`enhanced-readiness`)
- **Required inputs:** web versus leads use case, permitted first-party fields, consent signals, normalization/hashing implementation, account eligibility/terms/settings and diagnostics.
- **Workflow:** inspect approved data collection, consent, field availability, normalization/hash boundaries and platform configuration; compare a permitted correlated test with diagnostics when already enabled.
- **Diagnostic rubric:** ready prerequisites, blocked consent/data/settings, implementation defects and receipt not tested. Readiness is distinct from successful matching or improved attribution.
- **Output format:** prerequisite → evidence → ready/blocked/unknown, separate web/leads paths and smallest next step.
- **Decision rules:** recommend enablement only when prerequisites and authority are established. Verify current platform eligibility instead of freezing requirements in this skill.
- **Guardrails:** hashing is not permission to collect/share data; do not expose values or hashes that enable customer linkage. No automatic activation. Repeat prerequisite checks and actual diagnostic test after an authorized implementation.

### 12. Attribution Window Sanity Check (`attribution-windows`)
- **Required inputs:** documented conversion/buying cycle, account/action settings, click/view attribution definitions, timezone, reporting lag and comparable outcome/report exports.
- **Workflow:** inventory current settings; compare observed time-to-conversion distributions and report definitions; explain plausible differences and prepare a scoped recommendation.
- **Diagnostic rubric:** unintended window/settings mismatch, incompatible definitions, data incompleteness and an intentional business tradeoff.
- **Output format:** platform/action → current window/model → business rationale → recommendation and evidence limitations.
- **Decision rules:** differing platform totals are not automatically broken tracking. No universal best window; quantify a counterfactual only when the data supports it.
- **Guardrails:** no automatic settings/bidding changes or promise of recovered conversions. After an authorized change, verify saved settings and compare suitably delayed, comparable windows.

## Decision reviews

### 11. Server-Side Tagging Feasibility Review (`server-feasibility`)
- **Required inputs:** concrete measurement problem, existing routes, permitted data/consent policy, supported destinations, traffic estimates, hosting/maintenance owner, current costs and constraints.
- **Workflow:** trace the current failure; compare repairing browser tagging, existing native integrations and server routing; map data boundaries, deduplication, monitoring, operating cost and rollback for a small pilot.
- **Diagnostic rubric:** demonstrated need, implementation/ownership feasibility, consent preservation, measurable pilot criterion and cost evidence. A first-party URL does not prove forwarding works.
- **Output format:** proceed/pilot/defer recommendation, alternatives, assumptions, current sourced costs and pilot acceptance/retest.
- **Decision rules:** recommend only against the actual problem and business constraints; leave unsourced costs/benefits unknown.
- **Guardrails:** no automatic migration, privacy bypass, uptime guarantee or claim that server-side tagging restores every lost signal. Verify inbound, forwarding and destination receipt in the pilot.

### 14. iOS Privacy Signal Loss Review (`ios-signal`)
- **Required inputs:** web versus app context, actual OS/browser/device observations, consent conditions, campaign/cohort windows, authoritative outcomes and appropriate platform diagnostics.
- **Workflow:** compare the same permitted journey on genuinely exercised devices/browsers; trace capture/storage/redirect differences; reconcile available cohort reports and distinguish web browser behavior from app tracking permission frameworks.
- **Diagnostic rubric:** observed implementation difference, privacy-controlled behavior, incomplete cohort data, reporting/modeling differences and unproven causation.
- **Output format:** environment → observed checkpoint difference → possible causes → supported next test, with denominators and uncertainty.
- **Decision rules:** user-agent spoofing or a desktop mobile viewport is not an iPhone test. Report a loss estimate only with comparable outcome evidence and method; a reporting gap alone does not prove its cause.
- **Guardrails:** no fingerprinting, circumvention, invented recovery rate or conflation of browser privacy with app ATT. Retest the same actual environment and preserve the user's privacy choices.

## Recurring readout

### 15. Weekly Tracking Signal Readout (`weekly-readout`)
- **Required inputs:** selected audits, reviewed contracts, comparable current/prior private reports, owner, chosen cadence/local time/IANA timezone/destination and a functioning scheduler/reporting route.
- **Workflow:** check freshness/completion; run the bounded authorized suite; gather accessible supplemental module evidence; compare unchanged completed scopes; rank confirmed issues, investigations and missing coverage; deliver the dashboard to the chosen destination.
- **Diagnostic rubric:** new/persistent observations, independently verified repairs, missing/changed/failed coverage and stale evidence. Omitted or failed checks never count as fixes.
- **Output format:** what changed, what matters, fix queue with owners/retests, explicit coverage matrix and confirmed schedule. Offer one relevant feedback question.
- **Decision rules:** schedule only on user request/authorization. Let the person choose or edit cadence/time/timezone and pause/resume. Reuse choices; confirm the scheduler's actual result and destination. Distinguish schedule created from a verified unattended run.
- **Guardrails:** a skill is not a clock/service. Use available host scheduling or approved CI; follow its rules and permission boundaries. Do not promise a live dashboard, alerts or changes without functioning hosting/delivery/access. No unsolicited messages or public evidence uploads.

## Current capabilities and sources

The bundled runner supplies browser inventory, supported decoded-event/count/duplicate checks, configured generic request checks, consent-action observations, and commerce dataLayer shape checks. The audit dashboard compiles agent-supplied review records. Container contents, arbitrary request parameter validation, cookie/storage policy, campaign continuity, actual iOS execution, platform/CRM/server access, import reconciliation and specialist recommendations remain host-guided operations. No bundled connector or automatic platform auditor is supplied.

Verify current primary documentation before provider-specific judgments. Reviewed 2026-10-12:
- Google ecommerce: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google consent behavior: https://developers.google.com/tag-platform/security/concepts/consent-mode
- Google offline imports/enhanced conversions for leads: https://developers.google.com/google-ads/api/docs/conversions/upload-offline
- Server-side tagging: https://developers.google.com/tag-platform/tag-manager/server-side/intro
- Meta deduplication: https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events (fetch was rate-limited during this revision; retrieve current guidance before claiming exact provider rules).

Treat this as procedural guidance, not a frozen specification for all providers. Use the site's intended TikTok, Snapchat and other tools in the same action/destination/evidence framework; do not hide them because the catalog names the most common platforms.
