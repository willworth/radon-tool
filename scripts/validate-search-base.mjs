import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const searchBasePath = path.join(root, 'src/data/municipalities.search-base.json')
const exclusionsPath = path.join(root, 'src/data/appendixB.manual-exclusions.json')
const reviewedLowCoveragePath = path.join(root, 'src/data/appendixB.reviewed-low-coverage-provinces.json')
const officialPath = path.join(root, 'src/data/municipalities.official.json')
const inePath = path.join(root, 'data-source/ine-municipios-55200.json')
const reconciliationPath = path.join(root, 'data-source/ine-reconciliation-report.json')
const outPath = path.join(root, 'data-source/search-base-validation-report.json')
const independentCheckPath = path.join(root, 'data-source/appendixB.independent-check.json')

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[·']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function municipalityVariants(name) {
  const variants = new Set([name])
  if (name.includes('/')) {
    for (const part of name.split('/')) variants.add(part.trim())
  }
  if (name.includes(' y ')) variants.add(name.replace(/ y /g, ' i '))
  if (name.includes(' i ')) variants.add(name.replace(/ i /g, ' y '))
  if (name.includes('-')) variants.add(name.replace(/-/g, ' '))
  if (name.includes(' / ')) {
    for (const part of name.split(' / ')) variants.add(part.trim())
  }

  const articleMatch = name.match(/^(el|la|los|las)\s+(.+)$/iu)
  if (articleMatch) {
    variants.add(`${articleMatch[2]}, ${articleMatch[1]}`)
    variants.add(articleMatch[2])
  }

  const commaArticleMatch = name.match(/^(.+),\s+(el|la|los|las)$/iu)
  if (commaArticleMatch) {
    variants.add(`${commaArticleMatch[2]} ${commaArticleMatch[1]}`)
    variants.add(commaArticleMatch[1])
  }

  return [...variants].map(normalize)
}

