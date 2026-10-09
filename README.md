# SignalCheck

Check your forms. See which events fire.

SignalCheck is an open source skill and browser runner for checking website forms, analytics events, consent behavior and key customer actions. Install it in Claude Code, GitHub Copilot, Gemini CLI or OpenAI Codex, then configure the pages, forms and events you want to test.

For configured checks, SignalCheck compares the events captured in the browser with your measurement plan. It reports missing events, separates confirmed repeat emissions from suspected duplicates, and gives your AI agent evidence to suggest fixes. Connect a scheduler to repeat the checks daily and track changes.

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
