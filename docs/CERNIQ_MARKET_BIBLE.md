# CERNIQ Market Bible — Puerto Rico Cooperativas Market Intelligence

> Compiled 2026-06-06 from web research (English + Spanish sources, primary documents fetched where possible).
> Every claim is sourced inline. Items marked **UNVERIFIED** need confirmation before use in sales/legal contexts.
> Verification queue in §9.

## TL;DR — The Ten Facts That Matter

1. **91 COSSEC-insured cooperativas de ahorro y crédito**, $12.48B total assets (Dec 2025), 1.16M socios. Down from 111 in 2021 — consolidation continues.
2. **84% of assets sit in just 40 cooperativas >$100M** — the realistic ICP is ~60 institutions.
3. **57+ cooperativas hold mortgage portfolios** ($2.05B system-wide, growing every quarter) — confirmed at the April 2026 COSSEC/FHLBNY Cumbre.
4. **FHLBNY membership opened to cooperativas in Jan 2026** (Ley 73-2025). La Sagrada Familia (Corozal) admitted April 2026; LarCoop second in line. Membership requires bilingual GAAP audited statements, monthly loan-level collateral files (COL-121), and annual Reg 8665 attestations — all CERNIQ-shaped work.
5. **CECL is live** (Carta Circular 2023-01) with a triple parallel CAEL filing in AITSA since March 2024; **RAP→GAAP transition deadline ~2028** (Jan vs June contested between Ley 99-2024 and the FOMB).
6. **All COSSEC filings flow through AITSA** (aitsa.cossec.pr.gov) — quarterly financials, liquidity reports, asamblea reports. No third-party vendor produces AITSA/COSSEC output today.
7. **No mainland ALM vendor has Spanish support, PR presence, or COSSEC output.** Confirmed across Vizo, ALM360/QuantyPhi, DCG, Brick, CLA, Mark H. Smith. The differentiator is real.
8. **Core systems**: 4 cooperativas on Fiserv DNA (USICOOP CUSO), 4+ on Sharetec (fastest-growing on the island), zero confirmed Symitar. Long tail on local/legacy cores → generic CSV/flat-file adapter is mandatory.
9. **COSSEC got NASCUS accreditation (June 2025)** + NCUA MOU (2023) → examiner expectations rising. Strongest regulatory-tailwind sales hook.
10. **GTM channels**: ASEC convention (March, Ponce Hilton — booths sold to vendors), Liga's Puerto Rico Cooperativista (quarterly, 40k copies, inserted in Primera Hora), six Consejos Regionales, Mes del Cooperativismo (October).

---

## 1. COSSEC Registry & Market Universe

### 1.1 The registry

