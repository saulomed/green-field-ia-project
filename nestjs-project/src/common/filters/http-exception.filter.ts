import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let error: string;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (
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
      error = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';
    }

    response.status(statusCode).json({ statusCode, error, message });
  }
}
