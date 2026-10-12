# Description review — plain-language revision

Reviewed 2026-10-12 with Product Language Fit. Audience: a marketer or website owner asking an AI agent to find and improve a website problem, without needing browser/protocol knowledge. Preserve the approved check → investigate → retest workflow. Scope: package/plugin utility description, skill trigger, agent list/prompt and actual README opening/support. This is editorial review grounded in shipped behavior, not customer comprehension or market validation.

## Previous wording and corrected assessment

Previous package/plugin description: **Check forms and tracking in a real browser. Flag QA conversion emissions, probe agent access and retest fixes against the original checks.**

The user reported that this felt very technical. The previous review assessed implementation accuracy but was too generous about reader comprehension and voice. For this intended reader, “QA conversion emissions” and “probe agent access” require decoding. Reject this version at Two-second; continue all remaining tests for diagnosis. Do not carry previous Pass judgments forward or treat the utility role as an exemption from clarity.

| Test | Status | Concrete reason and basis |
| --- | --- | --- |
| Pointing | Pass | Named form, tracking, emission and repair checks exist in the runner. |
| Visual | Pass | A website form tested in a browser and a fix checked again are pictureable, although traffic terminology is obscure. |
| Falsifiable | Pass | Configured event findings and unchanged-test verification are demonstrable and refutable. |
| Ownable | Pass | Limited utility role; no exclusive capability or competitive superiority is claimed. |
| Two-second | Fail | The intended reader must translate “QA conversion emissions” and “probe agent access” before understanding what to do with the result. User feedback corroborates technical density; no timed study claimed. |
| Promise | Pass | The basic offer is website checks plus repair verification. |
| Delivery | Pass | The existing README explains those implemented functions and supplies commands, though its explanations are also technical. |
| Evidence | Pass | Implementation claims match the sources and validation recorded below; this does not establish readability. |
| Competitor | Pass | Utility description makes no claim that other tools lack these functions. |
| Voice | Fail | Protocol vocabulary contradicts this user's request for a description centered on someone using the data to make improvements. |
| Action | Pass | README installation commands and example tasks identify a next step. |
| Read-aloud | Pass | Parallel verbs have a workable spoken rhythm; unfamiliar nouns are a separate clarity/voice defect. Written review only. |

## Exact revised surfaces

Package/plugin description: **Find broken forms and tracking mistakes. Help your agent investigate what went wrong and check each fix against the original test.**

Skill description: **Find broken website forms and tracking mistakes, help your agent investigate what went wrong and check each fix against the original test. Use when forms fail, tracking is missing or repeated, test visits affect reports, or an automated assistant cannot reach a form. Also use for consent checks, human/bot/agent traffic review, recurring website checks, updates and setup feedback. Distinguish what the browser showed from confirmed leads, sales and agent identity; further proof needs access to the relevant systems.**

Agent list label: **Find broken forms and tracking mistakes**

Default prompt: **Use $signalcheck to check my website’s most important form, investigate any problems with the tools I have connected and check fixes against the same test.**

README opening (retained): **Check the form. Investigate the failure. Retest the fix.**

The revised README begins: **SignalCheck helps your AI agent find broken forms and tracking mistakes on your website. Start with something a customer should be able to do: request a quote, join your email list or submit a contact form. Decide what should happen, then check what actually happens.**

Actual support explains that a failed check gives the agent evidence to investigate, connected tools can prepare a fix, and changing or skipping the original test does not verify a repair. Traffic support describes investigating test visits affecting reports and automated assistants reaching a chosen form. It attributes human/bot/agent review to system evidence and retains unknowns. Plain-language limits separate browser tests from received leads, counted sales and confirmed agent identity. Installation and example tasks remain on the same README surface. Technical commands and evidence details remain available below that introduction and in references.

## Clarification and claim evidence

Compare wording within the approved idea: “trust your website's results” implies broader accuracy than the package verifies; “fix broken forms automatically” implies bundled integrations and authority; “find broken forms and tracking mistakes, investigate and check each fix against the original test” matches the available workflow. Select the third clarification. No strategic repositioning, invented outcome promise or market-wide distinction is introduced.

