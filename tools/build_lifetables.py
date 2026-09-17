#!/usr/bin/env python3
"""
Build the inline life-table data block for index.html from UN World Population
Prospects 2024 (complete single-age life tables, Medium variant).

    python3 tools/build_lifetables.py            # download + filter + write JSON + inject
    python3 tools/build_lifetables.py --inject   # re-inject tools/lifetables.json only

The two source files are ~200 MB gzipped each. They are streamed straight
from the UN server through gzip and the csv module; nothing large touches disk.
The filtered result (tools/lifetables.json, ~35 KB) is committed so the page can
be rebuilt without re-downloading.

Why the 2024 projection year rather than the 2023 estimate: WPP 2024's
single-year *estimates* for 2022-2023 carry artifacts for some countries
(Australia's male q(x) at ages 21-38 is ~0.00001, fifty times too low, with a
spurious bump at 60-63) and raw single-year noise for small countries (Norway's
female rates jump +-40% between adjacent years). The first projected year is
produced by the UN's smooth mortality model, is consistent across countries,
sits within 0.2 years of the 2023 estimate on e0, and is one year closer to
today.

Per country x sex the JSON carries:
  qx   probability of dying between exact age x and x+1, ages 0..99, year 2024
  mx100  central death rate of the open 100+ interval (for the tail extension)
  e0   WPP's own life expectancy at birth -- kept ONLY so verify.js can check
       that the engine reproduces it from qx
  r    mean annual log-decline of qx over 2024-2073 in the UN's Medium
       projection, one value per age band (see BANDS) -- drives the
       "mortality keeps improving" toggle
"""
import csv, gzip, io, json, math, os, re, subprocess, sys

BASE = ("https://population.un.org/wpp/assets/Excel%20Files/"
        "1_Indicator%20(Standard)/CSV_FILES/")
FILES = [
    # (sex, filename)
    ('M', 'WPP2024_Life_Table_Complete_Medium_Male_2024-2100.csv.gz'),
    ('F', 'WPP2024_Life_Table_Complete_Medium_Female_2024-2100.csv.gz'),
]
BASE_YEAR = 2024          # first projected year -- see the docstring for why
PROJ_TO = 2073            # end of the 50-year window for improvement rates
MAX_AGE = 99              # single ages kept; 100+ is an open interval in WPP

# ISO3 -> display name. Order here is the order in the country picker.
COUNTRIES = {
    'USA': 'United States',   'GBR': 'United Kingdom', 'CAN': 'Canada',
    'AUS': 'Australia',       'NZL': 'New Zealand',    'IRL': 'Ireland',
    'DEU': 'Germany',         'FRA': 'France',         'ITA': 'Italy',
    'ESP': 'Spain',           'NLD': 'Netherlands',    'CHE': 'Switzerland',
    'SWE': 'Sweden',          'NOR': 'Norway',         'JPN': 'Japan',
    'SGP': 'Singapore',       'KOR': 'South Korea',
}
# Age bands for the improvement rates: (first, last) inclusive.
BANDS = [(0, 0), (1, 14), (15, 34), (35, 54), (55, 74), (75, 89), (90, 99)]

HERE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(HERE, 'lifetables.json')
HTML_PATH = os.path.join(HERE, '..', 'index.html')
MARK_BEGIN, MARK_END = '// LIFETABLES:BEGIN', '// LIFETABLES:END'


def stream_rows(filename):
    """Yield csv rows of one WPP file, filtered to our countries, without saving it.

    Downloads via curl rather than urllib: the python.org build of Python on
    macOS does not see the system certificate store, while curl does.
    """
    proc = subprocess.Popen(
        ['curl', '-sS', '--fail', '-A', 'Mozilla/5.0', BASE + filename],
        stdout=subprocess.PIPE)
    gz = gzip.GzipFile(fileobj=proc.stdout)
    # utf-8-sig strips the BOM the UN files start with
    text = io.TextIOWrapper(gz, encoding='utf-8-sig', newline='')
    reader = csv.DictReader(text)
    n = 0
    for row in reader:
        n += 1
        if row['ISO3_code'] in COUNTRIES:
            yield row
    if proc.wait() != 0:
        sys.exit(f'curl failed for {filename} (exit {proc.returncode})')
    print(f'  {filename}: {n:,} rows scanned', file=sys.stderr)


def build():
    data = {iso: {'name': name, 'M': {}, 'F': {}} for iso, name in COUNTRIES.items()}
    for sex, fname in FILES:
        print(f'streaming {fname} ...', file=sys.stderr)
        got = {}   # (iso, year) -> {age: row}
        for row in stream_rows(fname):
            year = int(row['Time'])
            if year not in (BASE_YEAR, PROJ_TO):
                continue
            iso, age = row['ISO3_code'], int(row['AgeGrpStart'])
            got.setdefault((iso, year), {})[age] = row
        for iso in COUNTRIES:
            rows = got[(iso, BASE_YEAR)]
            assert len(rows) == 101, (iso, sex, len(rows))
            qx = [round(float(rows[a]['qx']), 6) for a in range(MAX_AGE + 1)]
            assert all(0 < q <= 1 for q in qx), (iso, sex)
            # Guard against the artifacts seen in the 2022-23 estimates: adult
            # mortality must rise over every 5-year span.
            for a in range(40, 95):
                assert qx[a + 5] > qx[a], (iso, sex, a, qx[a], qx[a + 5])
            data[iso][sex]['qx'] = qx
            data[iso][sex]['mx100'] = round(float(rows[100]['mx']), 5)
            data[iso][sex]['e0'] = round(float(rows[0]['ex']), 3)
            end = got[(iso, PROJ_TO)]
            span = PROJ_TO - BASE_YEAR
            rates = []
            for lo, hi in BANDS:
                decl = [math.log(float(rows[a]['qx']) / float(end[a]['qx'])) / span
                        for a in range(lo, hi + 1)]
                rates.append(round(sum(decl) / len(decl), 5))
            data[iso][sex]['r'] = rates
    out = {
        'source': 'United Nations, World Population Prospects 2024, complete life '
                  'tables, Medium variant: the 2024 table as the baseline, with '
                  'improvement rates from the 2024-2073 projection.',
        'url': 'https://population.un.org/wpp/',
        'baseYear': BASE_YEAR,
        'projWindow': [BASE_YEAR, PROJ_TO],
        'bands': [list(b) for b in BANDS],
        'countries': data,
    }
    with open(JSON_PATH, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'wrote {JSON_PATH} ({os.path.getsize(JSON_PATH):,} bytes)', file=sys.stderr)
    return out


def inject(out):
    """Replace the block between the markers in index.html with the data."""
    if not os.path.exists(HTML_PATH):
        print('index.html not found; JSON only', file=sys.stderr)
        return
    src = open(HTML_PATH).read()
    block = (f'{MARK_BEGIN}\n'
             f'// Generated by tools/build_lifetables.py -- do not edit by hand.\n'
             f'const LIFETABLES = {json.dumps(out, separators=(",", ":"))};\n'
             f'{MARK_END}')
    pat = re.compile(re.escape(MARK_BEGIN) + r'.*?' + re.escape(MARK_END), re.S)
    if not pat.search(src):
        sys.exit(f'markers {MARK_BEGIN!r} .. {MARK_END!r} not found in index.html')
    open(HTML_PATH, 'w').write(pat.sub(lambda _: block, src, count=1))
    print('injected into index.html', file=sys.stderr)


if __name__ == '__main__':
    if '--inject' in sys.argv:
        inject(json.load(open(JSON_PATH)))
    else:
        inject(build())
