---
kind: task
name: task-next-frontend-api-typing
test_specs_aware: true
sources_mtime:
  docs/tasks/task-next-frontend-api-typing/context.md: "2026-08-15T16:16:46Z"
  docs/tasks/task-next-frontend-api-typing/library-refs.md: "2026-08-15T16:25:53Z"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
---

# Tipagem das chamadas de API do `next-frontend`

## Objective

Adoção do codegen OpenAPI no next-frontend: pipeline de geração dos tipos, contrato tipado entre componentes e BFF, e política de validação de runtime na fronteira com o NestJS

---

## Step Implementations

### SI-1 — Gerar os tipos do contrato a partir do `openapi.json` (Infra)

**Description:** Cria o script de codegen na raiz do repositório e versiona o `.d.ts` gerado, materializando a garantia de que uma quebra de contrato falha no `tsc` do frontend.

**Technical actions:**

1. Criar `scripts/generate-api-types.sh` na **raiz** do repositório — roda `npx openapi-typescript@7.13.0 nestjs-project/openapi.json -o next-frontend/lib/api/schema.d.ts` (per `next-frontend-api-typing/TD-01`, Option A). O script roda no host, fora dos containers, porque `build.context: ./next-frontend` impede o container do frontend de enxergar `nestjs-project/`. O pin de versão vive no próprio comando: não há `package.json` na raiz onde declará-lo.
2. Executar o script e commitar `next-frontend/lib/api/schema.d.ts` — o artefato é **versionado** de propósito, para que o diff apareça no PR quando o backend mudar um DTO.
3. Verificar que `next-frontend/.gitignore` não exclui `lib/api/schema.d.ts`; acrescentar exceção se necessário.
4. Confirmar que `next-frontend/tsconfig.json` mantém `module: esnext` e `moduleResolution: bundler` — pré-requisito do `openapi-typescript` registrado em `library-refs.md` → `### openapi-typescript` → "Instalação e requisitos". A configuração atual já satisfaz; a ação é de verificação, não de ajuste.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/lib/api/schema.d.ts` existe no repositório e está rastreado pelo git (`git ls-files` o lista).
- O arquivo gerado exporta `paths`, `components` e `operations`, e `components["schemas"]` contém os nomes de schema do `openapi.json` verbatim.
- `docker compose exec next-frontend npx tsc --noEmit` retorna exit 0 com o arquivo gerado presente.
- Reexecutar `scripts/generate-api-types.sh` sem alterar `nestjs-project/openapi.json` não produz diff em `next-frontend/lib/api/schema.d.ts`.

---

### SI-2 — Check de drift entre a spec e os tipos versionados (Infra)

**Description:** Entrega a metade de controle da Option A da `TD-01` — o mecanismo que faz um `.d.ts` defasado falhar em vez de passar silenciosamente.

**Technical actions:**

1. Criar `scripts/check-api-types-drift.sh` na raiz — regera os tipos para um destino temporário a partir de `nestjs-project/openapi.json` e compara com `next-frontend/lib/api/schema.d.ts`, saindo com código diferente de zero quando divergirem (per `next-frontend-api-typing/TD-01`).
2. Documentar os dois scripts no `CLAUDE.md` da raiz: quando rodar `generate-api-types.sh` (após qualquer `npm run openapi:generate` no `nestjs-project`, per `openapi-spec/TD-04`) e o que significa o `check` falhar.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-1

**Acceptance criteria:**

- Com `next-frontend/lib/api/schema.d.ts` em dia, `scripts/check-api-types-drift.sh` sai com código 0 e não escreve no arquivo versionado.
- Com o arquivo versionado alterado à mão, o script sai com código diferente de zero e nomeia o arquivo divergente na saída.
- O script não deixa artefato temporário no diretório de trabalho após a execução (`git status` permanece limpo em ambos os casos).

**Pendência declarada — sem host de CI.** A `TD-01` decidiu "o CI regenera e falha se o resultado diferir do commitado", mas o repositório **não tem pipeline de CI algum** (nenhum `.github/workflows`, `.gitlab-ci.yml` ou `.circleci`) e nenhum TD escolheu um provedor. Este SI entrega o check como script executável e agnóstico de provedor — o que é a substância da decisão e é verificável hoje. A ligação a um pipeline real fica pendente de uma decisão de tooling própria, que não pertence ao escopo desta task.

---

### SI-3 — Módulo de contrato do BFF (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-api-typing/TD-02 — Contrato do BFF para os componentes — tipagem das chamadas `/api/...``

