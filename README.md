# Life Expectancy Dashboard

An actuarial life-expectancy estimate: start from your country's official life table, adjust it with published hazard ratios for the risk factors with the strongest evidence, and read off your survival curve, the years each factor adds or costs, the chance of reaching 80 / 90 / 100, and what changing something would do — with every number cited.

![Life Expectancy Dashboard screenshot](screenshot.png)

## What it models

- **17 national life tables, one source.** The UN's *World Population Prospects 2024* complete (single-year-of-age) tables for the US, UK, Canada, Australia, New Zealand, Ireland, Germany, France, Italy, Spain, the Netherlands, Switzerland, Sweden, Norway, Japan, Singapore and South Korea, by sex. The engine reproduces the UN's published life expectancy at birth for all 34 tables to within 0.02 years, which is asserted on every test run.
- **16 risk factors, each from a large cohort study or meta-analysis** — smoking (with intensity and years since quitting), BMI, exercise, alcohol, fruit & vegetables, sleep, blood pressure, diabetes, prior heart attack / stroke, COPD, kidney disease, depression, education, social connection, partnership, and parents' longevity. The hazard ratios and their sources are listed on the page itself, rendered from the same table the engine uses, so the documentation cannot drift from the code.
- **Re-anchored to the population average, not the study's reference group.** A published HR compares you with never-smokers or people of BMI 22.5–25; a national life table describes the *average* person, who is a mix. The multiplier actually applied is `HR ÷ Σ(prevalence × HR)`, so a person of exactly average risk reproduces the national table (asserted at every age) and a never-smoker correctly lands *above* the national average rather than at it. Smoking and BMI use each country's own WHO prevalence; disease prevalence and blood pressure are age-dependent.
- **Effects fade with age — except diseases.** Every source that stratifies by age finds relative risks shrinking in old age, so lifestyle, body and social factors fade from 60 (smoking from 75, where Thun et al. still find ≥ 3×). Diagnosed diabetes, heart disease, COPD and kidney disease do not fade: their sources' life-expectancy figures imply a sustained hazard.
- **Living parents count for the ages they may still reach.** The evidence (Atkins 2016) is about the age a parent *attained*, so a parent who is alive is censored data. The select separates "still living" from "passed away", and a living parent is credited with the life-table expectation over the bands they can still reach — a mother alive at 75 will on average reach her mid-80s, so she is a mild advantage (HR ≈ 0.79), not a "70s" penalty. Grandparents are not modelled: there is no well-measured effect independent of the parents to cite.
- **Your future is not frozen at today.** A 40-year-old without diabetes is not a 40-year-old who will *never* have diabetes. The chance of developing each absent condition at the population rate is priced in, and blood pressure drifts upward with age at the median rate. Without this the estimate for a healthy young person ran three years too high.
- **Mortality improvement toggle.** Off, today's death rates hold for life — the "period" figure quoted in the news. On, each future year's rate falls at the pace the UN projects for that country, sex and age band over 2024–2073 — the "cohort" figure, roughly +4 years for a 30-year-old.
- **What-if scenarios** overlay a dashed curve. Quitting smoking is modelled as it actually happens — the excess risk decays with a 7-year time constant, so the benefit keeps accruing after you quit, and a 30-year-old quitter recovers most of a smoker's loss.
- **Per-factor tornado chart** — years gained or lost versus the national average, one factor at a time, with an explicit *interaction* bar so the chart always reconciles to the headline figure. Gains are blue and losses red, not green and red: the green/red pair failed the colour-blind separation check (deutan ΔE 4.0), blue/red passes at 24.
- **Age-at-death distribution**, milestone tiles, table twins for every chart, dark/light theme, shareable URL hash, CSV and PNG export. No framework, no server, nothing leaves the page.

## Try it

Open `index.html` directly in a browser — no build step, no server, no dependencies beyond Chart.js (CDN, pinned with an SRI hash and a graceful fallback if it is blocked). Everything recalculates as you type.

## Calibration

The pipeline is checked against life-expectancy differences that the source papers report directly, computed live on the page and asserted by the harness:

