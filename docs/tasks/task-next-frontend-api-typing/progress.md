# task-next-frontend-api-typing — Progress

**Status:** completed
**SIs:** 4/4 completed

## Final verification

| Deliverable | Comando | Resultado |
|---|---|---|
| Type-check | `docker compose exec next-frontend npx tsc --noEmit` | exit 0 |
| Lint | `docker compose exec next-frontend npm run lint` | exit 0, sem achados |
| Build | `docker compose exec next-frontend npm run build` | exit 0 — compilado em 3.3s, 5 páginas estáticas |
| Testes | `docker compose exec next-frontend npm test` | **bloqueado** — `npm error Missing script: "test"`, como o plano previa |
| Drift check | `./scripts/check-api-types-drift.sh` | exit 0 |

### Pós-conclusão — passada de `/simplify`

Quatro agentes de revisão (reuse, simplificação, eficiência, altitude) rodaram sobre o diff. Seis achados convergiram no mesmo mecanismo e foram corrigidos com uma única mudança; três achados menores também foram aplicados. Todas as ACs de SI-1 e SI-2 foram revalidadas após o refactor, incluindo o caminho de falha do drift check.

- **Pin único do codegen.** `generate-api-types.sh` passou a aceitar um caminho de saída opcional, e `check-api-types-drift.sh` agora o chama em vez de reimplementar a invocação do `npx`. Antes, a versão `7.13.0`, o caminho da spec, a resolução do `REPO_ROOT` e o próprio comando de geração estavam duplicados nos dois arquivos. O modo de falha era silencioso: pins divergentes fariam o check comparar saídas de duas versões diferentes de codegen, acusando drift inexistente ou mascarando drift real.
- **Diff sem arquivo intermediário** no caminho de erro do drift check.
- **Comentários narrativos removidos** de `contracts.ts` (os que repetiam o que o acessor já dizia); os que registram decisão foram preservados.
- **Duplicação de prosa entre os dois `CLAUDE.md`** resolvida: as regras do arquivo gerado passam a viver só no `next-frontend/CLAUDE.md` § Typed API contracts, e a raiz aponta para lá — mantendo na raiz apenas o que é de escopo de raiz (por que os scripts rodam no host, onde vive o pin).
- **Não aplicado:** a sugestão de enxugar os tipos intermediários de `contracts.ts` antecipando ~9 rotas. Só uma rota existe; reestruturar por especulação sobre a nona é prematuro, e os intermediários hoje ajudam a leitura. Reavaliar quando a terceira ou quarta rota entrar e o padrão real aparecer.

### SI-1 — Gerar os tipos do contrato a partir do `openapi.json`
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - `scripts/generate-api-types.sh` criado na raiz; roda `npx --yes openapi-typescript@7.13.0` (o `--yes` evita o prompt interativo do npx quando o pacote não está no cache).
  - AC de idempotência verificada por `md5sum` antes e depois de uma segunda execução: hashes idênticos (`8e5937f7…`).
  - AC "rastreado pelo git" **não** verificável nesta execução: o commit é do usuário (regra permanente — nunca commitar sem permissão explícita). `git check-ignore` confirma que nenhum padrão de `.gitignore` exclui `next-frontend/lib/api/schema.d.ts`, então a ação técnica 3 (acrescentar exceção) foi desnecessária.
  - AC de tsconfig confirmada por leitura: `module: esnext` + `moduleResolution: bundler` já presentes; nenhuma alteração feita.
  - `docker compose exec next-frontend npx tsc --noEmit` retornou exit 0 com o arquivo gerado presente.

### SI-2 — Check de drift entre a spec e os tipos versionados
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - Ambas as ACs de comportamento verificadas empiricamente: com o `.d.ts` em dia o script sai 0; após anexar `export type DriftCanary = never` ao arquivo versionado, sai 1 e nomeia o arquivo divergente na saída, incluindo o diff completo em stderr. O arquivo foi restaurado por regeração ao fim do teste.
  - O temporário é criado via `mktemp -d` **fora da árvore de trabalho** e removido por `trap ... EXIT`, o que satisfaz a AC de `git status` limpo mesmo se o script for interrompido no meio.
  - Documentação escrita na raiz do `CLAUDE.md` como nova seção `## API Types Codegen (scripts/)`, inserida antes de `## Working Principles`. Inclui a pendência de CI como blockquote.
  - Pendência da `TD-01` permanece aberta e agora está registrada em dois lugares (o SI no plano e o `CLAUDE.md` da raiz): não há pipeline de CI no repositório para hospedar o check, e nenhum TD escolheu provedor. O script é o entregável agnóstico de provedor; a ligação ao pipeline é decisão de tooling separada.