**Description:** Cria a superfície que os componentes consomem, derivada dos tipos gerados, para que o contrato BFF↔componente seja honesto sobre o que o BFF de fato devolve.

**Technical actions:**

1. Criar `next-frontend/lib/api/contracts.ts` implementando o snippet de Setup do `### Frontend Runtime` → `#### next-frontend-api-typing/TD-02`, com o conteúdo F2-load-bearing byte-verbatim: o acessor `paths[...]["...""]["responses"][200]["content"]["application/json"]` e a derivação por `Pick`/`Omit`/`Extract`. Imports e demais boilerplate são derivados pelo implementador.
2. Documentar a convenção no `next-frontend/CLAUDE.md` § API Integration: `components/` e `hooks/` importam **apenas** de `lib/api/contracts.ts`; `lib/api/schema.d.ts` é artefato gerado e nunca é importado diretamente nem editado à mão.

**Tests:** _(empty — Setup SI; smoke-gated by AC; o módulo é apenas de tipos, sem branching de runtime — per `## Testing Requirements`, `lib/` só exige `*.test.ts` quando há ramificação.)_

**Dependencies:** SI-1 — `contracts.ts` importa de `lib/api/schema.d.ts`, que só existe após a geração. _(Desvia do contrato canônico `Dependencies: —` do template de Setup de Frontend Runtime: aqui o pré-requisito é real e intra-task, e declará-lo é mais correto que omiti-lo.)_

**Acceptance criteria:**

- `next-frontend/lib/api/contracts.ts` existe e exporta ao menos um tipo derivado de `paths` por utility type, sem nenhum campo redigitado à mão.
- `docker compose exec next-frontend npx tsc --noEmit` retorna exit 0.
- Remover um campo de um DTO em `nestjs-project`, regerar a spec e regerar os tipos faz o `tsc` do frontend falhar apontando a derivação afetada — a rede de segurança da `openapi-spec/TD-05` está ativa.
- Nenhum arquivo em `components/` ou `hooks/` importa de `lib/api/schema.d.ts` (verificável por grep).

---

### SI-4 — Registrar a política de ausência de validação de runtime (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### next-frontend-api-typing/TD-03 — Validação de runtime na fronteira BFF↔NestJS`

**Description:** Torna explícita e auditável a decisão de não validar em runtime, para que a ausência seja lida como escolha registrada e não como esquecimento.

**Technical actions:**

1. Registrar no `next-frontend/CLAUDE.md` § API Integration: os route handlers repassam o corpo do `nestjs-api` tipado apenas em build; não há parse de runtime na fronteira HTTP (per `next-frontend-api-typing/TD-03`, Option A). Incluir o risco aceito (resposta fora do contrato vira `undefined` silencioso longe da causa) e o gatilho de reavaliação — a existência de codegen de schemas Zod **a partir da spec**.
2. Delimitar o alcance no mesmo registro: `lib/env.ts` continua validando com Zod em runtime por `next-frontend-env-config/TD-01`; a decisão trata da fronteira HTTP, não da de ambiente.

**Tests:** _(empty — Setup SI; a decisão é a ausência deliberada de código de validação, sem superfície a exercitar.)_

**Dependencies:** —

**Acceptance criteria:**

- `next-frontend/CLAUDE.md` § API Integration declara a ausência de validação de runtime na fronteira BFF↔NestJS, nomeia o risco aceito e nomeia o gatilho de reavaliação.
- O registro distingue explicitamente a fronteira HTTP da validação de ambiente de `lib/env.ts`.
- Não existe nenhum schema Zod de resposta HTTP em `next-frontend/` (verificável por grep) — a ausência é o estado decidido.

