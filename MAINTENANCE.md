# Maintenance recipe

This file is a renewal procedure, not a maintenance promise. It is written so that a future user — or their AI agent — can verify whether the tool's data is still current, and refresh it without needing the original author.

The trust here is in the recipe, not in me. If you are reading this and the in-app "última revisión de datos" date is more than six months old, do not assume the data is wrong, and do not assume it is right. Run the checks below.

---

## What this tool claims to be

A municipality-level radon zone lookup for Spain, built on:

- **CTE DB-HS6 Appendix B** — the building code's municipality classification (Zone I / Zone II) under Real Decreto 732/2019.
- **INE national municipality base** — the search universe of ~8,131 Spanish municipalities.

It does **not** make address-level claims, does not replace measurement, and deliberately withholds answers for province blocks where the source extraction is not trusted enough to publish (`pending_validation`).

If either of those source documents has been reissued, or if the withheld provinces have been re-extracted with confidence, this tool is potentially stale and the procedure below explains how to refresh it.

---

## Quick freshness check (for any user, no setup)

You can do this without cloning anything.

1. Open the in-app **"Estado del prototipo"** card. Note the "última revisión de datos" date.
2. Visit the official CTE DB-HS6 page: <https://www.codigotecnico.org/DocumentosCTE/Salubridad.html>. Check the "Última modificación" or version date on the consolidated DB-HS document.
3. Visit the CSN municipality zonification page: <https://www.csn.es/mapa-de-zonificacion-por-municipio>. Check whether the official municipality list has been republished or amended.
4. If either source is newer than the in-app date by more than six months, the tool is potentially behind and should be refreshed. Continue to the next section, or pass this file to your agent and ask it to do so.

---

## Refresh procedure (for a developer or an agent)

**Prerequisites:** Node 20+ (the repo currently builds clean on Node 24), Python 3.10+, and `git`. No backend, no API keys, no cloud account required for a local refresh.

### 1. Clone and install

```bash
git clone https://github.com/willworth/radon-tool
cd radon-tool
npm install
```

(If the repository has moved or is unavailable, the data extraction step below is fully reproducible from public Spanish government PDFs alone. The build pipeline is just bookkeeping around those.)

### 2. Refresh the source PDF if needed

The DB-HS6 PDF lives at `data-source/DBHS.pdf`. If the official CTE DB-HS document has been updated:

1. Download the new consolidated DB-HS PDF from <https://www.codigotecnico.org/DocumentosCTE/Salubridad.html>.
2. Replace `data-source/DBHS.pdf`.
3. Open the new PDF and verify that Appendix B still contains the municipality classification tables. If the appendix layout has materially changed, the extraction script may need adjustment (see step 5).

### 3. Refresh the INE municipality base if needed

INE periodically updates its municipality register. If you want to incorporate municipality changes (mergers, renamings, new codes), refresh `data-source/ine-municipios-55200.json` from the INE API. The current file is documented as the result of API call `55200` against the INE municipality endpoint.

### 4. Re-run the pipeline

```bash
python3 -m venv .venv
.venv/bin/pip install pypdf
.venv/bin/python scripts/extract-official-radon-data.py
node scripts/reconcile-ine-codes.mjs
node scripts/build-search-base.mjs
node scripts/validate-search-base.mjs
```

This will regenerate:

- `src/data/municipalities.official.json` — extracted Appendix B classifications
- `src/data/municipalities.search-base.json` — the bundled search universe
- `data-source/ine-reconciliation-report.json` — INE code reconciliation diagnostics
- `data-source/search-base-validation-report.json` — coverage and withheld-province report

### 5. Read the validation report

Open `data-source/search-base-validation-report.json`. The fields that matter:

