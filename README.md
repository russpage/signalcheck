# SignalCheck

Check the form. Investigate the failure. Retest the fix.

SignalCheck is an open source skill and browser runner for checking website forms, analytics events, consent behavior and key customer actions. Install it in Claude Code, GitHub Copilot, Gemini CLI or OpenAI Codex. Start with the customer action you care about; your agent discovers the implementation and helps you define what should happen.

Each browser report includes a fix queue: the observed problem, evidence, source access needed, suggested investigation and retest criteria. Your agent can use its connected tools to investigate and prepare authorized code or configuration changes. The included verifier checks an applied repair against the original browser contract and recorded regression scopes; changed expectations, omitted checks and new failures block verification.

SignalCheck supplies the workflow and deterministic browser checks. Your host supplies tool access, credentials, execution, scheduling and any publishing authority. This package does not run an autonomous repair service or ship authenticated GTM/Shopify/CRM connectors. Browser verification does not prove downstream receipt.

Created by **Russ Page**. https://github.com/russpage

## Install

Clone the standalone repository, then run the installer from its root.

```sh
git clone https://github.com/russpage/signalcheck.git
cd signalcheck
```

```sh
node scripts/install.mjs --platform claude --scope user
node scripts/install.mjs --platform copilot --scope user
node scripts/install.mjs --platform gemini --scope user
node scripts/install.mjs --platform codex --scope user
```

Use `--platform all` to install all four, or `--scope project --project /path/to/project` to install in a project. Preview with `--dry-run`. Existing installations require explicit `--force`; the installer refuses symlink destinations and omits generated reports and dependencies.

Restart or reload your agent's skill discovery if required. Ask:

> Use signalcheck to audit https://example.com. Run a real browser, inventory all discovered forms and tags, test the configured journeys, and report verified failures, suspected duplicates, suggested fixes and coverage gaps. Set up daily monitoring after the profile and report route work.

Claude Code also exposes `/signalcheck`; Codex can explicitly invoke `$signalcheck`. See [platform support and official sources](docs/platforms.md) for exact installation locations, Gemini CLI support, Claude uploads, OpenAI plugin distribution and Microsoft Copilot limitations.

Installing a skill does not create a browser, network access, service credentials or a scheduled job. The host must provide a supported browser or a shell/CI runtime that can run the included Playwright engine. Microsoft 365 Copilot's restricted skill sandbox cannot directly run this live Node/Chromium scanner; offline report review and an external authorized execution service are separate paths.

## Start a scan

Requires Node 22+, Chromium and its OS dependencies. The installed skill is self-contained: its runner is `scripts/browser-qa/` inside the skill directory.

From this distribution:

```sh
npm run setup:runner
cd skills/signalcheck/scripts/browser-qa
npx playwright install chromium
```

Copy `config/example.json` to a private site profile, replace the URL and intended destination IDs, and configure expected forms/events/consent behavior. Keep test identities and credentials outside the shared package.

```sh
node bin/run.mjs --config /absolute/path/site.json --output /absolute/path/qa/current
node bin/report.mjs /absolute/path/qa/current/report.json
```

On Linux CI use `npx playwright install --with-deps chromium` when required. `--help` shows the supported flags. The default run does not fill or submit forms. Page loads can generate genuine analytics traffic, so use a test environment or documented synthetic exclusions. Invalid-input checks require `--allow-invalid`; successful submissions require `--allow-submit` plus QA routing and outcome contracts. Start from `config/contracts.example.json` to configure those disabled journey templates. Purchases and destructive transactions are not executed.

## Turn a finding into a fix

Ask your agent:

> Use SignalCheck on my most important customer journey. Show what you discover, help me define the intended result, and run the browser. Use the tools I have connected to trace failures and prepare reviewable fixes. Retest applied changes against the original checks. Keep missing access and untested delivery stages explicit.

The report generator writes `action-plan.json` and `action-plan.md` alongside the report. For ongoing work, keep a separate persistent ledger:

```sh
npm run actions -- plan /absolute/path/qa/current/report.json --output /absolute/path/qa/actions.json --mode prepare-fixes
npm run actions -- record /absolute/path/qa/actions.json --id sc-ACTION --record /absolute/path/qa/change-record.json
npm run actions -- verify /absolute/path/qa/actions.json --id sc-ACTION --report /absolute/path/qa/retest/report.json
```

Use `--capabilities PATH` with a host-discovered, read-verified tool inventory and `--previous PATH` to preserve ongoing actions. `investigate` collects/traces; `prepare-fixes` prepares changes; `maintain` follows an explicitly authorized operating policy. Mode selection does not grant publishing permission. The CLI records evidence and verifies reports; the host agent performs actual tool operations. See the installed skill's [agent workflow](skills/signalcheck/references/agent-workflow.md) and [guided setup](skills/signalcheck/references/onboarding.md).

