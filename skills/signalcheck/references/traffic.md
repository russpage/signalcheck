# Human, bot and agent traffic

Keep execution identity, permitted activity and verified business outcome separate. An agent is automation and may act for a customer. A verified bot or agent is not automatically malicious, authorized to transact, or a verified conversion. A user-agent string, IP address or fast interaction is not proof of identity.

## Start with a useful decision

Reuse the chosen customer journey. Ask only for missing business decisions: which agent activities are welcome, which targets should be accessible, which production conversions must exclude QA, and how test submissions are routed. Let the agent discover selectors, intended destinations and available logs. Do not ask users to invent bot-score thresholds. Preserve consent policy and existing protections while preparing scoped changes.

Choose one of two evidence paths:

- Browser QA: use `config/traffic.example.json`, target forms/selectors and optional non-destructive steps or gated submissions. Test production exclusion by specifying zero-emission rules, separately from events expected at a QA destination.
- Actual traffic: obtain an authorized CDN/server export, analytics/CRM observation or real agent trace through available host tools. Normalize it to the import contract below. The package does not collect all live visitors, ship vendor connectors or verify signatures itself.

## Identify and separate SignalCheck visits

All runner visits are `synthetic-qa`, even when an agent user-agent string is used. Report metadata identifies the run with `traffic.runMarkerId`; it does not itself change analytics counting.

An optional first-party storage marker requires an existing reviewed site integration:

```json
{
  "traffic": {
    "syntheticMarker": {
      "siteIntegrationConfirmed": true,
      "origins": ["https://your-site.example"]
    },
    "excludedEvents": [
      {"vendor": "ga4", "destinationId": "G-PRODUCTION", "eventName": "generate_lead"}
    ]
  }
}
```

The runner writes `localStorage.signalcheck_qa` before page scripts on exact approved origins. The value contains `kind`, an opaque `runId` and `visitId`. The site can read it for a reviewed QA exclusion or QA routing. No production-site integration is installed automatically. Storage marking is not a server-side request identity, customer authorization, consent choice or anti-abuse credential; do not trust a client-writable marker for security decisions. A failed marker is reported explicitly. No QA headers are added or third-party storage modified.

The zero-event checks report `SYNTHETIC_CONVERSION_EMITTED` when a configured production event is observed. This means browser emission, not platform counting. Keep success checks and legitimate QA-destination events intact. Positive production-event requirements and production exclusions in one scope are rejected, not silently rewritten. Repeat the unchanged contract after a scoped fix. Check downstream exclusions independently with the run correlation and a destination observer; missing access remains untested. Real lead suppression still requires the existing submission gates.

## Probe agent access without pretending to be an authenticated agent

Add `agentAccess` to a page or supported submission/invalid-validation journey:

```json
{"kind": "policy-probe", "userAgent": "TheReviewedAgentUserAgent/1.0", "challengeSelectors": ["#site-challenge"]}
```

Configure a target form/selector contract; reuse steps, consent and existing submission authorization. Results distinguish `target-accessible`, `restricted`, `challenged`, `target-unavailable` and `inconclusive`. A completed probe does not prove that a real signed agent can access the site, that a challenge was caused by bot detection, or that a backend accepted a lead. The browser never bypasses a challenge or signs another agent's requests. Confirm restrictions through actual authenticated agent traces and edge/server evidence before recommending a policy change. Retry/idempotency and agent-to-human attribution handoffs remain separate browser/access checks, not new bundled automatic tests.

## Analyze actual traffic evidence

Run from the installed runner:

```sh
node bin/traffic.mjs --input /private/normalized-export.json --output /private/traffic-report.json
```

Use this normalized version 1 structure; sample values describe the format, not observed traffic:

```json
{
  "schemaVersion": 1,
  "source": {"kind": "cdn", "authenticated": true, "evidenceRef": "private:authorized-export"},
  "coverage": {"unit": "request", "sampling": "sampled", "start": "2026-10-01T00:00:00Z", "end": "2026-10-02T00:00:00Z"},
  "records": [{
    "id": "private:observation-id",
    "identityEvidence": [{"kind": "signature", "result": "signed-agent", "ref": "private:verified-signature-observation"}],
    "access": {"expectedPolicy": "allow", "httpStatus": 403, "challengeObserved": false, "journeyCompleted": false, "evidenceRef": "private:journey-trace"}
  }]
}
```

Set `source.authenticated:true` only after the host verified the source and the referenced evidence. It is an attestation, not a cryptographic validation performed by the importer. Source kinds: `cdn`, `server`, `analytics`, `crm`, `agent-trace`. Units: `request`, `session`, `event`, `record`, `journey`; sampling: `full`, `sampled`, `unknown`. Analyze each unit/window/source separately; never add requests to sessions or infer whole-site visitor shares from a sample. IDs must identify distinct observations, not individual people; retain raw evidence privately outside the report.

Identity evidence pairs:

| Kind | Result | Required basis |
| --- | --- | --- |
| `runner` | `synthetic-qa` | Correlation to an actual runner run and receipt, not an arbitrary client marker |
| `signature` | `signed-agent` | Successful signature verification at a trusted observer |
| `edge` | `verified-bot` | Trusted edge/vendor identity verification |
| `behavior` | `likely-human` or `suspected-automation` | Documented heuristic evidence; never proof or a calibrated probability |

Absent/untrusted verified identity or conflicting classifications become `unknown`. A signed agent may also have a verified-bot classification; it stays `signed-agent`. Raw user-agent claims are ignored. Preserve evidence references, provenance and unknown counts. Bot scores are vendor-specific observations; do not convert them into invented human probabilities.

Optional `outcome` needs `countedAsBusinessConversion` (boolean) and `evidenceRef` for correlated counting evidence. A correlated QA conversion produces `SYNTHETIC_CONVERSION_COUNTED`. Optional `access` requires all fields shown above and the site's intended policy (`allow`, `deny`, `observe`). A verified agent restricted on an allowed journey produces `SIGNED_AGENT_ACCESS_RESTRICTED`; an intended deny rule does not. Imported findings carry `checkpoint:imported-evidence`, not browser repair certification. Record a scoped investigation, reviewable fix and fresh correlated retest; do not feed imported findings into the browser verifier as though it independently checked the source. No automatic blocks, allowlists or policy writes occur.

The importer retains only hashed observation/evidence references, fixed categories and bounded typed outcomes/access fields; the JSON report is written privately. It does not retain raw IPs, user-agent strings, payloads or user identities. Do not publish source exports or evidence to GitHub.

## Source boundaries

Verified 2026-10-10: Cloudflare exposes bot scores, verified bot identity and signed agents. Availability depends on the deployed product/plan; equivalent trusted sources can be used. Web Bot Auth uses HTTP signatures and evolving IETF drafts. GA excludes known bots and does not report how many it excluded, so analytics alone is not a total bot census. These sources describe input mechanisms, not bundled SignalCheck integrations:

https://developers.cloudflare.com/bots/reference/bot-management-variables/
https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/
https://support.google.com/analytics/answer/9888366?hl=en
