import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createMockHost(responseMock: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => responseMock,
      getRequest: () => ({}),
    }),
  } as never;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  });

  it('should serialize a domain HttpException with error code', () => {
    const exception = new HttpException(
      { error: 'EMAIL_JA_EXISTE', message: 'E-mail já está cadastrado' },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, createMockHost({ status: statusMock, json: jsonMock }));

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'EMAIL_JA_EXISTE',
      message: 'E-mail já está cadastrado',
    });
  });

  it('should serialize a string HttpException response', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, createMockHost({ status: statusMock, json: jsonMock }));

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Not Found',
    });
  });

  it('should return 500 for non-HttpException errors', () => {
    const exception = new Error('Unexpected failure');

    filter.catch(exception, createMockHost({ status: statusMock, json: jsonMock }));

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  it('should normalize a ValidationPipe exception into a single message plus per-field details', () => {
    const exception = new HttpException(
      {
        validationErrors: [
          { field: 'email', message: 'email must be a valid email' },
          { field: 'password', message: 'password must be longer than 8 characters' },
        ],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, createMockHost({ status: statusMock, json: jsonMock }));

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: [
        { field: 'email', message: 'email must be a valid email' },
        { field: 'password', message: 'password must be longer than 8 characters' },
      ],
    });
  });

  it('should not attach details for a DomainException', () => {
    const exception = new HttpException(
      { error: 'EMAIL_JA_EXISTE', message: 'E-mail já está cadastrado' },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, createMockHost({ status: statusMock, json: jsonMock }));

    expect(jsonMock.mock.calls[0][0]).not.toHaveProperty('details');
  });
});
