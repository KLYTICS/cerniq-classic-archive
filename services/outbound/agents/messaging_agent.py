"""
CERNIQ Outbound Engine — Messaging Agent

Generates bilingual outreach messages from templates and lead context.
"""

import logging
import os
from typing import Literal

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


class MessagingAgent:
    """Generates personalized bilingual outreach messages."""

    def __init__(self):
        self.templates = self._load_templates()

    def _load_templates(self) -> dict[str, str]:
        """Load email templates from disk."""
        templates = {}
        for name in ("cold_email", "followup_email", "final_email"):
            path = os.path.join(TEMPLATES_DIR, f"{name}.txt")
            try:
                with open(path, "r", encoding="utf-8") as f:
                    templates[name] = f.read()
            except FileNotFoundError:
                logger.warning(f"Template not found: {path}")
                templates[name] = ""
        return templates

    def generate_cold_email(
        self,
        lead: dict,
        lang: Literal["es", "en"] = "es",
    ) -> dict[str, str]:
        """Generate the initial cold outreach email."""

        institution = lead.get("institution", "Cooperativa")
        role = lead.get("contact_role", "CFO")
        assets_m = int(lead.get("estimated_assets", 0)) // 1_000_000

        if lang == "es":
            subject = f"Informe ALM gratuito para {institution}"
            body = f"""Estimado/a {role},

¿Sus informes ALM para el comité se construyen manualmente o a través de un sistema?

En CERNIQ hemos desarrollado un flujo de trabajo que convierte la carga de un balance general en un informe ALM bilingüe en minutos — diseñado específicamente para cooperativas como {institution}.

{f'Con ${assets_m}M en activos, ' if assets_m > 0 else ''}su institución puede beneficiarse de:

• Análisis de brecha de duración y sensibilidad NII
• Cumplimiento LCR/NSFR bajo Basilea III
• Prueba de estrés Monte Carlo con 1,000 escenarios
• Comparación con la mediana del sector

¿Le gustaría recibir un informe de muestra personalizado? Responda a este correo o programe una demostración de 15 minutos.

Saludos cordiales,
Erwin Kiess
CERNIQ — San Juan, PR
"""
        else:
            subject = f"Free ALM Report for {institution}"
            body = f"""Dear {role},

Quick question — are your ALM committee reports currently built manually or through a system?

We've built a workflow at CERNIQ that converts a balance sheet upload into a bilingual ALM report in minutes — designed specifically for institutions like {institution}.

{f'At ${assets_m}M in assets, ' if assets_m > 0 else ''}your institution could benefit from:

• Duration gap and NII sensitivity analysis
• LCR/NSFR compliance under Basel III
• Monte Carlo stress test with 1,000 scenarios
• Sector median benchmarking

Would you like to receive a personalized sample report? Reply to this email or schedule a 15-minute demo.

Best regards,
Erwin Kiess
CERNIQ — San Juan, PR
"""

        return {"subject": subject, "body": body, "type": "cold", "lang": lang}

    def generate_followup(
        self,
        lead: dict,
        sequence: int = 1,
        lang: Literal["es", "en"] = "es",
    ) -> dict[str, str]:
        """Generate follow-up emails (sequence 1 = day 3, sequence 2 = day 7)."""

        institution = lead.get("institution", "Cooperativa")
        role = lead.get("contact_role", "CFO")

        if sequence == 1:
            if lang == "es":
                subject = f"Re: Informe ALM para {institution}"
                body = f"""Estimado/a {role},

Le escribo como seguimiento a mi correo anterior.

CERNIQ ayuda a instituciones como {institution} a pasar de datos crudos de balance general a un informe ALM listo para la junta directiva, a través de un simple flujo de carga.

El informe incluye análisis de brecha de duración, sensibilidad NII, y pruebas de estrés — todo en español e inglés.

¿Tiene 15 minutos esta semana para que le muestre cómo funciona?

Saludos cordiales,
Erwin Kiess
CERNIQ
"""
            else:
                subject = f"Re: ALM Report for {institution}"
                body = f"""Dear {role},

Just following up on my previous email.

CERNIQ helps institutions like {institution} move from raw balance sheet data to a board-ready ALM report through a simple upload workflow.

The report includes duration gap analysis, NII sensitivity, and stress testing — all in English and Spanish.

Do you have 15 minutes this week for a quick walkthrough?

Best regards,
Erwin Kiess
CERNIQ
"""
        else:
            # Final follow-up
            if lang == "es":
                subject = f"Última nota — informe ALM para {institution}"
                body = f"""Estimado/a {role},

Esta es mi última nota. Entiendo que está ocupado/a.

Si en el futuro necesita una herramienta para generar informes ALM de forma más rápida y confiable, CERNIQ está diseñado exactamente para eso.

Le dejo mi enlace para agendar una llamada cuando sea conveniente:
https://calendly.com/cerniq/demo

Saludos,
Erwin Kiess
CERNIQ
"""
            else:
                subject = f"Last note — ALM report for {institution}"
                body = f"""Dear {role},

This is my last note. I understand you're busy.

If you ever need a faster, more reliable way to generate ALM reports, CERNIQ is built for exactly that.

Here's my scheduling link whenever it's convenient:
https://calendly.com/cerniq/demo

Best,
Erwin Kiess
CERNIQ
"""

        return {"subject": subject, "body": body, "type": f"followup_{sequence}", "lang": lang}

    def generate_email(self, lead: dict, lang: Literal["es", "en"] = "es") -> str:
        """Legacy interface: returns just the email body."""
        result = self.generate_cold_email(lead, lang)
        return result["body"]