function incrementObject(object, key) {
  object[key] = (object[key] ?? 0) + 1
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

const searchBase = JSON.parse(await fs.readFile(searchBasePath, 'utf8'))
const exclusions = JSON.parse(await fs.readFile(exclusionsPath, 'utf8'))
const reviewedLowCoverageProvinces = await readOptionalJson(reviewedLowCoveragePath, [])
const official = await readOptionalJson(officialPath, [])
const ine = await readOptionalJson(inePath, [])
const reconciliation = await readOptionalJson(reconciliationPath, null)
const independentCheck = await readOptionalJson(independentCheckPath, { entries: [] })

const ineProvinceByCode = new Map(ine.map((row) => [row.code, row.province]))
const ineProvincesByMunicipality = new Map()

for (const row of ine) {
  for (const municipality of municipalityVariants(row.municipality)) {
    if (!ineProvincesByMunicipality.has(municipality)) ineProvincesByMunicipality.set(municipality, new Set())
    ineProvincesByMunicipality.get(municipality).add(row.province)
  }
}

const summary = {
  totalMunicipalities: searchBase.length,
  byZone: {
    I: 0,
    II: 0,
    not_classified: 0,
  },
  bySourceStatus: {},
  manualOverrideCount: 0,
  pendingValidationCount: 0,
}

const provinceStats = new Map()
const activeOverlayCodeMismatches = []
const activeOverlayDuplicateCodes = []
const seenActiveOverlayCodes = new Set()

for (const row of searchBase) {
  summary.byZone[row.zone] += 1
  summary.bySourceStatus[row.sourceStatus] = (summary.bySourceStatus[row.sourceStatus] ?? 0) + 1

  if (row.sourceStatus === 'manual_override') summary.manualOverrideCount += 1
  if (row.sourceStatus === 'pending_validation') summary.pendingValidationCount += 1

  const provinceKey = `${row.province} (${row.autonomousCommunity})`
  if (!provinceStats.has(provinceKey)) {
    provinceStats.set(provinceKey, {
      province: row.province,
      autonomousCommunity: row.autonomousCommunity,
      totalMunicipalities: 0,
      classifiedMunicipalities: 0,
      notClassifiedMunicipalities: 0,
      pendingValidationMunicipalities: 0,
      manualOverrideMunicipalities: 0,
    })
  }

  const stats = provinceStats.get(provinceKey)
  stats.totalMunicipalities += 1

  if (row.sourceStatus === 'pending_validation') stats.pendingValidationMunicipalities += 1
  else if (row.zone === 'not_classified') stats.notClassifiedMunicipalities += 1
  else stats.classifiedMunicipalities += 1

  if (row.sourceStatus === 'manual_override') stats.manualOverrideMunicipalities += 1

  if (row.sourceStatus === 'appendix_overlay' || row.sourceStatus === 'manual_override') {
    if (row.ineCode && ineProvinceByCode.get(row.ineCode) && ineProvinceByCode.get(row.ineCode) !== row.province) {
      activeOverlayCodeMismatches.push({
        ineCode: row.ineCode,
        municipality: row.municipality,
        searchBaseProvince: row.province,
        ineProvince: ineProvinceByCode.get(row.ineCode),
        sourceStatus: row.sourceStatus,
      })
    }

    if (row.ineCode) {
      if (seenActiveOverlayCodes.has(row.ineCode)) {
        activeOverlayDuplicateCodes.push({
          ineCode: row.ineCode,
          municipality: row.municipality,
          province: row.province,
          sourceStatus: row.sourceStatus,
        })
      }
      seenActiveOverlayCodes.add(row.ineCode)
    }
  }
}

const excludedProvinces = exclusions.map((row) => ({
  ...row,
  pendingValidationMunicipalities:
    provinceStats.get(`${row.province} (${row.autonomousCommunity})`)?.pendingValidationMunicipalities ?? 0,
}))

const reviewedLowCoverageKeys = new Set(
  reviewedLowCoverageProvinces.map((row) => `${row.autonomousCommunity}|${row.province}`),
)

const lowCoverageProvinces = [...provinceStats.values()]
  .filter(
    (row) =>
      row.pendingValidationMunicipalities === 0 &&
      row.classifiedMunicipalities > 0 &&
      row.classifiedMunicipalities / row.totalMunicipalities < 0.02,
  )
  .sort((a, b) => a.classifiedMunicipalities / a.totalMunicipalities - b.classifiedMunicipalities / b.totalMunicipalities)

const reviewedLowCoverage = lowCoverageProvinces
  .filter((row) => reviewedLowCoverageKeys.has(`${row.autonomousCommunity}|${row.province}`))
  .map((row) => ({
    ...row,
    review: reviewedLowCoverageProvinces.find(
      (review) => review.autonomousCommunity === row.autonomousCommunity && review.province === row.province,
    ),
  }))

const suspiciousProvinces = lowCoverageProvinces.filter(
  (row) => !reviewedLowCoverageKeys.has(`${row.autonomousCommunity}|${row.province}`),
)

const extractionDiagnostics = {
  officialAppendixRows: official.length,
  officialRowsWithIneCode: official.filter((row) => row.ineCode).length,
  officialRowsWithoutIneCode: official.filter((row) => !row.ineCode).length,
  reconciliationMatchedRows: reconciliation?.matched ?? null,
  reconciliationUnmatchedRows: reconciliation?.unmatched ?? null,
  likelyProvinceMismatchCount: reconciliation?.likelyProvinceMismatchCount ?? null,
  likelyProvinceMismatchCountsByExtractedProvince:
    reconciliation?.likelyProvinceMismatchCountsByExtractedProvince ?? {},
}

const likelyProvinceMismatchesInSearchBase = []
for (const row of searchBase) {
  const possibleIneProvinces = [
    ...new Set(
      municipalityVariants(row.municipality).flatMap((municipality) => [
        ...(ineProvincesByMunicipality.get(municipality) ?? []),
      ]),
    ),
  ]

  if (possibleIneProvinces.length > 0 && !possibleIneProvinces.includes(row.province)) {
    likelyProvinceMismatchesInSearchBase.push({
      ineCode: row.ineCode,
      municipality: row.municipality,
      searchBaseProvince: row.province,
      possibleIneProvinces,
      zone: row.zone,
      sourceStatus: row.sourceStatus,
    })
    incrementObject(
      extractionDiagnostics.likelyProvinceMismatchCountsBySearchBaseProvince ??= {},
      row.province,
    )
  }
}

// Negative-completeness checks (2026-10-12, KAL-1708). The old report passed while whole provinces lost
// their classifications, because an absent province looks less suspicious than a sparse one.
const searchBaseByCode = new Map(searchBase.map((row) => [row.ineCode, row]))
const independentCheckContradictions = []
let independentCheckAgreeing = 0
let independentCheckWithheld = 0
for (const entry of independentCheck.entries) {
  const row = searchBaseByCode.get(entry.ineCode)
  if (!row) {
    independentCheckContradictions.push({ ...entry, shown: 'missing from search base' })
  } else if (row.sourceStatus === 'pending_validation') {
    independentCheckWithheld += 1
  } else if (row.zone !== entry.zone) {
    independentCheckContradictions.push({ ...entry, shown: row.zone, sourceStatus: row.sourceStatus })
  } else {
    independentCheckAgreeing += 1
  }
}

// Any province whose Appendix B rows the independent check expects, but which has no classified
// municipality and is not withheld, is release-blocking: that is exactly how Castilla-La Mancha vanished.
const independentProvinces = new Set(independentCheck.entries.map((entry) => entry.province))
const provincesMissingClassifications = [...provinceStats.values()]
  .filter((row) => independentProvinces.has(row.province))
  .filter((row) => row.classifiedMunicipalities === 0 && row.pendingValidationMunicipalities < row.totalMunicipalities)
  .map((row) => row.province)

// Two Appendix B rows reconciled to one INE code must agree on the zone (e.g. merged municipalities).
const officialZonesByCode = new Map()
for (const row of official) {
  if (!row.ineCode) continue
  if (!officialZonesByCode.has(row.ineCode)) officialZonesByCode.set(row.ineCode, new Set())
  officialZonesByCode.get(row.ineCode).add(row.zone)
}
const conflictingOfficialZones = [...officialZonesByCode.entries()]
  .filter(([, zones]) => zones.size > 1)
  .map(([ineCode, zones]) => ({ ineCode, zones: [...zones] }))

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  extractionDiagnostics,
  publicSearchBaseDiagnostics: {
    activeOverlayCodeMismatchCount: activeOverlayCodeMismatches.length,
    activeOverlayCodeMismatches,
    activeOverlayDuplicateCodeCount: activeOverlayDuplicateCodes.length,
    activeOverlayDuplicateCodes,
    likelyProvinceMismatchCount: likelyProvinceMismatchesInSearchBase.length,
    likelyProvinceMismatchesInSearchBase,
  },
  independentCheckDiagnostics: {
    entries: independentCheck.entries.length,
    agreeing: independentCheckAgreeing,
    withheld: independentCheckWithheld,
    contradictionCount: independentCheckContradictions.length,
    contradictions: independentCheckContradictions,
    provincesMissingClassifications,
    conflictingOfficialZones,
  },
  excludedProvinces,
  reviewedLowCoverageProvinces: reviewedLowCoverage,
  suspiciousProvinces,
  provinceStats: [...provinceStats.values()].sort((a, b) => a.province.localeCompare(b.province, 'es')),
}

