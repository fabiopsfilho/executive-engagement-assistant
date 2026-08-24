# AI Skills Transformation — Research Source Documents

This folder holds the source research that informs the assistant's expert persona.
It exists for **provenance**: so anyone can trace a statistic, framework, or case
study surfaced by the app back to the original document it came from.

## Where this research is used

The verified content from these documents is woven into the expert persona at:

    backend/lambdas/shared/persona.ts  →  EXPERT_PERSONA

That persona is injected into every insight-generating Lambda (account analysis,
slides, agenda / Skills Session), so the research flows automatically into the
generated output. The relevant sections in `persona.ts` are:

- `2026 RESEARCH UPDATE — DEEPER EVIDENCE BASE`
- `ADDITIONAL FRAMEWORKS YOU APPLY (2026)`
- `PROOF-POINT CASE STUDIES`

## Source documents

| File | What it contributes |
|------|---------------------|
| `AI Skills Transformation Trends and Ente.docx` | Primary research report — the benchmark stats (BCG 6% leaders, 10-20-70, maturity-ROI link), the 90-180 day playbook, three-tier curriculum, Responsible AI dimensions, EU AI Act timeline, and AWS case studies. |
| `AI_Skills_Transformation_Executive_Playbook.docx` | The executive narrative sequence (Business Outcomes → Workflows → AI Opportunities → Skills → Learning → Adoption → Impact), Learn→Practice→Apply→Demonstrate→Scale, role/proficiency segments, the three AI-skill generations ("agent boss"), and measurement hierarchy. |
| `AI_Skills_Transformation_Full_Research_Record.docx` | Full research record backing the report (sources and detail). |
| `AI_Skills_Transformation_Speaker_Notes.docx` | Speaker notes for the executive briefing narrative. |
| `EBC AI Skills Transformation Assistant Prompt.md` | The original assistant prompt / framing used to develop the persona. |

## Verified content incorporated into the persona

Only content verified against these documents was added — no invented statistics.
Highlights:

- **Leader benchmark:** only 6% of large companies qualify as AI-adoption leaders;
  leaders +9.3pp TSR, +10pp revenue growth, +6pp margin; 13% AI-skilled workers vs 1%.
- **Value paradox:** ~80% use GenAI but 60%+ see no bottom-line impact; 95% of
  unstructured GenAI investments produced zero return (MIT Media Lab / Project NANDA).
- **Maturity-ROI link:** 82% provide some AI training but only 35% have a mature
  program; mature programs are ~2x as likely to report significant positive ROI.
- **Skills demand:** 94% face AI-critical skill shortages (WEF); AI-engineering
  postings +255% YoY.
- **Training intensity:** regular AI usage is markedly higher with 5+ hours of
  training plus in-person coaching; only 36% feel properly trained.
- **Frameworks:** Five V's (Value/Visualize/Validate/Verify/Venture, 65%
  pilot-to-production), McKinsey three horizons, three AI-skill generations,
  the 8 dimensions of Responsible AI, EU AI Act enforcement timeline.
- **Case studies:** Holcim (85% participation, 90% manual invoice reduction),
  Absa (12-week incubator, 28 GenAI innovations), Visa (78% seller confidence),
  New York Life (12,000 upskilled, 33% internal fill), Globe, Pearson;
  Forrester TEI 234% ROI, 84% efficiency.

> When updating the research, refresh both these source files **and** the
> corresponding sections of `backend/lambdas/shared/persona.ts`.
