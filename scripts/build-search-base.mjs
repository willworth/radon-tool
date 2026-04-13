import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const inePath = path.join(root, 'data-source/ine-municipios-55200.json')
const appendixPath = path.join(root, 'src/data/municipalities.official.json')
const exclusionsPath = path.join(root, 'src/data/appendixB.manual-exclusions.json')
const outPath = path.join(root, 'src/data/municipalities.search-base.json')

const provinceToCcaa = {
  'Álava / Araba': 'País Vasco',
  'Albacete': 'Castilla-La Mancha',
  'Alicante / Alacant': 'Comunidad Valenciana',
  'Almería': 'Andalucía',
  'Ávila': 'Castilla y León',
  'Badajoz': 'Extremadura',
  'Islas Baleares / Illes Balears': 'Islas Baleares',
  'Barcelona': 'Cataluña',
  'Burgos': 'Castilla y León',
  'Cáceres': 'Extremadura',
  'Cádiz': 'Andalucía',
  'Castellón / Castelló': 'Comunidad Valenciana',
  'Ciudad Real': 'Castilla-La Mancha',
  'Córdoba': 'Andalucía',
  'La Coruña / A Coruña': 'Galicia',
  'Cuenca': 'Castilla-La Mancha',
  'Gerona / Girona': 'Cataluña',
  'Granada': 'Andalucía',
  'Guadalajara': 'Castilla-La Mancha',
  'Guipúzcoa / Gipuzkoa': 'País Vasco',
  'Huelva': 'Andalucía',
  'Huesca': 'Aragón',
  'Jaén': 'Andalucía',
  'León': 'Castilla y León',
  'Lérida / Lleida': 'Cataluña',
  'La Rioja': 'La Rioja',
  'Lugo': 'Galicia',
  'Madrid': 'Comunidad de Madrid',
  'Málaga': 'Andalucía',
  'Murcia': 'Murcia',
  'Navarra': 'Comunidad Foral de Navarra',
  'Orense / Ourense': 'Galicia',
  'Asturias': 'Principado de Asturias',
  'Palencia': 'Castilla y León',
  'Las Palmas': 'Canarias',
  'Pontevedra': 'Galicia',
  'Salamanca': 'Castilla y León',
  'Santa Cruz de Tenerife': 'Canarias',
  'Cantabria': 'Cantabria',
  'Segovia': 'Castilla y León',
  'Sevilla': 'Andalucía',
  'Soria': 'Castilla y León',
  'Tarragona': 'Cataluña',
  'Teruel': 'Aragón',
  'Toledo': 'Castilla-La Mancha',
  'Valencia / València': 'Comunidad Valenciana',
  'Valladolid': 'Castilla y León',
  'Vizcaya / Bizkaia': 'País Vasco',
  'Zamora': 'Castilla y León',
  'Zaragoza': 'Aragón',
  'Ceuta': 'Ciudad Autónoma de Ceuta',
  'Melilla': 'Ciudad Autónoma de Melilla',
}

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const manualOverlay = new Map([
  ['yecla|murcia', 'not_classified'],
])

const ine = JSON.parse(await fs.readFile(inePath, 'utf8'))
const appendix = JSON.parse(await fs.readFile(appendixPath, 'utf8'))
const exclusions = JSON.parse(await fs.readFile(exclusionsPath, 'utf8'))
const excludedProvinceKeys = new Set(
  exclusions.map((row) => `${row.autonomousCommunity}|${row.province}`),
)

const filteredAppendix = appendix.filter(
  (row) => !excludedProvinceKeys.has(`${row.autonomousCommunity}|${row.province}`),
)

const overlay = new Map()
for (const row of filteredAppendix) {
  const key = `${normalize(row.municipality)}|${normalize(row.province)}`
  overlay.set(key, row.zone === '1' ? 'I' : row.zone === '2' ? 'II' : 'not_classified')
}

const base = ine
  .filter((row) => provinceToCcaa[row.province])
  .map((row) => {
    const key = `${normalize(row.municipality)}|${normalize(row.province)}`
    const zone = manualOverlay.get(key) ?? overlay.get(key) ?? 'not_classified'
    return {
      ineCode: row.code,
      municipality: row.municipality,
      province: row.province,
      autonomousCommunity: provinceToCcaa[row.province],
      zone,
      sourceStatus: zone === 'not_classified' ? 'official' : 'official',
    }
  })

await fs.writeFile(outPath, JSON.stringify(base, null, 2) + '\n', 'utf8')
console.log(`wrote ${base.length} records to ${outPath}`)
console.log(`overlay rows retained: ${filteredAppendix.length} / ${appendix.length}`)
console.log(base.find((row) => row.municipality === 'Yecla' && row.province === 'Murcia'))