await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8')

console.log(JSON.stringify(report.summary, null, 2))
console.log(JSON.stringify(report.extractionDiagnostics, null, 2))
console.log(JSON.stringify(report.publicSearchBaseDiagnostics, null, 2))
console.log(`excluded provinces: ${excludedProvinces.length}`)
console.log(`reviewed low-coverage provinces: ${reviewedLowCoverage.length}`)
console.log(`suspicious provinces: ${suspiciousProvinces.length}`)
console.log(
  `independent check: ${independentCheckAgreeing} agree, ${independentCheckWithheld} withheld, ${independentCheckContradictions.length} contradictions; provinces missing classifications: ${provincesMissingClassifications.length}`,
)

const releaseBlocking = {
  activeOverlayCodeMismatches: activeOverlayCodeMismatches.length,
  activeOverlayDuplicateCodes: activeOverlayDuplicateCodes.length,
  likelyProvinceMismatchesInSearchBase: likelyProvinceMismatchesInSearchBase.length,
  suspiciousProvinces: suspiciousProvinces.length,
  independentCheckContradictions: independentCheckContradictions.length,
  provincesMissingClassifications: provincesMissingClassifications.length,
  conflictingOfficialZones: conflictingOfficialZones.length,
}
const failures = Object.entries(releaseBlocking).filter(([, count]) => count > 0)
if (failures.length > 0) {
  console.error(`RELEASE-BLOCKING: ${failures.map(([name, count]) => `${name}=${count}`).join(', ')}`)
  process.exitCode = 1
} else {
  console.log('release checks: pass')
}
