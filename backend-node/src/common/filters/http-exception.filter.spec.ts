import { HttpException, HttpStatus, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/api/test', method: 'GET' }),
      }),
    };
  });

  it('handles HttpException with correct status and code', () => {
    filter.catch(new BadRequestException('Invalid input'), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'BAD_REQUEST' }),
      }),
    );
  });

  it('handles NotFoundException', () => {
    filter.catch(new NotFoundException('Resource not found'), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
    );
  });

  it('handles ForbiddenException', () => {
    filter.catch(new ForbiddenException('Access denied'), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('returns 500 for unknown errors', () => {
    filter.catch(new Error('DB connection lost'), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    );
  });

  it('includes timestamp and path in response', () => {
    filter.catch(new BadRequestException('test'), mockHost);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.error.timestamp).toBeDefined();
    expect(body.error.path).toBe('/api/test');
  });

  it('joins array messages', () => {
    filter.catch(new BadRequestException({ message: ['field1 invalid', 'field2 required'] }), mockHost);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.error.message).toContain('field1 invalid');
    expect(body.error.message).toContain('field2 required');
  });

  it('includes details from validation errors', () => {
    filter.catch(new BadRequestException({ message: 'Validation failed', errors: [{ field: 'email' }] }), mockHost);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.error.details).toEqual([{ field: 'email' }]);
  });

  it('never leaks internal error messages in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    filter.catch(new Error('secret internal detail'), mockHost);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.error.message).not.toContain('secret internal detail');
    expect(body.error.message).toContain('unexpected error');
    process.env.NODE_ENV = origEnv;
  });

  it('handles non-Error thrown values', () => {
    filter.catch('string error', mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});
