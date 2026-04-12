import officialMunicipalities from './municipalities.official.json'
import type { MunicipalityRecord, RadonZone } from '../types'

type RawOfficialMunicipality = Omit<MunicipalityRecord, 'zone' | 'ineCode' | 'sourceStatus'> & {
  zone: '1' | '2'
}

function normalizeZone(zone: RawOfficialMunicipality['zone']): RadonZone {
  return zone === '1' ? 'I' : 'II'
}

export const municipalities: MunicipalityRecord[] = (officialMunicipalities as RawOfficialMunicipality[]).map(
  (record, index) => ({
    ...record,
    zone: normalizeZone(record.zone),
    ineCode: `official-${index}`,
    sourceStatus: 'official',
  }),
)

export const municipalityDataStatus = {
  source: 'official',
  message:
    'Clasificación oficial extraída de CTE DB-HS6 Apéndice B (municipios Zona I y Zona II). Pendiente de enriquecer con códigos INE y una validación extra de bordes antes de publicar como referencia definitiva.',
} as const
