# task-next-frontend-env-config — Progress

**Status:** completed
**SIs:** 5/5 completed

## Final verification

- `docker compose exec next-frontend npx tsc --noEmit` — exit 0.
- `docker compose exec next-frontend npm run lint` — limpo, sem findings.
- `docker compose exec next-frontend npm run build` — sucesso (rotas `/`, `/_not-found`, `/login`, todas estáticas).
- `docker compose exec next-frontend npm test` — **não executado**: o script não existe. Bloqueio previsto no plano (§ Deliverables) e desbloqueado pela task de MSW.

Observações da verificação final:

- **Segunda ocorrência do mesmo problema de ownership.** O `npm run build` falhou na primeira tentativa com `EACCES: permission denied, open '/home/node/app/next-env.d.ts'` — o arquivo pertencia ao uid do host, como o `tsconfig.tsbuildinfo` no SI-3. Corrigido com `chown node:node`. São dois arquivos que o `next-frontend/CLAUDE.md` § "Installing Dependencies Inside the Container" não cobre no passo de `chown`, e ambos quebram comandos rotineiros dentro do container. O passo canônico deveria ser `chown -R node:node node_modules .next tsconfig.tsbuildinfo next-env.d.ts`.
- **O build não exercita `lib/env.ts` em runtime.** Nenhuma página ou route handler importa o módulo ainda, então a validação do `createEnv` nunca roda durante o `next build`. O módulo está type-checked e compilado, mas o comportamento de derrubar o boot com `API_BASE_URL` ausente ou inválida permanece não provado por execução — é exatamente o que o contrato de teste diferido do SI-3 cobre.

### SI-1 — Alinhar os arquivos de ambiente com a decisão de BFF
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - Ação técnica 2 (editar `next-frontend/.env`) foi no-op — o arquivo não existe no repositório; só `.env.example` está presente.
  - `CLAUDE.md` da raiz (linha 42) ainda descreve as duas base URLs e a exceção do browser como regra vigente — ficou desatualizado pela TD-04. Fora do escopo deste SI (as ações técnicas citam apenas `next-frontend/CLAUDE.md`); merece task própria.
  - `.claude/skills/testing-guide-next-frontend/references/external-systems.md` (linha 86) instrui fixtures MSW a usarem `NEXT_PUBLIC_API_BASE_URL` para testes de client component — também desatualizado pela TD-04 e fora do escopo. Relevante para a task de MSW.

### SI-2 — Biblioteca de validação do schema de ambiente (Setup)
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - Os containers estavam todos parados no início do SI; subi a stack com `docker compose up -d next-frontend` (o Compose puxou `db`, `mailpit` e `nestjs-api` junto por dependência).
  - O usuário autorizou o procedimento root+chown para os três installs da task (`zod`, `@t3-oss/env-nextjs`, `@next/env`), não só para este SI.
  - `npm install` reportou 5 vulnerabilidades pré-existentes (1 moderate, 4 high) na árvore do `next-frontend`. Não são introduzidas por `zod` e corrigi-las está fora do escopo desta task — vale uma task própria de `npm audit`.

### SI-3 — Módulo de configuração tipada com fronteira server/client (Setup)
- **Status:** completed
- **Tests:** diferidos por decisão do usuário — ver observação abaixo
- **Observations:**
  - **Conflito do plano, resolvido pelo usuário.** O SI-3 exigia criar `lib/__tests__/env.test.ts` **e** que `npx tsc --noEmit` passasse, mas `vitest` não está instalado (o ferramental pertence à task de MSW, per SI-5 e `AMB-1`). Escrever o teste produzia `TS2307: Cannot find module 'vitest'`, violando o AC de type-check. O usuário decidiu **adiar o arquivo de teste para quando o Vitest for instalado**. O teste foi escrito, validado contra os demais erros de tipo e então removido; `lib/env.ts` foi entregue sem ele.
  - **Contrato de teste devido pela task de MSW** para `lib/env.ts` — quatro casos, todos exercendo a validação no momento da importação (`vi.resetModules()` + `await import("../env")` por caso), e todos rodando sob `environment: "node"`, nunca jsdom (ver a armadilha de fronteira abaixo): (1) ambiente válido expõe `config.api.baseUrl` com o valor validado; (2) `API_BASE_URL` ausente rejeita a importação com erro que nomeia a variável; (3) `API_BASE_URL` com valor não-URL rejeita a importação; (4) `API_BASE_URL=""` rejeita a importação, provando `emptyStringAsUndefined: true`. _(Corrigido na passada de `/simplify`: a redação original assertava `env.API_BASE_URL` e `env.NODE_ENV`, mas o SI-4 tornou `config` o único export — o contrato era insatisfazível.)_
  - **Armadilha de fronteira server/client nos testes.** `@t3-oss/env-core` decide server vs client por `typeof window === "undefined"`. Sob jsdom a guarda dispara e a simples importação de `@/lib/env` lança, porque `config` dereferencia `env.API_BASE_URL` na avaliação do módulo. Testes que importam este módulo precisam de `environment: "node"`; testes de browser (hooks, client components) interceptam a rota relativa do BFF em vez da base URL upstream.
  - **Armadilha de tipo registrada para quem reescrever o teste:** `ProcessEnv` declara `NODE_ENV` como readonly, então `process.env.NODE_ENV = "test"` não compila. A saída é um cast local — `const testEnv = () => process.env as Record<string, string | undefined>`.
  - `tsconfig.tsbuildinfo` estava com owner do host (`saulo_santos`, uid 1001) e quebrava `npx tsc --noEmit` dentro do container com `TS5033 EACCES`. Corrigido com `chown node:node`. O procedimento do `next-frontend/CLAUDE.md` § Installing Dependencies cobre só `node_modules` e `.next` — vale estender o passo de `chown` para incluir `tsconfig.tsbuildinfo`.
  - `env` foi exportado via `export { env }` (statement separado, preservando o snippet do Setup byte-verbatim). O SI-4 remove esse export ao promover `config` a superfície pública, conforme o AC do SI-4.
  - ACs 2 e 3 (importação derruba o processo com variável ausente / valor não-URL) **não foram verificados por execução** — não há runner. Ficam provados quando o contrato de teste acima rodar.

