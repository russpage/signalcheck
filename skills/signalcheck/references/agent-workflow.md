# Turn evidence into a verified improvement

The installed skill guides the current host agent. The runner creates a machine-readable private action ledger and a redacted human handoff. Connected tool execution is performed by the host under its existing rules. This release does not include a standalone autonomous service, an MCP server or authenticated GTM/Shopify/CRM connectors.

## Discover actual capabilities

Inspect the host's available tools, schemas and applicable connector instructions. Verify read access to the exact site, repository, container/workspace or provider account. Record only observed tools and operations in a private capability file. Avoid treating a successful read as permission to write or publish.

Capability entries contain `id` (`browser`, `site_profile`, `source`, `tag_manager`, `form_provider` or `backend`), `tool` (the actual discovered callable), `resource` (the scoped resource), `verified` (whether access was tested) and `operations` (`read`, `prepare`, `apply`, `publish`, `receipt`). An empty list is a valid setup and means missing access, not a broken installation. The tool list is data for the host; the CLI never executes names or commands from it.

| Tool access | Useful action | Evidence required |
| --- | --- | --- |
| Source/repository read and patch tools | Trace code and prepare a PR | Match source path/version to the observed site; preserve business intent |
| GTM/container read and workspace tools | Trace tag/trigger and draft a workspace change | Confirm container/workspace, trigger conditions and intended destinations |
| Website/form-provider tools | Inspect unavailable form and draft an embed/provider repair | Verify correct form/account and production versus test routing |
| Analytics/CRM/server read tools | Verify persisted/processed outcomes | Correlate the approved test action with the correct record and timestamp |
| Browser runner | Retest the original action and related conditions | Same contract signature, complete capture and fresh post-change run |

Generic tool IDs in a template are not evidence that these tools exist. Probe reads only on resources in scope. Use discovery results to choose a path; report missing access without inventing a provider API, requesting unrelated integrations or falling back against host rules.

## Modes and authority

- `investigate`: collect evidence and trace the cause. Do not prepare or apply changes.
- `prepare-fixes`: produce a reviewable patch, PR or workspace draft. Use existing authorization for such preparation; production publishing remains separate.
- `maintain`: execute changes only inside a recorded policy specifying resources, permitted operations, publishing boundaries, rollback conditions and verification tests. The string `maintain` grants no authority by itself.

Follow explicit user instructions and host rules. Ask only when an operation requires authorization not already given. Publishing to a website or tag container and creating leads/orders are different actions from creating a code draft. Sending messages or creating notifications needs its own authorization. Never auto-delete an unfamiliar tag to reduce request counts.

## Generate and continue the action ledger

Run paths below from `scripts/browser-qa/` in the installed skill. Keep files in a private user project.

```sh
node bin/report.mjs /absolute/path/qa/current/report.json
node bin/actions.mjs plan /absolute/path/qa/current/report.json --output /absolute/path/qa/actions.json --mode prepare-fixes --capabilities /absolute/path/qa/capabilities.json
```

`report.mjs` automatically creates a fresh `action-plan.json` and `action-plan.md` alongside its scan report. These are scan-specific starting points. Use a separate persistent ledger for tracked work and add `--previous /absolute/path/qa/actions.json` to later `plan` calls. Never overwrite the persistent ledger with the report generator's fresh plan.

Each action records the observation, stable ID, original contract/scope, related device/consent scopes, missing read access, cause confidence, proposed investigation and retest criteria. Coverage gaps require improved observation/configuration and a new baseline before a website fix. Read needs are investigation hints, not proof every listed integration is necessary; a verified source can sometimes settle the cause without GTM access.

## Investigate, prepare, apply

Separate observed failure from inferred cause. Test alternative explanations: intended extra destinations, consent updates, blocking, runner effects, provider downtime and different business actions. Inspect the actual code/trigger before presenting a specific edit as the fix. If access is missing, keep the investigation blocked and explain the next useful read.

Use `record PLAN --id ACTION --record RECORD_JSON` after real work. A record has a `stage`, ISO timestamp `at` and private `evidenceRef`. It is a statement of completed work, not a command to perform it. Examples below omit actual identities and resource URLs.

```json
{"stage":"investigated","at":"2026-10-09T18:00:00Z","evidenceRef":"review:source-at-commit","cause":"Two independently installed handlers emit the same configured event after the accepted action.","causeConfidence":"high"}
```

```json
{"stage":"prepared","at":"2026-10-09T18:05:00Z","evidenceRef":"review:patch","changeRef":"pr:reviewable-patch","rollback":"Revert the recorded source commit and rerun the original suite."}
```

```json
{"stage":"applied","at":"2026-10-09T18:10:00Z","evidenceRef":"deployment:confirmed-version","authorized":true,"authorizationRef":"policy:approved-site-and-operation"}
```

Use `blocked` with an evidence reference for a missing boundary. Do not claim `applied` for an unmerged PR or unpublished workspace. Confirm that the tested environment serves the changed version. Authorization records and application records are host-attested metadata; the CLI cannot authenticate them or verify deployment provenance independently.

## Retest and close

Run the original browser profile after deployment. Preserve the original contract; changing expected counts to match faulty behavior is not a fix. Retest related devices, consent states and journeys recorded in the baseline. Expand the related suite when the edit affects shared code/templates; this requires host review because the CLI only knows the recorded scopes.

```sh
node bin/run.mjs --config /absolute/path/qa/site.json --output /absolute/path/qa/retest
node bin/actions.mjs verify /absolute/path/qa/actions.json --id sc-ACTION --report /absolute/path/qa/retest/report.json
```

The verifier rejects an old/pre-change run, incomplete execution, changed or omitted contract/scope, inadequate capture, the original failure or new findings within recorded regression scopes. It returns a failing exit code if verification is blocked. New regressions after an applied change set `rollback-review`; assess evidence and follow the recorded rollback policy rather than automatically rolling back unrelated changes.

Close only as `verified-browser-scope`: the original observed failure is absent within the recorded adequate browser tests. It does not assert causal attribution, an exhaustive site audit, CRM receipt or final conversion counting. Keep downstream receipt `untested` until authorized backend tools supply correlated evidence; summarize that checkpoint separately. Coverage disappearance alone never closes an action.

## Recurring operation

The scheduled runner collects evidence without an LLM. A separately configured host-agent job can read the private artifact, load the persistent ledger, investigate newly actionable items and prepare authorized fixes. Tool credentials, host-agent scheduling, notification routing and publishing policy must be configured by that host; the bundled daily scan does not create them. Reuse scoped IDs to avoid duplicate work, preserve blocked items and surface stale/failed scans. Do not claim a repair agent is running merely because a browser schedule exists.
