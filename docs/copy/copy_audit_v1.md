# CERNIQ Site Copy Audit v1

**Date:** 2026-03-16
**Auditor:** Claude (MP-COPY-01)
**Scope:** All user-facing pages + email templates
**Voice Target:** Senior risk analyst speaking to a cooperativa CFO
**Primary Language:** Spanish (cooperativa-facing); English secondary

---

## Landing Page — `/frontend/app/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Informes ALM para cooperativas y credit unions"` (kicker) | KEEP | -- |
| 2 | `"Bilingual ALM Reporting"` (tagline under lockup) | REWRITE | `"Informes ALM Bilingues / Bilingual ALM Reporting"` -- Spanish first per bilingual convention |
| 3 | `"Informes ALM bilingues para cooperativas y credit unions de Puerto Rico"` (h1) | KEEP | Already institutional, specific, Spanish-first |
| 4 | `"Cargue su hoja de balance. Genere su informe COSSEC-compliant en horas, no semanas."` | KEEP | Uses mandated phrases ("COSSEC-compliant", "en horas, no semanas") |
| 5 | `"Upload your balance sheet. Generate your COSSEC-compliant report in hours, not weeks."` | KEEP | Clean English mirror |
| 6 | `"La proxima temporada de examenes COSSEC se acerca."` (urgency hook 1) | REWRITE | `"La proxima temporada de examenes COSSEC se acerca. Prepare sus 12 ratios regulatorios."` -- Add specificity |
| 7 | `"La Fed movio tasas. Sabe el impacto en su NIM?"` (urgency hook 2) | KEEP | Specific, data-driven, relevant to CFO |
| 8 | `"Prepare su proximo ALCO en 24 horas."` (urgency hook 3) | KEEP | Uses mandated "ALCO-ready" concept + "24 horas" |
| 9 | `"Solicitar analisis gratuito"` (primary CTA) | REWRITE | `"Solicitar analisis gratuito / Request free analysis"` -- Add English per bilingual button convention |
| 10 | `"Comenzar — $750"` (secondary CTA) | REWRITE | `"Comenzar piloto — $750 / Start pilot — $750"` -- More specific, bilingual |
| 11 | `"3 cooperativas en piloto"` | KEEP | Specific social proof |
| 12 | `"Activos analizados: $1.1B+"` | KEEP | Data-driven proof point |
| 13 | `"Informes entregados: 12+"` | KEEP | Concrete metric |
| 14 | `"3 cooperativas in pilot -- Assets analyzed: $1.1B+ -- Reports delivered: 12+"` | KEEP | English mirror, fine |
| 15 | `"Comparacion de costos / Cost comparison"` (section label) | KEEP | Bilingual section label |
| 16 | `"Cuanto gasta su institucion en analisis ALM?"` (h2) | KEEP | Direct, relevant to CFO pain |
| 17 | `"Consultor tradicional"` (table header) | KEEP | Clear comparison |
| 18 | Cost comparison table (all rows) | KEEP | Specific numbers, bilingual, institutional |
| 19 | `"AHORRO ESTIMADO: 83-93%"` | KEEP | Concrete savings figure |
| 20 | `"Cumplimiento COSSEC"` / `"COSSEC Compliance"` (feature 1) | KEEP | Uses mandated "COSSEC" alignment |
| 21 | `"12 ratios calculados automaticamente desde su hoja de balance."` | KEEP | Uses mandated "12 ratios" phrasing |
| 22 | `"Bilingue por diseno"` / `"Bilingual by design"` (feature 2) | KEEP | Specific differentiator |
| 23 | `"Espanol e ingles en el mismo informe, listo para junta y regulador."` | KEEP | Institutional, board-focused |
| 24 | `"Entrega en 24 horas"` / `"24-hour delivery"` (feature 3) | KEEP | Mandated "en horas, no semanas" concept |
| 25 | `"Como funciona / How it works"` (section label) | KEEP | Standard bilingual section |
| 26 | `"De carga a informe terminado en 3 pasos"` | KEEP | Clear, action-oriented |
| 27 | Workflow steps 1-3 (all) | KEEP | Clean, specific, bilingual |
| 28 | `"Demostracion / Walkthrough"` (section label) | KEEP | Bilingual |
| 29 | `"Vea el flujo de carga a informe en accion"` | KEEP | Specific |
| 30 | `"Video de demostracion ALM proximamente"` (placeholder) | REWRITE | `"Demostracion del flujo ALM proximamente / ALM workflow demo coming soon"` -- Remove generic "video de demostracion", add English |
| 31 | `"Add NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL once the upload-to-report walkthrough is ready."` | DELETE | Developer instruction exposed to users -- must be hidden or replaced with user-friendly text |
| 32 | `"Precios / Pricing"` (section label) | KEEP | Bilingual label |
| 33 | `"Comience con un piloto o elija acceso recurrente"` | KEEP | Clear, non-startup-y |
| 34 | Pricing tier: `"Informe Piloto"` / `"Pilot Report"` | KEEP | Institutional naming |
| 35 | Pricing tier: `"Plataforma Recurrente"` / `"Recurring Platform"` | REWRITE | `"Acceso Recurrente"` / `"Recurring Access"` -- "Plataforma" alone is banned |
| 36 | Pricing tier: `"Plan Anual"` / `"Annual Plan"` | KEEP | Clear |
| 37 | `"Recomendado"` badge | REWRITE | `"Recomendado / Recommended"` -- Add English per bilingual convention |
| 38 | `"1 informe ALM bilingue"` / `"Revision de datos y setup"` / `"PDF listo para junta"` (bullets) | REWRITE | `"PDF listo para junta"` -> `"PDF board-ready bilingue"` -- Use mandated phrase |
| 39 | `"Informes recurrentes"` / `"Portal de acceso"` / `"Entrega bilingue PDF"` | REWRITE | `"Portal de acceso"` -> `"Portal de informes y seguimiento"` -- More specific |
| 40 | `"4+ informes anuales"` / `"Precio fijo predecible"` / `"Soporte prioritario"` | KEEP | Clear value props |
| 41 | `"Comprar ahora"` (one_time CTA) | REWRITE | `"Comenzar piloto / Start pilot"` -- More institutional, bilingual |
| 42 | `"Solicitar demo"` (recurring/annual CTA) | REWRITE | `"Solicitar demo / Request demo"` -- Add English |
| 43 | `"Preguntas frecuentes / FAQ"` (section label) | KEEP | Bilingual |
| 44 | `"Respuestas a preguntas comunes"` | KEEP | Clean |
| 45 | All 5 FAQ Q&A pairs | KEEP | Bilingual, specific, institutional, data-driven |
| 46 | `"Solicitar demo / Request demo"` (form section label) | KEEP | Bilingual |
| 47 | `"Conecte su institucion al flujo de trabajo"` | REWRITE | `"Conecte su institucion al flujo de analisis ALM"` -- More specific |
| 48 | `"Diganos quien es y programaremos una demostracion enfocada en la carga ALM, el informe bilingue y el camino de piloto para su institucion."` | KEEP | Specific, institutional |
| 49 | Form labels: `"Nombre / Name"`, `"Correo institucional / Work email"`, etc. | KEEP | Bilingual labels, good |
| 50 | `"Solicitar analisis gratuito / Request free analysis"` (form submit) | KEEP | Bilingual button per convention |
| 51 | `"Solicitud recibida / Request received"` (success state) | KEEP | Bilingual |
| 52 | `"Le daremos seguimiento en 24 horas para programar su demostracion CERNIQ ALM."` | KEEP | Specific timeline, institutional |
| 53 | `"No se pudo enviar. Intente de nuevo. / Failed to submit. Please try again."` (error) | KEEP | Bilingual error message |
| 54 | `"Informes ALM bilingues. Listos para COSSEC. En 24 horas."` (bottom CTA h2) | KEEP | All mandated phrases in one line |
| 55 | `"CERNIQ es software de informes ALM bilingues para cooperativas y credit unions..."` | REWRITE | `"CERNIQ es la plataforma de analisis ALM para cooperativas y credit unions de Puerto Rico. Un flujo enfocado: cargue su balance, reciba su informe bilingue board-ready."` -- Use "plataforma de analisis ALM" (mandated), remove vague "un producto que su institucion entiende de inmediato" |
| 56 | `"Procesando..."` (checkout loading state) | REWRITE | `"Procesando... / Processing..."` -- Bilingual |
| 57 | `"Precios"` (nav button) | REWRITE | `"Precios / Pricing"` -- Bilingual nav for bank-facing visitors |
| 58 | `"Login"` (nav button) | REWRITE | `"Acceder / Login"` -- Spanish first |
| 59 | `"Solicitar Demo"` (nav CTA) | KEEP | Primary Spanish CTA in nav is fine |
| 60 | `"Enviando... / Submitting..."` (form loading) | KEEP | Bilingual loading state |

