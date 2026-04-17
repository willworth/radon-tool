import searchBaseMunicipalities from './municipalities.search-base.json'
import type { MunicipalityRecord } from '../types'

export const municipalities: MunicipalityRecord[] = searchBaseMunicipalities as MunicipalityRecord[]

export const municipalityDataSummary = municipalities.reduce(
  (summary, row) => {
    summary.total += 1

    if (row.sourceStatus === 'pending_validation') summary.pendingValidation += 1
    else if (row.zone === 'not_classified') summary.notClassified += 1
    else summary.classified += 1

    if (row.sourceStatus === 'manual_override') summary.manualOverrides += 1

    return summary
  },
  {
    total: 0,
    classified: 0,
    notClassified: 0,
    pendingValidation: 0,
    manualOverrides: 0,
  },
)

export const municipalityDataStatus = {
  source: 'official',
  message:
    `Base municipal completa construida sobre datos INE, con clasificación CTE DB-HS6 Apéndice B superpuesta cuando el bloque provincial parece fiable. ${municipalityDataSummary.pendingValidation.toLocaleString(
      'es-ES',
    )} municipios siguen marcados como pendientes de validación antes de presentarlo como referencia definitiva.`,
} as const
