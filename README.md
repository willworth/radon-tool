# Spain Radon Municipality Lookup Tool

Early public-information scaffold for a standalone radon lookup app focused on Spain.

## Scope

This repository is the first credible public-facing scaffold for a municipality lookup tool that helps users:

- search a Spanish municipality with autocomplete
- see a municipality-level radon classification placeholder (`Zone I`, `Zone II`, or `not classified`)
- read plain-language guidance in Spanish, with English alongside it
- add a small amount of housing context (house vs flat, floor level, rough building age)
- understand the tool's limits before any public launch

## Current status

This version now uses an extracted **official municipality classification** from CTE DB-HS6 Appendix B, bundled at build time.

Current source files:

- `data-source/DBHS.pdf`
- `scripts/extract-official-radon-data.py`
- `src/data/municipalities.official.json`

The app shape remains static and backend-free, but the dataset is no longer a three-row placeholder.

### Current caveat

The extraction path is reproducible, but still deserves one more validation pass before any public launch or policy-grade claim.

In particular, the next cleanup should:

- validate municipality counts against an independent official list if one becomes available
- attach stable INE municipality identifiers
- spot-check provinces at page boundaries

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
```

## Data model

Current municipality record shape:

```json
{
  "ineCode": "15030",
  "municipality": "Arteixo",
  "province": "A Coruña",
  "autonomousCommunity": "Galicia",
  "zone": "II",
  "sourceStatus": "placeholder"
}
```

## Data extraction workflow

To rebuild the official dataset from source:

```bash
python3 -m venv .venv
.venv/bin/pip install pypdf
.venv/bin/python scripts/extract-official-radon-data.py
```

This reads the official DB-HS6 PDF and writes:

- `src/data/municipalities.official.json`

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

## Limitations

This tool still does **not** yet include:

- address lookup
- Cadastre integration
- map visualisation
- testing provider directory
- validated mitigation cost tables
- independent reconciliation against INE municipality codes

## Project structure

```text
src/
  data/
    municipalities.placeholder.json
    municipalities.ts
  App.tsx
  main.tsx
  styles.css
  types.ts
```

## Next work suggested

1. Validate extracted municipality counts and edge cases province by province.
2. Add stronger search normalization for accents and province disambiguation.
3. Attach INE codes and stable matching metadata.
4. Refine bilingual copy with reviewed public-health wording.
5. Prepare static deployment target and domain/subdomain decision.

## License

Not decided yet.