| Check | Published | This engine |
|---|---|---|
| Current smoker vs never, US man aged 35 | ≈ 10 years (Jha 2013) | 8.7 |
| BMI 32 vs 23, aged 40 | 2–4 years (PSC 2009) | 2.0 |
| BMI 42 vs 23, aged 40 | 8–10 years (PSC 2009) | 6.0 |
| > 25 drinks/week vs ≤ 7, aged 40 | 4–5 years (Wood 2018) | 4.4 |
| Five low-risk habits vs none, US man aged 50 | 12.2 years (Li 2018) | 10.9 |
| Life expectancy, US man at 50 with all five low-risk habits | 87.6 (Li 2018) | 87.1 |
| Life expectancy, US man at 50 with none of them | 75.5 (Li 2018) | 74.4 |
| Diabetes + heart attack, aged 60 | 12 years (Di Angelantonio 2015) | 8.0 |

Two are worth a note. The alcohol HRs are *back-solved* so the engine reproduces Wood et al.'s reported losses, and the page says so. The multimorbidity figure is below the paper's because the paper's reference cohort had a lower death rate than the US table (a constant 3.7× on the actual table gives 10.2) and because the engine prices in that the healthy comparator may develop disease later; the acceptance band is 8–15 and the reasoning is on the page. The Li comparisons hold the other eleven factors at the population average so they compare like with like.

## Data

`tools/build_lifetables.py` streams the UN's two projection files (~200 MB gzipped each, never written to disk), keeps the 17 countries, and writes `tools/lifetables.json` (34 KB), which is committed and injected into `index.html` between the `LIFETABLES:BEGIN / END` markers. Re-inject without downloading: `python3 tools/build_lifetables.py --inject`.

**The baseline is the UN's 2024 table, not its 2023 estimate.** The WPP 2024 single-year *estimates* for 2022–23 carry artifacts for some countries — Australia's male death rates at ages 21–38 are recorded at ~0.00001, fifty times too low, with a spurious bump at 60–63 — and raw sampling noise for small ones (Norway's female rates jump ±40% between adjacent years). The first projected year comes from the UN's smooth mortality model, is consistent across countries, agrees with the 2023 estimate on life expectancy at birth to within 0.2 years, and is one year closer to today. The build script asserts that adult mortality rises over every 5-year span, which the 2023 tables fail.

Prevalence of smoking, obesity, overweight and underweight by country: WHO Global Health Observatory, 2022, age-standardised (`M_Est_smk_curr_std`, `NCD_BMI_30A`, `NCD_BMI_25A`, `NCD_BMI_18A`).

## Verifying changes

```sh
osascript -l JavaScript verify.js
```

2,687 assertions covering the life-table data, the Gompertz tail extension, the factor table (every factor cited, every prevalence summing to 1), the re-anchoring invariant at every age, the direction of every factor in five profiles, the age-fade rules, the 12× cap, the calibration checks above, the tornado's reconciliation, the what-if logic, hash round-tripping (including hostile links), the real input handlers (metric/imperial conversion), CSV/PNG export, the theme, and that every panel actually rendered. It evaluates the real script blocks out of `index.html` under stub DOM objects, so the tests exercise the shipped code and cannot drift from it. There is no Node on the machine this was built on, hence `osascript`.

Every assertion class was mutation-tested: the code was deliberately broken fourteen ways in a scratch copy (normalisation dropped, cap removed, improvement toggle ignored, hash key missing or colliding, smoking fade moved, tail extension flattened, imperial weight unconverted, BMI target wrong, blood-pressure drift removed, interaction bar dropped, a function smuggled into chart-plugin options) and the harness caught each one. Two lessons are baked into it. A missing hash key serialised as the literal string `"undefined"` and round-tripped anyway, so the harness checks the key map itself. And Chart.js treats any *function* inside plugin options as a scriptable option and calls it — a `format` callback came back as a string, the plugin threw inside `new Chart()`, and every panel after the tornado silently went blank; only the screenshot pass caught it. The stub `Chart` now runs the page's plugin hooks and the harness asserts plugin options carry no functions and that every panel rendered.

## Notes

- Single-file vanilla HTML/CSS/JS with Chart.js for the visualisations. No framework, no bundler, no backend.
- The combined hazard multiplier is capped at 12×. The proportional-hazards assumption has been tested to about 8× (three cardiometabolic diseases together, Di Angelantonio 2015); stacking fifteen adverse factors multiplicatively gave a 40-year-old a life expectancy of 41 before the cap, which no evidence supports. A profile that hits the cap is told so on the page.
- Most hazard ratios come from North American and European cohorts and are applied unchanged to every country; only the baseline table and the smoking/BMI prevalences are country-specific.
- Not medical advice. This is the average outcome for a large group of people who share your answers — individual outcomes vary enormously, and the estimate is only as honest as the inputs.