| Material claim | Evidence and scope | Publication treatment |
| --- | --- | --- |
| Find broken forms and tracking mistakes | `bin/run.mjs`, form and event contracts; real Chromium fixtures detect unavailable/invalid forms and unwanted conversion emission | Configured checks, not every website failure or final vendor reporting accuracy |
| Help an agent investigate | Actual findings, private action ledger and `references/agent-workflow.md` | Host supplies tools and source access; no guaranteed diagnosis or autonomous fix |
| Check a fix against the original test | `verifyAction`, scope/signature and regression checks; fresh local-fixture repair tests | Browser evidence; changed/skipped checks block certification; received leads and counted sales need separate evidence |
| Review human/bot/agent traffic | `analyzeTrafficExport` and traffic guidance | Supplied source assertions, unknowns retained; no universal identity detector or implied customer intent |
| Investigate test visits and agent access | Synthetic-emission contracts, storage marker, access probes and imported access/counting findings | Site integration or system evidence needed; agent identity and actual platform counting separately confirmed |

## Canonical 12-test gate — revised copy

Rerun all 12 on the exact revised descriptions in the actual README and skill context. Labels remain utility components; no standalone headline or unique-positioning certification is implied.

| Test | Status | Concrete reason and review basis |
| --- | --- | --- |
| Pointing | Pass | Broken forms, tracking mistakes, investigation evidence and original-test verification map directly to the named mechanisms and fixtures above. |
| Visual | Pass | The reader can picture a customer trying a quote form, an agent investigating its failed check and running the same check after a repair. These examples appear in the README. |
| Falsifiable | Pass | A configured failed form/event check must produce evidence, and a skipped/changed test must not certify a repair. Tests can refute those exact claims. |
| Ownable | Pass | Utility role: describes this implemented mechanism without claiming that credible alternatives cannot supply it. Ownership of a market-wide proposition is not asserted. |
| Two-second | Pass | Editorial inference: find a broken form or tracking mistake, investigate it and check the fix with the original test. No protocol terms are needed to paraphrase the package/list copy. No timed customer test. |
| Promise | Pass | Offers a concrete problem-finding and repair-checking task for a website owner; no guaranteed revenue recovery, complete detection or autonomous maintenance. |
| Delivery | Pass | README support develops each verb with a selected form, expected behavior, evidence for investigation and an unchanged repair check. Limits describe the same workflow rather than changing its subject. |
| Evidence | Pass | Each remaining functional claim is tied to inspected code, existing tests and explicit host/evidence boundaries. No improvement in actual leads, revenue or reporting accuracy is asserted. |
| Competitor | Pass | Necessary utility language stays in a descriptive role. A manual browser/log review is a practical alternative, but no superiority or exclusivity claim is made; unknown competitor capabilities remain unknown. |
| Voice | Pass | Editorial judgment informed by the user's technical-density feedback: “broken forms”, “what went wrong”, “fix” and “same test” describe work in familiar language. No invented customer quotation or measured comprehension. |
| Action | Pass | The list prompt names a chosen form and available tools; README installation and example tasks give a proportionate next step. The user need not understand emissions or access probes to start. |
| Read-aloud | Pass | Written spoken-flow review: two short package sentences, a concrete problem first and one sequence of investigation/checking second. No stacked protocol nouns or acronym sequence. No audio review claimed. |

Adversarial editorial review: “help” does not imply an agent has source access or authority; nearby README support explicitly attributes both to the AI app. “Each fix” describes the same-test verification rule, not a guarantee that all repairs succeed. “Find” is scoped by configured behavior in the actual setup instructions and is not an exhaustive-audit claim. The traffic paragraph withholds confirmed identity/counting until source evidence exists. The short description is a plain utility description, not a claim of proven demand or unique positioning.

## Validation and continuing rule

Functional evidence comes from the unchanged 0.4.0 implementation: 105 automated checks and 19 real Chromium fixture visits passed in GitHub CI. Source run: https://github.com/russpage/signalcheck/actions/runs/38024143271. This revision changes descriptions, README support and contribution guidance only. Validate skill metadata and packaged installation before publishing; do not repeat browser tests solely to substantiate a wording change.

Future user-facing descriptions must lead with the problem, a useful action and an observable result. Keep implementation detail in technical references and state necessary limits plainly. Run all 12 in the intended reader's context; utility accuracy does not excuse failures of Two-second or Voice.