**Landing Page Summary:** 47 KEEP, 12 REWRITE, 1 DELETE. The landing page is the strongest page -- bilingual convention is mostly followed, mandated phrases appear frequently, tone is institutional. Key fixes: expose dev instruction (line 31), add bilingual to CTAs and nav, replace "Plataforma Recurrente" naming.

---

## Pricing Page — `/frontend/app/pricing/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Pricing"` (subtitle under nav logo) | REWRITE | `"Precios / Pricing"` -- Spanish first |
| 2 | `"Simple pricing for the first wedge"` (kicker) | REWRITE | `"Precios claros para su analisis ALM / Clear pricing for your ALM analysis"` -- "first wedge" is internal/startup jargon; make bilingual and customer-facing |
| 3 | `"Start with one pilot report, then move into recurring ALM reporting access."` (h1) | REWRITE | `"Comience con un informe piloto. Pase a acceso recurrente cuando este listo. / Start with a pilot report. Move to recurring access when ready."` -- Spanish first, bilingual, remove implicit urgency |
| 4 | `"CERNIQ is being sold first as bilingual ALM reporting software for cooperativas, credit unions, and the advisory firms that support them. Keep the pricing easy to understand and easy to buy."` | DELETE | This is an internal sales memo exposed on the public pricing page. Replace entirely. |
| 5 | (replacement for #4) | REWRITE | `"CERNIQ genera informes ALM bilingues COSSEC-aligned para cooperativas, credit unions y las firmas CPA que las asesoran. Precios transparentes, sin contratos a largo plazo. / CERNIQ generates bilingual COSSEC-aligned ALM reports for cooperativas, credit unions, and the CPA firms that advise them. Transparent pricing, no long-term contracts."` |
| 6 | `"Pilot for proof"` / `"Recurring for ongoing reporting"` / `"Partner for multi-client firms"` (mini stats) | REWRITE | `"Piloto: pruebe con un informe"` / `"Recurrente: acceso continuo"` / `"Socios: multiples instituciones"` -- Spanish first, more specific |
| 7 | `"Pilot Report"` / `"Single bilingual ALM report"` (tier 1 name + subtitle) | REWRITE | `"Informe Piloto / Pilot Report"` / `"Un informe ALM bilingue para validar el proceso"` -- Bilingual, Spanish first |
| 8 | `"One bilingual ALM report"` (bullet) | REWRITE | `"1 informe ALM bilingue (ES + EN)"` |
| 9 | `"Upload review and setup guidance"` | REWRITE | `"Revision de datos y configuracion inicial / Upload review and setup guidance"` |
| 10 | `"Board-ready PDF delivery"` | REWRITE | `"PDF board-ready listo para junta / Board-ready PDF delivery"` |
| 11 | `"Best for first-time pilot validation"` | REWRITE | `"Ideal para validar el proceso con su institucion / Best for first-time pilot validation"` |
| 12 | `"Recurring Platform"` / `"Ongoing upload-to-report access"` (tier 2) | REWRITE | `"Acceso Recurrente / Recurring Access"` / `"Flujo continuo de carga, analisis y entrega de informes"` -- "Platform" alone is banned |
| 13 | `"Recurring upload and report workflow"` | REWRITE | `"Flujo recurrente de carga y entrega de informes / Recurring upload and report workflow"` |
| 14 | `"Bilingual report delivery"` | REWRITE | `"Entrega de informes bilingues (ES + EN) / Bilingual report delivery"` |
| 15 | `"Portal access for completed reports"` | REWRITE | `"Portal de acceso a informes completados / Portal access for completed reports"` |
| 16 | `"Best fit for active institutions"` | REWRITE | `"Ideal para instituciones con reportes trimestrales / Best fit for active institutions"` |
| 17 | `"Partner Access"` / `"For CPA and advisory firms"` (tier 3) | REWRITE | `"Acceso para Socios / Partner Access"` / `"Para firmas CPA y consultoras que sirven multiples cooperativas"` |
| 18 | `"Multi-client workflow"` | REWRITE | `"Flujo multi-cliente / Multi-client workflow"` |
| 19 | `"Partner-facing portal access"` | REWRITE | `"Portal de socios con vista consolidada / Partner portal with consolidated view"` |
| 20 | `"White-label delivery support"` | REWRITE | `"Soporte de entrega con marca propia / White-label delivery support"` |
| 21 | `"Built for firms serving multiple institutions"` | REWRITE | `"Disenado para firmas que sirven multiples cooperativas / Built for firms serving multiple institutions"` |
| 22 | `"Recommended"` badge | REWRITE | `"Recomendado / Recommended"` -- Bilingual |
| 23 | `"Loading..."` (button loading state) | REWRITE | `"Procesando... / Processing..."` -- Bilingual |
| 24 | `"Choose Pilot Report"` / `"Choose Recurring Platform"` / `"Choose Partner Access"` (CTAs) | REWRITE | `"Comenzar piloto / Start pilot"` / `"Elegir acceso recurrente / Choose recurring"` / `"Contactar ventas / Contact sales"` -- Spanish first, bilingual |
| 25 | `"Why it is priced this way"` (section label) | REWRITE | `"Por que este precio / Why it is priced this way"` -- Bilingual |
| 26 | `"The pilot report gives institutions a low-friction way to evaluate CERNIQ on a real reporting cycle."` | REWRITE | `"El informe piloto permite a su institucion evaluar CERNIQ en un ciclo real de reportes, sin compromiso. / The pilot report lets your institution evaluate CERNIQ on a real reporting cycle, no commitment."` |
| 27 | `"The recurring plan keeps the core offer focused on secure upload, bilingual reporting, and portal access."` | REWRITE | `"El plan recurrente mantiene el flujo enfocado: carga segura, informe bilingue y portal de acceso. / The recurring plan keeps the workflow focused: secure upload, bilingual report, and portal access."` |
| 28 | `"Partner pricing exists for firms serving multiple institutions, but it should stay secondary until proof accumulates."` | DELETE | Internal sales strategy exposed publicly. |
| 29 | (replacement for #28) | REWRITE | `"El plan de socios esta disenado para firmas CPA y consultoras que gestionan el cumplimiento ALM de multiples cooperativas. / Partner pricing is designed for CPA firms and consultancies managing ALM compliance for multiple cooperativas."` |
| 30 | `"Buying guidance"` (section label) | REWRITE | `"Guia de compra / Buying guidance"` -- Bilingual |
| 31 | `"Lead with the pilot, not platform complexity."` (h2) | DELETE | Internal strategy, not customer-facing copy. |
| 32 | (replacement for #31) | REWRITE | `"Comience con un piloto. Escale cuando este listo. / Start with a pilot. Scale when ready."` |
| 33 | `"For the next stage of CERNIQ, pricing should support fast conversations and founder-led pilots. The goal is not to maximize plan variety. The goal is to reduce buying friction and get real institutions through the workflow."` | DELETE | Internal strategy memo exposed to customers. |
| 34 | (replacement for #33) | REWRITE | `"No requiere contratos a largo plazo ni compromisos anuales. Pruebe con un informe piloto, valide los resultados con su equipo, y pase a acceso recurrente cuando su institucion este lista. / No long-term contracts or annual commitments required. Try a pilot report, validate results with your team, and move to recurring access when your institution is ready."` |
| 35 | `"Recommended sales sequence"` (box label) | REWRITE | `"Como empezar / How to get started"` -- Customer-facing, not internal sales language |
| 36 | `"Start with the pilot report, prove credibility with a real institution, then convert that relationship into recurring platform access once the workflow is trusted."` | REWRITE | `"Solicite su informe piloto. Revise los resultados con su comite ALCO o junta directiva. Cuando el flujo de trabajo este validado, active el acceso recurrente desde su portal. / Request your pilot report. Review results with your ALCO committee or board. When the workflow is validated, activate recurring access from your portal."` |

**Pricing Page Summary:** 0 KEEP, 27 REWRITE, 4 DELETE. This is the weakest page. Multiple internal strategy notes are exposed publicly. Entirely English-only -- violates bilingual convention. Uses banned word "platform" repeatedly. Requires a complete bilingual rewrite with customer-facing language.

---

## Login Page — `/frontend/app/login/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Intelligence Engineered"` (subtitle under logo) | REWRITE | `"Plataforma de Analisis ALM"` -- "Intelligence Engineered" is generic/startup-y; use specific product descriptor per brand voice |
| 2 | `"Access CERNIQ market data, portfolio risk, valuation, options, execution, and reporting workflows from one secure workspace."` (subheading) | REWRITE | `"Acceda a sus informes ALM, datos regulatorios y analisis COSSEC desde un portal seguro. / Access your ALM reports, regulatory data, and COSSEC analysis from a secure portal."` -- Current text lists features that don't exist for cooperativa users (options, execution). "One secure workspace" is vague. |
| 3 | `"Authentication failed"` (default error) | REWRITE | `"Error de autenticacion. Verifique sus credenciales. / Authentication failed. Please check your credentials."` -- Bilingual, more helpful |
| 4 | t('login.signInToAccount') / t('login.createAccount') (i18n keys) | KEEP | Already using i18n system -- verify translations are bilingual |
| 5 | t('login.email') / t('login.emailPlaceholder') | KEEP | i18n -- verify |
| 6 | t('login.password') | KEEP | i18n -- verify |
| 7 | t('common.processing') | KEEP | i18n -- verify |
| 8 | t('login.signIn') / t('login.signUp') | KEEP | i18n -- verify |
| 9 | t('login.orContinueWith') | KEEP | i18n -- verify |
| 10 | t('common.google') / t('common.github') | KEEP | i18n -- verify |
| 11 | t('login.noAccount') / t('login.hasAccount') | KEEP | i18n -- verify |
| 12 | `"EN"` / `"ES"` (language toggle labels) | KEEP | Standard language toggle |

**Login Page Summary:** 9 KEEP, 3 REWRITE, 0 DELETE. The login page uses i18n for most strings (good), but the two hardcoded strings ("Intelligence Engineered" and the feature description) are startup-generic and list irrelevant features. The error message needs bilingual treatment.

---

## Dashboard — `/frontend/app/dashboard/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Buenos dias"` / `"Buenas tardes"` / `"Buenas noches"` (greeting) | KEEP | Appropriate, personal |
| 2 | `"Risk Intelligence"` (nav subtitle) | REWRITE | `"Inteligencia de Riesgo ALM"` -- Spanish first, more specific |
| 3 | `"Live Data"` (nav button) | REWRITE | `"Datos en Vivo / Live Data"` -- Bilingual |
| 4 | `"Salir"` (logout) | KEEP | Spanish, appropriate |
| 5 | `"Panel de Control"` (default heading when no name) | KEEP | Spanish, institutional |
| 6 | `"No hay analisis disponible — cargue su balance para comenzar."` | KEEP | Action-oriented, bilingual mirror present |
| 7 | `"(No analysis available — upload your balance sheet to start)"` | KEEP | English mirror |
| 8 | `"Brecha de Duracion"` / `"(Duration Gap)"` | KEEP | Bilingual, technical, appropriate for CFO |
| 9 | `"Preparacion COSSEC"` / `"(COSSEC Readiness)"` | KEEP | Uses mandated COSSEC framing |
| 10 | `"Riesgo NII"` / `"(NII Risk Rating)"` | KEEP | Technical, bilingual |
| 11 | `"Fuerte"` / `"Moderado"` / `"En riesgo"` (COSSEC status labels) | KEEP | Clear risk language |
| 12 | `"Asset-sensitive"` (duration gap badge) | REWRITE | `"Sensible a activos / Asset-sensitive"` -- Bilingual |
| 13 | `"+/-12.5% sensibilidad"` (NII badge) | KEEP | Specific metric |
| 14 | `"Estado ALM"` / `"(ALM Status)"` | KEEP | Bilingual section label |
| 15 | ALM status rows: LCR, Adecuacion de Capital, etc. | KEEP | All bilingual, technical, appropriate |
| 16 | `"Datos de demostracion — cargue balance para datos reales"` | KEEP | Honest disclaimer |
| 17 | `"Preparacion COSSEC"` / `"(COSSEC Readiness Score)"` (gauge section) | KEEP | Mandated framing |
| 18 | `"Institucion bien preparada"` / `"Atencion requerida en algunas areas"` / `"Accion inmediata requerida"` | KEEP | Clear severity language |
| 19 | `"Fecha de examen: por determinar"` / `"(Exam date: to be determined)"` | KEEP | Bilingual |
| 20 | `"Entorno de Tasas"` / `"(Rate Environment)"` | KEEP | Bilingual |
| 21 | Rate environment: `"Fed Funds Rate"`, `"SOFR"`, `"10Y Treasury"`, `"PR Prime"` | KEEP | Industry-standard labels |
| 22 | `"Base rate for loan pricing"` / `"Variable rate benchmark"` / `"Mortgage/bond yield driver"` / `"Local commercial lending"` (rate impacts) | REWRITE | Add Spanish: `"Tasa base para prestamos"` / `"Tasa de referencia variable"` / `"Impulsor de rendimiento hipotecario"` / `"Prestamos comerciales locales"` |
| 23 | `"Tasas de referencia — actualizadas periodicamente"` | KEEP | Honest, specific |
| 24 | `"Modulos"` / `"Herramientas Disponibles"` / `"(Available Tools)"` | KEEP | Bilingual |
| 25 | Module cards (all 6): titles bilingual, descriptions bilingual | KEEP | All bilingual, specific |
| 26 | `"Abrir modulo"` (module CTA) | REWRITE | `"Abrir modulo / Open module"` -- Add English |
| 27 | `"Acciones Rapidas"` / `"(Quick Actions)"` | KEEP | Bilingual |
| 28 | `"Generar Informe ALM"` | KEEP | Action-specific, good |
| 29 | `"Actualizar Balance Sheet"` | REWRITE | `"Actualizar Hoja de Balance"` -- Mixed language; keep consistent Spanish or add bilingual: `"Actualizar Hoja de Balance / Update Balance Sheet"` |
| 30 | `"Preparar ALCO"` | KEEP | Uses mandated ALCO language |
| 31 | `"(Generate ALM Report . Update Balance Sheet . Prepare ALCO Meeting)"` | KEEP | English mirror |
| 32 | `"Cargando dashboard"` (loading) | REWRITE | `"Cargando panel de control"` -- "dashboard" is English; use "panel de control" per voice guide |
| 33 | `"ALM Intelligence"` / `"Inteligencia ALM"` (module card) | KEEP | Bilingual |
| 34 | `"COSSEC Compliance"` / `"Cumplimiento COSSEC"` | KEEP | Mandated framing |
| 35 | `"SpendCheck"` / `"Control de Gastos"` | KEEP | Bilingual product naming |
| 36 | `"Receipt parsing, AP controls, and recovery."` | REWRITE | `"Analisis de recibos, controles de cuentas por pagar y recuperacion."` -- Spanish description already exists but English version uses jargon ("AP"); spell out for clarity |
| 37 | `"Market Data"` / `"Datos de Mercado"` | KEEP | Bilingual |

**Dashboard Summary:** 29 KEEP, 7 REWRITE, 0 DELETE. Dashboard is well-done -- heavily bilingual, uses mandated COSSEC/ALCO terminology. Minor fixes: mixed-language strings ("Balance Sheet" in Spanish context), rate impact labels English-only, loading state uses English "dashboard".

---

## Portal Home — `/frontend/app/portal/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Portal del cliente / Client portal"` (kicker) | KEEP | Bilingual |
| 2 | `"Bienvenido"` + user name (h1) | KEEP | Personal, Spanish-first |
| 3 | `"Gestione sus informes, cargue datos de balance y revise los entregables CERNIQ."` | KEEP | Specific, institutional |
| 4 | `"Manage reports, upload balance-sheet data, and review CERNIQ deliverables."` | KEEP | English mirror |
| 5 | `"Free"` / `"plan"` (subscription badge) | REWRITE | `"Gratuito / Free"` -- Bilingual |
| 6 | `"informes / reports"` (count badge) | KEEP | Bilingual |
| 7 | `"Pago confirmado / Payment confirmed"` (welcome banner) | KEEP | Bilingual |
| 8 | `"Bienvenido a CERNIQ"` / `"Welcome to CERNIQ"` | KEEP | Bilingual |
| 9 | `"Su analisis ALM comienza aqui. / Your ALM analysis starts here."` | KEEP | Bilingual, clear |
| 10 | `"Cargar datos / Upload data"` (CTA button) | KEEP | Bilingual button per convention |
| 11 | `"Configurar institucion / Set up institution"` (alternate CTA) | KEEP | Bilingual, action-specific |
| 12 | `"Progreso / Progress"` (section label) | KEEP | Bilingual |
| 13 | `"Procesando su analisis ALM..."` / `"Processing your ALM analysis..."` | KEEP | Bilingual |
| 14 | Rotating messages: `"Validando datos..."`, `"Calculando brechas de duracion..."`, etc. | KEEP | Technical, bilingual, specific |
| 15 | `"Tiempo estimado / Estimated time: 30-60 minutos"` | KEEP | Specific timeline |
| 16 | `"Le enviaremos un email cuando este listo. / We will email you when it is ready."` | KEEP | Bilingual |
| 17 | `"Su Informe ALM esta listo"` / `"Your ALM Report is Ready"` | KEEP | Bilingual |
| 18 | `"El informe para [name] ha sido generado exitosamente."` | KEEP | Personalized, bilingual |
| 19 | `"Ver informe / View Report"` (CTA) | KEEP | Bilingual button |
| 20 | `"Descargar PDF / Download PDF"` (CTA) | KEEP | Bilingual button |
| 21 | `"Quiere revisar el informe juntos?"` / `"Want to review the report together?"` | KEEP | Personal touch, bilingual |
| 22 | `"Agende 30 min con Erwin / Schedule 30 min with Erwin"` | KEEP | Personal, uses founder name per mandated phrases |
| 23 | `"Siguiente paso / Next Step"` | KEEP | Bilingual |
| 24 | `"Comience enviando sus datos de balance. / Get started by submitting your balance sheet data."` | KEEP | Bilingual, action-oriented |
| 25 | `"Cargar datos / Upload Data"` (button) | KEEP | Bilingual per convention |
| 26 | `"Descargar plantilla / Download Template"` (button) | KEEP | Bilingual per convention |
| 27 | `"Hubo un problema generando su informe. Nuestro equipo ha sido notificado."` | KEEP | Honest, bilingual |
| 28 | Status badges: `"Completado / Complete"`, `"Procesando / Processing"`, etc. | KEEP | All bilingual |
| 29 | `"Historial de informes / Report History"` | KEEP | Bilingual |
| 30 | `"No hay informes aun. Envie sus datos para generar su primer informe."` | KEEP | Bilingual, action-oriented |
| 31 | `"Cargando... / Loading..."` | KEEP | Bilingual |
| 32 | Table headers: `"Institucion / Institution"`, `"Estado / Status"`, etc. | KEEP | All bilingual |
| 33 | `"Tendencias trimestrales / Quarterly Trends"` (gated section) | KEEP | Bilingual |
| 34 | `"Mejorar plan / Upgrade plan"` (upgrade CTA) | KEEP | Bilingual |
| 35 | `"Ver / View"` / `"Cargar / Upload"` (table action links) | KEEP | Bilingual micro-copy |

**Portal Home Summary:** 34 KEEP, 1 REWRITE, 0 DELETE. Strongest page in the site. Consistently bilingual, institutional, uses mandated phrases. Only fix: "Free" plan badge needs Spanish.

---

## Portal Submit — `/frontend/app/portal/submit/page.tsx`

### Strings Inventory

| # | Current Text | Status | Suggested Rewrite |
|---|---|---|---|
| 1 | `"Enviar datos / Submit data"` (kicker) | REWRITE | `"Cargar datos / Upload data"` -- "Enviar" (send) is less accurate than "Cargar" (upload) for a file upload flow; also aligns with brand voice guide preferring action-specific language |
| 2 | `"Cargue sus datos de balance"` (h1) | KEEP | Action-oriented, Spanish-first |
| 3 | `"Upload your balance-sheet data for report generation."` | KEEP | English mirror |
| 4 | `"Descargar plantilla CSV / Download CSV Template"` (step 1 heading) | KEEP | Bilingual |
| 5 | `"Complete sus datos de balance usando nuestra plantilla..."` | KEEP | Specific, bilingual |
| 6 | `"Descargar plantilla / Download Template"` (button) | KEEP | Bilingual |
| 7 | `"Seleccionar informe / Select Report"` (step 2) | KEEP | Bilingual |
| 8 | `"No hay informes esperando datos..."` | KEEP | Bilingual, informative |
| 9 | `"Ver sus informes / View your reports"` | KEEP | Bilingual |
| 10 | `"Validacion fallida — reintentar / Validation failed — retry"` | KEEP | Bilingual error |
| 11 | `"Creado / Created"` | KEEP | Bilingual |
| 12 | `"Cargar sus datos / Upload Your Data"` (step 3) | KEEP | Bilingual |
| 13 | `"Cargue el archivo CSV completado. Tamano maximo: 2MB."` | KEEP | Specific, bilingual |
| 14 | `"Arrastre su archivo CSV aqui o haga clic para seleccionar"` / `"Drag your CSV file here or click to select"` | KEEP | Bilingual |
| 15 | `"Cambiar / Change"` (file change link) | KEEP | Bilingual |
| 16 | `"Vista previa (primeras 5 filas) / Preview (first 5 rows)"` | KEEP | Bilingual |
| 17 | `"... y mas filas / ... and more rows"` | KEEP | Bilingual |
| 18 | `"Datos enviados exitosamente / Data submitted successfully"` | KEEP | Bilingual |
| 19 | `"elementos importados..."` / `"items imported..."` | KEEP | Bilingual |
| 20 | `"Volver al portal / Back to portal"` | KEEP | Bilingual |
| 21 | `"Validacion fallida / Validation failed"` | KEEP | Bilingual |
| 22 | `"Solo archivos CSV son aceptados. / Only CSV files are accepted."` | KEEP | Bilingual |
| 23 | `"El archivo excede 2MB. / File exceeds 2MB limit."` | KEEP | Bilingual |
| 24 | `"El archivo esta vacio. / File is empty."` | KEEP | Bilingual |
| 25 | `"Error de conexion. Intente de nuevo. / Network error. Please try again."` | KEEP | Bilingual |
| 26 | `"Cargando y validando... / Uploading & Validating..."` (loading) | KEEP | Bilingual |
| 27 | `"Enviar datos / Submit Data"` (upload button) | REWRITE | `"Cargar datos / Upload Data"` -- Match step heading; "Enviar" vs "Cargar" consistency |
| 28 | `"Necesita ayuda? / Need help?"` (FAQ sidebar) | KEEP | Bilingual |
| 29 | All 3 FAQ items (format, data requirements, timing) | KEEP | Bilingual, specific, helpful |
| 30 | `"Problemas? / Issues?"` | KEEP | Bilingual |
| 31 | `"Contactar soporte / Contact support"` | KEEP | Bilingual |
| 32 | `"Cargando... / Loading..."` | KEEP | Bilingual |

**Portal Submit Summary:** 30 KEEP, 2 REWRITE, 0 DELETE. Very well done. Consistent bilingual convention throughout. Minor fix: "Enviar" vs "Cargar" inconsistency in button labels.

---

## Email Templates — `/backend-node/src/email/email.service.ts`

### Strings Inventory

| # | Template | Status | Notes / Suggested Rewrite |
|---|---|---|---|
| 1 | **Client Welcome** subject: `"Bienvenido a CERNIQ, [name] — Sus proximos pasos / Welcome to CERNIQ"` | KEEP | Bilingual, personal, specific |
| 2 | Welcome body: Spanish section with 3-step onboarding | KEEP | Clear, action-oriented, institutional |
| 3 | Welcome body: English mirror section | KEEP | Clean mirror |
| 4 | Welcome CTA: `"Acceder al portal / Access portal"` | KEEP | Bilingual CTA |
| 5 | Welcome signature: `"Cordialmente, Erwin Kiess, Fundador, CERNIQ . KLYTICS LLC"` | KEEP | Uses mandated "Erwin Kiess, Fundador" and "KLYTICS LLC, San Juan, Puerto Rico" |
| 6 | **Data Submission Ack** subject: `"Datos recibidos — Procesando su analisis ALM, [name]"` | KEEP | Specific, bilingual |
| 7 | Data Ack body: 4-step processing explanation | KEEP | Technical and specific: "Simulacion Monte Carlo -- 1,000 escenarios", "informe bilingue de 14+ paginas listo para junta directiva" -- all mandated phrases |
| 8 | Data Ack CTA: `"Ver estado en portal / Check status in portal"` | KEEP | Bilingual |
| 9 | **Report Ready** subject: `"Su Informe ALM esta listo — [name] / Your ALM Report is Ready"` | KEEP | Bilingual, personalized |
| 10 | Report Ready body: 6-section report overview | KEEP | Lists all deliverables, uses mandated "cumplimiento COSSEC", "14+ paginas" |
| 11 | Report Ready CTA: `"Descargar informe ahora / Download report now"` | KEEP | Bilingual |
| 12 | Report Ready offer: `"sesion de 15 minutos"` | KEEP | Personal, specific |
| 13 | **Magic Link / Data Reminder** subject: `"[name] — Sus datos de balance estan pendientes / Your balance data is pending"` | KEEP | Bilingual, personal |
| 14 | Data Reminder body: gentle nudge + 3 help points | KEEP | Non-pushy, helpful, bilingual |
| 15 | Data Reminder CTA: `"Cargar datos ahora / Upload data now"` | KEEP | Bilingual |
| 16 | **Job Failed Alert** (internal to Erwin) | KEEP | Internal, English-only is fine |
| 17 | **Demo Request Notification** (internal to Erwin) | KEEP | Internal |
| 18 | **Lead Notification** (internal to Erwin) | KEEP | Internal |
| 19 | **Lead Confirmation** subject: `"Solicitud recibida — [name] / Your ALM Request — CERNIQ"` | KEEP | Bilingual |
| 20 | Lead Confirmation body: 3-step next steps | KEEP | Specific, institutional |
| 21 | **Revenue Alert** (internal) | KEEP | Internal |
| 22 | **Payment Failed** subject: `"Problema con su pago — CERNIQ / Payment Issue"` | KEEP | Bilingual |
| 23 | Payment Failed body | KEEP | Personal, bilingual, non-threatening |
| 24 | **Cancellation** subject: `"Lamentamos verle ir — una nota personal / A personal note — CERNIQ"` | KEEP | Personal, bilingual |
| 25 | Cancellation body | KEEP | Empathetic, mentions historical reports remain available |
| 26 | **Monthly Report Cycle** subject: `"Nuevo ciclo de reporte — envie sus datos actualizados / New reporting cycle — CERNIQ"` | KEEP | Bilingual, action-oriented |
| 27 | **B2: Data Submission Reminder** | KEEP | Helpful, bilingual, non-pushy |
| 28 | **B3: Onboarding Check-in** | KEEP | Personal, bilingual, offers help |
| 29 | **C2: Report Follow-up** | KEEP | Guides usage of 4 report sections, bilingual |
| 30 | **D5: Win-back** subject: `"Le extranamos — novedades en CERNIQ / We miss you"` | REWRITE | `"Novedades en CERNIQ — mejoras para su institucion / Updates from CERNIQ"` -- "Le extranamos" / "We miss you" is consumer-app language, not institutional risk analyst tone |
| 31 | D5 body: `"Portal de cliente redisenado con seguimiento en tiempo real"` | REWRITE | `"Portal del cliente mejorado con seguimiento de estado de informes"` -- "rediseñado" implies the product was broken; "mejorado" is safer |
| 32 | **A1: Lead Nurture Teaser** | KEEP | Bilingual, specific, not pushy |
| 33 | **A2: Lead Nurture Pricing** | KEEP | Bilingual, comparison table format |
| 34 | A2 pricing table: `"Informe Individual $499"` | REWRITE | Price mismatch -- landing page says $750 for pilot, this email says $499. Align to $750 or current pricing |
| 35 | A2: `"Informes ilimitados + alertas"` (monthly bullet) | REWRITE | `"Informes recurrentes + portal de acceso"` -- "ilimitados" may be misleading; match actual plan features |
| 36 | **Renewal Reminder** | KEEP | Bilingual, urgent variant for <=7 days |
| 37 | **Churn Risk Alert** (internal) | KEEP | Internal |
| 38 | HTML wrapper footer: `"CERNIQ . KLYTICS LLC . San Juan, Puerto Rico . hello@cerniq.io"` | KEEP | Uses mandated company info |
| 39 | All `from:` fields: `"Erwin Kiess <onboarding@resend.dev>"` | REWRITE | Update sender domain when Resend custom domain is configured: `"Erwin Kiess <erwin@cerniq.io>"` |

**Email Summary:** 34 KEEP, 5 REWRITE, 0 DELETE. Email templates are the most polished content in the product -- consistently bilingual, personal, institutional, and use almost all mandated phrases. Key issues: pricing mismatch in A2 email ($499 vs $750), win-back tone too consumer-y, sender domain still on resend.dev.

---

## Global Issues (cross-page)

| # | Issue | Pages Affected | Recommendation |
|---|---|---|---|
| 1 | Pricing inconsistency: Landing says $750 pilot, A2 email says $499 | Landing, Email A2 | Standardize to current pricing ($750 pilot) |
| 2 | "Plataforma" used alone | Pricing page (tier name), landing page (#35) | Replace with "plataforma de analisis ALM" or "acceso recurrente" |
| 3 | Internal strategy text exposed publicly | Pricing page (4 instances) | Delete and replace with customer-facing bilingual copy |
| 4 | Dev instructions visible to users | Landing page video placeholder (#31) | Remove or replace with user-friendly fallback |
| 5 | "Intelligence Engineered" tagline | Login page | Replace with product-specific descriptor |
| 6 | Feature list includes non-existent features | Login page ("options, execution") | Scope to ALM reporting features only |
| 7 | Rate impact labels English-only | Dashboard | Add Spanish translations |
| 8 | Mixed language in single strings | Dashboard ("Actualizar Balance Sheet") | Pick one language or make fully bilingual |
| 9 | `from` email on resend.dev domain | All emails | Update when custom domain configured |
| 10 | Loading states inconsistently bilingual | Various | Standardize all loading/processing text to bilingual |

---

## Audit Score by Page

| Page | Total Strings | KEEP | REWRITE | DELETE | Score |
|---|---|---|---|---|---|
| Landing (`page.tsx`) | 60 | 47 | 12 | 1 | 78% |
| Pricing (`pricing/page.tsx`) | 36 | 0 | 27 | 4 | 0% |
| Login (`login/page.tsx`) | 12 | 9 | 3 | 0 | 75% |
| Dashboard (`dashboard/page.tsx`) | 37 | 29 | 7 | 0 | 78% |
| Portal Home (`portal/page.tsx`) | 35 | 34 | 1 | 0 | 97% |
| Portal Submit (`portal/submit/page.tsx`) | 32 | 30 | 2 | 0 | 94% |
| Email Templates (`email.service.ts`) | 39 | 34 | 5 | 0 | 87% |
| **TOTAL** | **251** | **183** | **57** | **5** | **73%** |

---

## Priority Fixes (Highest Impact)

1. **CRITICAL: Pricing page full rewrite** -- Internal strategy notes exposed to customers, zero bilingual text, uses banned words. Requires complete bilingual rewrite.
2. **HIGH: Landing page video placeholder** -- Developer instruction (`NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL`) visible to users.
3. **HIGH: Login page feature description** -- Lists features (options, execution, valuation) that don't exist for target audience.
4. **MEDIUM: Landing page CTA bilingual** -- Primary CTAs ("Solicitar analisis gratuito", "Comenzar -- $750") missing English per button convention.
5. **MEDIUM: Email A2 pricing mismatch** -- $499 in nurture email vs $750 on landing page.
6. **LOW: Dashboard rate impacts** -- English-only labels in otherwise bilingual page.
7. **LOW: Mixed-language strings** -- "Actualizar Balance Sheet", "Cargando dashboard" -- minor consistency fixes.
