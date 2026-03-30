jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  const makeHost = () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => ({ status, json }),
          getRequest: () => ({ method: 'POST', url: '/api/test' }),
        }),
      } as any,
      status,
      json,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  it('maps string HttpExceptions into API error responses', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(
      new HttpException('Missing input', HttpStatus.BAD_REQUEST),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing input',
        details: undefined,
        timestamp: expect.any(String),
        path: '/api/test',
      },
    });
  });

  it('maps object HttpExceptions and preserves details', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json } = makeHost();

    filter.catch(
      new HttpException(
        {
          message: ['bad email', 'bad name'],
          details: { field: 'email' },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'bad email; bad name',
        details: { field: 'email' },
        timestamp: expect.any(String),
        path: '/api/test',
      },
    });
  });

  it('captures non-HTTP errors in Sentry and hides internals in production', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(new Error('secret stack detail'), host);

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { path: '/api/test', method: 'POST' },
    });
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'An unexpected error occurred. Please try again or contact support.',
        details: undefined,
        timestamp: expect.any(String),
        path: '/api/test',
      },
    });
  });
});
