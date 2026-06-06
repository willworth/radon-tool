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
  messageEs:
    `Base municipal completa construida sobre datos INE. La clasificación CTE DB-HS6 Apéndice B solo se superpone cuando la extracción y la reconciliación parecen suficientemente fiables; ${municipalityDataSummary.pendingValidation.toLocaleString(
      'es-ES',
    )} municipios siguen marcados como pendientes de validación. Esta herramienta no es un servicio oficial ni una referencia definitiva.`,
  messageEn:
    `Full municipality base built from INE data. CTE DB-HS6 Appendix B classification is overlaid only where extraction and reconciliation look sufficiently reliable; ${municipalityDataSummary.pendingValidation.toLocaleString(
      'en-US',
    )} municipalities are still marked as pending validation. This tool is not an official service or a definitive reference.`,
} as const
