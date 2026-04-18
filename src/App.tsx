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

function sourceStatusLabel(sourceStatus?: MunicipalitySourceStatus, zone?: RadonZone) {
  if (sourceStatus === 'pending_validation') return 'Pendiente de validación'
  if (sourceStatus === 'manual_override') return zone === 'not_classified' ? 'No clasificado (ajuste manual)' : 'Ajuste manual'
  return resultBadgeLabel(zone ?? 'not_classified')
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

function resultBadgeLabel(zone: RadonZone) {
  if (zone === 'II') return 'Zona II'
  if (zone === 'I') return 'Zona I'
  return 'No clasificado'
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
          <div className="heroTop">
            <div className="introBlock">
              <p className="eyebrow">{tcopy(language, 'España', 'Spain')}</p>
              <h1>{tcopy(language, 'Consulta preliminar de radón por municipio', 'Preliminary radon lookup by municipality')}</h1>
              <p className="lede">
                {tcopy(
                  language,
                  'El radón es un gas radiactivo natural que puede acumularse en viviendas y otros espacios interiores. Esta herramienta te ayuda a entender si tu municipio aparece en la clasificación oficial actual y si merece la pena investigar más o plantearte una medición.',
                  'Radon is a naturally occurring radioactive gas that can build up in homes and other indoor spaces. This tool helps you understand whether your municipality appears in the current official classification and whether it is worth investigating further or considering a measurement.',
                )}
              </p>
              <p className="introSupporting">
                {tcopy(
                  language,
                  'No sustituye una medición directa ni pretende dar certeza sobre una vivienda concreta. Su función es orientarte rápido y con honestidad para que sepas si conviene dar el siguiente paso.',
                  'It does not replace a direct measurement and it does not claim certainty for any specific property. Its job is to orient you quickly and honestly so you can decide whether to take the next step.',
                )}
              </p>

              <div className="heroGuidance">
                <div className="heroGuidanceItem">
                  <strong>{tcopy(language, 'Qué hace', 'What it does')}</strong>
                  <span>{tcopy(language, 'Te orienta a nivel municipal para saber si conviene medir o pedir más información.', 'It gives you a municipality-level signal to help decide whether to test or ask for more information.')}</span>
                </div>
                <div className="heroGuidanceItem">
                  <strong>{tcopy(language, 'Qué no hace', 'What it does not do')}</strong>
                  <span>{tcopy(language, 'No estima el nivel real de una vivienda concreta ni sustituye un detector.', 'It does not estimate the true level in a specific property and it does not replace a detector.')}</span>
                </div>
              </div>
            </div>

            <aside className="heroPanel">
              <p className="panelEyebrow">{tcopy(language, 'Cobertura actual', 'Current coverage')}</p>
              <div className="statGrid">
                <article className="statCard">
                  <strong>{municipalityDataSummary.total.toLocaleString('es-ES')}</strong>
                  <span>{tcopy(language, 'municipios en búsqueda', 'municipalities searchable')}</span>
                </article>
                <article className="statCard">
                  <strong>{municipalityDataSummary.classified.toLocaleString('es-ES')}</strong>
                  <span>{tcopy(language, 'con clasificación visible', 'with visible classification')}</span>
                </article>
                <article className="statCard">
                  <strong>{municipalityDataSummary.notClassified.toLocaleString('es-ES')}</strong>
                  <span>{tcopy(language, 'sin clasificación mostrada', 'with no shown classification')}</span>
                </article>
                <article className="statCard statCard-alert">
                  <strong>{municipalityDataSummary.pendingValidation.toLocaleString('es-ES')}</strong>
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
            </aside>
          </div>
          <div className="notice warning heroNotice">
            <strong>{tcopy(language, 'Estado del dato:', 'Data status:')}</strong>{' '}
            {tcopy(language, municipalityDataStatus.messageEs, municipalityDataStatus.messageEn)}
          </div>
        </section>

        <section className="card journeyCard" aria-label={tcopy(language, 'Cómo funciona', 'How it works')}>
          <div className="journeyIntro">
            <p className="eyebrow">{tcopy(language, 'Cómo funciona', 'How it works')}</p>
            <h2>{tcopy(language, 'Comprueba tu municipio y decide el siguiente paso', 'Check your municipality and decide the next step')}</h2>
            <p>
              {tcopy(
                language,
                'La idea es simple: averiguas si tu municipio aparece en la clasificación actual, entiendes lo que eso significa y decides si conviene medir o pedir más información.',
                'The idea is simple: find out whether your municipality appears in the current classification, understand what that means, and decide whether it makes sense to test or ask for more information.',
              )}
            </p>
          </div>
          <div className="journeyStrip">
            <article className="journeyStep">
              <span className="journeyNumber">1</span>
              <div>
                <strong>{tcopy(language, 'Busca tu municipio', 'Search your municipality')}</strong>
                <p>
                  {tcopy(
                    language,
                    'Encuentra tu municipio en segundos, con o sin acentos.',
                    'Find your municipality in seconds, with or without accents.',
                  )}
                </p>
              </div>
            </article>
            <article className="journeyStep">
              <span className="journeyNumber">2</span>
              <div>
                <strong>{tcopy(language, 'Entiende la señal', 'Understand the signal')}</strong>
                <p>
                  {tcopy(
                    language,
                    'Mira si aparece como Zona I, Zona II, no clasificado o pendiente de validación.',
                    'See whether it appears as Zone I, Zone II, not classified, or pending validation.',
                  )}
                </p>
              </div>
            </article>
            <article className="journeyStep">
              <span className="journeyNumber">3</span>
              <div>
                <strong>{tcopy(language, 'Decide qué hacer', 'Decide what to do')}</strong>
                <p>
                  {tcopy(
                    language,
                    'Usa el resultado para decidir si medir, pedir más información o hablar con tu ayuntamiento o comunidad.',
                    'Use the result to decide whether to test, ask for more information, or contact your town hall or building community.',
                  )}
                </p>
              </div>
            </article>
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
                  {match.province} · {match.autonomousCommunity} · {sourceStatusLabel(match.sourceStatus, match.zone)}
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
                'búsqueda municipal sobre base completa de municipios de España, con superposición de la clasificación del Apéndice B del CTE DB-HS6 cuando está disponible.',
                'municipality search over the full Spain municipality base, with the CTE DB-HS6 Appendix B classification overlaid when available.',
              )}
              <br />
              <strong>{tcopy(language, 'Cobertura actual:', 'Current coverage:')}</strong>{' '}
              {municipalityDataSummary.total.toLocaleString('es-ES')} municipios en la base de búsqueda;{' '}
              {municipalityDataSummary.classified.toLocaleString('es-ES')} con clasificación mostrada;{' '}
              {municipalityDataSummary.notClassified.toLocaleString('es-ES')} no clasificados y{' '}
              {municipalityDataSummary.pendingValidation.toLocaleString('es-ES')} pendientes de validación.
              <br />
              <strong>{tcopy(language, 'Aviso:', 'Disclaimer:')}</strong>{' '}
              {tcopy(
                language,
                'Esta herramienta no estima el nivel real de tu vivienda. Solo una medición con detector puede confirmarlo.',
                'This tool does not estimate the real level in your home. Only a detector measurement can confirm it.',
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

        <footer className="siteFooter">
          <p>
            {tcopy(
              language,
              'Un proyecto de Will Worth. Más contexto y proyectos en ',
              'A project by Will Worth. More context and projects at ',
            )}
            <a href="https://willworth.dev" target="_blank" rel="noreferrer">
              willworth.dev
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  )
}
