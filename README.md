[README.md](https://github.com/user-attachments/files/32417954/README.md)
# Life Expectancy Dashboard

An actuarial life-expectancy estimate: start from your country's official life table, adjust it with 35 published hazard ratios for the risk factors with the strongest evidence, and read off your survival curve, the years each factor adds or costs, the chance of reaching 80 / 90 / 100, and what changing something would do — with every number cited.

<img width="1440" height="1250" alt="screenshot" src="https://github.com/user-attachments/assets/82e32e8e-15e0-48b8-84ec-7f2cf2e3e7ba" />

## What it models

- **17 national life tables, one source.** The UN's *World Population Prospects 2024* complete (single-year-of-age) tables for the US, UK, Canada, Australia, New Zealand, Ireland, Germany, France, Italy, Spain, the Netherlands, Switzerland, Sweden, Norway, Japan, Singapore and South Korea, by sex. The engine reproduces the UN's published life expectancy at birth for all 34 tables to within 0.02 years, which is asserted on every test run.
- **35 risk factors, each from a large cohort study or meta-analysis.** Lifestyle: smoking (intensity, years since quitting, cigar/pipe), exercise, strength training, sitting time, alcohol, sleep. Diet: fruit & vegetables, nuts, whole grains, processed meat, sugary drinks, coffee. Body: BMI, waist circumference, blood pressure, resting heart rate. Optional measurements: VO₂max, grip strength, hs-CRP. Conditions: diabetes / prediabetes, heart attack or stroke, atrial fibrillation, COPD, kidney disease, depression / serious mental illness, sleep apnoea, opioid or stimulant dependence, self-rated health. Social and environment: education, household income, employment, social connection, partnership, parents' longevity, air pollution. The hazard ratios and their sources are listed on the page itself, rendered from the same table the engine uses, so the documentation cannot drift from the code.
- **Every optional input is neutral until answered.** Measurements are judged against age- and sex-specific norms, so a blank field is exactly the population average and a value moves the estimate only by how far you sit from the norm. When VO₂max is entered, self-reported exercise counts at half weight — measured fitness is what it was standing in for.
- **Correlated factors are capped as groups**, so they cannot stack past what whole-pattern studies find: the five diet items at ±35 %, education + income at ±60 %, the fitness group at ±2.5×, BMI + waist at ±3×. The favourable side is soft: combined low-risk profiles have been studied to about half the average hazard, and below that each further halving counts half, with a hard floor at one-fifth; the adverse side keeps a 12× cap that multimorbidity data support to 8×. When either applies, the tornado's bars are computed without it and scaled to the headline so they still reconcile.
- **Re-anchored to the population average, not the study's reference group.** A published HR compares you with never-smokers or people of BMI 22.5–25; a national life table describes the *average* person, who is a mix. The multiplier actually applied is `HR ÷ Σ(prevalence × HR)`, so a person of exactly average risk reproduces the national table (asserted at every age) and a never-smoker correctly lands *above* the national average rather than at it. Smoking and BMI use each country's own WHO prevalence; disease prevalence and blood pressure are age-dependent.
- **Effects fade with age — except diseases.** Every source that stratifies by age finds relative risks shrinking in old age, so lifestyle, body and social factors fade from 60 (smoking from 75, where Thun et al. still find ≥ 3×). Diagnosed diabetes, heart disease, atrial fibrillation, COPD, kidney disease and drug dependence do not fade: their sources' life-expectancy figures imply a sustained hazard.
- **Living parents count for the ages they may still reach.** The evidence (Atkins 2016) is about the age a parent *attained*, so a parent who is alive is censored data. The select separates "still living" from "passed away", and a living parent is credited with the life-table expectation over the bands they can still reach — a mother alive at 75 will on average reach her mid-80s, so she is a mild advantage (HR ≈ 0.79), not a "70s" penalty. Grandparents are not modelled: there is no well-measured effect independent of the parents to cite.
- **Your future is not frozen at today.** A 40-year-old without diabetes is not a 40-year-old who will *never* have diabetes. The chance of developing each absent condition at the population rate is priced in, and blood pressure drifts upward with age at the median rate. Without this the estimate for a healthy young person ran three years too high.
- **Mortality improvement toggle.** Off, today's death rates hold for life — the "period" figure quoted in the news. On, each future year's rate falls at the pace the UN projects for that country, sex and age band over 2024–2073 — the "cohort" figure, roughly +4 years for a 30-year-old.
- **What-if scenarios** overlay a dashed curve. Quitting smoking is modelled as it actually happens — the excess risk decays with a 7-year time constant, so the benefit keeps accruing after you quit, and a 30-year-old quitter recovers most of a smoker's loss.
- **Per-factor tornado chart** — years gained or lost versus the national average, one factor at a time, with an explicit *interaction* bar so the chart always reconciles to the headline figure. Gains are blue and losses red, not green and red: the green/red pair failed the colour-blind separation check (deutan ΔE 4.0), blue/red passes at 24.
- **Age-at-death distribution**, milestone tiles, table twins for every chart, dark/light theme, shareable URL hash, CSV and PNG export. No framework, no server, nothing leaves the page.

## Try it

Open `index.html` directly in a browser — no build step, no server, no dependencies beyond Chart.js (CDN, pinned with an SRI hash and a graceful fallback if it is blocked). Everything recalculates as you type.

## Using the dashboard

1. **Start with the basics** — country, sex, age, height, weight, blood pressure, and the Lifestyle group. These are the inputs with the largest effects, and they are the only ones with concrete defaults; everything else starts as "not entered", which means the population average.
2. **Fill in what you know.** Waist, resting heart rate, VO₂max (a fitness watch's estimate is fine), grip strength and hs-CRP are optional and judged against people of your age and sex, so a blank field costs nothing and a value only moves the estimate by how far you sit from the norm. The Diet, Health conditions, Social & family and Environment groups work the same way.
3. **Read the four panels.** The hero figure is your life expectancy (the *mean* age at death for people like you) with the national average beside it. The survival curve shows the chance of still being alive at each age; the dot marks the median. *What each factor is worth* ranks every answer by the years it adds or costs versus the national average. *When, not just how long* shows the spread — half of people like you die before the median, one in ten before the P10 figure.
4. **Try a change.** Tick items in *What if you changed something?* to overlay the scenario as a dashed line; each line shows that change alone, the total applies them together.
5. **Toggle the projection.** *Mortality keeps improving* switches from today's death rates (the "period" figure quoted in the news) to the UN's projected improvement (the "cohort" figure, typically a few years higher for younger adults).
6. **Share or export.** *Copy link* puts every answer in the URL; *CSV* downloads the survival table; *PNG* saves the survival chart. Nothing you enter leaves the page.

The methodology panel at the bottom explains every rule, lists every hazard ratio with a link to its source, and shows the calibration checks computed live.

## Deploying

The site is static. To publish on GitHub Pages: create a repository, push this folder (`git remote add origin <url> && git push -u origin main`), then in the repository's *Settings → Pages* choose *Deploy from a branch*, branch `main`, folder `/ (root)`. The `.nojekyll` file is already there. The `og:image` tag in `index.html` points at `https://deet88.github.io/Life-Expectancy/screenshot.png` — change it if the repository is named differently.

## Calibration

The pipeline is checked against life-expectancy differences that the source papers report directly, computed live on the page and asserted by the harness:

| Check | Published | This engine |
|---|---|---|
| Current smoker vs never, US man aged 35 | ≈ 10 years (Jha 2013) | 11.0 |
| BMI 32 vs 23, aged 40 | 2–4 years (PSC 2009) | 2.8 |
| BMI 42 vs 23, aged 40 | 8–10 years (PSC 2009) | 8.6 |
| > 25 drinks/week vs ≤ 7, aged 40 | 4–5 years (Wood 2018) | 4.4 |
| Five low-risk habits vs none, US man aged 50 | 12.2 years (Li 2018) | 11.8 |
| Life expectancy, US man at 50 with all five low-risk habits | 87.6 (Li 2018) | 86.6 |
| Life expectancy, US man at 50 with none of them | 75.5 (Li 2018) | 74.2 |
| Diabetes + heart attack, aged 60 | 12 years (Di Angelantonio 2015) | 9.3 |

Two are worth a note. The alcohol HRs are *back-solved* so the engine reproduces Wood et al.'s reported losses, and the page says so. The multimorbidity figure is below the paper's because the paper's reference cohort had a lower death rate than the US table (a constant 3.7× on the actual table gives 10.2) and because the engine prices in that the healthy comparator may develop disease later; the acceptance band is 8–15 and the reasoning is on the page. Every check holds the factors it does not vary at the population average, which is what the papers compare.

## Data

`tools/build_lifetables.py` streams the UN's two projection files (~200 MB gzipped each, never written to disk), keeps the 17 countries, and writes `tools/lifetables.json` (34 KB), which is committed and injected into `index.html` between the `LIFETABLES:BEGIN / END` markers. Re-inject without downloading: `python3 tools/build_lifetables.py --inject`.

**The baseline is the UN's 2024 table, not its 2023 estimate.** The WPP 2024 single-year *estimates* for 2022–23 carry artifacts for some countries — Australia's male death rates at ages 21–38 are recorded at ~0.00001, fifty times too low, with a spurious bump at 60–63 — and raw sampling noise for small ones (Norway's female rates jump ±40% between adjacent years). The first projected year comes from the UN's smooth mortality model, is consistent across countries, agrees with the 2023 estimate on life expectancy at birth to within 0.2 years, and is one year closer to today. The build script asserts that adult mortality rises over every 5-year span, which the 2023 tables fail.

Prevalence of smoking, obesity, overweight and underweight by country: WHO Global Health Observatory, 2022, age-standardised (`M_Est_smk_curr_std`, `NCD_BMI_30A`, `NCD_BMI_25A`, `NCD_BMI_18A`).

## Verifying changes

```sh
osascript -l JavaScript verify.js
```

3,415 assertions covering the life-table data, the Gompertz tail extension, the factor table (every factor cited, every prevalence summing to 1), the re-anchoring invariant at every age, the direction of every factor in five profiles, the age-fade rules, the group caps, the soft floor and 12× cap, the neutrality of every not-entered input, the calibration checks above, the tornado's reconciliation, the what-if logic, hash round-tripping (including hostile links), the real input handlers (metric/imperial conversion), CSV/PNG export, the theme, and that every panel actually rendered. It evaluates the real script blocks out of `index.html` under stub DOM objects, so the tests exercise the shipped code and cannot drift from it. There is no Node on the machine this was built on, hence `osascript`.

Every assertion class was mutation-tested: the code was deliberately broken twenty ways in a scratch copy (normalisation dropped, cap removed, improvement toggle ignored, hash key missing or colliding, smoking fade moved, tail extension flattened, imperial weight unconverted, BMI target wrong, blood-pressure drift removed, interaction bar dropped, a function smuggled into chart-plugin options, not-entered inputs made non-neutral, group caps ignored, the fitness overlap rule dropped, the soft floor removed, unemployment counted past 65, prediabetes frozen) and the harness caught each one. Two lessons are baked into it. A missing hash key serialised as the literal string `"undefined"` and round-tripped anyway, so the harness checks the key map itself. And Chart.js treats any *function* inside plugin options as a scriptable option and calls it — a `format` callback came back as a string, the plugin threw inside `new Chart()`, and every panel after the tornado silently went blank; only the screenshot pass caught it. The stub `Chart` now runs the page's plugin hooks and the harness asserts plugin options carry no functions and that every panel rendered.

## Notes

- Single-file vanilla HTML/CSS/JS with Chart.js for the visualisations. No framework, no bundler, no backend.
- The combined hazard multiplier is capped at 12×. The proportional-hazards assumption has been tested to about 8× (three cardiometabolic diseases together, Di Angelantonio 2015); stacking fifteen adverse factors multiplicatively gave a 40-year-old a life expectancy of 41 before the cap, which no evidence supports. A profile that hits the cap is told so on the page.
- Most hazard ratios come from North American and European cohorts and are applied unchanged to every country; only the baseline table and the smoking/BMI prevalences are country-specific.
- Not medical advice. This is the average outcome for a large group of people who share your answers — individual outcomes vary enormously, and the estimate is only as honest as the inputs.
