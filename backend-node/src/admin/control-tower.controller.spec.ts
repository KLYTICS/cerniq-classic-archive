import { Test } from '@nestjs/testing';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';

describe('ControlTowerController', () => {
  it('returns the control-tower summary', async () => {
    const controlTower = {
      getSummary: jest.fn().mockResolvedValue({ generatedAt: 'now' }),
      runAction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ControlTowerController],
      providers: [{ provide: ControlTowerService, useValue: controlTower }],
    }).compile();

    const controller = moduleRef.get(ControlTowerController);
    const result = await controller.getSummary();

    expect(result).toEqual({ generatedAt: 'now' });
    expect(controlTower.getSummary).toHaveBeenCalled();
  });

  it('forwards action requests to the service', async () => {
    const controlTower = {
      getSummary: jest.fn(),
      runAction: jest.fn().mockResolvedValue({ ok: true }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ControlTowerController],
      providers: [{ provide: ControlTowerService, useValue: controlTower }],
    }).compile();

    const controller = moduleRef.get(ControlTowerController);
    const result = await controller.runAction({
      action: 'run_pipeline',
      userId: undefined,
      jobId: undefined,
    });

    expect(result).toEqual({ ok: true });
    expect(controlTower.runAction).toHaveBeenCalledWith('run_pipeline', {
      action: 'run_pipeline',
      userId: undefined,
      jobId: undefined,
    });
  });
});
