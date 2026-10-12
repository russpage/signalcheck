# Description review — audit modules, 0.6.0

Reviewed 2026-10-12 with Product Language Fit for every new feature release, as requested by the user. Audience: website owners and marketers using an AI agent to check tags/events and decide what to fix. Role: descriptive utility copy and setup instructions, not exclusive market positioning. This is an editorial/model assessment; customer comprehension and market response remain untested.

## Exact 0.6.0 surfaces

Package/plugin: **Check your website’s tags and events: GTM, GA4, Meta, Google Ads, TikTok, Snapchat and other tools. See what needs fixing and review changes on your schedule.**

Skill frontmatter: **Check website tags and events across GTM, GA4, Meta, Google Ads, TikTok, Snapchat and other tools. Find missing or repeated events, wrong destinations and incomplete shopping data. Guide audits of consent, campaign tracking, server events, offline conversions and attribution using available evidence. Show what to fix, what needs investigation and what remains untested. Discover the intended tools and customer actions, check fixes against the original tests, and help set a recurring review at the user's chosen time. Also cover forms and human, bot, agent and test traffic.**

Agent label retained: **Check your website’s tags and events**

Default prompt: **Use $signalcheck to check my website’s tags and events, show what to fix and what remains untested, check repairs against the original tests, and help set reviews at my chosen time.**

README opener retained: **Check your tags. Find the problem. Check the fix.** Its first paragraph retains the 0.5.0 wording below. New section labels: **Choose the audits that matter** and **Review changes on your schedule**. Their actual support names all fifteen guided workflows, says the agent chooses checks around the customer's action, describes the dashboard/owner/retest and explicitly identifies platform/server access, imported assertions, ecommerce shape limits and host scheduling/delivery dependencies. The commands, workflow references and scheduling reference supply the next action. Evaluate the section labels in that complete context, not as standalone promises of hosting or automatic platform access.

## Brief and wording comparison

Preserve the approved tags/events lead and requested platform names. Add the user's new audit and scheduling scope in support; keep protocol and access mechanics in references. Compare narrow wording variants rather than reopen settled positioning: the previous “Find tracking problems, investigate them and check fixes” accurately describes repairs but omits the new recurring dashboard; “Audit every platform automatically” asserts unsupported access and is rejected at Falsifiable/Evidence; the selected “See what needs fixing and review changes on your schedule” describes the action queue and host-guided recurrence with their limits supplied in the README. No guarantee of complete accuracy, recovered revenue or uniqueness is made.

## Claim-evidence record

| Material claim | Source and scope | Publication treatment |
| --- | --- | --- |
| Tags/events across named tools | Existing discovery, three native decoders, configured generic request rules, host inspection | Retain tool-specific browser/receipt limits and other-tool discovery questions |
| Fifteen guided audits | `references/audit-modules.md`, fifteen named workflows with required inputs/workflow/rubric/output/decision rules/guardrails, shared owner/evidence/retest contract | Guided workflows, not fifteen bundled platform integrations |
| What to fix and untested stages | Existing browser action queue; new `lib/audits.mjs`, `bin/audits.mjs` and report coverage/next-action tables | Imported evidence remains host-supplied assertions; missing evidence downgrades no-mismatch to inconclusive; no health percentage or verified-fixed import |
| Incomplete shopping data | `expectedCommerce`, `lib/commerce.mjs`, runtime shape summaries and configured field checks | DataLayer shape only; no catalog correctness, universal parameter schema, sale counting or purchase execution |
| Reviews at chosen time | `references/scheduling.md`, onboarding/controller host scheduling instructions and actual prior schedule creation in this conversation | Host supplies scheduler, execution and destination; schedule creation is distinct from verified unattended capture |
| Check repairs | Original-contract signature and action verifier include commerce requirements/capture limits | Never close repairs from review imports, altered checks or incomplete capture |
| Traffic | Existing traffic module and host source-evidence guidance | Identity, intent, business outcome and production counting stay separate; no fabricated bot probabilities |

## Canonical twelve tests on README sections, controller/body and label/prompt context

