import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const officialPath = path.join(root, 'src/data/municipalities.official.json')
const outPath = officialPath
const ineCachePath = path.join(root, 'data-source/ine-municipios-55200.json')

const provinceCodeToName = {
  '01': 'Álava / Araba',
  '02': 'Albacete',
  '03': 'Alicante / Alacant',
  '04': 'Almería',
  '05': 'Ávila',
  '06': 'Badajoz',
  '07': 'Islas Baleares / Illes Balears',
  '08': 'Barcelona',
  '09': 'Burgos',
  '10': 'Cáceres',
  '11': 'Cádiz',
  '12': 'Castellón / Castelló',
  '13': 'Ciudad Real',
  '14': 'Córdoba',
  '15': 'La Coruña / A Coruña',
  '16': 'Cuenca',
  '17': 'Gerona / Girona',
  '18': 'Granada',
  '19': 'Guadalajara',
  '20': 'Guipúzcoa / Gipuzkoa',
  '21': 'Huelva',
  '22': 'Huesca',
  '23': 'Jaén',
  '24': 'León',
  '25': 'Lérida / Lleida',
  '26': 'La Rioja',
  '27': 'Lugo',
  '28': 'Madrid',
  '29': 'Málaga',
  '30': 'Murcia',
  '31': 'Navarra',
  '32': 'Orense / Ourense',
  '33': 'Asturias',
  '34': 'Palencia',
  '35': 'Las Palmas',
  '36': 'Pontevedra',
  '37': 'Salamanca',
  '38': 'Santa Cruz de Tenerife',
  '39': 'Cantabria',
  '40': 'Segovia',
  '41': 'Sevilla',
  '42': 'Soria',
  '43': 'Tarragona',
  '44': 'Teruel',
  '45': 'Toledo',
  '46': 'Valencia / València',
  '47': 'Valladolid',
  '48': 'Vizcaya / Bizkaia',
  '49': 'Zamora',
  '50': 'Zaragoza',
  '51': 'Ceuta',
  '52': 'Melilla',
}

const provinceAliases = new Map([
  ['Álava / Araba', ['Álava / Araba']],
  ['Islas Baleares / Illes Balears', ['Islas Baleares / Illes Balears', 'Islas Baleares']],
  ['La Coruña / A Coruña', ['La Coruña / A Coruña', 'A Coruña']],
  ['Gerona / Girona', ['Gerona / Girona']],
  ['Lérida / Lleida', ['Lérida / Lleida']],
  ['Orense / Ourense', ['Orense / Ourense']],
  ['Guipúzcoa / Gipuzkoa', ['Guipúzcoa / Gipuzkoa']],
  ['Vizcaya / Bizkaia', ['Vizcaya / Bizkaia']],
  ['Navarra', ['Navarra']],
  ['Asturias', ['Asturias']],
  ['Ceuta', ['Ceuta']],
])

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[·']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(santa|sant|san|el|la|los|las|l|a)\b/gu, (m) => m)
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

function provinceVariants(name) {
  const extra = provinceAliases.get(name) ?? [name]
  return [...new Set(extra.map(normalize))]
}

async function loadIneMunicipios() {
  try {
    const cached = JSON.parse(await fs.readFile(ineCachePath, 'utf8'))
    return cached
  } catch {}

  const res = await fetch('https://servicios.ine.es/wstempus/js/es/DATOS_TABLA/55200?tip=AM')
  if (!res.ok) throw new Error(`Failed INE fetch: ${res.status}`)
  const json = await res.json()
  const municipios = []
  const seen = new Set()

  for (const row of json) {
    const meta = row.MetaData?.find((m) => m.T3_Variable === 'Municipios')
    if (!meta?.Codigo || seen.has(meta.Codigo)) continue
    seen.add(meta.Codigo)
    const code = String(meta.Codigo).padStart(5, '0')
    const provinceCode = code.slice(0, 2)
    const province = provinceCodeToName[provinceCode]
    if (!province) continue
    const fullName = String(meta.Nombre || '').replace(/^\d{5}\s+/, '').trim()
    municipios.push({ code, municipality: fullName, province })
  }

  await fs.mkdir(path.dirname(ineCachePath), { recursive: true })
  await fs.writeFile(ineCachePath, JSON.stringify(municipios, null, 2) + '\n', 'utf8')
  return municipios
}

const manualAliases = new Map([
  ['arteixo|la coruna a coruna', '15005'],
  ['sagunto sagunt|valencia valencia', '46220'],
  ['moreda de alava moreda araba|alava araba', '01039'],
  ['abanto y ciervana abanto zierbena|vizcaya bizkaia', '48002'],
  ['karrantza harana valle de carranza|vizcaya bizkaia', '48022'],
  ['gargantilla del lozoya y pinilla de buitrago|madrid', '28062'],
  ['las tres villas|almeria', '04901'],
  ['la taha|granada', '18901'],
  ['la calahorra|granada', '18045'],
  ['el guijo|cordoba', '14035'],
  ['el viso|cordoba', '14074'],
])

async function main() {
  const official = JSON.parse(await fs.readFile(officialPath, 'utf8'))
  const ineMunicipios = await loadIneMunicipios()

  const ineByProvAndName = new Map()
  for (const item of ineMunicipios) {
    for (const p of provinceVariants(item.province)) {
      for (const m of municipalityVariants(item.municipality)) {
        ineByProvAndName.set(`${m}|${p}`, item.code)
      }
    }
  }

  let matched = 0
  let unmatched = 0
  const unmatchedRows = []

  const reconciled = official.map((row) => {
    const provinceKeys = provinceVariants(row.province)
    const muniKeys = municipalityVariants(row.municipality)

    let ineCode = null
    for (const p of provinceKeys) {
      for (const m of muniKeys) {
        const manual = manualAliases.get(`${m}|${p}`)
        if (manual) {
          ineCode = manual
          break
        }
        const found = ineByProvAndName.get(`${m}|${p}`)
        if (found) {
          ineCode = found
          break
        }
      }
      if (ineCode) break
    }

    if (ineCode) matched += 1
    else {
      unmatched += 1
      unmatchedRows.push(`${row.autonomousCommunity} | ${row.province} | ${row.municipality}`)
    }

    return {
      ...row,
      ineCode: ineCode ?? undefined,
    }
  })

  await fs.writeFile(outPath, JSON.stringify(reconciled, null, 2) + '\n', 'utf8')
  await fs.writeFile(
    path.join(root, 'data-source/ine-reconciliation-report.json'),
    JSON.stringify({ matched, unmatched, unmatchedRows: unmatchedRows.slice(0, 200) }, null, 2) + '\n',
    'utf8',
  )

  console.log(JSON.stringify({ matched, unmatched, total: reconciled.length }, null, 2))
  if (unmatchedRows.length) {
    console.log('sample unmatched:', unmatchedRows.slice(0, 20))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
