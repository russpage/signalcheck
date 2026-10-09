# Evidence and reporting

Lead with confirmed business-impacting failures, then probable failures and coverage gaps. A green workflow means the software/job completed unless the site contract explicitly defines a quality gate. Always state what actually ran.

## Two separate statuses

The bundled JSON report records execution states such as visit `completed`, `partial` or `failed`, and skipped journeys `untested`. These describe whether the observer ran. A completed visit can contain a website failure; a failed observer cannot establish that the website failed.

Use these outcomes for each contract in assistant reports or future contract-result schemas:

| Outcome | Meaning | Example |
| --- | --- | --- |
| Verified | The check ran in scope and adequate evidence satisfied its assertion | One configured lead emission observed after an approved successful submit |
| Failed | Adequate evidence contradicted the assertion | Required embedded form displays an unavailable-provider error |
| Inconclusive | Attempted, but evidence/conditions cannot resolve the assertion | Browser collector request failed under an environment network restriction |
| Untested | Applicable check was not executed | Valid submission disabled because QA routing is unset |
| Unsupported | Current tool/runner cannot evaluate it | Server-only receipt without an observer; bundled purchase journey |

Do not turn “no finding” into verified unless an applicable assertion actually ran with adequate capture. Unknown vendor traffic is unsupported parsing, not proof that it sent no event.

## Finding contents

Each actionable finding should include:

- Stable code/contract ID and affected URL, route/template, frame, device, browser and consent scope.
- Expected behavior, observed behavior, action sequence and UTC timestamps.
- Sanitized evidence: request/event IDs or local artifact references, relevant response/error, control state and masked screenshot when useful.
- Impact/severity and recurrence: new, persisting, resolved or scope-changed.
- **Observation confidence** and **cause confidence** separately. Confirmed duplicate emission can have an uncertain source.
- Specific repair or investigation, owner if known, and the next test that distinguishes competing causes.
- Last independently verified delivery checkpoint and remaining unsupported/untested stages.

The current runner includes codes, severities, evidence, suggestions and a single confidence field; do not imply it already emits every richer field above. Assistant review may add the separate confidence/cause discussion without changing raw evidence.

Use ordinal confidence unless calibrated probabilities exist. “High confidence: same logical ID emitted twice in one action window” is better than an invented 97%. Time-only duplicate candidates are suspected. A repeated SDK installer is an installation overlap; it does not by itself prove duplicate events.

## Suggested fix example

> Failed: configured contact form is unavailable on desktop and mobile. The embedded provider displays its unavailable-form message. Observation confidence: high. Cause confidence: low; disabled/deleted form or embed configuration needs provider access. Restore the provider form or replace the embed, then rerun availability and approved submission tests. Backend delivery remains untested.

Do not prescribe deleting a GTM tag solely because two requests appear. First compare destination, event name, logical ID, action window, consent state and transport; inspect the responsible trigger/install only when source or container access supports that conclusion.

## Scope and denominators

Report the site/config version and planned versus completed visits, tested versus skipped journeys, contract outcomes, parser coverage, browser/device matrix, consent states, and capture limitations. State whether URLs were exhaustive, template-sampled or supplied explicitly. A route visited is not a form delivered. A parsed request is not an event counted.

Record effective observation boundaries: initial page load vs post-consent vs action window, main document/iframe/worker, delayed receipt budget and enabled backend observers. Region, authentication, CAPTCHA, sandbox and browser restrictions belong in coverage whenever they affect a result.

Compare runs only when URL, journey, device, consent state and expectation signature are equivalent and execution completed. A changed contract needs review; a missing or failed visit cannot resolve yesterday's finding. Preserve incomplete checkpoints and show scan staleness if a daily run did not finish.

## Minimal daily report

1. Run time and coverage; whether the scan completed and whether submissions/backend receipt were included.
2. Highest-impact confirmed failures with evidence and a concrete next action.
3. Suspected duplicates/misfires with alternative explanations and next discriminating test.
4. New, persisting and resolved findings under comparable scope.
5. Untested, inconclusive and unsupported checks; access/configuration needed to close the gaps.

Keep reports private when they contain site infrastructure details or synthetic identities. Publish only sanitized examples. Avoid raw HARs, private GTM exports, access tokens, unmasked screenshots or customer data in a public repository.
