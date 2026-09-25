# Data provenance: Mauna Loa CO₂ (Plate V)

The three CSV files here are unmodified copies of NOAA Global Monitoring Laboratory data
products, downloaded on **2026-09-25** from https://gml.noaa.gov/ccgg/trends/data.html.
Each file's own header was created on 2026-09-05.

| File | URL | Contents |
| --- | --- | --- |
| `co2_mm_mlo.csv` | https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv | Monthly mean CO₂ (ppm) at Mauna Loa, March 1958 onwards, with a deseasonalised series |
| `co2_annmean_mlo.csv` | https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv | Annual means (ppm), 1959 onwards |
| `co2_gr_mlo.csv` | https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_gr_mlo.csv | Annual growth, 1 Jan to 31 Dec (ppm/yr), 1959 onwards |

**Credit.** The data are provided by NOAA GML (contact: Xin Lan). Data from March 1958 to
April 1974 were obtained by C. David Keeling of the Scripps Institution of Oceanography
(SIO), as stated in the file headers. The files ask users to credit GML. The page credits
"NOAA Global Monitoring Laboratory and Scripps Institution of Oceanography" and links here.

**Notes from the file headers that the page relies on.**

- Monthly values are built from daily means. Missing months are interpolated.
- Because of the eruption of the Mauna Loa volcano, measurements at Mauna Loa Observatory
  were suspended from 29 Nov 2022 and resumed in July 2023. Observations from December
  2022 to 4 July 2023 come from the Maunakea Observatories, about 21 miles north.

**Derived values.** Everything the page computes (annual means, the average seasonal
cycle, decade averages of the published growth) is done in `src/lib/keeling/co2.ts`.
It is tested in `co2.test.ts`, including a year-by-year check that the annual means
computed from the monthly file reproduce NOAA's published annual means to ±0.01 ppm.
