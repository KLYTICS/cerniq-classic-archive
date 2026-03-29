import { FineTunePipelineService } from './fine-tune-pipeline.service';

describe('FineTunePipelineService', () => {
  let service: FineTunePipelineService;

  beforeEach(() => {
    service = new FineTunePipelineService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDataSources', () => {
    it('should return configured data sources', () => {
      const sources = service.getDataSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]).toHaveProperty('source');
      expect(sources[0]).toHaveProperty('language');
      expect(sources[0]).toHaveProperty('category');
    });
  });

  describe('addTrainingExample', () => {
    it('should add a training example and return id', () => {
      const result = service.addTrainingExample({
        messages: [
          { role: 'system', content: 'You are a regulatory expert.' },
          { role: 'user', content: 'What is NWR?' },
          { role: 'assistant', content: 'Net Worth Ratio is...' },
        ],
        category: 'regulatory',
        quality: 5,
        language: 'en',
        source: 'manual',
      });

      expect(result.id).toMatch(/^train-/);
      expect(result.total).toBe(1);
    });
  });

  describe('getTrainingStats', () => {
    it('should return empty stats when no examples', () => {
      const stats = service.getTrainingStats();
      expect(stats.totalExamples).toBe(0);
      expect(stats.avgQuality).toBe(0);
      expect(stats.readyForTraining).toBe(false);
    });

    it('should aggregate stats correctly after adding examples', () => {
      service.addTrainingExample({
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'assistant', content: 'Answer' },
        ],
        category: 'regulatory',
        quality: 4,
        language: 'es',
        source: 'COSSEC',
      });
      service.addTrainingExample({
        messages: [
          { role: 'user', content: 'Test2' },
          { role: 'assistant', content: 'Answer2' },
        ],
        category: 'financial_statement',
        quality: 5,
        language: 'en',
        source: 'NCUA',
      });

      const stats = service.getTrainingStats();
      expect(stats.totalExamples).toBe(2);
      expect(stats.avgQuality).toBe(4.5);
      expect(stats.byCategory).toHaveProperty('regulatory');
      expect(stats.byLanguage).toHaveProperty('es');
    });
  });

  describe('exportTrainingData', () => {
    it('should export JSONL format filtered by quality', () => {
      service.addTrainingExample({
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        category: 'regulatory',
        quality: 5,
        language: 'en',
        source: 'test',
      });
      service.addTrainingExample({
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        category: 'regulatory',
        quality: 1,
        language: 'en',
        source: 'test',
      });

      const exported = service.exportTrainingData(4);
      const lines = exported.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.messages[0].content).toBe('Q1');
    });
  });

  describe('submitFineTuneJob', () => {
    it('should create a pending fine-tune job', async () => {
      service.addTrainingExample({
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'assistant', content: 'Answer' },
        ],
        category: 'regulatory',
        quality: 4,
        language: 'en',
        source: 'test',
      });

      const job = await service.submitFineTuneJob({ epochs: 2 });
      expect(job.status).toBe('pending');
      expect(job.id).toMatch(/^ft-/);
      expect(job.epochs).toBe(2);
      expect(service.getJobs()).toHaveLength(1);
    });
  });
});
