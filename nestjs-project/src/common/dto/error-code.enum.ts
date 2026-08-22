/**
 * Machine-readable domain error codes emitted in `ErrorResponseDto.error`.
 * Declared as a named enum (not inferred as a plain `string`) so a rename
 * breaks `tsc` on the frontend's generated types instead of the screen.
 *
 * @author Saulo Santos
 * @date 22/08/2026
 */
export enum ErrorCode {
  EMAIL_JA_EXISTE = 'EMAIL_JA_EXISTE',
  EMAIL_JA_CONFIRMADO = 'EMAIL_JA_CONFIRMADO',
  EMAIL_NAO_CONFIRMADO = 'EMAIL_NAO_CONFIRMADO',
  CREDENCIAIS_INVALIDAS = 'CREDENCIAIS_INVALIDAS',
  SESSAO_INVALIDA = 'SESSAO_INVALIDA',
  TOKEN_INVALIDO = 'TOKEN_INVALIDO',
  TOKEN_REUTILIZADO = 'TOKEN_REUTILIZADO',
  LIMITE_EXCEDIDO = 'LIMITE_EXCEDIDO',
  USUARIO_NAO_ENCONTRADO = 'USUARIO_NAO_ENCONTRADO',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
