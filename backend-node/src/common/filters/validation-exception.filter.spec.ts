import { ValidationExceptionFilter } from './validation-exception.filter';
import { BadRequestException, ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new ValidationExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/api/test' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats class-validator errors as 422 with details', () => {
    const exception = new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
    });
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({ message: 'email must be an email' }),
          ]),
        }),
      }),
    );
  });

  it('passes through non-validation BadRequests as 400', () => {
    const exception = new BadRequestException('Something went wrong');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'BAD_REQUEST' }),
      }),
    );
  });
});
