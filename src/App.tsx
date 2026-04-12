import { useMemo, useState } from 'react'
import { municipalities, municipalityDataStatus } from './data/municipalities'
import type { BuildingAge, FloorLevel, HousingType, MunicipalityRecord, RadonZone } from './types'

const zoneCopy: Record<
  RadonZone,
  {
    titleEs: string
    titleEn: string
    descriptionEs: string
    descriptionEn: string
    nextStepsEs: string[]
    nextStepsEn: string[]
  }
> = {
  II: {
    titleEs: 'Zona II',
    titleEn: 'Zone II',
    descriptionEs:
      'Municipio de mayor potencial de radón según la clasificación reglamentaria. No predice la concentración exacta de una vivienda concreta.',
    descriptionEn:
      'Municipality with higher radon potential under the regulatory classification. It does not predict the exact concentration in any specific home.',
    nextStepsEs: [
      'Prioriza la medición si vives en sótano, planta baja o primera planta.',
      'Si la vivienda es anterior a la protección moderna frente al radón, conviene medir con más urgencia.',
      'Si el resultado supera 300 Bq/m³, busca asesoramiento técnico sobre mitigación.',
    ],
    nextStepsEn: [
      'Prioritise testing if you live in a basement, ground floor, or first floor home.',
      'If the dwelling predates modern radon protection, testing becomes more urgent.',
      'If the result exceeds 300 Bq/m³, seek technical advice about mitigation.',
    ],
  },
  I: {
    titleEs: 'Zona I',
    titleEn: 'Zone I',
    descriptionEs:
      'Municipio con potencial apreciable de radón. El riesgo real depende también del tipo de vivienda, la planta y cómo se construyó.',
    descriptionEn:
      'Municipality with meaningful radon potential. Real risk also depends on the building type, floor level, and construction details.',
    nextStepsEs: [
      'Medir sigue siendo razonable, sobre todo en viviendas bajas o unifamiliares.',
      'Interpreta el mapa como orientación inicial, no como diagnóstico.',
      'Si compras, alquilas o reformas, pide información específica sobre protección y ventilación.',
    ],
    nextStepsEn: [
      'Testing is still sensible, especially in houses and lower floors.',
      'Treat the map as an initial guide, not a diagnosis.',
      'If you are buying, renting, or renovating, ask for specific information on protection and ventilation.',
    ],
  },
  not_classified: {
    titleEs: 'No clasificado',
    titleEn: 'Not classified',
    descriptionEs:
      'El municipio no figura aquí como Zona I o Zona II. Eso no garantiza niveles bajos: solo indica que esta clasificación no lo señala como prioritario.',
    descriptionEn:
      'The municipality is not listed here as Zone I or Zone II. That does not guarantee low levels, it only means this classification does not flag it as a priority area.',
    nextStepsEs: [
      'Si hay sótano, planta baja, roca granítica o dudas razonables, medir sigue siendo válido.',
      'Usa el resultado con cautela y busca datos locales adicionales cuando existan.',
      'La medición directa sigue siendo la única forma de saber el nivel real.',
    ],
    nextStepsEn: [
      'If there is a basement, ground floor exposure, granite geology, or reasonable concern, testing can still make sense.',
      'Use this result cautiously and look for better local data when available.',
      'Direct measurement remains the only way to know the real level.',
    ],
  },
}

function scoreContext(zone: RadonZone, housingType: HousingType, floor: FloorLevel, age: BuildingAge) {
  let score = zone === 'II' ? 3 : zone === 'I' ? 2 : 1
  if (housingType === 'house') score += 1
  if (floor === 'basement_ground') score += 2
  if (floor === 'first') score += 1
  if (age === 'pre_2006') score += 1
  if (age === '2020_plus') score -= 1

  if (score >= 5) {
    return {
      bandEs: 'Prioridad alta para medir',
      bandEn: 'High testing priority',
      detailEs: 'La combinación de municipio y contexto de vivienda sugiere que conviene medir pronto.',
      detailEn: 'The municipality plus housing context suggests testing should be a near-term priority.',
    }
  }

  if (score >= 3) {
    return {
      bandEs: 'Conviene medir',
      bandEn: 'Testing is advisable',
      detailEs: 'No es una urgencia absoluta, pero una medición doméstica tendría sentido práctico.',
      detailEn: 'Not an absolute emergency, but a home radon measurement would be a practical next step.',
    }
  }

  return {
    bandEs: 'Prioridad menor, pero posible',
    bandEn: 'Lower priority, still possible',
    detailEs: 'El contexto parece menos expuesto, aunque la medición sigue siendo la única comprobación real.',
    detailEn: 'The context appears less exposed, although direct measurement is still the only real check.',
  }
}

