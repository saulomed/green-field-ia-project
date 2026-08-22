import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { ErrorCode } from '../dto/error-code.enum';
import { ErrorDetailDto } from '../dto/error-detail.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let error: string;
    let message: string;
    let details: ErrorDetailDto[] | undefined;

    if (exception instanceof DomainException) {
      statusCode = exception.statusCode;
      error = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'validationErrors' in exceptionResponse
      ) {
        // Normalized shape from the `ValidationPipe` exception factory
        // (main.ts): per-field violations migrate to `details`, and
        // `message` becomes a single form-level sentence.
        const resp = exceptionResponse as Record<string, unknown>;
        error = ErrorCode.VALIDATION_ERROR;
        message = 'Dados inválidos';
        details = resp.validationErrors as ErrorDetailDto[];
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'error' in exceptionResponse
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        error = resp.error as string;
        message = resp.message as string;
      } else if (typeof exceptionResponse === 'string') {
        error = exceptionResponse;
        message = exceptionResponse;
      } else {
        error = exception.message;
        message = exception.message;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = ErrorCode.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
    }

    response
      .status(statusCode)
      .json({ statusCode, error, message, ...(details ? { details } : {}) });
  }
}
