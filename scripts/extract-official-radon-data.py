from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / 'data-source' / 'DBHS.pdf'
OUT_PATH = ROOT / 'src' / 'data' / 'municipalities.official.json'

START_PAGE = 146
END_PAGE = 180
MIN_Y = 60
MAX_Y = 700

CCAA_X = 106.46
PROVINCE_X = 191.21
ZONE1_X = 283.37
ZONE2_X = 396.79
X_TOL = 12
Y_PREC = 2

COLUMN_RANGES = {
    'ccaa': (94, 150),
    'province': (179, 230),
    'zone1': (271, 350),
    'zone2': (384, 455),
}

SKIP_VALUES = {
    'Documento Básico HS Salubridad',
    'HS 6 Protección frente a la exposición al radón',
    'Nombre CCAA',
    'Nombre PROVINCIAS',
    'Municipios ZONA',
    '1',
    '2',
    'Apéndice B. Clasificación de municipios en función del potencial de',
    'radón',
    'de',
    'a la exposición',
    'B ásico',
}

VALID_CCAA = {
    'Andalucía', 'Aragón', 'Canarias', 'Cantabria', 'Castilla y León', 'Castilla-La Mancha',
    'Cataluña', 'Ciudad Autónoma de Ceuta', 'Comunidad de Madrid', 'Comunidad Foral de Navarra',
    'Comunidad Valenciana', 'Extremadura', 'Galicia', 'Islas Baleares', 'La Rioja', 'Murcia',
    'País Vasco', 'Principado de Asturias'
}


class Collector:
    def __init__(self) -> None:
        self.items: List[Tuple[int, float, float, str]] = []
        self.page = 0

    def __call__(self, text, cm, tm, font_dict, font_size):
        value = text.replace('\xa0', ' ').strip()
        if value:
            self.items.append((self.page, round(tm[5], Y_PREC), round(tm[4], 2), value))
        return text


def bucket_for_x(x: float) -> str | None:
    for key, (min_x, max_x) in COLUMN_RANGES.items():
        if min_x <= x <= max_x:
            return key

    targets = {
        'ccaa': CCAA_X,
        'province': PROVINCE_X,
        'zone1': ZONE1_X,
        'zone2': ZONE2_X,
    }
    for key, target in targets.items():
        if abs(x - target) <= X_TOL:
            return key
    return None


def norm(text: str) -> str:
    return ' '.join(text.split())


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    collector = Collector()

    rows: Dict[Tuple[int, float], Dict[str, List[str]]] = defaultdict(lambda: defaultdict(list))

    for page_num in range(START_PAGE, END_PAGE + 1):
        collector.page = page_num
        reader.pages[page_num - 1].extract_text(visitor_text=collector)

    for page_num, y, x, text in collector.items:
        if y < MIN_Y or y > MAX_Y:
            continue
        bucket = bucket_for_x(x)
        if not bucket:
            continue
        rows[(page_num, y)][bucket].append(text)

    current_ccaa = None
    current_province = None
    records = []

    for (page_num, y) in sorted(rows.keys(), key=lambda k: (k[0], -k[1])):
        cols = {k: norm(' '.join(v)) for k, v in rows[(page_num, y)].items()}
        if not cols:
            continue

        ccaa = cols.get('ccaa', '').strip()
        province = cols.get('province', '').strip()
        z1 = cols.get('zone1', '').strip()
        z2 = cols.get('zone2', '').strip()

        if ccaa in SKIP_VALUES or province in SKIP_VALUES:
            continue
        if z1 in SKIP_VALUES and not z2:
            continue
        if z2 in SKIP_VALUES and not z1:
            continue

        if ccaa and ccaa not in VALID_CCAA:
            continue

        if ccaa:
            current_ccaa = ccaa
        if province:
            current_province = province

        if current_ccaa is None or current_province is None:
            continue

        for municipality, zone in ((z1, '1'), (z2, '2')):
            if not municipality or municipality in SKIP_VALUES:
                continue
            if any(bad in municipality for bad in ['promedio', 'concentración', 'detectores', 'edificio', 'mediciones', 'Bq/m', 'apéndice']):
                continue
            records.append(
                {
                    'autonomousCommunity': current_ccaa,
                    'province': current_province,
                    'municipality': municipality,
                    'zone': zone,
                }
            )

    deduped = []
    seen = set()
    for record in records:
        key = (record['autonomousCommunity'], record['province'], record['municipality'], record['zone'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(record)

    OUT_PATH.write_text(json.dumps(deduped, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(deduped)} records to {OUT_PATH}')
    print('sample start:', deduped[:8])
    print('sample end:', deduped[-8:])


if __name__ == '__main__':
    main()
