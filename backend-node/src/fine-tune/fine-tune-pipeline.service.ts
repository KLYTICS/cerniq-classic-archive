import { Injectable, Logger } from '@nestjs/common';

// ─── LLM Fine-Tuning Pipeline ───────────────────────────────
// Manages training data collection, formatting, and submission
// for PR financial regulatory domain fine-tuning

export interface TrainingExample {
  id: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  category:
    | 'regulatory'
    | 'financial_statement'
    | 'risk_management'
    | 'cossec_exam';
  quality: number; // 1-5 expert rating
  language: 'en' | 'es';
  source: string;
}

export interface FineTuneJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  baseModel: string;
  trainingExamples: number;
  validationExamples: number;
  epochs: number;
  createdAt: string;
  completedAt?: string;
  resultModelId?: string;
  metrics?: {
    trainingLoss: number;
    validationLoss: number;
    bleuScore?: number;
  };
}

// ─── Training Data Sources ──────────────────────────────────

const DATA_SOURCES = [
  {
    source: 'COSSEC Regulations',
    language: 'es',
    estimatedPages: 500,
    category: 'regulatory',
  },
  {
    source: 'OCIF Cartas Circulares 2010-2024',
    language: 'es',
    estimatedPages: 200,
    category: 'regulatory',
  },
  {
    source: 'NCUA Letters to CUs 2010-2024',
    language: 'en',
    estimatedPages: 300,
    category: 'regulatory',
  },
  {
    source: 'PR CU Annual Reports 2018-2024',
    language: 'es',
    estimatedPages: 400,
    category: 'financial_statement',
  },
  {
    source: 'CERNIQ AI Advisor Outputs (rated)',
    language: 'both',
    estimatedPages: 50,
    category: 'risk_management',
  },
];

// ─── System Prompts for Different Domains ───────────────────

const DOMAIN_SYSTEM_PROMPTS = {
  regulatory:
    'Eres un experto en regulación financiera de Puerto Rico, especializado en COSSEC, OCIF y NCUA. Respondes citando artículos específicos de regulaciones.',
  financial_statement:
    'Eres un analista financiero especializado en cooperativas de ahorro y crédito de Puerto Rico. Interpretas estados financieros con precisión técnica.',
  risk_management:
    'Eres un asesor de riesgo ALM para instituciones financieras de Puerto Rico. Proporcionas recomendaciones específicas basadas en datos cuantitativos.',
  cossec_exam:
    'Eres un consultor de preparación de exámenes COSSEC. Conoces los formatos exactos de los Schedules 1-12 y los criterios CAMEL.',
};

@Injectable()
export class FineTunePipelineService {
  private readonly logger = new Logger(FineTunePipelineService.name);
  private trainingData: TrainingExample[] = [];
  private jobs: FineTuneJob[] = [];

  // ─── Data Collection ──────────────────────────────────────

  getDataSources() {
    return DATA_SOURCES;
  }

  addTrainingExample(example: Omit<TrainingExample, 'id'>) {
    const id = `train-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.trainingData.push({ ...example, id });
    return { id, total: this.trainingData.length };
  }

  getTrainingStats() {
    const byCategory = new Map<string, number>();
    const byLanguage = new Map<string, number>();
    const byQuality = new Map<number, number>();

    for (const ex of this.trainingData) {
      byCategory.set(ex.category, (byCategory.get(ex.category) ?? 0) + 1);
      byLanguage.set(ex.language, (byLanguage.get(ex.language) ?? 0) + 1);
      byQuality.set(ex.quality, (byQuality.get(ex.quality) ?? 0) + 1);
    }

    return {
      totalExamples: this.trainingData.length,
      byCategory: Object.fromEntries(byCategory),
      byLanguage: Object.fromEntries(byLanguage),
      byQuality: Object.fromEntries(byQuality),
      avgQuality:
        this.trainingData.length > 0
          ? this.trainingData.reduce((s, e) => s + e.quality, 0) /
            this.trainingData.length
          : 0,
      readyForTraining:
        this.trainingData.length >= 100 &&
        this.trainingData.filter((e) => e.quality >= 4).length >= 50,
    };
  }

  // ─── Format for OpenAI Fine-Tuning ────────────────────────

  exportTrainingData(minQuality: number = 3): string {
    const filtered = this.trainingData.filter((e) => e.quality >= minQuality);
    return filtered
      .map((e) => JSON.stringify({ messages: e.messages }))
      .join('\n');
  }

  // ─── Job Management ───────────────────────────────────────

  async submitFineTuneJob(config: {
    baseModel?: string;
    epochs?: number;
    minQuality?: number;
  }): Promise<FineTuneJob> {
    const baseModel = config.baseModel ?? 'gpt-4o-mini-2024-07-18';
    const examples = this.trainingData.filter(
      (e) => e.quality >= (config.minQuality ?? 3),
    );
    const validationSplit = Math.floor(examples.length * 0.1);

    const job: FineTuneJob = {
      id: `ft-${Date.now()}`,
      status: 'pending',
      baseModel,
      trainingExamples: examples.length - validationSplit,
      validationExamples: validationSplit,
      epochs: config.epochs ?? 3,
      createdAt: new Date().toISOString(),
    };

    this.jobs.push(job);

    // In production: submit to OpenAI API
    // const response = await openai.fineTuning.jobs.create({
    //   model: baseModel,
    //   training_file: uploadedFileId,
    //   validation_file: validationFileId,
    //   hyperparameters: { n_epochs: config.epochs ?? 3 },
    // });

    this.logger.log(
      `Fine-tune job ${job.id} submitted: ${job.trainingExamples} examples on ${baseModel}`,
    );
    return job;
  }

  getJobs(): FineTuneJob[] {
    return this.jobs;
  }

  getDomainPrompts() {
    return DOMAIN_SYSTEM_PROMPTS;
  }
}
