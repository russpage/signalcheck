# Check the tracking stack

Treat tags and events as the primary scope. Forms are one source of customer actions; page views, content views, navigation, clicks and other reviewed actions also need tracking checks. Keep GTM (tag management), installed scripts, browser requests, decoded events and final vendor receipt separate.

Discover scripts, containers, collectors and observed events before asking for configuration. Review the user's intended stack: GTM, GA4, Meta, Google Ads, TikTok, Snapchat and any other relevant tools such as Klaviyo, Customer.io or an internal collector. Ask what is missing from the discovered list, which tools should receive data and which actions should send which events. Never assume an installed tag is intended or an absent tool is unnecessary. Reuse previous answers. The agent discovers technical details; the user decides business intent.

Keep a private coverage table for every discovered or expected tool: installed/discovered, request observed, event decoded, expected behavior checked, platform receipt checked, and gaps. A whole-site or all-tags claim requires an actual reviewed inventory and completed checks; a sampled suite cannot establish it. Report unsupported or unconfigured tools explicitly.

| Tool/check | Bundled evidence | Additional evidence |
| --- | --- | --- |
| GTM | Observed container loader and configured request checks | Export/preview review to trace which tags and triggers ran; container loading alone does not prove its tags fired |
| GA4, Meta, Google Ads | Existing event decoders, destination/count/action checks and duplicate-emission analysis | Vendor receipt, final processing, attribution and server forwarding need separate access |
| TikTok, Snapchat and other tools | Recognized-script inventory where supported; configured request checks independent of vendor | Payload/event meaning must be inspected through host browser/tools when no decoder exists; platform receipt is separate |

## Configure other tracking requests

Use `expectedTagRequests` at the site, page, navigation-step or supported form-journey level. Discover the actual collector and event signal from browser evidence; do not invent vendor endpoints or assume a loader is an event. This fictional example shows the format, not a vendor integration:

```json
{
  "expectedTagRequests": [
    {"id": "other-tool-pageview", "host": "collector.example", "path": "/collect", "method": "GET", "query": {"event": "page_view"}, "resourceTypes": ["fetch"], "count": 1}
  ]
}
```

Configure an exact lowercase host (including port when relevant), either exact `path` or explicit `pathPrefix`, and `count` or `min`/`max`. Optional conditions: method, exact query values, resource types, device, consent states and action ID. IDs are unique nonpersonal check labels; up to 100 combined rules per visit. Prefer a narrow path/event match; a broad endpoint count can include unrelated events. Query values are compared in memory and never copied to the report; keep profiles private and do not match secret credentials.

Step rules are automatically scoped to that step's action. Successful submission-journey rules must specify the actual submit action ID when an action-specific count is needed. Consent-conditioned rules count requests in the observed consent phase; clicked controls do not certify the consent manager's policy. Treat an unverified phase as untested. Define zero-request rules only where site policy requires zero; do not assume consent always forbids all network requests.

`resourceTypes:["script"]` can check a loader request, but cannot establish event firing. Other request rules count raw request attempts, not decoded or deduplicated logical events. They do not parse JSON/binary bodies or prove that a vendor counted the event. Use the existing decoded-event contracts for GA4/Meta/Ads semantics; use host inspection or a tested new adapter for other payloads. Matching query signals narrows a request check but does not validate all payload properties.

Reports distinguish verified browser request checks, failed counts/HTTP errors, incomplete capture, untested conditions and inapplicable rules. Missing responses or capture gaps never verify delivery. Changing a matcher, action or expected count changes the original repair-verification scope. Rerun the same checks and related regressions after a fix.

A matching rule grants no network or write permissions. Existing write guards may block an unfamiliar POST collector during navigation/invalid-input checks; report that interference as inconclusive and use an authorized test environment or host browser workflow. Do not allow business writes merely because a rule labels an endpoint as tracking. Script loading, request dispatch, backend acceptance and final platform processing remain separate checkpoints.
