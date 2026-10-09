# Set up around one useful result

Use this flow for first setup, adding a site or expanding coverage. Treat it as a conversation with progressive choices, not a technical questionnaire. Default to completing independent work while awaiting information. Do not promise a positive emotion or invent a defect for a demonstration.

## 1. Make the outcome concrete

Ask: “Which customer action would hurt most if it stopped working?” Offer a few relevant choices discovered from the site: request a quote, book an appointment, buy a product or join the newsletter. Explain the immediate deliverable: check that action and show the evidence, next fix or remaining gap. Accept an existing priority without asking again.

Ask for the website URL if absent. Reuse known configuration. Do not request GTM IDs, selectors, vendor accounts or a complete measurement plan before discovery. Explain that page loads may create synthetic analytics traffic and use existing test/exclusion arrangements when available.

## 2. Do the technical discovery

Use a real browser and available read tools. Inventory the selected route, form provider, observed destinations, consent controls and capture boundaries. Discover tools exposed by the host and verify scoped read access; never equate installation with access or permission. Continue a bounded browser inventory when source/provider access is missing.

Return a short, concrete preview: “I found a quote form, a Google Analytics destination and an embedded booking tool. Here is what I observed.” Keep “discovered,” “observed” and “verified against expectations” distinct.

## 3. Co-create the rulebook

Ask about business decisions the agent cannot infer safely:

- What counts as success: a click, an accepted form or a persisted CRM lead?
- Which intended destinations should receive which events? Explain any ambiguity using plain language and actual observations. Offer a draft for correction, never silently adopt the live implementation as correct.
- What is legitimate repetition: two destinations, two different actions or a repeated submission?
- For submissions: where should the QA lead go, and which follow-up must be suppressed?

Show a readable contract before its JSON: “One accepted quote request should create one lead and send one lead event to each approved destination.” Mark unknown destinations and backend stages untested. Record the user's choices and source of each expectation. Ask only the next decision that blocks progress; use up to three short questions per exchange when needed.

Let users choose priorities and intended behavior while the agent drafts selectors, configuration and commands. Do not involve them in mechanical work merely to create a feeling of participation. Keep direct interaction for judgment, reusable configuration for their preferences and automation for repeatable work.

## 4. Produce the first useful result

Run the smallest meaningful suite. Lead with the user's chosen journey, its expected and observed behavior and the most useful next action. Show evidence when useful. A working journey with a coverage gap is an honest result; never stage a fake failure or call missing expectations a pass.

Demonstrate one next step: a specific source investigation, reviewable repair or missing receipt check. The desired first milestone is an actionable result, not the number of integrations connected. Record elapsed setup time and unresolved blockers only if actually measured; do not claim reduced setup time without comparison data.

## 5. Choose operating boundaries at the decision point

Explain modes using concrete actions: investigate; prepare reviewable fixes; maintain within an explicit policy. Default to investigate when authority is unknown. Maintain mode does not itself authorize production changes. Reuse valid authorization; ask only when the requested next action falls outside it. Record exact resources, permitted changes, publishing boundaries, test routing and rollback conditions.

Connect extra tools only when the first result shows why they are useful. For example, read a GTM workspace to locate the duplicated trigger or read the CRM to verify lead persistence. State how missing access changes the result; do not force unrelated account connections.

## 6. Finish with continuity

Summarize: “You chose quote requests. These checks ran. This evidence supports this result. This stage remains untested. Here is the next action.” Save the reviewed site profile and private action ledger in the user's project. Offer recurring monitoring when requested or clearly part of the task; verify the actual scheduler and reporting route before saying it is enabled.

Give returning users a short change review: new journeys, changed intent, new permissions or failed tests. Preserve their decisions; do not restart onboarding each run. Measure improvement by verified repairs and closed coverage gaps. A pleasant setup is a design aim, not a proven psychological outcome.

## Source and interpretation

Scott E. Sampson, *Essentials of Service Design and Innovation*, fourth edition, supplied Chapters 1–6, pp. 36–37 and 47–48, distinguishes co-production of value potential from later value realization, and discusses balancing customer control with provider efficiency. The flow above applies that distinction to SignalCheck. Its specific conversation and first-result design are implementation choices, not experimentally validated claims from the book. Do not distribute the supplied PDF with this package.
