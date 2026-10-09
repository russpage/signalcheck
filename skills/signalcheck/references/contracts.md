# Test contracts

A scanner can discover what exists. A contract states what should happen. Review contracts before treating a baseline as correct; yesterday's broken behavior must not become today's passing test.

## Three profiles

| Profile | Supplies | Does not establish |
| --- | --- | --- |
| Site | Allowed hosts and routes, selectors, critical actions, destination IDs, consent policy, synthetic identities, expected outcomes | That every discovered form is safe to submit |
| Platform | Installation locations and known constraints: Shopify pixels, WordPress forms, SPA navigation, cross-origin embeds | A site's intended event names, account IDs or business rules |
| Protocol adapter | Decode captured requests into logical GA4, Meta or Google Ads events; distinguish transport variants | Final receipt, processing or conversion credit at the destination |

A Shopify profile and a GA4 adapter solve different problems. A first-party collector needs an explicit host-to-protocol mapping; a matching URL alone is not proof that its payload follows that protocol. Unknown vendors remain inventory entries until an adapter exists.

## Contract contents

Use this as a specification checklist. It is not a JSON schema; only documented runner keys are executable.

| Component | Required decisions |
| --- | --- |
| Identity | Stable contract ID/version, owner, criticality and environment |
| Scope | URL/host, device/browser, consent state, locale/region, authentication, frame or worker boundary |
| Preconditions | Test fixture exists, permitted action, fresh/persistent session, required integrations available |
| Action | Exact control and sequence; action IDs; invalid, valid or repeat-submit case |
| UI | Expected validation, error/success state, redirect and disabled/loading state |
| Measurement | Event name, vendor, destination, conversion label, allowed count/range, payload requirements and trigger window |
| Identity/attribution | Run correlation, event/order identity, expected session continuity and approved campaign fixture |
| Delivery | Which receipt checkpoints must be proven, access method, correlation predicate and maximum delay |
| Test data | Allowed identity, suppression/exclusion, fixture lifecycle and cleanup owner |
| Evidence | Minimum capture, redaction, retention and result when capture is unavailable |

For a contact form, separate contracts for: invalid input produces validation and no conversion; valid input produces confirmation and one configured lead event; correlated record arrives at the application/CRM. A click, a success screen and a delivered record are distinct checkpoints.

## Map to the bundled runner

The engine's configuration supports explicit route/device/consent matrices, destination allowlists, page/event expectations, selectors and bounded journeys. See `scripts/browser-qa/config/schema.json`, `config/example.json`, `config/contracts.example.json` and the runner's `--help` for executable fields. Do not add unsupported fields and then imply that they were evaluated.

- `expectedPageviews` and `expectedPageEvents` define global page events; a page's `expectedEvents` narrows the contract to that route. Events specify vendor, event name, destination and count or range. Count zero expresses a negative event expectation. Assertions apply only in the configured capture window and scope.
- `collectorHosts` explicitly maps first-party collector hosts to supported protocols. It does not enable server-log access.
- A page's `expectedForms` checks `selector`, optional `frameSelector`, required-field selector strings and optional `requireLabels`. Its `assertions` check configured selector presence and optional `visible`, `enabled` or `accessibleName`. Automatic inventory is not a contract that every form works.
- Non-destructive `steps` exercise configured navigation/SPA controls; each click must be explicitly marked non-destructive. A name such as “Continue” is not enough to infer safety.
- Submission journeys require enabled configuration, `--allow-submit`, confirmed synthetic routing, test values, `successSelector` or `successUrlPattern`, and `expectedEvents`. Purchase, checkout and destructive actions are unsupported by the bundled executor.
- A journey with `kind: "invalid-validation"` requires `--allow-invalid` and explicitly configured count-zero `expectedEvents`. It checks native rejection or `validationSelector`, with backend write interception. Report an intercepted write as an observed attempt and attribute it to the form only with endpoint/action evidence; unrelated background writes can make validation inconclusive. Interception does not prove client validation prevented the attempt. The guard permits recognized measurement requests so premature conversion emission can still be observed.
- Backend receipt, arbitrary payload schemas, cookie-level consent validation, geo simulation, attribution and cleanup require additional observers or a separate authorized browser/API run. A field describing the desired outcome does not implement an observer.

## Receipt checkpoints

| Checkpoint | Evidence | Maximum supported conclusion |
| --- | --- | --- |
| Control activated | Browser action and timestamp | Test attempted the action |
| UI accepted | Visible confirmation/redirect | UI displayed success |
| Request emitted | Captured URL/protocol/body summary | Browser attempted emission |
| Endpoint responded | Captured status/response, if available | Endpoint returned that response |
| Application recorded | Correlated authoritative application record | Test record exists there |
| Integration forwarded | Correlated forwarding log/queue receipt | Integration attempted or acknowledged forwarding |
| Destination processed | Correlated destination receipt/debug record | Destination processed the observed test event |
| Counted/attributed | Appropriate delayed reporting evidence | Event received reporting credit under those settings |

An HTTP 2xx response is insufficient to prove a created lead, processed event or attributed conversion. A browser cannot establish a server-only event without a server observer. Poll only within an explicit delay budget; otherwise report inconclusive and retain the correlation key safely.

## Avoid false failures

- Judge logical events, not total requests or script elements. One GA4 request can contain a batch; one Ads conversion can produce companion requests. Different destinations or different actions can intentionally receive matching event names.
- Scope duplicate candidates by vendor, destination, action, device/visit, consent state and transport. A reused logical event/order ID provides stronger evidence than timing proximity. A repeated browser emission still does not prove the vendor counted twice.
- A matching Meta browser/server pair is structurally deduplication-ready when the pixel destination, event name and event identity correspond. This is not evidence that Meta actually deduplicated it. Server events are visible only when captured through an authorized server observer/import.
- A consent rejection can legitimately leave cookieless Google requests in advanced Consent Mode. Check the configured basic/advanced policy, consent signals, storage and identifiers; do not classify every denied-state request as a violation.
- A banner click proves interaction with the control. It does not prove the CMP or tags honored the choice. Distinguish requested state, observed control state and independently verified measurement state.
- A successful mobile viewport run is not a real-device or Safari compatibility test. A clean console is not proof that search, checkout or accessibility works.

## Synthetic data lifecycle

Prefer staging and vendor test modes. Production tests need dedicated QA identities, a stable run marker or correlated fixture, known campaign/sales suppression, and an explicit conversion/reporting exclusion strategy. Validate the exclusion before enabling submissions; do not remove the very events needed as QA evidence.

Keep secrets and test values in environment variables or the host's secret store. Minimize stored payloads, mask fields and confirmation text, avoid raw URLs containing personal data, and retain evidence only as long as useful. A hash of a personal identifier is still sensitive correlation data; it is not blanket anonymization.

Cleanup is an independent operation: record which fixture was created, the permitted delete/archive action, owner and outcome. Never delete customer records based on a name-prefix guess. The bundled runner does not perform CRM cleanup or verify production exclusion rules.

## Primary references

https://developers.google.com/tag-platform/security/concepts/consent-mode

https://developers.google.com/tag-platform/security/guides/consent-debugging

https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events.md

https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference

https://playwright.dev/docs/network
