#!/usr/bin/env bash
#
# Gera os tipos TypeScript do contrato da API a partir da spec OpenAPI do NestJS.
#
# Decisão: next-frontend-api-typing/TD-01 (Option A) — o script vive na raiz do
# repositório e o `.d.ts` gerado é versionado. Roda no host, fora dos containers:
# `build.context: ./next-frontend` impede o container do frontend de enxergar
# `nestjs-project/`, e não há `package.json` na raiz para declarar a dependência,
# então a versão fica pinada aqui — este é o **único** lugar do repositório que
# fixa a versão do codegen e o caminho da spec. `check-api-types-drift.sh` chama
# este script em vez de reimplementar a geração, justamente para que não exista
# um segundo pin capaz de divergir.
#
# Uso:
#   ./scripts/generate-api-types.sh            # escreve no destino versionado
#   ./scripts/generate-api-types.sh <caminho>  # escreve em outro destino

set -euo pipefail

OPENAPI_TYPESCRIPT_VERSION="7.13.0"
SPEC="nestjs-project/openapi.json"
DEFAULT_OUT="next-frontend/lib/api/schema.d.ts"

OUT="${1:-$DEFAULT_OUT}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f "$SPEC" ]; then
  echo "ERRO: spec não encontrada em $SPEC. Gere-a primeiro no nestjs-project." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

# Progresso vai para stdout e erros para stderr, de modo que quem chama este script
# como sub-rotina (o drift check) possa silenciar o progresso sem perder os erros.
echo "Gerando $OUT a partir de $SPEC (openapi-typescript@${OPENAPI_TYPESCRIPT_VERSION})..."
npx --yes "openapi-typescript@${OPENAPI_TYPESCRIPT_VERSION}" "$SPEC" -o "$OUT"

echo "OK: $OUT gerado."