---

## Technical Specifications

### Frontend Runtime

#### next-frontend-api-typing/TD-02 — Contrato do BFF para os componentes — tipagem das chamadas `/api/...`

**Pattern:** dado que o `openapi.json` e os DTOs já são a fonte de verdade upstream, derivar por utility types entrega a honestidade da Option C com o custo da Option A, e é a única que mantém o vínculo de build sem inventar infraestrutura; a Option D é sedutora mas paga engenharia de tipos própria para resolver a metade fácil do problema, e a Option A já nasce errada no primeiro endpoint do projeto que é `auth`.

**Setup:** um módulo `lib/api/contracts.ts` escrito à mão que declara o contrato de cada rota `/api/...` **derivando** dos tipos gerados, nunca redigitando campos. O acessor upstream é o canônico do `openapi-typescript` (ver `library-refs.md` → `openapi-typescript` → "Forma dos tipos gerados").

```ts
// next-frontend/lib/api/contracts.ts
import type { paths } from "@/lib/api/schema"

// Fronteira NestJS↔BFF — acessor canônico sobre os tipos gerados.
type LoginUpstream = paths["/auth/login"]["post"]["responses"][200]["content"]["application/json"]

// Fronteira BFF↔componente — derivada, nunca redigitada.
export type LoginBffResponse = Pick<LoginUpstream, /* campos que o BFF reexpõe */>
```

A lista concreta de campos de cada `Pick`/`Omit` **não é fixada por nenhum TD** — ela é lida do schema gerado no momento em que cada route handler existir. O que a decisão fixa é a obrigação de derivar: remover um campo no DTO do backend deve quebrar o `Pick` em build.

**Aplicação:** não há superfície de UI nesta task (`ui_in_scope: logic-only`), então o alvo é declarado por padrão de arquivo e por capacidade futura:

- **Adota o padrão:** todo route handler em `next-frontend/app/api/**/route.ts` (a superfície do BFF) e todo componente ou hook que consuma uma rota relativa `/api/...` por `next-frontend-env-config/TD-04`. Cada rota nova registra seu contrato em `lib/api/contracts.ts` no mesmo commit em que o handler nasce.
- **Fronteiras / exclusões:**
  - Streaming e download de vídeo (Fases 03 e 05) — ficam fora da decisão de base URL da `next-frontend-env-config/TD-04` e, por consequência, fora deste contrato; exigirão decisão própria quando o object storage entrar em escopo.
  - `lib/api/schema.d.ts` — artefato **gerado** pela TD-01; nunca editado à mão e nunca importado diretamente por `components/` ou `hooks/`, que falam apenas com `contracts.ts`.

**Migração:**

_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._ Não existe nenhum route handler em `next-frontend/app/` ainda (registrado como fato no documento de decisões), então a adoção é greenfield, sem migração.

**Verificação:**

- **Unit:** o `Pick`/`Omit` de cada rota resolve para um tipo não-vazio — provado por `npx tsc --noEmit`, que é a rede de segurança que a `openapi-spec/TD-05` escolheu; um campo removido no DTO upstream quebra a derivação em build.
- **Integration:** os testes de route handler (`*.integration.test.ts` com MSW, per `## Testing Requirements`) asseguram que o corpo devolvido ao browser satisfaz o tipo declarado em `contracts.ts` — o handler é importado e chamado direto, e o fake MSW responde com o shape upstream.
- **E2E:** não aplicável nesta task — sem tela que exercite o contrato ponta a ponta.
- **Regression guards:** `npx tsc --noEmit` e `npm run lint` devem continuar em verde após a introdução do módulo, incluindo o `npm run build`.

#### next-frontend-api-typing/TD-03 — Validação de runtime na fronteira BFF↔NestJS

