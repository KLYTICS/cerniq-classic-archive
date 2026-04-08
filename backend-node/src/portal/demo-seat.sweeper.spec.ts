import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DemoSeatSweeper } from './demo-seat.sweeper';
import { DemoSeatService } from './demo-seat.service';

describe('DemoSeatSweeper', () => {
  let sweeper: DemoSeatSweeper;
  let demoSeats: { sweepExpired: jest.Mock };

  beforeEach(async () => {
    demoSeats = {
      sweepExpired: jest.fn().mockResolvedValue({
        scanned: 0,
        expired: 0,
        expiredIds: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoSeatSweeper,
        { provide: DemoSeatService, useValue: demoSeats },
      ],
    }).compile();

    sweeper = module.get<DemoSeatSweeper>(DemoSeatSweeper);
  });

  describe('runHourly', () => {
    it('invokes DemoSeatService.sweepExpired on every tick', async () => {
      await sweeper.runHourly();
      expect(demoSeats.sweepExpired).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when there is nothing to expire (no log spam)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await sweeper.runHourly();

      // Zero-expired runs should NOT emit the sweep summary log — we only
      // log when we actually did work, to keep the log stream quiet during
      // idle hours.
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'portal.demo_seat_sweep' }),
      );
      logSpy.mockRestore();
    });

    it('emits a structured log with counts when seats actually expired', async () => {
      demoSeats.sweepExpired.mockResolvedValue({
        scanned: 5,
        expired: 2,
        expiredIds: ['p1', 'p2'],
      });
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await sweeper.runHourly();

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'portal.demo_seat_sweep',
          scanned: 5,
          expired: 2,
          expiredIds: ['p1', 'p2'],
        }),
      );
      logSpy.mockRestore();
    });

    it('NEVER throws when DemoSeatService.sweepExpired rejects', async () => {
      // Cron handlers must never throw — an uncaught rejection kills the
      // scheduler in NestJS. We log and continue.
      demoSeats.sweepExpired.mockRejectedValue(new Error('DB connection lost'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await expect(sweeper.runHourly()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Demo seat sweep failed'),
        expect.any(String),
      );
      errorSpy.mockRestore();
    });

    it('is idempotent across back-to-back calls', async () => {
      await sweeper.runHourly();
      await sweeper.runHourly();
      await sweeper.runHourly();

      expect(demoSeats.sweepExpired).toHaveBeenCalledTimes(3);
    });
  });
});
