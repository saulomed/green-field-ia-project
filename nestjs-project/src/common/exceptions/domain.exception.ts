/**
 * Base class for all domain exceptions.
 * Carries a machine-readable error code and an HTTP status code so the
 * exception filter can translate it to the standard error response format
 * without the service layer being aware of HTTP.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class DomainException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
