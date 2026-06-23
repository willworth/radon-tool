import { useMemo, useState } from 'react'
import { municipalities, municipalityDataStatus, municipalityDataSummary } from './data/municipalities'
import type {
  BuildingAge,
  FloorLevel,
  HousingType,
  MunicipalityRecord,
  MunicipalitySourceStatus,
  RadonZone,
} from './types'

type Language = 'es' | 'en'

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

const pendingValidationCopy = {
  titleEs: 'Clasificación pendiente de validación',
  titleEn: 'Classification pending validation',
  descriptionEs:
    'Este municipio está en una provincia cuyo bloque del Apéndice B se retiró temporalmente de la superposición por problemas de extracción o reconciliación. Este resultado no significa “riesgo bajo” ni “no clasificado” con seguridad.',
  descriptionEn:
    'This municipality sits in a province whose Appendix B block was temporarily removed from the overlay because of extraction or reconciliation problems. This result does not safely mean “low risk” or “not classified”.',
  nextStepsEs: [
    'Trata este caso como dato pendiente, no como tranquilidad confirmada.',
    'Si la vivienda está en contacto con el terreno o hay preocupación razonable, medir sigue siendo una decisión válida.',
    'Antes de compartir públicamente este caso como referencia, conviene revisar la provincia en la fuente oficial.',
  ],
  nextStepsEn: [
    'Treat this as pending data, not as confirmed reassurance.',
    'If the home is in contact with the ground or there is reasonable concern, testing can still be sensible.',
    'Before relying on this publicly, the province should be rechecked against the official source.',
  ],
} as const

function isClassificationPending(record: MunicipalityRecord) {
  return record.sourceStatus === 'pending_validation'
}

