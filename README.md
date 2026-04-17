# Spain Radon Municipality Lookup Tool

Early public-information scaffold for a standalone radon lookup app focused on Spain.

## Scope

This repository is the first credible public-facing scaffold for a municipality lookup tool that helps users:

- search a Spanish municipality with autocomplete
- see a municipality-level radon classification (`Zone I`, `Zone II`, or `not classified`)
- read plain-language guidance in Spanish, with English alongside it
- add a small amount of housing context (house vs flat, floor level, rough building age)
- understand the tool's limits before any public launch

## Current status

This version now uses an extracted **official municipality classification** from CTE DB-HS6 Appendix B, bundled at build time.

The UI is intentionally simple and should work comfortably on mobile as well as desktop, with no backend dependency.

Current source files:

- `data-source/DBHS.pdf`
- `scripts/extract-official-radon-data.py`
- `src/data/municipalities.official.json`

The app shape remains static and backend-free, but the dataset is no longer a three-row placeholder.

### Current working truth

The search universe is the full Spain municipality base from INE.

Appendix B is treated as a classification overlay on top of that base, not as the entire searchable universe.

That means each municipality currently falls into one of these product states:

- `Zone I`
- `Zone II`
- `not classified`
- `pending validation`

`pending validation` is important. It means the municipality sits in a province whose Appendix B extraction block is currently withheld because it is not trusted enough yet. It should not silently read as an ordinary reassuring negative.

### Current caveat

The extraction path is reproducible, but still deserves one more validation pass before any public launch or policy-grade claim.

In particular, the next cleanup should:

- validate municipality counts against an independent official list if one becomes available
- finish stable INE municipality identifier reconciliation
- spot-check provinces at page boundaries
- fix remaining truncated or boundary-contaminated names from the PDF extraction path

### Current data picture

After the latest search-base rebuild:

- total municipalities in search base: `8,131`
- classified via overlay: `2,726`
- explicitly `not classified`: `4,032`
- `pending validation`: `1,372`
- manual overrides: `1`

Currently withheld provinces:

- Huelva
- Sevilla
- Huesca
- Palencia
- Salamanca
- Tarragona
- Castellón / Castelló
- Vizcaya / Bizkaia

Current review candidates flagged by validation because they have unusually low classified coverage without being excluded:

- Valencia / València

Recent deliberate province review materially improved extraction for:

- Barcelona
- Gerona / Girona

The main extractor fixes in that pass were:

- widen the accepted top-of-page capture window so province headers just below the header band are not dropped
- use column ranges rather than a single brittle x-position tolerance, so split labels like `Comunidad Valenciana` still parse correctly

Follow-on data-layer work then improved overlay retention further:

- reconciliation now handles lowercase article forms such as `el Puig de Santa Maria`
- the search-base build now prefers reconciled `ineCode` joins before falling back to normalized name + province joins

That second pass matters because it recovers municipalities whose names are equivalent but differently formatted between Appendix B extraction and INE naming.

## Proposed stack

- Vite
- React
- TypeScript
- static JSON bundled at build time
- no backend for v1

This keeps deployment simple and credible for a public-information lookup utility.

## Development

```bash
npm install
npm run dev
npm run build
npm run data:build-search-base
npm run data:validate
```

## Data model

Current municipality record shape:

```json
{
  "ineCode": "15005",
  "municipality": "Arteixo",
  "province": "La Coruña / A Coruña",
  "autonomousCommunity": "Galicia",
  "zone": "II",
  "sourceStatus": "appendix_overlay"
}
```

`sourceStatus` is now meaningful and should be preserved in future work:

- `appendix_overlay`: municipality is classified from the retained Appendix B overlay
- `not_classified`: municipality is present in the INE base but not currently classified by the retained overlay
- `pending_validation`: municipality belongs to a withheld province block
- `manual_override`: municipality has a deliberate override applied in the build step
- `placeholder`: legacy placeholder-only state from the pre-real-data scaffold

## Data extraction workflow

To rebuild the official dataset from source:

```bash
python3 -m venv .venv
.venv/bin/pip install pypdf
.venv/bin/python scripts/extract-official-radon-data.py
node scripts/reconcile-ine-codes.mjs
node scripts/build-search-base.mjs
node scripts/validate-search-base.mjs
```

This currently uses:

- the official DB-HS6 PDF as the radon classification source
- INE municipality-coded API output as a reconciliation aid for `ineCode`

It writes:

- `src/data/municipalities.official.json`
- `data-source/ine-municipios-55200.json`
- `data-source/ine-reconciliation-report.json`
- `src/data/municipalities.search-base.json`
- `data-source/search-base-validation-report.json`

## Validation workflow

The most useful quick truth check in the repo is:

```bash
npm run data:validate
```

That generates `data-source/search-base-validation-report.json`, which currently records:

- total municipality counts
- zone counts
- `sourceStatus` counts
- withheld provinces and how many municipalities they affect
- low-coverage province review candidates

This is not a proof of correctness, but it does stop the project from being opaque.

## Intended official sources

Current extraction is based on published official material:

- CTE DB-HS6 Appendix B municipality classification
- Official consolidated DB HS PDF from codigotecnico.org

Planned enrichment sources:

- CSN published radon zone material
- INE municipality identifiers for stable matching

## Methodology notes

- Municipality classification is only a first-pass public-information layer.
- It does **not** estimate radon concentration for a specific address or building.
- Building type, floor level, contact with the ground, construction details, and mitigation measures all matter.
- Direct measurement remains the only reliable way to know indoor radon concentration.
- If data is withheld or uncertain, the product should say so explicitly rather than silently degrading to a normal-looking result.

## Limitations

This tool still does **not** yet include:

- address lookup
- Cadastre integration
- map visualisation
- testing provider directory
- validated mitigation cost tables
- complete validated reconciliation against INE municipality codes

## Project structure

```text
data-source/
  DBHS.pdf
  ine-municipios-55200.json
  ine-reconciliation-report.json
  search-base-validation-report.json
scripts/
  build-search-base.mjs
  extract-official-radon-data.py
  reconcile-ine-codes.mjs
  validate-search-base.mjs
src/
  data/
    municipalities.official.json
    municipalities.search-base.json
    municipalities.ts
  App.tsx
  main.tsx
  styles.css
  types.ts
```

## Next work suggested

1. Recover one excluded province block carefully instead of attempting a broad risky parser rewrite.
2. Review Girona and Valencia / València to decide whether their low classified counts are genuine or extraction-related.
3. Fix remaining truncated / cross-boundary municipality names in the extractor output.
4. Finish INE-code reconciliation and quantify coverage cleanly.
5. Refine bilingual copy with reviewed public-health wording.
6. Prepare static deployment target and domain/subdomain decision.

## License

Not decided yet.