- **Total municipalities** — should be approximately 8,100. A figure materially below 8,000 is a red flag for a broken INE load.
- **Zone counts** — `Zone I`, `Zone II`, `not classified`, `pending_validation`. A sudden swing in any of these — especially a drop in `pending_validation` paired with a jump in `not classified` — should be inspected, not shipped.
- **Withheld provinces** — currently Granada, Huelva, Sevilla, Huesca, Palencia, Salamanca, Tarragona, Castellón / Castelló, Vizcaya / Bizkaia. (Granada withheld 2026-06-10: Appendix B extraction bleed — Huelva municipalities found in the Granada block; pending spot-check against the source PDF.) If any of these now has confident extraction, you can promote it (see step 6). Do not promote a province silently if its counts look anomalous.
- **Extraction diagnostics** — the Appendix B PDF extraction may contain rows that do not reconcile cleanly to INE, including likely province-context contamination from PDF page boundaries. This is not automatically a public-data failure if the rows are withheld or fail to join, but it must be visible in the report.
- **Public search-base diagnostics** — these are release-blocking if non-zero: active overlay INE-code mismatches, duplicate active overlay codes, or likely municipality/province mismatches in the final searchable dataset.
- **Low-coverage review candidates** — if a province appears here, investigate before publishing. Valencia / València is currently a reviewed low-coverage exception: the source PDF page lists only Chera, el Puig de Santa Maria, Gilet, Puçol, and Sagunto/Sagunt for Valencia. That review lives in `src/data/appendixB.reviewed-low-coverage-provinces.json`.

### 6. Promote a province out of `pending_validation` (optional, careful)

A province is currently withheld if the Appendix B extraction for its page block is not trusted. To promote one:

1. Inspect the extracted rows for that province in `src/data/municipalities.official.json` (filter by `province`).
2. Spot-check ten rows against the source PDF visually.
3. Confirm zone counts are plausible relative to the published Appendix B totals for that province.
4. Remove the province from the withheld list in `scripts/build-search-base.mjs` (search for the withheld-province array).
5. Re-run steps 4 and 5 above. The validation report should show that province moved from `pending_validation` to a mix of Zone I / Zone II / not_classified.
6. Confirm `publicSearchBaseDiagnostics` remains clean. If any active overlay mismatch appears, do not ship; either fix the extraction/reconciliation or keep the province withheld.

If any of those checks feels uncertain, leave the province withheld. Honest absence is the design intent.

### 7. Update the in-app date

Edit the "última revisión de datos" string in `src/App.tsx` to today's date in the form *"mes de YYYY"* (Spanish) and equivalent in English. If you promoted any provinces, update the withheld-provinces list shown in the UI.

### 8. Build and verify locally

```bash
npm run build
npm run preview
```

Walk through the in-app honesty checks before declaring success:

- The four refusals (not a house-level claim, no substitute for measurement, no address-level claim, absence ≠ low risk) are still present in the UI.
- `pending_validation` results still return a visibly distinct state with deliberately uncomfortable copy.
- Source attribution (CTE DB-HS6 Appendix B + INE) is still named in the UI.
- An AI-collaboration disclosure is still present in the "Estado del prototipo" card.

### 9. Decide whether to redeploy

If you are the operator of `radon.willworth.es`, the deployment commands are in the README. If you are not, you can host your local build anywhere you like — the app is fully static and has no backend. You can also fork the repo and run your own version under your own domain. That is an explicitly supported outcome of this maintenance contract.

---

## What to do if the underlying regulation changes shape

The recipe above assumes Appendix B continues to exist as a municipality table in DB-HS6. If a future reissue restructures the radon section materially (for example, replacing the Appendix B table with a different classification scheme under a new instruction), the extraction script will need rewriting and the tool's product states (`Zone I`, `Zone II`, `not classified`, `pending_validation`) may no longer be appropriate.

In that case, the honest move is to mark the tool clearly as legacy data, not to silently translate the new scheme onto the old states.

---

## Abandonment

I might stop maintaining this tool. Not as a rhetorical hedge — as a real possibility. Life changes, projects rotate, and a small public-information utility is not central to my work.

If you discover this tool is unmaintained and you find it useful: clone it, refresh it using the recipe above, and host your own version. That is the intended end state of a recipe-shaped artifact. The trust is in the procedure being legible, not in the author still being around.

Corrections, refresh PRs, or notice that a fork has taken over are all welcome at the contact in the in-app "Correcciones" card.
