export type RadonZone = 'I' | 'II' | 'not_classified'

export type MunicipalityRecord = {
  ineCode?: string
  municipality: string
  province: string
  autonomousCommunity: string
  zone: RadonZone
  sourceStatus?: 'placeholder' | 'official'
  notes?: string
}

export type HousingType = 'house' | 'flat'
export type FloorLevel = 'basement_ground' | 'first' | 'second_or_higher'
export type BuildingAge = 'pre_2006' | '2006_2019' | '2020_plus' | 'unknown'
