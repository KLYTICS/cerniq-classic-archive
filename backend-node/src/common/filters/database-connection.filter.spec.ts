import { DatabaseConnectionFilter } from './database-connection.filter';

describe('DatabaseConnectionFilter', () => {
  it('returns a 503 payload for database connectivity failures', () => {
    const filter = new DatabaseConnectionFilter();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ method: 'GET', url: '/api/alm/report' }),
      }),
    } as any;

    filter.catch({ message: 'database unavailable' } as any, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message:
          'The service is temporarily unavailable. Please retry shortly.',
        timestamp: expect.any(String),
        path: '/api/alm/report',
      },
    });
  });
});