function sourceStatusLabel(language: Language, sourceStatus?: MunicipalitySourceStatus, zone?: RadonZone) {
  if (sourceStatus === 'pending_validation') return tcopy(language, 'Pendiente de validación', 'Pending validation')
  if (sourceStatus === 'manual_override') {
    return zone === 'not_classified'
      ? tcopy(language, 'No clasificado (ajuste manual)', 'Not classified (manual adjustment)')
      : tcopy(language, 'Ajuste manual', 'Manual adjustment')
  }
  return resultBadgeLabel(language, zone ?? 'not_classified')
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

function municipalitySearchVariants(municipality: string) {
  const normalized = normalizeSearchValue(municipality)
  const variants = new Set([normalized])
  const articleSuffix = municipality.match(/^(.+),\s*(el|la|los|las|l['’])$/i)

  if (articleSuffix) {
    variants.add(normalizeSearchValue(`${articleSuffix[2]} ${articleSuffix[1]}`))
  }

  return [...variants]
}

function municipalityMatches(record: MunicipalityRecord, predicate: (value: string) => boolean) {
  return municipalitySearchVariants(record.municipality).some(predicate)
}

function searchableText(record: MunicipalityRecord) {
  return normalizeSearchValue(
    [
      ...municipalitySearchVariants(record.municipality),
      record.province,
      record.autonomousCommunity,
    ].join(' '),
  )
}

function searchRank(record: MunicipalityRecord, query: string) {
  const province = normalizeSearchValue(record.province)
  const community = normalizeSearchValue(record.autonomousCommunity)
  const option = normalizeSearchValue(formatOption(record))

  if (municipalityMatches(record, (municipality) => municipality === query) || option === query) return 0
  if (province === query) return 1
  if (province.startsWith(query)) return 2
  if (community === query) return 3
  if (municipalityMatches(record, (municipality) => municipality.startsWith(query))) return 4
  if (municipalityMatches(record, (municipality) => municipality.includes(query))) return 5
  if (province.includes(query)) return 6
  if (community.includes(query)) return 7
  return 8
}

function resultBadgeLabel(language: Language, zone: RadonZone) {
  if (zone === 'II') return tcopy(language, 'Zona II', 'Zone II')
  if (zone === 'I') return tcopy(language, 'Zona I', 'Zone I')
  return tcopy(language, 'No clasificado', 'Not classified')
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function tcopy(language: Language, es: string, en: string) {
  return language === 'es' ? es : en
}

function formatCount(language: Language, value: number) {
  return value.toLocaleString(language === 'es' ? 'es-ES' : 'en-US')
}

export default function App() {
  const [language, setLanguage] = useState<Language>('es')
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
        haystack: searchableText(m),
      }))
      .filter(({ haystack }) => haystack.includes(trimmed))
      .sort((a, b) => {
        const rankDifference = searchRank(a.record, trimmed) - searchRank(b.record, trimmed)
        if (rankDifference !== 0) return rankDifference

        const zonePriority = { II: 0, I: 1, not_classified: 2 } satisfies Record<RadonZone, number>
        const zoneDifference = zonePriority[a.record.zone] - zonePriority[b.record.zone]
        if (zoneDifference !== 0) return zoneDifference

        return a.record.municipality.localeCompare(b.record.municipality, 'es')
      })
      .slice(0, 8)
      .map(({ record }) => record)
  }, [query])

  const normalizedQuery = normalizeSearchValue(query)
  const provinceMatchNotice =
    normalizedQuery &&
    !selected &&
    matches.length > 0 &&
    matches.every((match) => normalizeSearchValue(match.province).includes(normalizedQuery))
  const selectedHasPendingClassification = selected ? isClassificationPending(selected) : false
  const result = selected
    ? selectedHasPendingClassification
      ? pendingValidationCopy
      : zoneCopy[selected.zone]
    : null
  const context =
    selected && !selectedHasPendingClassification ? scoreContext(selected.zone, housingType, floor, age) : null
  const hasQuery = query.trim().length > 0
  const currentTitle = selectedHasPendingClassification
    ? tcopy(language, pendingValidationCopy.titleEs, pendingValidationCopy.titleEn)
    : selected
      ? tcopy(language, zoneCopy[selected.zone].titleEs, zoneCopy[selected.zone].titleEn)
      : ''

  return (
    <div className="page">
      <main className="shell">
        <section className="hero">
          <div className="languageToggle" aria-label="Language selector">
            <button
              type="button"
              className={`languageButton ${language === 'es' ? 'languageButton-active' : ''}`}
              onClick={() => setLanguage('es')}
            >
              ES
            </button>
            <button
              type="button"
              className={`languageButton ${language === 'en' ? 'languageButton-active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
          </div>
          <p className="eyebrow">{tcopy(language, 'España · Radón', 'Spain · Radon')}</p>
          <h1>{tcopy(language, '¿Hay radón en tu municipio?', 'Is there radon in your municipality?')}</h1>
          <p className="lede">
            {tcopy(
              language,
              'Escribe tu municipio y verás si está marcado como zona de atención por radón, qué significa y qué puedes hacer. Es gratis, sin ánimo de lucro y sin nada que vender. Orienta; no certifica ni sustituye una medición.',
              'Type your municipality and see whether it is flagged as a radon priority area, what that means, and what you can do. Free, non-commercial, with nothing to sell. It orients; it does not certify or replace a measurement.',
            )}
          </p>
          <div className="notice warning">
            <strong>{tcopy(language, 'Estado del dato:', 'Data status:')}</strong>{' '}
            {tcopy(language, municipalityDataStatus.messageEs, municipalityDataStatus.messageEn)}
          </div>
        </section>

        <section className="card searchCard">
          <div className="sectionIntro">
            <div>
              <p className="eyebrow">{tcopy(language, 'Paso 1', 'Step 1')}</p>
              <h2>{tcopy(language, 'Busca tu municipio', 'Search your municipality')}</h2>
            </div>
            <p>
              {tcopy(
                language,
                'Empieza escribiendo municipio, provincia o ambos. Los acentos no son obligatorios para encontrar resultados.',
                'Start by typing the municipality, the province, or both. Accents are not required to find results.',
              )}
            </p>
          </div>
          <label htmlFor="municipality-search">{tcopy(language, 'Municipio', 'Municipality')}</label>
          <input
            id="municipality-search"
            type="text"
            placeholder={tcopy(language, 'Ej. Yecla, Arteixo, Madrid, Sevilla', 'E.g. Yecla, Arteixo, Madrid, Seville')}
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
          {provinceMatchNotice ? (
            <p className="searchHint">
              {tcopy(
                language,
                'Estás viendo coincidencias de una provincia. Elige el municipio concreto para ver la clasificación; si una provincia está pendiente, no lo leas como riesgo bajo.',
                'You are seeing province-level matches. Choose the specific municipality to see its classification; if a province is pending, do not read that as low risk.',
              )}
            </p>
          ) : null}
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
                  {match.province} · {match.autonomousCommunity} · {sourceStatusLabel(language, match.sourceStatus, match.zone)}
                </small>
              </button>
            ))}
            {hasQuery && matches.length === 0 ? (
              <div className="noResults">
                <strong>{tcopy(language, 'No encuentro ese municipio.', "I can't find that municipality.")}</strong>
                <p>
                  {tcopy(
                    language,
                    'Prueba con el nombre oficial, con o sin acentos, o añade la provincia.',
                    'Try the official municipality name, with or without accents, or add the province.',
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card contextCard">
          <div className="sectionIntro">
            <div>
              <p className="eyebrow">{tcopy(language, 'Paso 2', 'Step 2')}</p>
              <h2>{tcopy(language, 'Contexto de vivienda', 'Housing context')}</h2>
            </div>
            <p>{tcopy(language, 'Sirve para priorizar si medir pronto tiene sentido práctico. No sustituye una medición real.', 'This helps prioritise whether testing soon is practically worthwhile. It does not replace a real measurement.')}</p>
          </div>
          <div className="grid">
            <label>
              {tcopy(language, 'Tipo', 'Type')}
              <select value={housingType} onChange={(e) => setHousingType(e.target.value as HousingType)}>
                <option value="house">{tcopy(language, 'Casa', 'House')}</option>
                <option value="flat">{tcopy(language, 'Piso', 'Flat')}</option>
              </select>
            </label>
            <label>
              {tcopy(language, 'Planta', 'Floor')}
              <select value={floor} onChange={(e) => setFloor(e.target.value as FloorLevel)}>
                <option value="basement_ground">{tcopy(language, 'Sótano o baja', 'Basement or ground')}</option>
                <option value="first">{tcopy(language, 'Primera planta', 'First floor')}</option>
                <option value="second_or_higher">{tcopy(language, 'Segunda o superior', 'Second floor or higher')}</option>
              </select>
            </label>
            <label>
              {tcopy(language, 'Antigüedad aproximada', 'Rough age')}
              <select value={age} onChange={(e) => setAge(e.target.value as BuildingAge)}>
                <option value="pre_2006">{tcopy(language, 'Antes de 2006', 'Before 2006')}</option>
                <option value="2006_2019">2006–2019</option>
                <option value="2020_plus">{tcopy(language, '2020+ (posible protección CTE)', '2020+ (possible code protection)')}</option>
                <option value="unknown">{tcopy(language, 'No lo sé', 'Unknown')}</option>
              </select>
            </label>
          </div>
        </section>

        {selected && result ? (
          <section className="card resultCard">
            <div className="resultHeader">
              <div>
                <p className="eyebrow">{tcopy(language, 'Resultado', 'Result')}</p>
                <h2>
                  {selected.municipality}, {selected.province}
                </h2>
                <p className="selectedMeta">{selected.autonomousCommunity}</p>
              </div>
              <div className={`badge ${selectedHasPendingClassification ? 'badge-pending' : `badge-${selected.zone}`}`}>
                {selectedHasPendingClassification ? tcopy(language, 'Pendiente', 'Pending') : currentTitle}
              </div>
            </div>

            {selected.zone === 'not_classified' && !selectedHasPendingClassification ? (
              <div className="reassuranceAlert" role="alert">
                <span className="reassuranceAlert-icon" aria-hidden="true">!</span>
                <div>
                  <strong>{tcopy(language, '«No clasificado» no significa «sin radón».', '“Not classified” does not mean “radon-free”.')}</strong>
                  <p>
                    {tcopy(
                      language,
                      'Solo quiere decir que esta lista oficial no marca tu municipio como prioritario — no que tu vivienda esté libre de radón. El nivel real depende también de la geología local, del edificio y de la planta. La forma de saberlo con seguridad es medir: es barato, sencillo y la única prueba fiable.',
                      'It only means this official list does not flag your municipality as a priority — not that your home is free of radon. The real level also depends on local geology, the building, and the floor. The way to know for sure is to measure: it is cheap, simple, and the only reliable check.',
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="dual">
              <div>
                <h3>{currentTitle}</h3>
                <p>{tcopy(language, result.descriptionEs, result.descriptionEn)}</p>
              </div>
              <div className="resultSideNote">
                <h3>{tcopy(language, 'Lectura rápida', 'Quick reading')}</h3>
                <p>
                  {tcopy(
                    language,
                    'La clasificación municipal orienta dónde priorizar una medición, pero no sustituye una prueba en la vivienda.',
                    'Municipality classification helps prioritise where to test, but it does not replace a direct home measurement.',
                  )}
                </p>
              </div>
            </div>

            {context ? (
              <div className="contextBand">
                <strong>
                  {tcopy(language, context.bandEs, context.bandEn)}
                </strong>
                <p>
                  {tcopy(language, context.detailEs, context.detailEn)}
                </p>
                <p>
                  {tcopy(
                    language,
                    'Esta priorización es un criterio editorial de la herramienta, no una clasificación oficial.',
                    'This prioritisation is the tool’s editorial judgement, not an official classification.',
                  )}
                </p>
              </div>
            ) : (
              <div className="notice warning">
                <strong>{tcopy(language, 'Interpretación:', 'Interpretation:')}</strong>{' '}
                {tcopy(
                  language,
                  'En provincias marcadas como pendientes no mostramos una prioridad resumida basada en zona porque la capa de clasificación sigue en revisión. El contexto de vivienda sigue importando, pero la capa municipal no es lo bastante fiable todavía.',
                  'In provinces marked as pending we do not show a zone-based priority summary because the classification layer is still under review. Housing context still matters, but the municipal overlay is not reliable enough yet.',
                )}
              </div>
            )}

            <div>
              <h3>{tcopy(language, 'Siguientes pasos', 'Next steps')}</h3>
              <ul>
                {(language === 'es' ? result.nextStepsEs : result.nextStepsEn).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="notice">
              <strong>{tcopy(language, 'Metodología:', 'Method:')}</strong>{' '}
              {tcopy(
                language,
                'búsqueda municipal sobre base completa de municipios de España, con superposición de la clasificación del Apéndice B del CTE DB-HS6 solo cuando el emparejamiento con INE no presenta señales de conflicto.',
                'municipality search over the full Spain municipality base, with the CTE DB-HS6 Appendix B classification overlaid only when the INE matching does not show conflict signals.',
              )}
              <br />
              <strong>{tcopy(language, 'Cobertura actual:', 'Current coverage:')}</strong>{' '}
              {tcopy(
                language,
                `${formatCount(language, municipalityDataSummary.total)} municipios en la base de búsqueda; ${formatCount(
                  language,
                  municipalityDataSummary.classified,
                )} con clasificación mostrada; ${formatCount(language, municipalityDataSummary.notClassified)} no clasificados y ${formatCount(
                  language,
                  municipalityDataSummary.pendingValidation,
                )} pendientes de validación.`,
                `${formatCount(language, municipalityDataSummary.total)} municipalities in the search base; ${formatCount(
                  language,
                  municipalityDataSummary.classified,
                )} with shown classification; ${formatCount(language, municipalityDataSummary.notClassified)} not classified and ${formatCount(
                  language,
                  municipalityDataSummary.pendingValidation,
                )} pending validation.`,
              )}
              <br />
              <strong>{tcopy(language, 'Aviso:', 'Disclaimer:')}</strong>{' '}
              {tcopy(
                language,
                'Esta herramienta no estima el nivel real de tu vivienda, no sustituye una medición y no debe usarse como certificación inmobiliaria, sanitaria o legal.',
                'This tool does not estimate the real level in your home, does not replace measurement, and should not be used as a property, health, or legal certification.',
              )}
            </div>
          </section>
        ) : (
          <section className="card emptyState">
            <p className="eyebrow">{tcopy(language, 'Qué hará la herramienta', 'What the tool does')}</p>
            <h2>{tcopy(language, 'Empieza por un municipio', 'Start with a municipality')}</h2>
            <p>
              {tcopy(
                language,
                'Puedes buscar cualquier municipio de España. Después verás si aparece como Zona I, Zona II, no clasificado o pendiente de validación en la capa actual del Apéndice B.',
                'You can search any municipality in Spain. Then you will see whether it appears as Zone I, Zone II, not classified, or pending validation in the current Appendix B layer.',
              )}
            </p>
            <div className="emptySteps">
              <article>
                <strong>{tcopy(language, '1. Buscar', '1. Search')}</strong>
                <span>{tcopy(language, 'Municipio, provincia o ambas cosas.', 'Municipality, province, or both.')}</span>
              </article>
              <article>
                <strong>{tcopy(language, '2. Contextualizar', '2. Add context')}</strong>
                <span>{tcopy(language, 'Tipo de vivienda, planta y antigüedad aproximada.', 'Housing type, floor, and rough age.')}</span>
              </article>
              <article>
                <strong>{tcopy(language, '3. Interpretar con cautela', '3. Read cautiously')}</strong>
                <span>{tcopy(language, 'La herramienta orienta; el detector confirma.', 'The tool guides; the detector confirms.')}</span>
              </article>
            </div>
          </section>
        )}

        <section className="card infographicCard" aria-labelledby="journey-infographic-heading">
          <div className="sectionIntro">
            <div>
              <p className="eyebrow">{tcopy(language, 'Del riesgo a la acción', 'From risk to action')}</p>
              <h2 id="journey-infographic-heading">
                {tcopy(language, 'Qué pasa después de buscar tu municipio', 'What happens after you look up your municipality')}
              </h2>
            </div>
            <p>
              {tcopy(
                language,
                'La búsqueda municipal es solo el primer paso práctico. Si hay motivo de preocupación, el siguiente paso real es medir.',
                'The municipality lookup is only the first practical step. If there is reason for concern, the real next step is measurement.',
              )}
            </p>
          </div>
          <figure className="journeyFigure">
            <img
              src={language === 'es' ? '/radon-journey-es.png' : '/radon-journey-en.png'}
              alt={tcopy(
                language,
                'Infografía de cinco pasos: oír hablar del radón, comprobar el riesgo municipal, pedir un kit de medición, interpretar el resultado y buscar ayuda para mejorar la vivienda.',
                'Five-step infographic: hear about radon, check municipal risk, order a test kit, interpret the result, and find help to improve the home.',
              )}
              width="1672"
              height="941"
              loading="lazy"
            />
            <figcaption>
              {tcopy(
                language,
                'La herramienta ayuda sobre todo con el paso 2. El detector sigue siendo lo que confirma el nivel real de una vivienda concreta.',
                'This tool mainly helps with step 2. A detector is still what confirms the real level in a specific home.',
              )}
            </figcaption>
          </figure>
        </section>

        <section className="card infoGrid">
          <article>
            <h2>{tcopy(language, 'Qué es el radón', 'What is radon?')}</h2>
            <p>
              {tcopy(
                language,
                'El radón es un gas radiactivo natural que puede acumularse en interiores, especialmente en contacto con el terreno.',
                'Radon is a naturally occurring radioactive gas that can build up indoors, especially in spaces close to the ground.',
              )}
            </p>
          </article>
          <article>
            <h2>{tcopy(language, 'Cómo interpretar la zona', 'How to read the zone')}</h2>
            <p>
              {tcopy(
                language,
                'La clasificación municipal sirve para priorizar dónde medir antes, no para descartar riesgo en una vivienda concreta.',
                'Municipality-level classification helps prioritise where to test first, not to rule risk in or out for a specific property.',
              )}
            </p>
          </article>
          <article>
            <h2>{tcopy(language, 'Qué falta en v1', 'What is missing in v1')}</h2>
            <p>
              {tcopy(
                language,
                'No hay búsqueda por dirección, integración catastral ni mapa detallado todavía.',
                'There is no address lookup, cadastral integration, or detailed map yet.',
              )}
            </p>
          </article>
          <article>
            <h2>{tcopy(language, 'Metodología y límites', 'Method and limits')}</h2>
            <p>
              {tcopy(
                language,
                'La búsqueda cubre toda la base municipal del INE y aplica la clasificación del Apéndice B cuando el bloque provincial parece fiable. Los resultados pueden quedar como clasificados, no clasificados o pendientes de validación.',
                'Search covers the full INE municipality base and applies Appendix B classification where the provincial block appears trustworthy. Results can currently appear as classified, not classified, or pending validation.',
              )}
            </p>
          </article>
        </section>

        <section className="card coverageCard" aria-label={tcopy(language, 'Cobertura actual', 'Current coverage')}>
          <div className="sectionIntro">
            <div>
              <p className="eyebrow">{tcopy(language, 'Cobertura actual', 'Current coverage')}</p>
              <h2>{tcopy(language, 'Qué hay dentro de la búsqueda', 'What is inside the search')}</h2>
            </div>
            <p>
              {tcopy(
                language,
                'Puedes buscar cualquier municipio de España. No todos tienen una clasificación visible, y algunas provincias están retenidas a propósito mientras se revisan.',
                'You can search any municipality in Spain. Not all of them have a visible classification, and some provinces are deliberately withheld while they are under review.',
              )}
            </p>
          </div>
          <div className="statGrid">
            <article className="statCard">
              <strong>{formatCount(language, municipalityDataSummary.total)}</strong>
              <span>{tcopy(language, 'municipios en búsqueda', 'municipalities searchable')}</span>
            </article>
            <article className="statCard">
              <strong>{formatCount(language, municipalityDataSummary.classified)}</strong>
              <span>{tcopy(language, 'con clasificación visible', 'with visible classification')}</span>
            </article>
            <article className="statCard">
              <strong>{formatCount(language, municipalityDataSummary.notClassified)}</strong>
              <span>{tcopy(language, 'sin clasificación mostrada', 'with no shown classification')}</span>
            </article>
            <article className="statCard statCard-alert">
              <strong>{formatCount(language, municipalityDataSummary.pendingValidation)}</strong>
              <span>{tcopy(language, 'pendientes de validación', 'pending validation')}</span>
            </article>
          </div>
          <div className="legendList">
            <div className="legendItem">
              <span className="legendSwatch legendSwatch-i" />
              <span>{tcopy(language, 'Zona I o II: aparece en la superposición actual.', 'Zone I or II: appears in the current overlay.')}</span>
            </div>
            <div className="legendItem">
              <span className="legendSwatch legendSwatch-neutral" />
              <span>{tcopy(language, 'No clasificado: no figura en el Apéndice B retenido.', 'Not classified: does not appear in the retained Appendix B layer.')}</span>
            </div>
            <div className="legendItem">
              <span className="legendSwatch legendSwatch-pending" />
              <span>{tcopy(language, 'Pendiente: la provincia sigue en revisión y no debe leerse como tranquilidad.', 'Pending: the province is still under review and should not be read as reassurance.')}</span>
            </div>
          </div>
        </section>

        <section className="card disclosureCard" aria-labelledby="disclosure-heading">
          <div className="sectionIntro">
            <div>
              <p className="eyebrow">{tcopy(language, 'Antes de usar el resultado', 'Before using the result')}</p>
              <h2 id="disclosure-heading">{tcopy(language, 'Fuentes, estado y cautelas', 'Sources, status, and cautions')}</h2>
            </div>
            <p>
              {tcopy(
                language,
                'Esta herramienta está pensada como una orientación preliminar y transparente. Cuando el dato no es lo bastante fiable, debe decirlo antes de parecer útil.',
                'This tool is intended as a transparent preliminary guide. When the data is not reliable enough, it should say so before trying to look useful.',
              )}
            </p>
          </div>
          <div className="disclosureGrid">
            <article>
              <h3>{tcopy(language, 'Fuente principal', 'Primary source')}</h3>
              <p>
                {tcopy(
                  language,
                  'La clasificación procede del Apéndice B del ',
                  'Classification comes from Appendix B of ',
                )}
                <a
                  href="https://www.codigotecnico.org/DocumentosCTE/Salubridad.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  CTE DB-HS6
                </a>
                {tcopy(language, '. La base de búsqueda usa municipios del ', '. The search base uses municipalities from ')}
                <a href="https://www.ine.es/dynt3/inebase/es/index.htm?padre=525" target="_blank" rel="noreferrer">
                  INE
                </a>
                {tcopy(
                  language,
                  ' para que también puedas encontrar lugares que no aparecen en la capa clasificada. El resultado no es un mapa de concentración interior ni una predicción por dirección.',
                  ' so you can also find places that do not appear in the classified layer. The result is not an indoor concentration map or an address-level prediction.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, '“No clasificado” no es “sin radón”', '“Not classified” does not mean “no radon”')}</h3>
              <p>
                {tcopy(
                  language,
                  'Un municipio no clasificado solo significa que esta capa no lo marca como Zona I o II. La geología local, el edificio y la ventilación pueden cambiar la exposición real.',
                  'A not-classified municipality only means this layer does not mark it as Zone I or II. Local geology, the building, and ventilation can change real exposure.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Pendiente de validación', 'Pending validation')}</h3>
              <p>
                {tcopy(
                  language,
                  'Si una provincia está pendiente, su bloque se ha retenido deliberadamente por dudas de extracción o reconciliación. Es una señal de cautela, no una lectura tranquilizadora.',
                  'If a province is pending, its block has deliberately been withheld because of extraction or reconciliation concerns. It is a caution signal, not a reassuring result.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'Provincias actualmente retenidas: Granada, Huelva, Sevilla, Huesca, Palencia, Salamanca, Tarragona, Castellón / Castelló y Vizcaya / Bizkaia.',
                  'Currently withheld provinces: Granada, Huelva, Sevilla, Huesca, Palencia, Salamanca, Tarragona, Castellón / Castelló, and Vizcaya / Bizkaia.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'Además, la provincia de València muestra una cobertura de clasificación inusualmente baja (5 de 266 municipios) y está en revisión; interpreta con cautela los resultados “sin clasificar” de esa provincia.',
                  'In addition, the province of València shows unusually low classification coverage (5 of 266 municipalities) and is under review; interpret “not classified” results from that province with caution.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Control de calidad', 'Quality controls')}</h3>
              <p>
                {tcopy(
                  language,
                  'La extracción del PDF oficial puede producir filas dudosas. Por eso la validación distingue entre problemas de extracción y datos que llegan a la búsqueda pública. En esta versión no se publican clasificaciones activas con conflicto de código INE, código duplicado o provincia probable incorrecta.',
                  'The official PDF extraction can produce doubtful rows. The validation therefore separates extraction problems from data that reaches the public search. This version publishes no active classifications with an INE-code conflict, duplicate code, or likely wrong province.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'Los bloques provinciales que no superan ese umbral quedan como pendientes de validación. Valencia / València aparece con cobertura baja, pero fue revisada contra la página 171 del PDF DB-HS6 y se mantiene como excepción documentada.',
                  'Provincial blocks that do not pass that threshold remain pending validation. Valencia / València has low coverage, but it was checked against page 171 of the DB-HS6 PDF and is kept as a documented exception.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'La medición decide', 'Measurement decides')}</h3>
              <p>
                {tcopy(
                  language,
                  'La única forma de conocer el nivel de radón interior de una vivienda concreta es medir con un detector adecuado durante un periodo representativo.',
                  'The only way to know the indoor radon level of a specific home is to measure it with a suitable detector over a representative period.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Si sale alto', 'If the result comes back high')}</h3>
              <p>
                {tcopy(
                  language,
                  'Una medición por encima del nivel de referencia (300 Bq/m³) es una mala noticia, no una sentencia sobre la vivienda. La pauta habitual es medir, mitigar y volver a medir.',
                  'A measurement above the reference level (300 Bq/m³) is bad news, not a verdict on the home. The standard pathway is measure, mitigate, and measure again.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'La mitigación es ingeniería conocida, no un producto milagroso. Las tres familias estándar de intervención son: despresurización del subsuelo (un pequeño ventilador que extrae el radón desde debajo del forjado antes de que entre), ventilación adicional o equilibrada en las plantas bajas, y sellado de los puntos obvios de entrada (grietas, pasos de instalaciones, juntas). Suelen combinarse, y una segunda medición después confirma que han funcionado.',
                  'Mitigation is well-understood engineering, not a miracle product. The three standard families of intervention are: sub-slab depressurisation (a small fan that draws radon out from beneath the slab before it can enter), increased or balanced ventilation on the lower floors, and sealing the obvious entry routes (cracks, service penetrations, joints). They are usually combined, and a second measurement afterwards confirms whether they worked.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'El cuello de botella en España no es la técnica. Es encontrar un instalador cualificado: no existe un directorio nacional de mitigadores certificados, y la mejor referencia técnica abierta es ',
                  "The bottleneck in Spain is not the technique. It is finding a qualified installer: there is no national certified-mitigator directory, and the clearest open technical reference is ",
                )}
                <a
                  href="https://proyectoradoncero.ietcc.csic.es/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tcopy(language, 'Proyecto Radoncero del CSIC', "the CSIC's Proyecto Radoncero")}
                </a>
                {tcopy(
                  language,
                  ', con casos reales documentados. Esta herramienta no recomienda empresas concretas porque no puede verificarlas.',
                  ', which documents real cases. This tool does not recommend specific companies because it cannot verify them.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Estado del prototipo', 'Prototype status')}</h3>
              <p>
                {tcopy(
                  language,
'Última revisión de datos y validación: junio de 2026. Próxima revisión planificada: diciembre de 2026. La herramienta sigue siendo un prototipo público: útil para orientación inicial, no para decisiones inmobiliarias, sanitarias o legales.',
                  'Last data review and validation: June 2026. Next planned review: December 2026. This remains a public prototype: useful for initial orientation, not for property, health, or legal decisions.',
                )}
              </p>
              <p>
                {tcopy(
                  language,
                  'Si lees esto mucho después de esas fechas, los datos pueden estar desactualizados. No prometo mantenimiento indefinido. En su lugar, publico la receta: ',
                  'If you are reading this well after those dates, the data may be out of date. I do not promise indefinite upkeep. Instead, I publish the recipe: ',
                )}
                <a
                  href="https://github.com/willworth/radon-tool/blob/master/MAINTENANCE.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tcopy(language, 'cómo verificar y actualizar el dato', 'how to verify and refresh the data')}
                </a>
                {tcopy(
                  language,
                  ' tú mismo o con la ayuda de tu agente. La confianza está en el procedimiento, no en que yo siga aquí.',
                  ' yourself or with your agent. The trust is in the procedure, not in me still being around.',
                )}
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Construido con asistencia de IA', 'Built with AI assistance')}</h3>
              <p>
                {tcopy(
                  language,
                  'Esta herramienta se construyó de forma colaborativa con asistentes de IA: extracción del Apéndice B, reconciliación con la base de municipios del INE, validación, interfaz y copia bilingüe. Las decisiones sobre qué se retiene, qué se publica y cómo se redactan los avisos son humanas y deliberadas. El código, la canalización de datos y los informes de validación son inspeccionables: ',
                  'This tool was built collaboratively with AI assistants: Appendix B extraction, reconciliation against the INE municipality base, validation, interface, and bilingual copy. The decisions about what is withheld, what is published, and how the cautions are worded are human and deliberate. The code, data pipeline, and validation reports are inspectable: ',
                )}
                <a href="https://github.com/willworth/radon-tool" target="_blank" rel="noreferrer">
                  github.com/willworth/radon-tool
                </a>
                .
              </p>
            </article>
            <article>
              <h3>{tcopy(language, 'Correcciones', 'Corrections')}</h3>
              <p>
                {tcopy(
                  language,
                  'Si encuentras un municipio mal emparejado, un texto confuso o una fuente más actual, escríbeme. Prefiero corregir el límite de confianza antes que aparentar certeza.',
                  'If you find a mismatched municipality, unclear wording, or a newer source, tell me. I would rather correct the confidence boundary than pretend certainty.',
                )}{' '}
                <a href="mailto:willworthdev@gmail.com">willworthdev@gmail.com</a>
              </p>
            </article>
          </div>
        </section>

        <footer className="siteFooter">
          <p>
            {tcopy(
              language,
              'Un proyecto de Will Worth. Más contexto y proyectos en ',
              'A project by Will Worth. More context and projects at ',
            )}
            <a href="https://willworth.es" target="_blank" rel="noreferrer">
              willworth.es
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  )
}
