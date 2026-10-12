from __future__ import annotations

import json
import re
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
# Page furniture (running header) sits at y >= ~789. Table rows start at y ~765 on continuation pages, so the
# old 700 cutoff silently dropped the first ~9 rows of every page (2026-10-12, KAL-1708).
MAX_Y = 775

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


def norm_ccaa(text: str) -> str:
    # The PDF emits 'Castilla', '-', 'La Mancha' as separate fragments. Joined with spaces that became
    # 'Castilla - La Mancha', failed VALID_CCAA, and the row was skipped before the province updated, so
    # every Castilla-La Mancha row was attributed to Zamora (2026-10-12, KAL-1708).
    return re.sub(r'\s*-\s*', '-', norm(text))


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    collector = Collector()

    rows: Dict[Tuple[int, float], Dict[str, List[str]]] = defaultdict(lambda: defaultdict(list))

    for page_num in range(START_PAGE, END_PAGE + 1):
        collector.page = page_num
        reader.pages[page_num - 1].extract_text(visitor_text=collector)

    # The first appendix page opens with prose above the table header; start reading below the header row.
    header_y = {page: y for page, y, x, text in collector.items if text == 'Nombre CCAA'}

    for page_num, y, x, text in collector.items:
        if y < MIN_Y or y > MAX_Y:
            continue
        if page_num in header_y and y >= header_y[page_num]:
            continue
        bucket = bucket_for_x(x)
        if not bucket:
            continue
        rows[(page_num, y)][bucket].append(text)

    # Completeness accounting: every text fragment in a municipality column, below the running page header,
    # must end up in a record or be a known table-header value. The old y cutoff dropped ~300 page-top rows
    # silently; this check would have failed loudly (2026-10-12, KAL-1708).
    RUNNING_HEADER_Y = 785
    column_items = [
        (page_num, y)
        for page_num, y, x, text in collector.items
        if MIN_Y <= y < RUNNING_HEADER_Y
        and bucket_for_x(x) in ('zone1', 'zone2')
        and not (page_num in header_y and y >= header_y[page_num])
    ]
    unread = [key for key in column_items if key not in rows]
    if unread:
        raise SystemExit(f'{len(unread)} municipality-column fragments fell outside the read window, e.g. {unread[:5]}')

    emitted_rows = set()
    # A name too long for its cell wraps onto a second line set 6.84pt lower; ordinary rows are >= 7.32pt
    # apart. Two names in Appendix B wrap ("Cruïlles, Monells i Sant Sadurní de / l'Heura" and
    # "Gargantilla del Lozoya y Pinilla de / Buitrago"); join the continuation to its first line.
    WRAP_GAP = 7.0
    last_in_column: Dict[Tuple[int, str], Tuple[float, int]] = {}
    current_ccaa = None
    current_province = None
    records = []

    for (page_num, y) in sorted(rows.keys(), key=lambda k: (k[0], -k[1])):
        cols = {k: norm(' '.join(v)) for k, v in rows[(page_num, y)].items()}
        if not cols:
            continue

        ccaa = norm_ccaa(cols.get('ccaa', ''))
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
            # Fail loudly: silently skipping a header row carries the previous province forward.
            raise SystemExit(f'unrecognised CCAA {ccaa!r} on page {page_num} at y={y}')

        if ccaa:
            current_ccaa = ccaa
        if province:
            current_province = province

        if current_ccaa is None or current_province is None:
            continue

        for municipality, zone, column in ((z1, '1', 'zone1'), (z2, '2', 'zone2')):
            if not municipality or municipality in SKIP_VALUES:
                continue
            if any(bad in municipality for bad in ['promedio', 'concentración', 'detectores', 'edificio', 'mediciones', 'Bq/m', 'apéndice']):
                continue
            emitted_rows.add((page_num, y))
            previous = last_in_column.get((page_num, column))
            if previous and 0 < previous[0] - y < WRAP_GAP:
                records[previous[1]]['municipality'] += ' ' + municipality
                continue
            last_in_column[(page_num, column)] = (y, len(records))
            records.append(
                {
                    'autonomousCommunity': current_ccaa,
                    'province': current_province,
                    'municipality': municipality,
                    'zone': zone,
                }
            )

    dropped = sorted(
        {key for key in column_items if key not in emitted_rows},
    )
    dropped_text = [
        (page, y, ' | '.join(f'{k}={norm(" ".join(v))}' for k, v in rows[(page, y)].items()))
        for page, y in dropped
    ]
    allowed_dropped = [d for d in dropped_text if all(
        norm(' '.join(v)) in SKIP_VALUES or k in ('ccaa', 'province') for k, v in rows[(d[0], d[1])].items()
    )]
    unexplained = [d for d in dropped_text if d not in allowed_dropped]
    if unexplained:
        raise SystemExit(f'{len(unexplained)} table rows were read but produced no record, e.g. {unexplained[:5]}')

    province_counts = defaultdict(int)
    for record in records:
        province_counts[record['province']] += 1

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
    print(f'column fragments accounted for: {len(column_items)}; header-only rows skipped: {len(allowed_dropped)}')
    print('rows per province:', dict(sorted(province_counts.items())))
    print('sample start:', deduped[:8])
    print('sample end:', deduped[-8:])


if __name__ == '__main__':
    main()
