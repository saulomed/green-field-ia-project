#!/usr/bin/env bash
#
# Verifica se os tipos versionados estão em dia com a spec OpenAPI do NestJS.
#
# Regera os tipos para um destino temporário — delegando a `generate-api-types.sh`,
# que é o único dono da versão do codegen e do caminho da spec — e compara com o
# arquivo versionado. Sai com código != 0 quando divergirem: é a metade de controle
# da Option A da next-frontend-api-typing/TD-01, em que um `.d.ts` defasado falha em
# vez de passar silenciosamente.
#
# Não escreve no arquivo versionado e não deixa artefato no diretório de trabalho.
#
# Uso: ./scripts/check-api-types-drift.sh

set -euo pipefail

COMMITTED="next-frontend/lib/api/schema.d.ts"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f "$COMMITTED" ]; then
  echo "ERRO: $COMMITTED não existe. Rode ./scripts/generate-api-types.sh e versione o resultado." >&2
  exit 1
fi

# O temporário vive fora da árvore de trabalho para que `git status` permaneça
# limpo mesmo se o script for interrompido.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
TMP_OUT="$TMP_DIR/schema.d.ts"

"$SCRIPT_DIR/generate-api-types.sh" "$TMP_OUT" >/dev/null

if diff -q "$COMMITTED" "$TMP_OUT" >/dev/null; then
  echo "OK: $COMMITTED está em dia com a spec."
  exit 0
fi

echo "ERRO: $COMMITTED está defasado em relação à spec." >&2
echo "Rode ./scripts/generate-api-types.sh e commite o resultado." >&2
echo "" >&2
echo "--- diff (versionado vs. regerado) ---" >&2
diff -u "$COMMITTED" "$TMP_OUT" >&2 || true
exit 1
