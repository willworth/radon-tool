import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const searchBasePath = path.join(root, 'src/data/municipalities.search-base.json')
const exclusionsPath = path.join(root, 'src/data/appendixB.manual-exclusions.json')
const outPath = path.join(root, 'data-source/search-base-validation-report.json')

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

const searchBase = JSON.parse(await fs.readFile(searchBasePath, 'utf8'))
const exclusions = JSON.parse(await fs.readFile(exclusionsPath, 'utf8'))

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
}

const excludedProvinces = exclusions.map((row) => ({
  ...row,
  pendingValidationMunicipalities:
    provinceStats.get(`${row.province} (${row.autonomousCommunity})`)?.pendingValidationMunicipalities ?? 0,
}))

const suspiciousProvinces = [...provinceStats.values()]
  .filter(
    (row) =>
      row.pendingValidationMunicipalities === 0 &&
      row.classifiedMunicipalities > 0 &&
      row.classifiedMunicipalities / row.totalMunicipalities < 0.02,
  )
  .sort((a, b) => a.classifiedMunicipalities / a.totalMunicipalities - b.classifiedMunicipalities / b.totalMunicipalities)

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  excludedProvinces,
  suspiciousProvinces,
  provinceStats: [...provinceStats.values()].sort((a, b) => a.province.localeCompare(b.province, 'es')),
}

await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8')

console.log(JSON.stringify(report.summary, null, 2))
console.log(`excluded provinces: ${excludedProvinces.length}`)
console.log(`suspicious provinces: ${suspiciousProvinces.length}`)