- COSSEC (Corporación Pública para la Supervisión y Seguro de Cooperativas, created by **Ley 114-2001**) insures shares/deposits up to **$250,000/member**. Official site: [cossec.pr.gov](https://www.cossec.pr.gov/) → [Coop Ahorro y Crédito section](https://www.cossec.pr.gov/coop-ahorro-y-credito).
- The de-facto registry with financials: quarterly **"Estadísticas Industria Cooperativas de Ahorro y Crédito"** report, generated from the **AITSA** filing system. **Anejo 9** lists every insured cooperativa with charter number, assets, members, employees, ranked by assets. Latest fetched: [Q3 Sep-2025 PDF](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Estadisticas%20Industria%20Cooperativas%20de%20Ahorro%20y%20Credito/Estad%C3%ADsticas_Industria_Cooperativas_AC_sep_2025.pdf). Q4/Dec editions due ≤ March 15 following year.
- Historical series: [Estadísticas.PR — Mercado y Finanzas de Cooperativas](https://estadisticas.pr/en/inventario-de-estadisticas/mercado_finanzas_cooperativas). Secondary directory: [Liga de Cooperativas — Directorio](https://liga.coop/directorio/) (2021 print edition: 105+ coops, 200+ branches).

### 1.2 System size (Sep 30, 2025 — COSSEC Q3-2025 report)

| Metric | Value |
|---|---|
| Insured cooperativas | **91** (111 in 2021, 98 in Sep-2023) |
| Total assets | $12,415.1M |
| Members | 1,163,581 |
| FT employees | 3,285 |
| Loans | $7,722.5M (personal 37.3%, **mortgage 26.6% = $2,050.6M**, auto 25.1%, commercial 7.1%) |
| Deposits | $8,653.2M; acciones $2,465.5M |
| Capital | $3,595.4M (~29% of assets) |
| Morosidad | 2.40%; reserve coverage 125.5% |
| Avg loan yield | 7.57%; first-mortgage book 5.86% |
| CAEL ratings | 48 coops "1", 40 "2", 3 "4", none "3"/"5" |
| Regional assets | Caguas $3,311M · Arecibo $3,004M · Mayagüez $2,182M · Ponce $1,493M · SJ Área $1,245M · SJ Isla $1,179M |

**Year-end Dec 31, 2025** (COSSEC, Feb 2026): assets **$12,483M**; loans $7,827M (+4.53% YoY); acciones+depósitos $11,169M; capital ~$3,626M; members 1,164,046; morosidad 2.32%. Sources: [Semanario Visión](https://periodicovision.com/sistema-cooperativo-supera-los-12-4-mil-millonesen-activos-y-fortalece-su-posicion-financiera/), [NotiCel](https://noticel.com/en/noticias/gobierno/20260219/sistema-cooperativo-supera-los-12-4-mil-millones-en-activos/).

**Q1 2026** (latest): ETI stability index 0.57; capital $3,655M; **capital indivisible $412M = 3.25% of assets**; capital/assets ex-shares 9.35%. [NotiCel](https://noticel.com/en/noticias/20260604/cooperativas-mantienen-estabilidad-financiera-al-cierre-del-primer-trimestre-del-2026/), [El Vocero](https://www.elvocero.com/economia/cooperativas-arrancan-2026-con-finanzas-s-lidas-y-menor-morosidad/article_4cd0a85e-68a7-44ba-b72b-fbc88e2ec393.html).

**Asset concentration (TAM math):** 40 coops >$100M hold **$10,455M (84.2%)**; 20 coops at $50–100M hold $1,580M; remaining 31 coops hold <$400M combined.

### 1.3 Top 20 by assets (COSSEC Anejo 9, 9/30/2025)

| # | Cooperativa | HQ | Assets | Members | FTE | Notes |
|---|---|---|---|---|---|---|
| 1 | Coop A/C de Rincón | Rincón | $905.0M | 53,439 | 131 | Largest by assets |
| 2 | **COOPACA** (Arecibo) | Arecibo | $819.0M | 119,890 | 276 | Largest by members & staff |
| 3 | **CrediCentro** (Barranquitas) | Barranquitas | $515.0M | 34,750 | 98 | Fiserv DNA (USICOOP) |
| 4 | Las Piedras | Las Piedras | $493.6M | 78,741 | 155 | 2nd by members |
| 5 | **Oriental** | Humacao | $436.5M | 27,428 | 121 | CEO is ASEC VP |
| 6 | Isabela | Isabela | $375.7M | 48,340 | 70 | |
| 7 | **CamuyCoop** | Camuy | $366.0M | 20,224 | 90 | Fiserv DNA (USICOOP) |
| 8 | **VegaCoop** (Vega Alta) | Vega Alta | $364.0M | 40,454 | 87 | Strong CECL reserves |
| 9 | Cabo Rojo | Cabo Rojo | $348.6M | 35,683 | 94 | CEO chairs Circuito Coop |
| 10 | **La Sagrada Familia** | Corozal | $337.1M | 40,337 | 90 | **First FHLBNY cooperativa member (Apr 2026)** |
| 11 | Manatí | Manatí | $336.5M | 31,446 | 112 | Sharetec (2024) |
| 12 | San José | Aibonito | $324.0M | 30,504 | 75 | |
| 13 | **Medi-Coop** | San Juan | $286.4M | 8,146 | 27 | Professional bond (médicos) |
| 14 | Villalba | Villalba | $283.2M | 17,888 | 44 | |
| 15 | Dr. Manuel Zeno Gandía | Arecibo | $277.9M | 26,730 | 66 | Absorbed part of Coop Aguada |
| 16 | Roosevelt Roads | Fajardo/Ceiba (UNVERIFIED) | $247.5M | 24,308 | 86 | |
| 17 | **Mauna-Coop** (Maunabo) | Maunabo | $247.3M | 18,753 | 55 | Fiserv DNA (USICOOP) |
| 18 | **CandelCoop** | Mayagüez (UNVERIFIED) | $245.8M | 16,145 | 47 | |
| 19 | **LarCoop** (Lares) | Lares | $237.2M | 16,862 | 74 | **2nd FHLBNY applicant** |
| 20 | San Rafael de Quebradillas | Quebradillas | $231.7M | 31,614 | 61 | Wrote own FHFA comment letter |

**#21–33 (next tier):** Yauco $180.2M · Aiboniteña $169.7M · Valenciano (Juncos) $169.6M · Juana Díaz $163.5M · Cristóbal Rodríguez Hidalgo $162.8M · Hatillo $155.8M · Aguadilla $150.6M · Asoc. de Maestros PR $148.1M · Naguabeña $144.8M · Crédito La Puertorriqueña $139.6M · Caguas Coop $137.1M · Jesús Obrero $132.5M (CDFI, solar-lending leader) · Cidreña $123.3M. Also: Moca $97.1M, Mayagüez $91.1M, Saulo D. Rodríguez (Gurabo) $87.1M, Florida $65.8M. Smallest insured: Personal Ballester Hnos. $0.88M. **Coop Aguada no longer exists** — assets distributed 2021 to Zeno Gandía, CamuyCoop, Cabo Rojo et al.

Source for all figures: [COSSEC Q3-2025 Anejo 9](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Estadisticas%20Industria%20Cooperativas%20de%20Ahorro%20y%20Credito/Estad%C3%ADsticas_Industria_Cooperativas_AC_sep_2025.pdf).

### 1.4 Type distinctions (ICP scoping)

| Type | Law | Regulator | CERNIQ target? |
|---|---|---|---|
| Cooperativas de ahorro y crédito (91) | Ley 255-2002 | COSSEC (insured, quarterly AITSA) | **YES — the ICP** |
| Tipos diversos (workers/consumer/housing/production) | Ley 239-2004, via CDCOOP | COSSEC supervisory role only; semi-annual filings | No |
| Insurance coops (Seguros Múltiples, COSVI) | Insurance code | PR Insurance Commissioner | No (but Seguros Múltiples is an FHLBNY member) |
| **Federal credit unions (7)** | FCU Act | **NCUA, not COSSEC** | No (different regulator) — Caribe Federal $750.6M, VAPR $298.2M, PR FCU $185.1M, Universal Coop $30.4M, Borinquen Community $17.4M, Glamour $4.0M, PR Employee Groups $3.2M ([NCUSO PR listing](https://ncuso.org/credit-union/pr/)) |

---

## 2. Liga de Cooperativas de Puerto Rico

### 2.1 Organization

- **Apex (third-degree) integration body** of the PR cooperative movement, created 1948 by the cooperativas themselves. [liga.coop](https://liga.coop/) · (787) 764-2727 · info@liga.coop · 761 Ave. Luis Muñoz Rivera, San Juan 00918.
- Per ED Heriberto Martínez (Jan 2026): ~98% of PR coops are first-degree; three second-degree entities: **Grupo Cooperativo Seguros Múltiples, COSVI, Banco Cooperativo de PR**. [News is My Business, Jan 2026](https://newsismybusiness.com/puerto-rico-cooperatives-close-25-strong-brace-for-26/).
- Education arm: **CENASE** (seminar catalog for coop staff/boards) — [liga.coop/cenase](https://liga.coop/cenase/). Podcast: "Cooperativismo por Puerto Rico" ([Spotify](https://open.spotify.com/show/5yD9wyF7z9slEyh8QFtecQ)).

### 2.2 Events 2025–2026

| Event | When | Notes |
|---|---|---|
| **ASEC XXIII Convención Nacional** | **Mar 28–29, 2025, Ponce Hilton** | Theme "Cooperativismo 5.0"; vendor booths 10'×8'; reg $595–650. Contact Dahlia Torres (939) 262-3800, dtorres@ejecutivos.coop. Annual, late March. [ASEC](https://www.ejecutivos.coop/convencion2025/) — **the single best GTM event** |
| ASEC Seminario Residencial | ~August (annual) | Multi-day residential education event |
| **Mes del Cooperativismo** | October (statutory, Ley 491-2004) | Governor's proclamation, flag-raising at Liga, island-wide local events. [Liga](https://liga.coop/mes-del-cooperativismo/) |
| Consejo regional conferences | Recurring (e.g., Consejo Norte conference late 2025) | Exec presidents + board members attend |
| COSSEC/FHLBNY **Cumbre de Acceso a Capital Cooperativo** | April 2026 | 57+ cooperativas with mortgage portfolios attended. [Primera Hora](https://www.primerahora.com/noticias/consumo/notas/cossec-y-el-fhlb-de-nueva-york-impulsan-acceso-a-capital-para-cooperativas-en-puerto-rico/) |
| Liga asamblea anual | UNVERIFIED — date not published | Check Liga Facebook or call |
| 2025 = UN International Year of Cooperatives | All year | Sector-wide promotional theme |

### 2.3 Puerto Rico Cooperativista (publication)

- Newspaper edited by the Liga **since 1963**; ASSPRO award winner. [Official page](https://liga.coop/puerto-rico-cooperativista/).
- **Quarterly: January, April, July, October.** 24 pages full color, **40,000 copies/edition** + digital ([Issuu archive](https://issuu.com/ligadecooperativasdepuertorico/docs/pr_cooperativista_octubre)).
- Distribution: through cooperativas **plus inserted in Primera Hora** (since 2018) at 99 intersections island-wide.
- Submissions/advertising: **coordinacion@liga.coop** (Grace M. Matos). Editorial deadlines unpublished — UNVERIFIED; assume materials due ~4–6 weeks pre-issue and confirm by email.

### 2.4 Liga staff & board (liga.coop, updated 2026-01-19)

**Staff:**
| Name | Role | Email |
|---|---|---|
| **Heriberto Martínez Otero** | Director Ejecutivo (economist, ex-pres. Asoc. Economistas PR; since Sept/Oct 2023) | ejecutivo@liga.coop |
| **Lissette Estevez** | Gerente Programas Educativos, Informáticos e Investigativos — **education/tech gatekeeper** | educacion@liga.coop |
| **Grace M. Matos** | Coordinación de Programas y Servicios — **PR Cooperativista contact** | coordinacion@liga.coop |
| Lcda. Irma N. Torres Suárez | Asesora Legal | irma@liga.coop |
| Cynthia Díaz Martínez | Asistente Dirección Ejecutiva | cynthia@liga.coop |
| Myrna I. Rosa López | Contabilidad y RRHH | myrna@liga.coop |
| Gabriel Muriente | Oficial de Servicios | desarrollo@liga.coop |

**Junta de Directores** ([source](https://liga.coop/quienes-somos/junta-de-directores/)): Presidente **Iván A. Otero Matos** (Comisión Vivienda); VP Edmarie Vargas Mercado (Consejo Norte); 2do VP William Ortiz Negrón (Consejo Oeste); Secretario Orlando Torres López (Consejo Sur Central); Tesorero Jacinto Laureano Martínez (Consejo Este); Subsecretario Jesús Oliveras Ortiz (Consejo Metro); Subtesorero Fundador Rosario Cortés (Tipos Diversos); Lirca A. Feliciano Hernández (Consejo Metro Norte); **Gerardo Matos Ayala (Comisión Ahorro y Crédito — most relevant for CERNIQ)**; Michele Franqui Baquero (Banco Cooperativo); Joel Chévere Santos (COSVI); Lcdo. José A. Alvarado Roche (Seguros Múltiples).

### 2.5 Regional structure & related bodies

- **Six Consejos Regionales**: Metropolitano, Metro Norte, Norte, Oeste, Sur Central, Este — the Liga's geographic structures; hold their own conferences (cadence unpublished — UNVERIFIED). [Liga](https://liga.coop/quienes-somos/consejos-regionales/). Plus **Comisiones Sectoriales** (incl. Comisión Ahorro y Crédito).
- **ASEC** (Asociación de Ejecutivos de Cooperativas, 1973) — **best channel to CEOs**. Junta: Pres. **Carlos F. Ortiz Díaz** (BoniCoop); VP **William Méndez Pagán** (Coop Oriental); Sec. Vivian Morales Cruz (CACSI); Tes. Orlando Rodríguez Velázquez (CaribeCoop); Dirs. Ivis N. Vallés Rivera (Morovena), Edgar A. López Román (Las Piedras), Yerlyn Barreto Barreto (MocaCoop); **Dir. Ejecutiva Dahlia Torres Valentín** (dtorres@ejecutivos.coop). Member directory: [ejecutivos.coop/socios](https://www.ejecutivos.coop/socios/).
- **CDCOOP** — government umbrella (Ley 247-2008); ratifies COSSEC exec president. Current Commissioner under González administration UNVERIFIED.
- **FIDECOOP** — movement's investment fund ([fidecoop.coop](https://www.fidecoop.coop/)). ("FECOOPSE" could not be verified — likely FedeCoop or FIDECOOP.)
- **Circuito Cooperativo** — shared branching: 50+ coops, ~950k members, CO-OP Shared Branch access to 5,500+ US branches. Board pres.: **Kerwin Morales** (Coop Cabo Rojo). [circuito.coop](https://circuito.coop/quienes-somos/).
- **Banco Cooperativo de PR (BanCoop)** — sector correspondent bank; **CEO Johnny A. Pérez-Crespo (Jan 2025)**; developing shared digital/core technology for cooperativas — potential partner OR competitor. [El Vocero](https://www.elvocero.com/economia/en-ruta-a-modernizar-el-sistema-digital-de-las-cooperativas/article_f032079d-b424-4d8f-9f8e-0b0ab60295a3.html).
- **Grupo Cooperativo Seguros Múltiples** — exec pres. **Yamil García Díaz** (since Feb 2024).
- **Instituto de Cooperativismo (UPR Río Piedras)** — academic partner; current director UNVERIFIED (conflicting listings); instituto.cooperativismo@upr.edu.

---

## 3. COSSEC Regulatory Requirements

### 3.1 Legal framework

| Law | What it does |
|---|---|
| **Ley 255-2002** | Organic law for cooperativas A/C. [Consolidated PDF](https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Cooperativas/255-2002/255-2002.pdf) |
| **Ley 114-2001** | Creates COSSEC (regulator + insurer). [Consolidated PDF](https://bvirtualogp.pr.gov/ogp/BVirtual/LeyesOrganicas/pdf/114-2001.pdf) |
| **Ley 220-2015** | RAP divergence: PR government bonds at amortized cost; realized losses amortizable up to 15 years. [LexJuris](https://www.lexjuris.com/lexlex/Leyes2015/lexl2015220.htm) |
| Ley 239-2004 | General cooperatives law (non-A/C) |

**Recent amendments (high relevance):**

| Law | Date | Effect |
|---|---|---|
| Ley 65-2024 | May 2024 | Assembly quorum on second call: wait cut 2h → 30 min |
| **Ley 99-2024** | 2024 | COSSEC fiscal reform; mitigation of ~$400M PR-bond menoscabos; **extends RAP→GAAP deadline Jan 2028 → June 2028** (conditioned). **FOMB found it inconsistent with PROMESA (Aug 2024) and ordered amend/repeal — status contested, UNVERIFIED.** [LexJuris](https://www.lexjuris.com/lexlex/Leyes2024/lexl2024099.htm), [Microjuris](https://aldia.microjuris.com/2024/08/21/junta-de-supervision-pide-al-gobierno-enmendar-o-eliminar-ley-de-alivio-a-cooperativas/) |
| **Ley 73-2025** | Jul 2025 | Authorizes cooperativa FHLB membership; preserves FHLB lien priority in dissolution. [CUInsight](https://www.cuinsight.com/press-release/inclusiv-celebrates-the-passing-of-local-law-allowing-puerto-rican-cooperativas-to-access-federal-home-loan-bank-system/) |
| Ley 165-2025 | 2025 | New quorum rules for cooperativa assemblies |
| **Ley 15-2026** | Jan 7, 2026 | Coops may offer **commercial credit lines/cards to non-members and for-profit entities** — expands loan-book modeling surface. [LexJuris](https://www.lexjuris.com/lexlex/Leyes2026/lexl2026015.htm) |
| Ley 71-2026 | Apr 28, 2026 | Minimum startup share capital $50k → $150k |

### 3.2 CECL status

- **COSSEC adopted CECL via Carta Circular 2023-01** (FY 2023, with exceptions; the PDF is a non-OCR scan — exact exceptions UNVERIFIED). [Sin Comillas analysis](https://sincomillas.com/el-cambio-a-cecl-afecta-a-las-cooperativas/), [CC-2023-01 PDF](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Cartas%20Circulares/CARTAS%20CIRCULARES%202023/CC-2023-01.pdf).
- Legacy incurred-loss methodology: **Reglamento 8665 §2.12.2.5** ([PDF](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Reglamentos/8665.pdf)).
- **Since March 2024 quarterly filing: THREE parallel CAEL reports in AITSA** — (1) CAEL per Reglamento 7790, (2) CAEL with CECL, (3) "CAEL Piloto" with Net Equity Ratio replacing Real Capital/Total Assets (exact circular number UNVERIFIED).
- Observed CECL capital impact: one coop ~17.1% of capital real social; VegaCoop only 4.6–5.2% (strong reserves).
- **RAP→GAAP transition**: required by COSSEC Fiscal Plan (FOMB-certified May 2023, "under RAP, potential losses are masked"); deadline Jan 1, 2028, extended to June 2028 by Ley 99-2024 — **operative deadline in flux, monitor**. [FOMB](https://oversightboard.pr.gov/cossec-fiscal-plan-a-road-map-to-strengthen-financial-cooperatives/).
- **Product implication: CERNIQ's CECL engine must output BOTH Reglamento 8665 incurred-loss and ASU 2016-13 CECL through ~2028.**

### 3.3 Reporting requirements

| Report | Frequency | Channel | Legal basis |
|---|---|---|---|
| Informe Trimestral (financial/statistical) | Quarterly (Mar/Jun/Sep/Dec; ~10-business-day deadline) | **AITSA** (aitsa.cossec.pr.gov) | Ley 114-2001 Art. 13; Reglamento 6758 Cap. VII §3(c)(1) |
| Informe de Liquidez | Referenced in circulars; frequency UNVERIFIED | AITSA | |
| Informe de Asamblea Anual | Annual | AITSA | |
| Monthly reports | Calendar set in Reglamento 6758 Cap. VII §3(a) — exact content UNVERIFIED | | |
| Audited financial statements | Annual (~120 days post-close — UNVERIFIED) | Auditor must comply with CC-09-02 (incl. staff rotation) | |
| Triple CAEL (see §3.2) | Quarterly since Mar 2024 | AITSA | Reglamento 7790 |

- **CAEL rating system** (not PEARLS): Reglamento 7790-2010, scale 1 (best) – 5 (critical). [PDF](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Reglamentos/7790.pdf).
- Late/incorrect AITSA filing = regulatory violation, fines; extensions only +5 calendar days.
- AITSA can interface directly with the coop's core system — **the key integration target for CERNIQ**.
- COSSEC publishes the quarterly industry PDF (14 anejos) — **PDF only, no API**.
- Cartas circulares archive: [docs.pr.gov COSSEC repository](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Cartas%20Circulares/CARTAS%20CIRCULARES%202023/CC-2023-05.pdf); many older PDFs are image-only scans.

### 3.4 Coming in 2026–2027

- **NASCUS accreditation (June 2025, first ever)** — exam standards rising. [CUToday](https://www.cutoday.info/Fresh-Today/Historic-First-COSSEC-Receives-NASCUS-Accreditation-Marking-Milestone-For-Cooperative-Movement).
- **NCUA–COSSEC MOU (2023)** — examiner training, enhanced supervision. [NCUA](https://ncua.gov/newsroom/press-release/2023/ncua-cossec-partnership-will-strengthen-supervision-cooperativas).
- **PCA protocol** (NCUA/FDIC-style prompt corrective action) required by the COSSEC fiscal plan — no final rule yet, pending/UNVERIFIED.
- Reglamento 9674 (member disputes), Reglamento 9441 (investigative procedures), Reglamento 9313 (amends reporting chapters; BSA/AML/OFAC exam updates).
- BSA/AML: coops subject to 31 CFR Ch. X (FinCEN). No standalone COSSEC cyber regulation found (gap).

### 3.5 Capital adequacy

- **Capital indivisible** (7 LPRA §1366a): indivisible non-distributable reserve; phased floors reaching 4% of total assets, designed to guarantee an **8% index of indivisible capital over risk-weighted assets**; **35% of the reserve must be in liquid assets**. [Justia](https://law.justia.com/codes/puerto-rico/2018/titulo-7/parte-iii/capitulo-86/subcapitulo-vi/1366a/).
- 10% of net surplus feeds reserves (COSSEC-established).
- Solvency measured through CAEL; revised CAEL replaces Capital Real/Activos with **Net Equity Ratio**.
- Current system level: capital indivisible $412M = 3.25% of assets (Q1 2026) — i.e., **many coops are still building toward the floor → capital-planning analytics sell**.

---

## 4. Competitor Deep-Dive — Mainland ALM Vendors

### 4.1 Comparison table

| Vendor | Model | Pricing | Spanish? | PR presence? | COSSEC output? |
|---|---|---|---|---|---|
| **Vizo Financial / ALM Direct** | Hybrid outsourced + web portal (income sim 1–15 yr, NEV, shocks/ramps/twists; CU supplies data files + Excel templates) | Not published | None | None | None |
| **ALM360** (QuantyPhi, CUSO of **Corporate Central CU** — NOT Catalyst) | SaaS: ALM + CECL (PD-LGD & SCALE) + liquidity + optimization; "simplified ALM" tier for small CUs | Not published | None | None | None |
| **Darling Consulting Group** | Premium advisory (consultant drives ALCO) + DCG360 suite (Liquidity360, Deposits360, Loans360); targets $500M–$50B | Not published (premium) | None | None | None |
| **Brick & Associates CU/ALM-ware** | Licensed software, instrument-level, 8 shock tests, NCUA NEV Supervisory Test, decay-rate DB; serves **$10M–$9B** CUs; CU*Answers partner | Not published | None | None | None |
| **CLA (CliftonLarsonAllen)** | Professional services — chiefly **ALM model validation** (validates others' models, not a quarterly modeler) | Not published | None | UNVERIFIED | None |
| **Mark H. Smith (MHSI)** | Most direct small-CU analog: outsourced quarterly ALM, ~400 clients, quarter-to-quarter contracts, free setup, "data in whatever format", CECL add-on | Not published; positioning implies low-five-figures/yr | None | None | None |

Other players: ALM First (premium advisory, ~$79B AUM), ProfitStars/Jack Henry FPS, Empyrean, ZM Financial (Moody's), Plansmith, EasCorp, VolCorp, Cornerstone, Accolade, Wilary Winn. Catalyst Corporate runs its own separate ALM service. QRM = enterprise-only. FICS = mortgage servicing software, not ALM (misfit).

### 4.2 Key findings

1. **No vendor publishes pricing** — all quote-based. The $5k–$30k/yr small-CU band is anecdotal/UNVERIFIED.
2. **Zero Spanish support, zero PR-specific features, zero COSSEC/AITSA output across the entire market.** The only Spanish-language ALM marketing found was SAS's enterprise suite for Spain/LatAm — far above this segment.
3. **No third-party vendor produces AITSA/COSSEC filings today** — confirmed white space.
4. The standard integration pattern industry-wide is **quarterly instrument-level flat-file/CSV extracts + GL trial balance**, not live APIs — CERNIQ matching this pattern lowers switching friction.

Sources: [Vizo ALM](https://www.vfccu.org/solutions_mobile/alm.html) · [ALM360](https://corpcu.com/alm360) · [QuantyPhi CECL](https://quantyphi.com/services/alm360/cecl-modeling) · [DCG](https://www.darlingconsulting.com/dcg-360-software) · [Brick CU/ALM-ware](https://www.brickinc.com/software-solutions/cualm-ware-system/) · [CLA](https://www.claconnect.com/en/industries/credit-unions/asset-liability-model-validation-for-credit-unions) · [MHSI FAQ](https://markhsmith.com/faq/).

---

## 5. PR Economic Data Sources (CERNIQ feed architecture)

| Source | Content | Format / Frequency | API | Access |
|---|---|---|---|---|
| **BLS** | PR LAUS (`LASST72...`, e.g. `LASST720000000000003` = unemployment rate SA), CES (`SMS72.../SMU72...`), QCEW (FIPS 72) | JSON | **Yes — BLS API v2**: POST `https://api.bls.gov/publicAPI/v2/timeseries/data/`; free key; 500 q/day, 50 series/q, 20 yrs/q | [bls.gov/developers](https://www.bls.gov/developers/api_faqs.htm) |
| **FRED** | **925 PR-tagged series** (LAUS, FHFA HPI, GDP-type, ACS) — best single programmatic PR gateway | JSON/CSV | **Yes** — free key, ~120 req/min | [PR tag](https://fred.stlouisfed.org/tags/series?t=puerto+rico) |
| **FHFA HPI** | Quarterly **all-transactions HPI for PR** (developmental index) + San Juan-Bayamón-Caguas MSA | CSV/XLSX, quarterly, ~2-mo lag | Static download (also in FRED) | [fhfa.gov/data/hpi/datasets](https://www.fhfa.gov/data/hpi/datasets); purchase-only PR series UNVERIFIED |
| **Census** | PEP municipio estimates (Vintage 2025, all 78 municipios); **PRCS** (ACS for PR; 5-yr = all municipios) | CSV + API | **Yes** — `api.census.gov`, state FIPS **72**, free key | [PEP tables](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-puerto-rico-municipios.html), [PRCS](https://www.census.gov/programs-surveys/acs/about/puerto-rico-community-survey.html) |
| **EDB/BDE — PRED portal** | **Economic Activity Index (EDB-EAI** — published by EDB, NOT Junta de Planificación; payroll + cement + gasoline + power) + Time Series workbook (~150 monthly indicators, 10 yrs: auto sales, bankruptcies, tourism — legacy GDB indicators) | Excel + PDF, monthly | No | [bde.pr.gov PRED](https://www.bde.pr.gov/BDEPROnline/Home/PRED), [EDB-EAI](https://www.bde.pr.gov/BDEPROnline/PREDDOCS/EDB-EAI.pdf) |
| **Junta de Planificación** | Informe Económico al Gobernador + Apéndice Estadístico (GNP, balance of payments; 34 tables) | PDF + Excel, annual | No | [jp.pr.gov](https://jp.pr.gov/apendice-estadistico-del-informe-economico-a-la-gobernador/) |
| **DTRH** | Encuesta Grupo Trabajador, CES, **monthly unemployment by municipio**, OES wages | PDF/Excel, monthly | No | [mercadolaboral.pr.gov](http://www.mercadolaboral.pr.gov/tablas_estadisticas.aspx) |
| **OCIF** | Quarterly statements of condition by institution type (banks, mortgage cos, IBEs) | Excel/PDF, quarterly | No | [ocif.pr.gov/estadisticas](https://www.ocif.pr.gov/estadisticas) |
| **Instituto de Estadísticas** | Cross-agency inventory incl. COSSEC stats | Mixed | **Yes** ([api.estadisticas.gobierno.pr](http://api.estadisticas.gobierno.pr/)) — per-dataset coverage UNVERIFIED | [estadisticas.pr](https://estadisticas.pr/) |
| **COSSEC quarterly** | Full coop-industry financials (14 anejos incl. per-coop Anejo 9) | **PDF only**, quarterly, ~75-day lag | No — **scraping pipeline needed** | [docs.pr.gov](https://docs.pr.gov/files/COSSEC/Documentos%20Cooperativas/Estadisticas%20Industria%20Cooperativas%20de%20Ahorro%20y%20Credito/Estad%C3%ADsticas_Industria_Cooperativas_AC_sep_2025.pdf) |
| **TransUnion PR** | Only major bureau with dedicated PR subsidiary (Trans Union de Puerto Rico, Guaynabo) | Commercial contract | Commercial | [TransUnion LatAm](https://www.transunion.com/about-us/global-locations/latin-america) |
| NY Fed | PR regional economy charts | PDF | No | [newyorkfed.org](https://www.newyorkfed.org/medialibrary/media/research/regional_economy/charts/Regional_PuertoRico) |

**Feed architecture conclusion**: BLS + FRED + Census APIs programmatic; EDB/JP/DTRH/OCIF/COSSEC require PDF/Excel scraping pipelines. NCUA call-report data does NOT cover cooperativas (COSSEC-insured, not NCUA).

---

## 6. Core Banking Systems in PR Cooperativas

| Core | Confirmed PR cooperativas | Source |
|---|---|---|
| **Fiserv DNA** | CrediCentro, Mauna-Coop, CamuyCoop, CoopRincón — via **USICOOP** CUSO (San Juan, formed 2013, ~$1B combined; chose DNA for open architecture). Current status (2026) UNVERIFIED — last primary source is 2014 | [Fiserv newsroom](https://newsroom.fiserv.com/news-releases/news-release-details/four-credit-unions-select-dna-fiserv-through-puerto-rico-based) |
| **Sharetec** (fastest-growing on island) | Coop Hermanos Unidos ($96M), Coop Lomas Verdes ($75M), **Coop Manatí ($310M)** — all 2024; earlier **CACSI** (Santa Isabel) on Velocity; "established presence" pre-2024 (names undisclosed); markets at ASEC convention | [Sharetec](https://www.sharetec.com/sharetec-growth-puerto-rico-partnerships/), [FinTech Futures](https://www.fintechfutures.com/core-banking-technology/puerto-rican-credit-union-cacsi-taps-sharetec-for-core-system-upgrade) |
| **Jack Henry Symitar** | **None confirmed** — no public evidence in EN or ES searches (absence of press ≠ absence of clients) | data gap |
| CU*Answers / Corelation KeyStone | None found | data gap |
| COOPSYS | Dominican Republic product (Dasoft) — no confirmed PR deployments | [coopsys.com.do](https://www.coopsys.com.do/) |
| Local/legacy systems | The long tail (~80+ of 91 coops have no publicly attributable core) likely runs local/legacy or shared processors; **BanCoop is developing shared core/digital technology for cooperativas** (potential partner/competitor) | [El Vocero](https://www.elvocero.com/economia/en-ruta-a-modernizar-el-sistema-digital-de-las-cooperativas/article_f032079d-b424-4d8f-9f8e-0b0ab60295a3.html) |

**Shared infrastructure**: Circuito Cooperativo (shared branching, 50+ coops, ~950k members, FSCC/CO-OP network). AITSA can interface directly with core systems for COSSEC filing.

### 6.1 Data export paths

- **Fiserv DNA**: open **Oracle relational DB** (easy SQL extraction); Fiserv AppMarket sells a purpose-built **"ALM-CECL Extract"** app (instrument-level CSVs for commercial/consumer/mortgage loans); generic DNA Export does CSV/Excel. [AppMarket](https://appmarket.fiservapps.com/alm-cecl-extract.html).
- **Symitar** (if ever encountered): **PowerOn specfiles** (batch extracts) or **SymXchange** SOAP API. [jackhenry.dev](https://jackhenry.dev/symxchange-api-docs/).
- **Sharetec Velocity**: export specifics not public — UNVERIFIED; engage Sharetec or a client coop.
- **Industry-standard ALM integration**: quarterly/monthly **instrument-level flat files (loans, shares, certificates, investments) + GL trial balance** via secure file transfer.
- **CERNIQ adapter strategy**: (1) Fiserv DNA adapter (Oracle/AppMarket extract), (2) Sharetec adapter, (3) generic CSV/Excel template for the legacy long tail — covers every confirmed core on the island.

---

## 7. Key People — Contact Intelligence

> ⚠️ Titles verified to source dates shown; **re-verify all before outreach.**

### 7.1 COSSEC

| Person | Role | Recency |
|---|---|---|
| **Mabel Jiménez Miranda** (CICA, MBA) | Presidenta Ejecutiva — ratified for 2nd term Jul 2024 (first ever); active X: @prprescossec | High confidence to late 2025; [NotiCel](https://www.noticel.com/gobierno/ahora/20240711/ratifican-a-mabel-jimenez-miranda-en-presidencia-ejecutiva-cossec/) |
| Junta de Directores (statutory: CDCOOP + OCIF commissioners, coop reps, Hacienda rep, Liga rep, public interest) | Names per cossec.pr.gov search snapshot (UNVERIFIED individually): Ricardo Álvarez Clas; Mónica Rodríguez (OCIF); José L. Núñez Rosario (VP); Carlos M. De Jesús Sánchez; Miguel Colón Robles; Heriberto Martínez Otero (Hacienda rep) | Re-confirm on live page |
| Examination/supervision heads | **Not published — data gap** | |

### 7.2 Largest cooperativas — executive heads

| Cooperativa | Person | Source/recency |
|---|---|---|
| Jesús Obrero | **Aurelio Arroyo González**, Presidente Ejecutivo (quoted in FHLBNY milestone) | [CDFI case study, Feb 2025](https://cdfi.org/wp-content/uploads/2025/02/Cooperativa-Jesus-Obrero.pdf) |
| Coop Oriental | **William Méndez Pagán** (also ASEC VP) | [ASEC, Jun 2026](https://www.ejecutivos.coop/sobre-nosotros/junta-directiva/) |
| La Sagrada Familia | **Eddie W. Alicea Sáez** | [Metro, Nov 2025](https://www.metro.pr/noticias/2025/11/19/cooperativa-la-sagrada-familia-crea-fondo-de-inversion-comunitaria-de-1-millon/) |
| Coop Cabo Rojo | **Kerwin Morales** (also Circuito Coop board pres.) | [circuito.coop, Jun 2026](https://circuito.coop/quienes-somos/) |
| VegaCoop | Rubén Morales Rivera — UNVERIFIED recency | RocketReach |
| LarCoop | Carlos de Jesús (2020 source — UNVERIFIED; possibly the COSSEC board's Carlos M. De Jesús Sánchez) | Liga podcast |
| COOPACA | Board pres. 2025-26: Luis A. Galarza Pérez; exec president unknown (gap). COSSEC opened inquiry re: a COOPACA board pres., Sep 2024 | [coopaca.com](https://www.coopaca.com/junta-de-directores-y-comites/) |
| Caguas Coop | Board pres. Emanuel Llanos Rivera; **Mildred Santiago Ortiz** (former Liga ED) is a director | [caguascoop.com](https://www.caguascoop.com/juntadedirectores) |
| Zeno Gandía, CamuyCoop, Saulo D. Rodríguez, Cidreña | Exec heads not indexed — **use ASEC Socios directory or call** | gap |

### 7.3 Fintech / ecosystem

| Org | Person | Recency |
|---|---|---|
| Parallel18 | **Dr. Hector Jirau**, Executive Director | Nov 2025 |
| Engine-4 (Bayamón) | **Luis Torres** (co-founder), José Torres (President/Chairman) | |
| Invest Puerto Rico | **Ella Woger-Nieves**, CEO | Active through 2025 |
| PRSTRT | **Lucy Crespo**, CEO | FY24-25 annual report, Nov 2025 |
| Colmena66 | **Bárbara Rivera-Chinea**, Exec Director (Denisse Rodríguez Colón moved to PRSTRT) | Oct 2025 |

### 7.4 Accountants / consultants serving cooperativas (partners or competitors)

| Firm | Cooperativa relevance | Priority |
|---|---|---|
| **González Torres & Co. CPA** | Explicitly specializes in cooperativas; partners present publicly on COSSEC fiscal plan (CPA José González Torres, CPA Fernando E. Ortiz Ramos) | **Highest — partner or competitor** [gtcpapr.com](https://gtcpapr.com/about/) |
| **Galíndez LLC** (ex FPV & Galíndez) | Top-10 PR firm; CPA Kenneth Rivera speaks at ASEC conventions | High |
| **Aquino, De Córdova LLC** | Lists cooperativas as served industry; Praxity member | Medium |
| Kevane Grant Thornton | Documented CECL expertise (Jorge E. Cañellas, Angel M. Rivera); no coop-specific practice found | Medium |
| **Estudios Técnicos, Inc.** | Economics consultancy (Graham Castillo, Leslie Adames); recurring ASEC speakers; built the ETI coop stability index | Watch — analytics competitor/partner |
| RSM PR / Baker Tilly PR | No indexed coop practice — UNVERIFIED | Low |
| Dedicated ALM/actuarial consultants for PR coops | **None surfaced** — consistent with white-space thesis | — |

Regulatory note: coop auditors must comply with COSSEC Circular CC-09-02 (incl. audit-staff rotation) — every audit firm is a potential channel.

---

## 8. FHLBNY Membership — The 57-Cooperativa Opportunity

### 8.1 Timeline of the door opening

| Date | Event |
|---|---|
| 2023 | Inclusiv + COSSEC + 65+ cooperativas file FHFA "FHLBank System at 100" comment letters citing the sector's $1.6B mortgage portfolio |
| Apr 2024 | FHFA regulatory interpretation: two membership pathways for non-federally-insured state-chartered CUs; FHLBNY–COSSEC MOU follows |
| Jul 2025 | **Ley 73-2025** signed (Gov. Jennifer González) — authorizes cooperativa FHLB membership |
| **Jan 27, 2026** | COSSEC + FHLBNY announce eligibility at Inclusiv's San Juan convening (COSSEC's Mabel Jiménez; FHLBNY VP Member Relations **Alexies Sornoza**) |
| **Apr 2026** | "Cumbre de Acceso a Capital Cooperativo" — **57+ cooperativas with mortgage portfolios** attended ([Primera Hora](https://www.primerahora.com/noticias/consumo/notas/cossec-y-el-fhlb-de-nueva-york-impulsan-acceso-a-capital-para-cooperativas-en-puerto-rico/)) |
| **Apr 30, 2026** | **La Sagrada Familia (Corozal) admitted — first cooperativa FHLBNY member ever** ([Sin Comillas](https://sincomillas.com/cooperativa-la-sagrada-familia-aceptada-como-miembro-del-federal-home-loan-bank-of-new-york/)); **LarCoop** second to complete application |
| Q1 2026 | Inclusiv closes first secondary-market purchase of PR cooperativa mortgages ($3.5M) |

Existing PR FHLBNY members for context: Banco Popular, FirstBank, Oriental Bank, Nave Bank; FCUs Caribe Federal, PR FCU, VAPR; PRHFA; 9 insurers incl. Cooperativa de Seguros Múltiples. [Membership list](https://www.fhlbny.com/members/membership-list) (not yet updated with the cooperativas as of June 2026 fetch).

### 8.2 What membership requires (FHLBNY "PR-Chartered Non-Federally-Insured Credit Union" track, HLB-APP-004 / HLB-007)

**At application** ([FHLBNY credit-union membership page](https://www.fhlbny.com/become-a-member/about-membership/credit-unions)):
- Two annual **audited GAAP financial statements in Spanish AND English** (all audited metrics converted to GAAP in English)
- Management response to latest COSSEC Report of Examination
- Home Financing Policy package + written justification quantifying mortgage lending
- Proof of long-term home mortgage lending (original term ≥5 yrs)
- COSSEC non-objection contact + FHFA-pathway statement (federal share-insurance eligibility determination)

**Ongoing:**
- **Annual attestation of compliance with COSSEC Reglamento 8665 Art. 2.18.2**, external auditor peer-reviewed and "pass"-rated by the Colegio de CPA de PR
- **Monthly loan-level mortgage collateral reporting** — **COL-121** standard layout (or COL-122 Excel), month-end cutoff, via FHLBNY secure file transfer; Pledge Questionnaire (COL-125) before first pledge ([COL-012 guide](https://www.fhlbny.com/documents/d/guest/getting-started-with-the-fhlbny-mortgage-data-reporting/))
- Maintain qualifying collateral for borrowing capacity (eligible: 1-4 family, HELOC, multifamily, CRE)
- UNVERIFIED: capital-stock purchase percentages (need FHLBNY Capital Plan)

### 8.3 CERNIQ feature mapping

| FHLBNY requirement | CERNIQ capability |
|---|---|
| Monthly COL-121 loan-level collateral files | Generate natively from the modeled mortgage book |
| Collateral valuation, haircuts, excess-collateral tracking | Borrowing-capacity module |
| **Bilingual GAAP audited reporting** | Core CERNIQ differentiator, directly on point |
| Annual Reg 8665 Art. 2.18.2 attestation | Compliance calendar + evidence pack |
| Advances = wholesale funding → IRR/maturity decisions | The ALM model itself — stress tests, what-ifs cooperativas never needed when deposit-only funded |
| Home Financing Policy quantification | Origination analytics (system originated $95.0M of mortgages in Q3-2025 alone) |

Market math: 57+ of 91 coops (~63%) hold mortgages; coops >$100M hold 89% of the $2.05B book. COSSEC has committed "acompañamiento técnico y regulatorio" to applicants — regulator-aligned tailwind.

---

## 9. Verification Queue / Data Gaps

**High priority (affects sales claims):**
1. Mabel Jiménez (COSSEC) and COSSEC board incumbency — re-verify before any outreach.
2. Operative RAP→GAAP deadline (Jan vs June 2028) and Ley 99-2024 status post-FOMB objection.
3. CC-2023-01 full text (non-OCR scan) — exact CECL exceptions/phase-in; request from COSSEC.
4. Reglamento 6758 full text — exact monthly/quarterly calendar + audited-FS deadline.
5. AITSA technical spec (file format/schema) — needs COSSEC contact; this is the integration moat.
6. Informe de Liquidez frequency/format; any explicit IRR reporting mandate.

**Medium:**
7. Q4-2025 Anejo 9 per-coop table (published ~Mar 2026) — refresh top-20 ranks.
8. Exec presidents of COOPACA, CamuyCoop, Zeno Gandía, Saulo D. Rodríguez, Cidreña — ASEC Socios directory or calls.
9. ASEC Convención 2026 + Seminario Residencial 2026 dates — email Dahlia Torres.
10. PR Cooperativista ad rate card + editorial deadlines — email coordinacion@liga.coop.
11. USICOOP current status (still on DNA? more members?); Sharetec pre-2024 PR client names; Sharetec Velocity export spec.
12. Exact list of which 57+ coops hold mortgages (COSSEC doesn't publish per-coop loan mix — needs AITSA-level data or audited FS review).
13. FHLBNY capital-stock purchase requirements (Capital Plan doc).
14. PCA-equivalent rule status; any COSSEC cybersecurity regulation.

**Low:**
15. CDCOOP Commissioner under González administration; Instituto de Cooperativismo UPR director; Liga asamblea dates; Consejos Regionales meeting cadence; CLA PR office; FHFA purchase-only PR series; estadisticas.pr API per-dataset coverage; HQ municipios for Roosevelt Roads and CandelCoop.

---

*Document compiled via parallel web research, 2026-06-06. Primary sources fetched directly where noted (COSSEC Q3-2025 statistical PDF, FHLBNY membership pages, liga.coop staff pages, LexJuris statute texts). Refresh cadence suggestion: quarterly, aligned to COSSEC statistical report publication (~75 days after quarter close).*
