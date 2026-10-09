# Description review — 0.3.0

Reviewed 2026-10-09 using Product Language Fit. Scope: accurate repository onboarding and utility descriptions for agent users. This is an editorial assessment of shipped behavior, not customer comprehension or market validation. No exclusivity or emotional outcome is asserted.

## Exact surfaces

README opening: **Check the form. Investigate the failure. Retest the fix.**

Package/plugin description: **Check website forms and tracking in a real browser. Give your agent a fix queue, tool guidance and retests against the original checks.**

Skill description: **Check website forms and tracking in a real browser; guide setup, investigate failures with available connected tools, prepare authorized repairs and retest unchanged contracts. Use for missing or duplicate events, broken forms, consent checks, daily QA, fix queues, update checks and setup feedback. Distinguish browser evidence from backend receipt; the host supplies execution, integrations and authority.**

Agent list label: **Check forms and tracking; investigate and retest fixes**

Default prompt: **Use $signalcheck to check my priority website journey in a real browser, investigate failures with available tools, prepare authorized fixes and retest the original contract.**

The actual README support explains the fix queue, host-supplied tools, browser-scope verification, incomplete/changed checks and unavailable backend connectors. Installation commands and a concrete first-journey prompt provide the next action. The skill and labels are utility/trigger components, not claims of market-wide differentiation.

## Direction selection

The approved direction is an agent-guided improvement workflow. Considered routes: forms/events inventory (existing scan truth, omits repair); fix queue (actual action ledger, needs access qualifications); tool integration (host workflow, risks implying bundled connectors); unchanged-contract retests (deterministic verifier, needs browser boundary); guided setup (priority action/co-created intent, no measured delight claim). Combine the fix queue with unchanged-contract verification; use the setup and update paths as supporting functionality. The plain-language baseline is: find an observed problem, investigate it using available tools and check the repair against the original test.

## Claims and evidence

| Claim | Source and scope | Publication treatment |
| --- | --- | --- |
| Real browser form/tracking checks | `bin/run.mjs`; real Chromium fixture | Bound by configured routes, contracts and supported parsers |
| Fix queue and handoff | `lib/action-plan.mjs`, `bin/actions.mjs`, `bin/report.mjs`; automated tests | Host-driven, private ledger; tool names do not create integrations |
| Available-tool investigation and authorized preparation | `SKILL.md`, `references/agent-workflow.md` | Workflow supplied; actual tool calls/access are host-dependent |
| Retest original checks | `verifyAction`; old run/changed scope/capture/regression tests; local browser repair fixture | Browser-scope verification, not causal proof or downstream receipt |
| Guided setup and feedback | `references/onboarding.md`, issue forms | Design instructions; delight, setup speed and adoption unmeasured |
| Main-change checks | `bin/updates.mjs`; mocked upstream tests | A one-shot checker; scheduler and delivery are separately configured |

## Canonical gate

Assessed exact descriptions and the opening within its actual README support. Standalone labels remain scoped utility components; no 12/12 marketing approval is claimed.

| Test | Status | Concrete reason and review basis |
| --- | --- | --- |
| Pointing | Pass | Forms/network capture, private actions and original-scope verification point to the named code and tests. |
| Visual | Pass | The reader can picture checking a form, investigating a failure and running its test again; support shows concrete commands and queue contents. |
| Falsifiable | Pass | Code/tests can refute the claims if no queue is emitted or changed/omitted checks verify; host and browser boundaries define scope. |
| Ownable | Pass | Utility role: describes this package's mechanisms accurately without claiming competitors lack them. Not approval of unique positioning. |
| Two-second | Pass | Editorial inference: the opening means check, investigate and retest a website failure. Actor and technical dependencies are explicit in support. No timed customer test. |
| Promise | Pass | Offers a check-and-repair workflow for the website journey the reader selects, without guaranteeing automatic production fixes. |
| Delivery | Pass | Actual README describes queue generation, connected host tools, reviewable changes and unchanged-contract retests, then supplies commands. |
| Evidence | Pass | Material implementation claims are tied to the sources above. Host execution and backend limitations prevent implied autonomous/receipt claims. Validation results are recorded separately after actual tests. |
| Competitor | Pass | Limited utility role: no superiority/uniqueness claim. A manual raw-report workflow is the relevant practical alternative; utility words are not presented as competitive exclusivity. No competitor capability claims made. |
| Voice | Pass | Editorial basis: uses the user's concrete vocabulary (forms, events, fixes, agent tools) and short action clauses, avoiding inflated AI/productivity promises. |
| Action | Pass | Installation commands and the priority-journey prompt give the next step; repairs and update integration name the required host and authorization. |
| Read-aloud | Pass | Written spoken-flow review: three short opening clauses share imperative rhythm; descriptions have one clear actor and no stacked superiority language. No audio/user reading claimed. |

Adversarial editorial review: reading “retest the fix” as universal repair success is bounded immediately by recorded browser contracts, regression scopes and unsupported backend receipt. “Tool guidance” does not claim bundled authenticated connectors. “Update check” does not imply a silent subscription or unattended update. Replacing the name with another tool would not create an unsupported uniqueness claim because these descriptions remain in a utility role.

## Continuing requirement

Run PLF again on each description revision, including changed surrounding support; do not carry these judgments forward automatically. Preserve canonical test order and statuses. If a future governing positioning claim asserts a competitive difference, research credible alternatives before approving it.