function formatOption(m: MunicipalityRecord) {
  return `${m.municipality}, ${m.province}`
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MunicipalityRecord | null>(null)
  const [housingType, setHousingType] = useState<HousingType>('flat')
  const [floor, setFloor] = useState<FloorLevel>('first')
  const [age, setAge] = useState<BuildingAge>('unknown')

  const matches = useMemo(() => {
    const trimmed = normalizeSearchValue(query)
    if (!trimmed) return municipalities.slice(0, 8)

    return municipalities
      .map((m) => ({
        record: m,
        haystack: normalizeSearchValue(
          `${m.municipality} ${m.province} ${m.autonomousCommunity}`,
        ),
      }))
      .filter(({ haystack }) => haystack.includes(trimmed))
      .sort((a, b) => {
        const aStarts = normalizeSearchValue(a.record.municipality).startsWith(trimmed)
        const bStarts = normalizeSearchValue(b.record.municipality).startsWith(trimmed)
        if (aStarts !== bStarts) return aStarts ? -1 : 1
        return a.record.municipality.localeCompare(b.record.municipality, 'es')
      })
      .slice(0, 8)
      .map(({ record }) => record)
  }, [query])

  const result = selected ? zoneCopy[selected.zone] : null
  const context = selected ? scoreContext(selected.zone, housingType, floor, age) : null

  return (
    <div className="page">
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">España · Spain</p>
          <h1>Consulta preliminar de radón por municipio</h1>
          <p className="lede">
            Herramienta estática para una primera orientación pública. Busca tu municipio, revisa la zona
            regulatoria y añade un poco de contexto sobre la vivienda. Está pensada para funcionar bien desde
            móvil, sin florituras. English guidance appears alongside the Spanish copy.
          </p>
          <div className="notice warning">
            <strong>Estado del dato / Data status:</strong> {municipalityDataStatus.message}
          </div>
        </section>

        <section className="card searchCard">
          <label htmlFor="municipality-search">Municipio / Municipality</label>
          <input
            id="municipality-search"
            type="text"
            placeholder="Ej. Arteixo, Madrid, Sevilla"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(null)
            }}
          />
          <div className="results" role="listbox" aria-label="Municipality matches">
            {matches.map((match) => (
              <button
                key={match.ineCode}
                type="button"
                className={`resultButton ${selected?.ineCode === match.ineCode ? 'resultButton-active' : ''}`}
                onClick={() => {
                  setSelected(match)
                  setQuery(formatOption(match))
                }}
              >
                <span>{match.municipality}</span>
                <small>
                  {match.province} · {match.autonomousCommunity}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="card contextCard">
          <h2>Contexto de vivienda / Housing context</h2>
          <div className="grid">
            <label>
              Tipo / Type
              <select value={housingType} onChange={(e) => setHousingType(e.target.value as HousingType)}>
                <option value="house">Casa / House</option>
                <option value="flat">Piso / Flat</option>
              </select>
            </label>
            <label>
              Planta / Floor
              <select value={floor} onChange={(e) => setFloor(e.target.value as FloorLevel)}>
                <option value="basement_ground">Sótano o baja / Basement or ground</option>
                <option value="first">Primera planta / First floor</option>
                <option value="second_or_higher">Segunda o superior / Second floor or higher</option>
              </select>
            </label>
            <label>
              Antigüedad aproximada / Rough age
              <select value={age} onChange={(e) => setAge(e.target.value as BuildingAge)}>
                <option value="pre_2006">Antes de 2006 / Before 2006</option>
                <option value="2006_2019">2006–2019</option>
                <option value="2020_plus">2020+ (posible protección CTE) / Possible code protection</option>
                <option value="unknown">No lo sé / Unknown</option>
              </select>
            </label>
          </div>
        </section>

        {selected && result && context ? (
          <section className="card resultCard">
            <div className="resultHeader">
              <div>
                <p className="eyebrow">Resultado / Result</p>
                <h2>
                  {selected.municipality}, {selected.province}
                </h2>
                <p className="selectedMeta">{selected.autonomousCommunity}</p>
              </div>
              <div className={`badge badge-${selected.zone}`}>{result.titleEs}</div>
            </div>

            <div className="dual">
              <div>
                <h3>{result.titleEs}</h3>
                <p>{result.descriptionEs}</p>
              </div>
              <div>
                <h3>{result.titleEn}</h3>
                <p>{result.descriptionEn}</p>
              </div>
            </div>

            <div className="contextBand">
              <strong>
                {context.bandEs} / {context.bandEn}
              </strong>
              <p>
                {context.detailEs} {context.detailEn}
              </p>
            </div>

            <div className="dual">
              <div>
                <h3>Siguientes pasos</h3>
                <ul>
                  {result.nextStepsEs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Next steps</h3>
                <ul>
                  {result.nextStepsEn.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="notice">
              <strong>Disclaimer:</strong> Esta herramienta no estima el nivel real de tu vivienda. Solo una
              medición con detector puede confirmarlo. This tool is not an address-level or building-level risk
              calculator.
            </div>
          </section>
        ) : (
          <section className="card emptyState">
            <h2>Selecciona un municipio</h2>
            <p>
              La interfaz ya usa un extracto oficial del Apéndice B del CTE DB-HS6. Aun así, tómalo como una
              orientación municipal inicial, no como una estimación de vivienda concreta.
            </p>
          </section>
        )}

        <section className="card infoGrid">
          <article>
            <h2>Qué es el radón / What is radon?</h2>
            <p>
              El radón es un gas radiactivo natural que puede acumularse en interiores, especialmente en contacto
              con el terreno. / Radon is a naturally occurring radioactive gas that can build up indoors,
              especially in spaces close to the ground.
            </p>
          </article>
          <article>
            <h2>Cómo interpretar la zona / How to read the zone</h2>
            <p>
              La clasificación municipal sirve para priorizar dónde medir antes, no para descartar riesgo en una
              vivienda concreta. / Municipality-level classification helps prioritise where to test first, not to
              rule risk in or out for a specific property.
            </p>
          </article>
          <article>
            <h2>Qué falta en v1 / What is missing in v1</h2>
            <p>
              No hay búsqueda por dirección, integración catastral ni mapa detallado todavía. / There is no
              address lookup, cadastral integration, or detailed map yet.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