### SI-3 — Módulo de contrato do BFF
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - **Desvio do snippet do plano, deliberado.** O snippet de Setup do `### Frontend Runtime` traz `Pick<LoginUpstream, /* campos que o BFF reexpõe */>` — um comentário no lugar da lista de chaves, que não compila. A lista foi lida do `schema.d.ts` gerado, exatamente como o plano manda ("ela é lida do schema gerado no momento em que cada route handler existir"): `"id" | "email" | "channel"`, os três campos que `RegisterResponseDto` declara hoje.
  - **`Pick` mantido mesmo sendo semanticamente passthrough.** Nenhum campo da resposta de login é sensível (os tokens vão em cookie, não no corpo), então não há recorte a fazer. Um alias direto (`= LoginUpstreamResponse`) teria o mesmo shape, mas **não quebraria** quando o backend removesse um campo — falharia como `undefined` silencioso num componente, que é justamente o risco aceito registrado na TD-03. O `Pick` fixa o contrato em build.
  - **AC-3 provada empiricamente, mas simulada na camada dos tipos gerados, não na do DTO.** Removi `email` de `RegisterResponseDto` dentro de `schema.d.ts` e o `tsc` falhou em `lib/api/contracts.ts(47,60)` com `TS2344`, nomeando a derivação afetada. Não editei o DTO em `nestjs-project/` nem rodei `npm run openapi:generate`: o elo spec→`.d.ts` já foi provado em SI-1/SI-2 (idempotência + drift check), e mexer no backend violaria o Scope Limits. O arquivo foi restaurado por regeração e o drift check confirma que está em dia.
  - **`Exclude` usado para os status de erro** (`LoginBffErrorStatus`), derivando a lista por exclusão do 200 em vez de redigitar `400 | 401 | 403 | 429` — um status de erro novo no backend aparece sozinho.
  - **Correção de documentação defasada, fora da ação literal do SI.** O `next-frontend/CLAUDE.md` afirmava "**Strategy decided, adoption deferred** — neither library is installed yet" sobre a `openapi-spec/TD-05`. Metade disso deixou de ser verdade nesta task. Reescrito para "Types adopted; client still deferred", preservando que `openapi-fetch` continua não instalado e sem TD que o adote.
  - Verificado que `next-frontend/hooks/` não existe e que nada em `components/` importa de `lib/api/schema` (AC-4).
  - Regression guards em verde: `tsc --noEmit` exit 0 e `npm run lint` sem achados.

### SI-4 — Registrar a política de ausência de validação de runtime
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - Registrado como subseção própria (`### No runtime validation at the BFF↔NestJS boundary`) dentro de `next-frontend/CLAUDE.md` § API Integration, em vez de uma frase avulsa. A decisão é a **ausência** de código, então o registro é o único artefato que a torna auditável — enterrá-la num parágrafo sobre outro assunto a faria ser lida como esquecimento, que é exatamente o que o SI existe para evitar.
  - Os três elementos exigidos pelas ACs estão nomeados separadamente e em negrito: **Accepted risk** (resposta fora do contrato vira `undefined` silencioso longe da causa), **Reevaluation trigger** (existência de codegen de schemas Zod a partir da spec — e a nota de que reabrir sem esse gatilho contraria a decisão) e **Scope boundary** (fronteira HTTP ≠ fronteira de ambiente).
  - Uma frase compacta sobre TD-03 já tinha entrado no `CLAUDE.md` durante o SI-3, ao final da § Typed API contracts. Foi absorvida por esta subseção para não deixar a política registrada em dois lugares com graus de detalhe diferentes.
  - AC-3 verificada: `grep -rn "zod"` em `next-frontend/**/*.{ts,tsx}` (fora de `node_modules`) retorna uma única ocorrência — `lib/env.ts:2`, que é precisamente a exceção delimitada por `next-frontend-env-config/TD-01`. Nenhum schema Zod de resposta HTTP existe.