| Test | Status | Concrete reason and review basis |
| --- | --- | --- |
| Pointing | Pass | Named tools point to actual discovery/adapters. Shopping data points to configured commerce shape checks. Audit/dashboard/scheduling support points to implemented compiler and explicit host workflow. |
| Visual | Pass | “Tags and events,” “what needs fixing,” and “chosen time” let the intended reader picture checking a site, reading the fix queue and selecting the review time. “Incomplete shopping data” is made concrete by item/value/currency fields in README support. |
| Falsifiable | Pass | Inventory, checks, module coverage, owner/next-action fields and a real scheduler result can confirm/refute the utility claims. Missing capture/receipt cannot be treated as success. |
| Ownable | Pass | Limited utility role: describes SignalCheck's shipped mechanisms without claiming that alternatives cannot offer them. No exclusive positioning claim is approved. |
| Two-second | Pass | Editorial first-exposure inference: check tags/events, see the problems, review on a chosen schedule. Tool names preserve the user's vocabulary. The longer skill metadata supplies triggers after that direct lead; technical verification details stay in references. No timed customer test is claimed. |
| Promise | Pass | The offer connects the actual tracking problem to an actionable fix list and repeat review. The user controls which customer action matters and the review time; “guide audits” limits the extended promise to evidence available to the agent. |
| Delivery | Pass | Actual README support explains selected workflows, dashboard outputs, private commands, commerce limits and scheduler responsibility. SKILL.md routes each task to the appropriate reference. No topic change or hidden automatic-access promise is required to understand the offer. |
| Evidence | Pass | Claims map to the record above. Platform/server/iOS reviews are host-guided and access-dependent; imported assertions and shape checks do not establish receipt/counting. No causal revenue, recovered signal, measured delight or fully autonomous service claim is present. |
| Competitor | Pass | Tool/platform words are necessary category utility. Manual network inspection and platform dashboards are credible alternatives; no superiority, unique breadth or unresearched absence of competitors is asserted. |
| Voice | Pass | Editorial diction follows the user's requests: tags, events, what to fix, customer actions and choosing the time. New public text avoids a fifteen-item technical menu as the setup requirement. Technical module titles remain in the relevant reference/catalog. |
| Action | Pass | Default prompt asks for checks, gaps, unchanged repair tests and chosen reviews. README supplies installation plus audit commands; setup elicits only business intent/time/access decisions that discovery cannot establish. |
| Read-aloud | Pass | Written spoken-flow review: package copy has a concrete tool list followed by one short result/schedule sentence. Skill metadata uses separate sentences instead of one stacked clause. Section labels read as direct instructions. No audio or customer reading is claimed. |

Adversarial review: “on your schedule” could imply a built-in timer, so README/support explicitly assigns execution and delivery to the host. “Fifteen audits” could imply automatic connector access, so the actual text says guided workflows and review compiler. “Incomplete shopping data” is limited to documented shape checks; no purchase, catalog or backend observer is implied. The dashboard shows gaps beside issues and never upgrades imported conclusions to verified fixes. This gate is editorial, not proof of Product Language Fit in the market.

## Standalone metadata components

The separate cold editorial review agrees with the supported utility scope. Package/plugin text and a label shown without its prompt remain working components, not complete communication units. Preserve the actual README/skill support. Do not call these components 12/12 or market-validated.

| Test | Package/plugin standalone status | Concrete reason |
| --- | --- | --- |
| Pointing | Pass | Tags, events, fix queue and review time point to documented behaviors. |
| Visual | Pass | The reader pictures checking tracking and reading problems on a schedule. |
| Falsifiable | Pass | Discovery, outputs and host scheduling can be inspected at their stated scope. |
| Ownable | Pass | Utility description makes no exclusive claim. |
| Two-second | Pass | The first sentence names the website checking task and familiar tools; editorial inference only. |
| Promise | Pass | Offers a tracking check and chosen review time relevant to the user's task. |
| Delivery | Not yet testable | A standalone metadata listing supplies no surrounding explanation of how the host performs the work. README support cannot silently be inherited on an unseen listing. |
| Evidence | Pass | The implementation supports checking and host-guided recurrence; no universal decoder or already-running service is asserted. |
| Competitor | Pass | Shared descriptive category terms serve a utility role, not superiority. |
| Voice | Pass | Direct wording follows the user's tracking vocabulary. |
| Action | Not yet testable | A standalone listing supplies no invocation/install control; its actual presentation must provide that context. |
| Read-aloud | Pass | Written spoken-flow review finds a concrete list and short parallel task clauses. |

A label shown alone similarly leaves Delivery/Action unresolved; the label-plus-default-prompt unit above supplies both. These are context limits, not hidden evidence of customer response.

## Validation for 0.6.0

Local validation passed 12 installer tests and 112 runner tests. All three real Chromium fixtures passed: the existing 10-visit tracking/repair fixture, 9-visit traffic fixture and new 4-visit commerce fixture. The full package installed on all four native skill paths; metadata, examples, reference links and all fifteen six-part module contracts validated. A fresh agent used supplied shop evidence and the current compiler, preserved unknown platform/iOS stages and unchanged expectations, and caught review-only browser/history wording; that wording was corrected and the same task rerun successfully. A separate Product Language Fit review found no material factual overclaims in the complete utility context. Its standalone component limits are recorded below. GitHub CI will be checked before merging. Browser fixtures use local synthetic sites; they are not live vendor, server, iOS or account integration tests. Successful package installation is separate from platform access and scheduled execution.

---

# Previous description review — tags and events, 0.5.0

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
