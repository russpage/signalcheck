# Description review — tags and events, 0.5.0

Reviewed 2026-10-12 with Product Language Fit. Audience: a website owner or marketer using an AI agent to check tracking. The user clarified that SignalCheck must describe tags firing, events, GA4, Meta, GTM, TikTok, Snapchat and other tools. Forms remain one source of actions. This replaces the narrowed form-first description while retaining plain language, evidence boundaries and the original-test repair workflow. Assessment is editorial/model review grounded in implementation, not customer comprehension or market validation.

## Exact surfaces

Package/plugin description: **Check your website’s tags and events: GTM, GA4, Meta, Google Ads, TikTok, Snapchat and other tools. Find tracking problems, investigate them and check fixes.**

README opening: **Check your tags. Find the problem. Check the fix.**

README introduction: **SignalCheck helps your AI agent check your website’s tags and events: GTM, GA4, Meta, Google Ads, TikTok, Snapchat and other tracking tools. Check whether tracking fires for the right actions, goes to the intended destination, or fires more often than expected.**

Skill description: **Check website tags and events across GTM, GA4, Meta, Google Ads, TikTok, Snapchat and other tracking tools. Use to investigate tags that do not fire, missing or repeated events, wrong destinations, consent behavior and tracking changes. Discover the installed tools and ask which others should be included; help investigate and check fixes against the original tests. Also cover forms, test traffic, human/bot/agent evidence, recurring checks and update feedback. Separate installed scripts, browser requests, decoded events and confirmed platform receipt; report untested tools and stages.**

Agent list label: **Check your website’s tags and events**

Default prompt: **Use $signalcheck to discover my website’s tracking tools, ask what else should be checked, test tags and events for the actions I care about, investigate failures and check fixes against the original tests.**

Actual README support covers page/product views, button clicks and form submissions; discovery and questions about other tools; evidence for investigation; fixes checked against the same tests; and plain-language receipt limits. Its tracking coverage table distinguishes GTM/container loading, decoded GA4/Meta/Google Ads events, and configured requests for TikTok/Snapchat/other tools. It explicitly states that other tools do not have universal payload decoding or final-receipt proof. Installation and task prompts supply the next action. Package/list descriptions are utility descriptions, not unique market-positioning claims.

## Brief, direction comparison and selection

Required coverage: tags and events lead; requested tools are named; other tools are discovered and reviewed with the user; forms are a supporting case; investigation and original-test checking remain part of the improvement workflow. Keep implementation vocabulary in references and preserve the shipped limits on platform receipt.

| Direction | Reader takeaway | Supporting product truth | Coverage and weakest point |
| --- | --- | --- | --- |
| Tag inventory | See which tools are installed | Script/container discovery | Omits runtime firing and repair checks |
| Tags and events firing | Check when tracking runs and what is observed | Decoded event rules plus configured generic requests | Requires explicit per-tool evidence boundaries |
| Accurate reports | Trust every reported lead/sale | Separate receipt checks can be host-guided | Unsupported as a broad guarantee; reject |
| Agent-guided repair | Investigate a failed check and test the repair | Private action ledger and original-scope verifier | Already supported but alone omits requested tool scope |
| Co-created tool coverage | Decide which tools/actions should be included | Discovery-first setup and saved expectations | Important setup behavior but insufficient as the main functional description |

Select tags/events firing as the descriptive lead, use the requested tool names for concrete scope, and retain investigation/repair checks as support. Unlike the form-first baseline, the actual wording names the tracking stack and the actions being measured. Unlike the technical 0.4.0 variant, it avoids emissions/probes/contract terminology. “Other tools” is supported by reviewed generic request contracts and host inspection, not an assertion of unlimited native decoders. No revenue, complete reporting accuracy or exclusive capability claim is made.

## Claim-evidence record

| Claim | Source and scope | Publication treatment |
| --- | --- | --- |
| Check tags/events in GTM, GA4, Meta and Google Ads | Container inventory, existing decoders, destination/action/count checks, `bin/run.mjs` and parser fixtures | GTM loading is separate from its tags firing; browser observations separate from final counting |
| TikTok, Snapchat and other tools | Recognized script discovery plus `lib/tag-requests.mjs`, configured collectors and host guidance | Generic request checks, manual payload review where needed; no bundled universal event decoder |
| Missing/repeated firing | Decoded logical-event rules and raw configured-request counts | Request counts and decoded event counts are distinct; neither establishes final duplicate conversion credit |
| Other-tool setup questions | `references/onboarding.md`, `references/tags-and-events.md`, SKILL.md | Discover first, ask for intended stack/missing tools, retain previous answers; no promised delight or adoption result |
| Investigate and check fixes | Source/tool guidance, private action ledger and unchanged-scope verifier | Tools/access supplied by host, applied repairs checked against original tests; no automatic production change authority |
| Privacy and capture limits | Generic matcher emits sanitized endpoints/counts and opaque matcher signatures; incomplete/missing responses are inconclusive | No raw query values or payloads retained; a tracking matcher grants no write permission |

