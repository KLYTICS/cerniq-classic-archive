import { PrismaExceptionFilter } from './prisma-exception.filter';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ method: 'POST', url: '/api/users' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('maps P2002 (unique constraint) to 409 CONFLICT', () => {
    const exception = {
      code: 'P2002',
      message: 'Unique constraint failed',
      meta: { target: ['email'] },
    };
    filter.catch(exception as any, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'DUPLICATE_ENTRY' }),
      }),
    );
  });

  it('maps P2025 (record not found) to 404', () => {
    const exception = { code: 'P2025', message: 'Record not found', meta: {} };
    filter.catch(exception as any, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('maps unknown codes to 500', () => {
    const exception = { code: 'P9999', message: 'Unknown', meta: {} };
    filter.catch(exception as any, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
