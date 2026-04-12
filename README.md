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

This version is intentionally incomplete and uses a **tiny placeholder dataset** stored at build time.

It is wired so the real municipality JSON can replace the placeholder later without changing the UI shape.

### Placeholder data warning

The current data file is:

- `src/data/municipalities.placeholder.json`

It contains only three clearly-marked example municipalities and must **not** be treated as a real reference dataset.

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

## Replacing the placeholder dataset

When the official municipality dataset is ready, replace the placeholder source with a real JSON file matching the same schema.

Likely source path for the first real import:

- `src/data/municipalities.official.json`

Then update `src/data/municipalities.ts` if needed.

## Intended official sources

Placeholder only for now. Real v1 should be based on published official material, likely including:

- CTE DB-HS6 Appendix B municipality classification
- CSN published radon zone material
- INE municipality identifiers for stable matching

## Methodology notes

- Municipality classification is only a first-pass public-information layer.
- It does **not** estimate radon concentration for a specific address or building.
- Building type, floor level, contact with the ground, construction details, and mitigation measures all matter.
- Direct measurement remains the only reliable way to know indoor radon concentration.

## Limitations

This scaffold does **not** yet include:

- official nationwide municipality data
- address lookup
- Cadastre integration
- map visualisation
- testing provider directory
- validated mitigation cost tables

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

1. Replace placeholder data with official municipality JSON.
2. Add stronger search normalization for accents and province disambiguation.
3. Refine bilingual copy with reviewed public-health wording.
4. Add fuller testing, interpretation, and mitigation guidance sections.
5. Prepare static deployment target and domain/subdomain decision.

## License

Not decided yet.
