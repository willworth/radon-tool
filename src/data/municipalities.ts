import searchBaseMunicipalities from './municipalities.search-base.json'
import type { MunicipalityRecord } from '../types'

export const municipalities: MunicipalityRecord[] = searchBaseMunicipalities as MunicipalityRecord[]

export const municipalityDataStatus = {
  source: 'official',
  message:
    'Base municipal completa construida sobre datos INE, con clasificación CTE DB-HS6 Apéndice B superpuesta cuando existe. La capa de clasificación sigue pendiente de validación adicional antes de presentarla como referencia definitiva.',
} as const
