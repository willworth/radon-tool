import placeholderMunicipalities from './municipalities.placeholder.json'
import type { MunicipalityRecord } from '../types'

export const municipalities = placeholderMunicipalities as MunicipalityRecord[]

export const municipalityDataStatus = {
  source: 'placeholder',
  message:
    'Dataset provisional con tres municipios de ejemplo. Sustituir por JSON oficial del CTE DB-HS6 / CSN antes de publicar como herramienta de referencia.',
} as const