## Canonical 12-test gate

Run on exact surfaces above in their actual README/skill context. These are descriptive utility components; no 12/12 market-positioning certification is claimed.

| Test | Status | Concrete reason and review basis |
| --- | --- | --- |
| Pointing | Pass | Tags, events and named tools point to container/script discovery, the three native decoders, generic request rules and original-test verification. Coverage table supplies the limits for each tool. |
| Visual | Pass | The reader can picture opening a page or clicking a button and checking whether the relevant tag fired. Page/product views and button/form actions are visible in the support. |
| Falsifiable | Pass | Configured firing counts and destinations can be refuted by observed requests/events; changing or omitting a check must block repair verification. Tool-specific checkpoints are stated. |
| Ownable | Pass | Utility role: describes this implementation without asserting that competitors cannot match it. No unique-positioning claim is being approved. |
| Two-second | Pass | Editorial inference: check website tags/events across the named tools, find tracking problems, investigate and test the fix. The user supplied these tool names and tracking terms; no unfamiliar emissions/probe wording is required. No timed study. |
| Promise | Pass | The main offer covers the user's requested tracking stack and events; forms no longer narrow the scope. Investigation and fix checking remain concrete next work. |
| Delivery | Pass | README support names tracked actions, tool discovery, intended data destinations and original-test checks. Its coverage table explains what each named tool can actually have checked. |
| Evidence | Pass | Claims match the sources above; TikTok/Snapchat/other-tool support is qualified as request matching and further payload review. No implication of universal event decoding, actual revenue improvement or final platform receipt. |
| Competitor | Pass | Category names identify necessary utility scope. Manual browser/network inspection is a relevant alternative; no superiority or market-wide exclusivity is asserted or inferred from unresearched alternatives. |
| Voice | Pass | Editorial judgment using direct user language: “tags firing”, “events”, “Meta”, “GA4”, “GTM”, “tiktok”, “snap” and “other tools”. Full Snapchat name clarifies the shorthand. Technical details are in references and the coverage table. |
| Action | Pass | Default prompt starts with tool discovery and asks what else should be checked; README supplies installation and configured-run commands. Users decide their tools and intended actions while the agent handles mechanics. |
| Read-aloud | Pass | Written spoken-flow review: the first package sentence introduces a tool list, the second gives three short actions. README opening has three short clauses; no stacked protocol terminology. No audio/user read-aloud claimed. |

Adversarial editorial review: “other tools” could be mistaken for unlimited native integrations, so actual README support states configured request counts, unimplemented payload decoding and separate receipt. GTM is treated as the manager/container, not a destination that counted an event. Repeated raw requests are not promoted to proof of repeated conversions. “Check fixes” retains original checks, adequate capture and recorded regressions. “All tags” is deliberately not claimed without a reviewed inventory and completed coverage; unknown tools/checks remain visible. The description does not grant publishing or business-write authority.

## Validation

Local: 12 installer tests and 102 runner tests passed; skill metadata and all three example profiles validated; complete package installed on all four native paths. The browser fixture now includes a generic SDK loader, page/action requests, missing collector and HTTP failure. GitHub CI passed all 114 automated checks and both real Chromium fixtures (19 visits), including generic SDK/action/request counts, missing/error endpoints, unchanged repair verification and traffic boundaries. The synthetic collector fixture was corrected to return an explicit JSON response after the browser reported request failure with its original response; no expected firing counts or failure checks were weakened. Independent sandbox skill execution preserved incomplete capture, distinct loader/request/receipt checkpoints and unidentified tools while describing setup for the full stack. CI: https://github.com/russpage/signalcheck/actions/runs/38310351117; job 115014258098. This is not a live TikTok/Snapchat/vendor integration test.

Future descriptions must preserve tags/events as the primary remit, requested tool coverage, discover-first questions about other tools, and clear per-tool evidence limits. Run all 12 again after wording or context changes.
