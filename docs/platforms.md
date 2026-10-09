# Install and run in different agents

The portable unit is `skills/signalcheck/`: `SKILL.md`, references, and the bundled Node.js browser runner. Installing the skill teaches an agent the audit procedure. A live audit also needs a browser tool or a machine with Node.js 22+, Playwright, Chromium, and permission to reach the target website. Scheduling is a separate runner or CI configuration.

Platform documentation was checked on 2026-10-09 UTC. Product names cover several different execution environments; the capability of the environment matters more than the model name.

## Local coding agents

These are the native paths this repository's installer uses. `~` denotes your profile directory. Each path contains an `signalcheck/` folder, with `SKILL.md` at its root.

| Agent | One project | Across your projects | Refresh or invoke |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` | Open a session; invoke `/signalcheck` |
| GitHub Copilot CLI and VS Code | `.github/skills/` | `~/.copilot/skills/` | CLI: `/skills reload`; request `/signalcheck` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` | `/skills reload`; ask to use `signalcheck` |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` | Changes are discovered automatically; restart if needed; invoke `$signalcheck` |

Official path references:

- Claude Code: https://code.claude.com/docs/en/skills
- GitHub Copilot CLI: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
- Copilot in VS Code: https://code.visualstudio.com/docs/agent-customization/agent-skills
- Gemini CLI: https://geminicli.com/docs/cli/skills/
- OpenAI Codex: https://learn.chatgpt.com/docs/build-skills

Copilot and Gemini also support `.agents/skills/` as a shared location. The installer uses each product's native location to make its behavior explicit. `--platform all` creates identical copies in four locations; several agents discover more than one of these locations. Keep all copies updated together, or install only the platform you use. Gemini gives `.agents/skills/` precedence over `.gemini/skills/` at the same scope.

## Installer commands

Clone https://github.com/russpage/signalcheck and run these commands from the repository root, where `scripts/install.mjs` lives.

Preview a project installation:

```sh
node scripts/install.mjs --platform claude --project /path/to/your/project --dry-run
```

Install into that project:

```sh
node scripts/install.mjs --platform claude --project /path/to/your/project
```

Install across your projects:

```sh
node scripts/install.mjs --platform codex --scope user
```

Other supported platform values are `copilot`, `gemini`, and `all`. `--global` is an alias for `--scope user`. Use `--force` only when you intend to replace an existing installation of this skill. The installer refuses symlinked paths, preflights every requested destination, and copies the entire skill excluding `node_modules`, `reports`, and `.git` directories. It does not alter agent configuration, install dependencies or browsers, grant permissions, audit a site, or schedule a job.

The installed runtime remains self-contained: its dependencies are declared within the skill folder, and helper files are copied with it. Run the setup commands in `SKILL.md` before a live audit. Dependencies and the Chromium binary are downloaded separately; they are not embedded in the skill package.

Test this prompt after installation:

```text
Use signalcheck to audit https://YOUR-DOMAIN.example.
Start with real browser visits on desktop and mobile, inventory the forms and
tracking destinations, and report evidence for missing or duplicate events.
Do not submit forms or place orders. Separate observed defects, suspected
issues, and checks that could not be performed. Produce a repeatable test config.
```

## Claude on the web and Cowork

Claude supports custom skill uploads. Zip the `signalcheck/` folder, preserving that folder at the ZIP root, then upload it through Customize > Skills and enable it. Code execution must be enabled; organization controls can restrict uploads.

The upload preserves the procedure and supporting scripts. Whether it can run the scanner depends on its execution environment: confirm Node.js, package installation, browser availability, network access, and storage. If those are unavailable, use an enabled browser tool for interactive evidence, or run the scanner externally and give Claude the sanitized report. Claude's API skill environment cannot install missing packages at runtime. Installing a local personal Claude Code skill alone does not make it available to Cowork or cloud sessions; use account-enabled skills or committed project skills where supported.

Official references:

- https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- https://support.claude.com/en/articles/12512180-use-skills-in-claude
- https://code.claude.com/docs/en/skills

## ChatGPT and OpenAI

OpenAI documents standalone skills for the ChatGPT desktop app, Codex CLI, and IDE extension. The local installer uses Codex's `.agents/skills/` discovery path. For broader distribution in Chat and Work on the web, desktop, and mobile, package the skill as a plugin and publish or share it through a supported marketplace. A repository folder or plugin manifest alone is not an installed or published ChatGPT plugin.

Plugin installation distributes the procedure. It does not guarantee that the host has the runner's packages, browser, or network access. Use the host's permitted browser tools when available, or an external scanner exposed through an enabled connector/MCP service. A plain file attachment does not register a skill automatically. This package does not need an OpenAI API key to run its deterministic scanner.

Official references:

- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/plugins

## Microsoft 365 Copilot and Copilot Studio

Microsoft 365 declarative-agent custom skills are a Frontier preview, with a separate authoring route from GitHub Copilot. Agent Builder accepts ZIP packages with `SKILL.md` at the ZIP root, whereas Claude's upload expects a named skill folder at the root. Repackage rather than uploading the Claude ZIP unchanged.

Microsoft's documented declarative-agent script sandbox has no runtime network access and cannot install packages. The bundled browser runner therefore cannot scan a website directly in that sandbox. A declarative agent can interpret an externally generated report or use separately enabled connector/API/MCP capabilities through its orchestrator. Do not claim a live audit occurred if only a report was read.

Copilot Studio's agents powered by the GitHub Copilot harness also support skill uploads. That is a different environment with its own capabilities and costs; verify its browser, runtime, network, and scheduling support before promising live monitoring. This installer does not provision either Microsoft 365 agents or Copilot Studio agents.

Official references:

- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-skills
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-builder-add-skills
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/skills-add-existing

## Gemini app and other chat interfaces

The verified installation route here is Gemini CLI. A Gemini Gem or another saved prompt can retain instructions and discuss reports, but it does not thereby acquire this Node.js runner, browser telemetry, or a daily scheduler. Use a supported local agent, browser-enabled agent, or external scan service for the execution step. Check current host capabilities rather than assuming that a common model brand implies common tools.

## Verify execution

After installation, confirm that the agent discovered the skill and that a real browser run produced a timestamped report with visited URLs, effective consent states, request evidence, and explicit skipped checks. A successful installation is not a successful audit. A green CI run confirms only the checks and journeys that actually executed; unconfigured submissions and server-side delivery remain untested.

For unattended daily monitoring, run the bundled scanner on GitHub Actions or another scheduled machine and store sanitized reports. The chosen AI can then interpret the evidence and propose fixes. Keep reports and test identities private even if the reusable skill is public.