**Pattern:** o risco que as Options B e C endereçam é o de spec defasada, e esse risco tem uma correção mais barata e mais a montante (o check de drift do TD-01, mais a conferência da resposta de `/auth/login` no backend); introduzir schemas Zod à mão agora recria a segunda fonte de verdade que a `openapi-spec/TD-05` foi escolhida para eliminar. Reavaliar quando existir codegen de schemas Zod **a partir da spec** — aí a Option C passa a custar quase nada e a recomendação muda.

**Setup:** _nenhum artefato de setup — a Option A é a ausência deliberada de validação._ Não há módulo de schemas, nenhuma dependência nova e nenhum passo de parse na fronteira; o `zod@^4.4.3` já instalado por `next-frontend-env-config/TD-02` permanece restrito ao seu uso atual em `lib/env.ts`.

**Aplicação:** vale para toda a fronteira BFF↔NestJS — cada route handler em `next-frontend/app/api/**/route.ts` repassa o corpo recebido do `nestjs-api` tipado apenas em build, sem parse em runtime.

- **Fronteiras / exclusões:**
  - `lib/env.ts` — continua validando em runtime com Zod por `next-frontend-env-config/TD-01`; esta decisão trata da fronteira HTTP, não da de ambiente.
  - A reavaliação está condicionada a um gatilho explícito: a existência de codegen de schemas Zod **a partir da spec**. Até lá, reabrir a discussão sem esse gatilho contraria a decisão.

**Migração:**

_No existing files require refactor — Setup SI is the only application of this pattern in the current phase._ A decisão é a manutenção do estado atual (ausência de validação), e não há route handler existente a alterar.

**Verificação:**

- **Unit:** não aplicável — não há código de validação a exercitar.
- **Integration:** os testes de route handler com MSW documentam o comportamento aceito: um corpo upstream fora do contrato **não** é rejeitado na fronteira. O que os testes provam é o caminho feliz e a propagação de erro do upstream, não um parse.
- **E2E:** não aplicável nesta task.
- **Regression guards:** o `onUnhandledRequest: "error"` do MSW (per `next-frontend/CLAUDE.md` § Testing) continua sendo a única barreira que impede um teste de alcançar o `nestjs-api` real — ela não substitui validação de contrato, e essa distinção deve permanecer explícita para quem reavaliar esta decisão.

**Risco aceito e registrado:** uma resposta fora do contrato vira `undefined` silencioso lá na frente, num componente, longe da causa. A mitigação escolhida é a montante — o check de drift do TD-01 — e depende de uma pendência do backend: o `openapi.json` atual declara `RegisterResponseDto` como resposta do `POST /auth/login`, o que merece conferência do lado do NestJS.

---

## Dependency Map

```
SI-1 (root) — gera lib/api/schema.d.ts
├── SI-2 — depends on SI-1 (o check compara contra o arquivo versionado por SI-1)
└── SI-3 — depends on SI-1 (contracts.ts importa os tipos gerados)
SI-4 (root, independente) — registro de política, sem artefato de código
```

---

## Deliverables

- [ ] SI-1 — Gerar os tipos do contrato a partir do `openapi.json` (Infra)
- [ ] SI-2 — Check de drift entre a spec e os tipos versionados (Infra)
- [ ] SI-3 — Módulo de contrato do BFF (Setup)
- [ ] SI-4 — Registrar a política de ausência de validação de runtime (Setup)

**Full test suites:**

- [ ] Type-check passa (`docker compose exec next-frontend npx tsc --noEmit`) — é a rede de segurança central desta task, per `openapi-spec/TD-05`.
- [ ] Lint passa (`docker compose exec next-frontend npm run lint`).
- [ ] Build passa (`docker compose exec next-frontend npm run build`).
- [ ] Testes do `next-frontend` passam (`docker compose exec next-frontend npm test`) — **bloqueado**: o script `test` e o Vitest ainda não existem (`next-frontend/CLAUDE.md` § Testing). Desbloqueado pela task de base do MSW; nenhum SI desta task produz artefato testável por runner, então o bloqueio não impede a entrega.

_`nestjs-project/` não entra nos deliverables: é o produtor do `openapi.json`, já entregue por `task-openapi-spec`, e esta task não adiciona artefato de backend._