### SI-4 — Organização das variáveis por domínio no objeto exportado (Setup)
- **Status:** completed
- **Tests:** diferidos — mesma decisão do SI-3 (Vitest ainda não instalado)
- **Observations:**
  - `export { env }`, adicionado no SI-3 apenas como superfície de teste, foi removido: `config` é agora o único export de `lib/env.ts`, satisfazendo o AC de que o schema plano não é superfície pública.
  - **AC do `as const` verificado por execução**, não por leitura: criei um probe temporário (`lib/__readonly-probe.ts`) atribuindo a `config.api.baseUrl`, confirmei `TS2540: Cannot assign to 'baseUrl' because it is a read-only property` e removi o arquivo. `tsc --noEmit` volta a exit 0.
  - **Contrato de teste devido pela task de MSW** para o export `config` — dois casos: (1) `config.api.baseUrl` reflete o valor validado por `createEnv`; (2) a reatribuição de `config.api.baseUrl` falha no type-check (já provado pelo probe acima; o teste passa a ser regressão).

### SI-5 — Convenção de carregamento de env no ambiente de teste (Setup)
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - **Ação técnica não prevista, exigida pelo AC-3.** `next-frontend/.gitignore` ignora `.env*` com exceção só para `!.env.example`, então o `.env.test` recém-criado nascia ignorado. Acrescentei `!.env.test` ao `.gitignore` — sem isso o AC "não é ignorado por `.gitignore`" era inalcançável. Verificado com `git check-ignore -v` (última regra casada é a negação) e com `git status`, que lista o arquivo como untracked.
  - `@next/env` foi declarado em **devDependencies**, não em `dependencies`: seu único consumidor é `loadEnvConfig()` no `vitest.config.ts`, que é ferramental de teste e não entra no bundle de produção. Pinado em `^16.2.12` para casar com a versão de `next` e evitar divergência de cascata de env entre runtime e suite.
  - Escopo respeitado conforme a observação do plano: a linha `loadEnvConfig(process.cwd())` **não** foi entregue — `vitest.config.ts` não existe e sua criação pertence à task de MSW.

## Follow-ups resolvidos após a verificação final

A pedido do usuário, os itens fora de escopo levantados durante a task foram corrigidos numa passada separada, depois de a task fechar.

- **`chown` do container (SI-3 + verificação final).** `next-frontend/CLAUDE.md` § "Installing Dependencies Inside the Container" agora inclui `tsconfig.tsbuildinfo` e `next-env.d.ts` no passo 2, com a explicação de por que esses dois arquivos derivam de ownership do host e as duas mensagens de erro exatas (`TS5033` no `tsc`, `EACCES` no `build`) que o sintoma produz.
- **`CLAUDE.md` da raiz.** O parágrafo de exceção do browser foi reescrito: o fato de rede (browser fora da rede Compose) permanece, mas a conclusão passa a ser a da `next-frontend-env-config/TD-04` — rotas relativas para o BFF, uma única base URL server-side, sem `NEXT_PUBLIC_*`. O carve-out de streaming/download das Fases 03 e 05 ficou explícito.
- **Skill `testing-guide-next-frontend`.** Corrigida em quatro arquivos: `references/external-systems.md` § "API_BASE_URL — single source of truth" foi reescrita para a realidade de URL única; os templates de `mocks/handlers.ts`, `artifacts/hooks.md` e `artifacts/route-handlers.md` passaram de `process.env.API_BASE_URL ?? "http://api.test"` para `import { config } from "@/lib/env"` + `config.api.baseUrl`; e a anti-pattern correspondente no `SKILL.md` foi endurecida para proibir também a leitura direta de `process.env`.
- **Citação `openapi-spec/TD-07` → `TD-05`.** A mesma troca já feita no `next-frontend/CLAUDE.md` pelo SI-1 foi aplicada aos dois pontos remanescentes na skill de testes (`SKILL.md` e o heading de `references/external-systems.md`). As demais ocorrências de `TD-07` no repositório são usos corretos (respostas de erro) ou registro histórico em docs de decisão.
- **`npm audit`: 5 → 3.** `npm audit fix` (não-breaking) resolveu `hono` (moderate) e `nanoid` (high). `tsc`, `lint` e `build` revalidados em verde depois.

Pendências que exigem decisão do usuário, não corrigidas:

- **3 vulnerabilidades high remanescentes** (`postcss`, `sharp`, e `next` por depender das duas) só têm correção via `npm audit fix --force`, que instala `next@16.3.1` — fora do pin `16.2.12` e desalinhado de `eslint-config-next` e `@next/env`. É upgrade de framework, não patch.
- **A validação de env continua não provada por execução** — depende de instalar o Vitest, que o usuário optou por adiar.
