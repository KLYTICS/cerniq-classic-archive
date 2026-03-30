import { of } from 'rxjs';
import {
  getUsageLog,
  StripeMeteringInterceptor,
} from './stripe-metering.interceptor';

describe('StripeMeteringInterceptor', () => {
  let interceptor: StripeMeteringInterceptor;

  beforeEach(() => {
    interceptor = new StripeMeteringInterceptor();
    getUsageLog().splice(0, getUsageLog().length);
  });

  it('records billable ALM endpoints that match route patterns', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/alm/inst-1/report',
          params: { institutionId: 'inst-1' },
        }),
      }),
    } as any;

    interceptor
      .intercept(context, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          expect(getUsageLog('inst-1')).toEqual([
            expect.objectContaining({
              institutionId: 'inst-1',
              eventType: 'report_generated',
            }),
          ]);
          done();
        },
      });
  });

  it('records api_call usage for v1 endpoints using the institution header fallback', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/positions',
          headers: { 'x-institution-id': 'inst-header' },
          params: {},
        }),
      }),
    } as any;

    interceptor
      .intercept(context, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          expect(getUsageLog('inst-header')).toEqual([
            expect.objectContaining({
              institutionId: 'inst-header',
              eventType: 'api_call',
            }),
          ]);
          done();
        },
      });
  });

  it('does not record usage when no institution context is available', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/alm/health',
          params: {},
          headers: {},
        }),
      }),
    } as any;

    interceptor
      .intercept(context, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          expect(getUsageLog()).toHaveLength(0);
          done();
        },
      });
  });
});