## Updates and feedback

`npm run updates` checks public `main` once and returns a pinned revision and comparison link. Inside an installed skill, run `node scripts/browser-qa/bin/updates.mjs` from the skill directory; its installation receipt identifies the installed commit when available. A repository checkout without an installation receipt reports `baseline-unknown`; supply `--receipt PATH` for a known installation. Checking never updates files or sends notifications.

Your agent can offer an opt-in cadence/channel, summarize relevant changes and ask whether to integrate the pinned revision. It must preserve profiles, evidence and local edits. A separate host scheduler and notification route are required for recurring alerts. See [updates and feedback](skills/signalcheck/references/updates-and-feedback.md).

Report a problem, request an improvement or share setup feedback:
https://github.com/russpage/signalcheck/issues/new/choose

Public issue forms are supplied. Your agent can draft feedback; it must have authorization before submitting it. Remove private evidence before sharing.

## Checks

| Area | What the package can establish |
| --- | --- |
| Forms and embeds | Inventory across frames, unavailable provider forms, configured missing/hidden controls, form contracts, invalid validation and enabled success checks. |
| Tags and events | GA4, Google Ads and Meta browser request decoding; intended destinations/counts; confirmed repeated logical IDs versus suspected timing matches. |
| Consent | Exercise configured controls in fresh contexts; compare events against the specified policy; preserve legitimate cookieless Consent Mode behavior. |
| Journeys | Configured navigation/SPA steps, DOM assertions, device variations and event attribution to tested actions. |
| Technical regressions | Navigation/HTTP failures, failed requests, structured JavaScript error evidence, protected screenshots and scoped history. |
| Downstream receipt | A workflow for connecting authorized backend evidence; CRM, email/SMS, webhook, server-side and final platform receipt remain untested without separate access/checks. |
| Attribution and accessibility | A checklist and evidence requirements; complete cross-domain attribution, browser/server deduplication, full accessibility conformance and real checkout require additional configured tests or tools. |

The inventory is bounded by the routes and providers actually visited. It cannot know which conversions should exist without a measurement plan. Two scripts installed do not prove two events fired, and two requests do not always represent two business conversions.

## Reports and daily use

The runner writes private JSON, HTML, Markdown and compressed masked screenshots. Reports include expected versus observed behavior, severity, evidence, fix suggestions, completion status and explicit coverage gaps. Progress is checkpointed; interrupted runs remain incomplete. History resolves findings only across equivalent completed checks.

Use `templates/signalcheck-daily.yml` as a GitHub Actions starting point. Place it in the repository root's `.github/workflows/`, leave `QA_PACKAGE_DIR` as `.` for a repository-root installation, and supply a reviewed site profile through the `WEBSITE_QA_PROFILE_JSON` repository secret. The template is inert until you copy it into `.github/workflows/` in a private audit repository. It runs the browser, retains bounded private artifacts and exposes a sanitized digest for AI report review. A recurring AI task can read it; the browser collection itself needs no LLM API key.

Use nonsensitive contract, journey and action IDs. Human-readable reports and the digest redact unsafe custom IDs; private comparison checkpoints retain configured IDs for stable history. Keep evidence private even when this package is public. Public repository artifacts and logs can be visible to everyone. The template requires a private audit repository and an explicitly configured profile; public distribution CI only uses local test fixtures.

## Packaging and limitations

- `skills/signalcheck/` is the canonical portable skill and contains its complete runtime.
- `plugin.json` packages the skill for the Agent Plugins/OpenAI distribution format; `.claude-plugin/plugin.json` supports Claude Code packaging. Manifests do not mean the package has been published to any plugin directory or that hosted browser execution is provisioned.
- The installer is tested using temporary fixture profiles. It copies native skill directories; it does not claim end-to-end installation testing in every proprietary client.
- Static references cover extra checks accurately labelled manual, configured or access-dependent. This package does not ship authenticated CRM/BigQuery/Meta CAPI receipt connectors.
- Follow the host's browser, execution and authorization rules. CAPTCHA, blocked runtimes and missing backend access are reported as gaps.

See [architecture](docs/architecture.md) and the skill's linked contract/check/report references. MIT licensed.

For skill authors, `skills/skill-setup-design/` contains reusable guidance for meaningful user decisions, a useful first result, progressive setup, updates and feedback. SignalCheck’s installer installs only SignalCheck; this additional skill is a separate source package.
