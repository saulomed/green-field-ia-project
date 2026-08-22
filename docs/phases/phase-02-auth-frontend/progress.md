# phase-02-auth-frontend — Progress

**Status:** in_progress
**SIs:** 21/27 completed

### SI-02.0.1 — Infra: instalar os primitives shadcn em lote
- **Status:** completed
- **Tests:** no tests (infra)
- **Observations:**
  - `checkbox.tsx` scaffoldado pelo shadcn importava `CheckIcon` de `lucide-react` (proibido pelo projeto); substituído por SVG inline genérico. Reconciliação completa com o Figma (cores, radius, variantes) fica para o drift audit de `/signup` (SI-02.15.0/15a), que já lista `checkbox.tsx (new)` no Reused DS.

### SI-02.0.2 — Custom-ui: icon-button.tsx
- **Status:** completed
- **Tests:** 2 passing
- **Observations:**
  - Instalada `@testing-library/user-event` (devDependency ausente) para seguir o padrão de client-components.md; autorizado pelo usuário o passo de root no container.
  - Consultado `get_design_context` no node Figma `I143:2435;82:6685` — confirma botão redondo 40px com slot de ícone 24px; implementado com uma única variante ("standard") já que nenhuma outra é consumida nesta fase.

### SI-02.0.3 — Custom-ui: progress-linear.tsx
- **Status:** completed
- **Tests:** no tests (apresentacional puro)
- **Observations:** none

### SI-02.0.4 — Ícones: arrow-back.tsx + eye.tsx
- **Status:** completed
- **Tests:** no tests (ícones não recebem teste)
- **Observations:**
  - **Design gap real:** não existe nó `visibility_off` em nenhum lugar do arquivo Figma (verificado via `get_metadata` na página "Icons" completa — só há `remove_red_eye`, node 143:344). `EyeOffIcon` foi implementado com o path padrão do Material Symbols "visibility_off" (mesma linguagem visual do restante do conjunto de ícones do projeto, que já é uma curadoria do Material Symbols), não um export Figma verbatim. Recomenda-se reportar essa lacuna ao time de design para adicionar o nó correspondente.

### SI-02.1 — Normalizar o envelope de erro do nestjs-project e propagar o contrato
- **Status:** completed
- **Tests:** 5 unit (filter) + 2 e2e novos (error-envelope) + 45 e2e passando no total (10 suítes, sem regressão)
- **Observations:**
  - `main.ts` e `test/support/create-test-app.ts` também precisaram mudar (não listados nas Technical actions, que citavam só o filtro) — o `exceptionFactory` do `ValidationPipe` precisava parar de juntar as violações num único texto para preservar `field` por violação, que o filtro então normaliza em `details`. `create-test-app.ts` foi atualizado em espelho (seu próprio docstring diz "wired the same way main.ts does").
  - As 5 suítes e2e que duplicam manualmente a config do `ValidationPipe` (`auth-register`, `auth-login`, `auth-confirm`, `auth-session`, `validation`) **não foram editadas**, per acceptance criteria — continuam com o `exceptionFactory` antigo (`error: 'Bad Request'`), então continuam passando sem tocar nelas. Isso significa que essas 5 specs não exercitam mais o comportamento real do `main.ts` para o caminho de validação — é uma divergência de teste pré-existente (elas já duplicavam a config em vez de usar `createTestApp()`), não introduzida por esta mudança, mas vale registrar como débito técnico para uma migração futura para `createTestApp()`.
  - A prova e2e do novo formato (`message` string + `details`) foi colocada em um arquivo novo (`test/error-envelope.e2e-spec.ts`, via `createTestApp()`) em vez de estender uma suíte existente, para respeitar literalmente "sem edição" das 8 suítes pré-existentes.
  - `npx tsc --noEmit` no backend tem erros de tipagem pré-existentes e não relacionados (em `auth.service.spec.ts`, `session.service.spec.ts`, `api-error.decorators.spec.ts`, `database.config.spec.ts`, `mail.service.spec.ts`) — fora do escopo desta SI; recomenda-se tarefa separada.
  - `docker compose run --rm nestjs-api npm run migration:run` foi executado (necessário para os e2e rodarem no ambiente local, que não tinha schema) — criou as tabelas `users`, `channels`, `refresh_tokens`, `password_reset_tokens` no banco de dev/test compartilhado.

### SI-02.3 — Propagação dos cookies de sessão até o browser
- **Status:** completed
- **Tests:** 8 passing
- **Observations:**
  - API desenhada como funções puras (`reissueSessionCookie`, `clearAuthCookies`, `readSessionCookie`) operando sobre `NextResponse`/`NextRequest` explícitos, em vez de `next/headers` `cookies()` — mantém o módulo testável sem contexto de requisição ambiente e agnóstico ao nome do cookie (lido do `Set-Cookie` upstream, nunca hardcoded).
  - `clearAuthCookies` usa `response.cookies.delete()`, que expira o cookie (valor vazio + `expires` no passado) em vez de removê-lo do `Set-Cookie` — é o único jeito de "limpar" um cookie via HTTP; teste inicial tinha expectativa errada (esperava `undefined`), corrigido.

### SI-02.8 — Provisionamento do stack E2E
- **Status:** completed
- **Tests:** no tests (Setup SI) — 1 smoke e2e criado à parte para provar a fiação (`tests/stack-smoke.e2e-spec.ts`)
- **Observations:**
  - `@playwright/test` instalado, `test:e2e` adicionado ao `package.json`, `playwright.config.ts` e `tests/auth.setup.ts` (helper de polling do Mailpit + `seedConfirmedSession`, sem consumidor ainda nesta fase — todas as 3 telas são anônimas) criados.
  - `MAILPIT_URL` adicionado a `.env.example` como env var só de E2E (não passa por `lib/env.ts`/`t3-oss/env-nextjs` — esse módulo é validação de runtime da app, não do harness de teste).
  - Bug de interop corrigido em `playwright.config.ts`: `import nextEnv from "@next/env"` (padrão usado em `vitest.config.mts`) falhava no carregador de config do Playwright (`_env.default` undefined); trocado para named import `import { loadEnvConfig } from "@next/env"`, que funciona porque este arquivo é compilado para CJS pelo Playwright (motivo diferente do `.mts`, que é ESM nativo).
  - **Não criei `next-frontend/.env` permanente** — um `.env` real (mesmo que só para verificação) é injetado pelo `env_file` do Compose no ambiente de todo o container, o que quebrou um teste pré-existente (`lib/__tests__/env.test.ts`) porque `.env.test` deixa de vencer a cascata quando há um `.env` real presente. Para verificar a AC, as env vars foram passadas só para o comando do e2e via `docker compose exec -e ...`, nunca persistidas. Cada dev deve criar seu próprio `next-frontend/.env` local (gitignored) a partir de `.env.example` para rodar `test:e2e` de verdade.
  - `test-results/` e `playwright-report/` adicionados ao `.gitignore` (artefatos do Playwright, não existiam antes).
  - **Incidente de permissão corrigido:** um subagent, sem autorização, rodou `chown -R node:node /home/node/app` (o bind mount de todo `next-frontend/`) para contornar um EACCES do Playwright ao recriar `test-results/`/`playwright-report/` — isso trocou o dono do diretório no host de `saulo_santos` (1001) para uid 1000 (inexistente no host). Revertido para `1001:1001`; a correção real e mínima foi `chmod o+w` (não-recursivo) só no diretório `next-frontend/`, permitindo ao uid do container criar/remover essas duas pastas sem depender de ownership.

### SI-02.2 — Cliente HTTP do BFF para o nestjs-api
- **Status:** completed
- **Tests:** no tests (Setup SI, garantido por tsc --noEmit)
- **Observations:** none

### SI-02.6 — Formulários: React Hook Form + schema Zod tipado contra o contrato
- **Status:** completed
- **Tests:** 24 passing
- **Observations:**
  - **Divergência de contrato resolvida com o usuário:** o plano documenta `name` no body de `POST /api/auth/register` e no UI Contract de `/signup`, mas o `RegisterDto` real do backend só tem `email`+`password`. Por decisão do usuário, o schema de signup segue o backend real — `name` não é enviado à API. Se a tela `/signup` (SI-02.15) tiver um campo "Full Name" no Figma, ele será um campo só-de-UI, não vinculado a este schema. **↳ Revertido em 2026-08-22, depois da SI-02.15b:** o usuário optou por persistir o nome. O backend ganhou `users.name` e o `RegisterDto` passou a exigir `name`; o campo é validado pelo `signupSchema` e enviado à API. Ver as Observations da SI-02.15b.
  - `lib/api/contracts.ts` ganhou um novo reexport (`ErrorCode`, derivado de `components["schemas"]["ErrorCode"]`) — necessário para `error-map.ts` tipar contra o enum de domínio sem redigitar os códigos.

### SI-02.7 — Fronteira de guarda de sessão
- **Status:** completed
- **Tests:** no tests (Setup SI, matcher vazio nesta slice)
- **Observations:** none

### SI-02.9 — Ciclo de vida do banco entre execuções E2E
- **Status:** completed
- **Tests:** no tests (Setup SI)
- **Observations:** a prova plena da AC de repetibilidade (duas execuções consecutivas sem limpeza) só é observável quando existirem specs reais que criam conta (SI-02.15b em diante) — `stack-smoke.e2e-spec.ts` (SI-02.8) não cria conta.

### SI-02.5 — Fundação dos route handlers do BFF
- **Status:** completed
- **Tests:** 6 passing (passthrough + route.integration)
- **Observations:**
  - **Bug real corrigido em `lib/api/client.ts` (SI-02.2):** `openapi-fetch`'s `createClient` captura `globalThis.fetch` no momento da criação do cliente (parâmetro default `baseFetch = globalThis.fetch`), que acontece na importação do módulo — antes do `server.listen()` do MSW rodar em teste. Isso fazia toda chamada vazar para DNS real (`ENOTFOUND nestjs-api.test`) em vez de ser interceptada. Corrigido passando `fetch: (...args) => globalThis.fetch(...args)`, que resolve o global em tempo de chamada. Suíte completa (46 testes) re-verificada sem regressão.
  - `lib/api/contracts.ts` ganhou o contrato de `POST /api/auth/register` (`RegisterBffRequest`/`RegisterBffResponse`/`RegisterBffErrorStatus`/`RegisterBffErrorResponse`); `signup-schema.ts` (SI-02.6) atualizado para importar `RegisterBffRequest` em vez de derivar `paths` localmente.
  - `mocks/handlers.ts` ganhou o fixture de caminho feliz para `/auth/register` (201, sem cookie).

### SI-02.4 — Renovação do access token
- **Status:** completed
- **Tests:** 3 novos (single-flight + retry) + 49 passando no total (suíte completa)
- **Observations:**
  - **Desvio de design do próprio TD:** o snippet de Setup do `auth-frontend/TD-04` sugeria usar `next/headers`'s `cookies()` (ambiente) para ler/escrever cookies dentro do middleware. Isso quebraria a testabilidade — o padrão do projeto testa route handlers importando-os e chamando diretamente, sem contexto de requisição real do Next, e `cookies()` lança fora desse contexto. Redesenhado para operar só sobre `Request`/`Response`: o middleware lê o `refresh_token` do header `Cookie` da chamada original, chama `/auth/refresh` via `fetch` puro, e anexa as `Set-Cookie` da renovação à resposta final devolvida por `api.GET(...)` — quem chama (o handler de `GET /api/users/me`, SI-02.14) é responsável por reemiti-las na própria `NextResponse`, do mesmo jeito que os outros handlers.
  - **Implicação para SI-02.14:** o handler de `GET /api/users/me` deve (a) repassar o header `Cookie` da requisição recebida para `api.GET("/users/me", {headers: {cookie: ...}})`, e (b) verificar `response.headers.getSetCookie()` e reemitir via `reissueSessionCookie(nextResponse.cookies, ...)` quando presente (sinal de que o refresh reativo rodou).
  - `lib/api/cookies.ts` generalizado: `reissueSessionCookie`/`clearAuthCookies` agora aceitam qualquer `CookieStore` (`{set, delete}`) em vez de exigir um `NextResponse` — cobre tanto `response.cookies` quanto o store de `(await cookies())`. Call sites de `cookies.test.ts` (SI-02.3) atualizados para `response.cookies`.

### SI-02.10 — Handler POST /api/auth/login
- **Status:** completed
- **Tests:** 5 passing (54 no total, sem regressão)
- **Observations:** none

### SI-02.11 — Handler POST /api/auth/forgot-password
- **Status:** completed
- **Tests:** 4 passing (58 no total, sem regressão)
- **Observations:** `lib/api/contracts.ts` ganhou o contrato de `POST /api/auth/forgot-password`; `forgot-password-schema.ts` (SI-02.6) atualizado para importar `ForgotPasswordBffRequest` em vez de derivar `paths` localmente.

### SI-02.12 — Handler POST /api/auth/resend-confirmation
- **Status:** completed
- **Tests:** 3 passing (62 no total, sem regressão)
- **Observations:**
  - **Outro drift do mesmo tipo (name/register):** o plano descreve `409 EMAIL_JA_CONFIRMADO` para `resend-confirmation`, mas esse código pertence ao endpoint `confirm` (diferido nesta fase) — o `AuthService.resendConfirmation` real nunca lança essa exceção, sempre `204` (no-op silencioso para conta inexistente/já confirmada). Implementado seguindo o backend real, sem o cenário 409, consistente com a decisão já tomada para o campo `name`.
  - **Bug real corrigido em `lib/api/passthrough.ts` (SI-02.5):** `NextResponse.json(undefined, ...)` lança `TypeError: Value is not JSON serializable` quando tanto `data` quanto `error` são `undefined` (respostas `204`). Corrigido com um branch que devolve `new NextResponse(null, {status})` quando o corpo é `undefined`. Isso também permitiu simplificar o handler de `forgot-password` (SI-02.11), removendo o special-case manual de 204 que eu tinha escrito lá — agora usa `passthrough()` diretamente, como o padrão pede.

### SI-02.13 — Handler POST /api/auth/refresh
- **Status:** completed
- **Tests:** 3 passing (65 no total, sem regressão)
- **Observations:** none

### SI-02.14 — Handler GET /api/users/me
- **Status:** completed
- **Tests:** 4 passing (69 no total, sem regressão)
- **Observations:**
  - Handler repassa o header `Cookie` recebido para `api.GET("/users/me", ...)` e reemite qualquer `Set-Cookie` presente na resposta upstream via `reissueSessionCookie`, exatamente como antecipado nas Observations da SI-02.4 — nenhuma surpresa de integração.
  - Teste de integração cobre as 4 ACs do plano: `200` verbatim, `401` upstream → refresh `200` → repetição devolve `200` (sem o caller ver o `401` intermediário), `401` upstream → refresh `401` propaga `401`, e `404` verbatim.
  - Esta é a última SI não-visual da fase — a partir daqui todas as SIs restantes (`SI-02.15.0` em diante) são de tela.

### SI-02.15.0 — Drift audit: Tela de cadastro de conta
- **Status:** completed
- **Tests:** no tests (audit-only; o relatório é o deliverable)
- **Observations:**
  - Criado `frontend-drift-report.md` com a seção `## Screen: signup` — 13 componentes auditados: 7 `alinhado`, 1 `drift menor` (`progress-linear.tsx`), 3 `drift relevante` (`text-field.tsx`, `card.tsx`, `checkbox.tsx`), 2 `componente ausente` (`signup-form.tsx`, `signup-success-panel.tsx`). Coluna `Prior` toda `_(none)_` — é a primeira auditoria da fase, não há `prior_decisions` nem CONFLICT possível.
  - **A skill `figma:figma-implement-design` citada na Technical action 1 não existe** — o plugin do Figma expõe `figma-design-to-code` (a direção read-from-Figma). Executado com essa skill + `get_design_context` no nó `140:333`; o procedimento da auditoria (enum de 4 valores, política de Decision, schema do relatório) está descrito por extenso no próprio SI e em `.claude/skills/plan-build/references/frontend-drift-report-schema.md`, então a ausência da skill não bloqueou nada. Vale corrigir o nome nas SIs `SI-02.16.0` e `SI-02.17.0`.
  - `card.tsx` e `checkbox.tsx` chegaram como scaffold do `npx shadcn add` (SI-02.0.1) e nunca foram reconciliados — daí o `drift relevante`. Isso confirma a pendência já anotada na SI-02.0.1 sobre o `checkbox.tsx`.
  - **Drift não emitido como bullet (fora do escopo do primitive):** o `Card` em disco injeta `py-(--card-spacing)` e `gap-(--card-spacing)`, enquanto o nó Figma `143:2400` não declara padding algum — o espaçamento (`px-6 py-10 gap-6`) pertence ao frame `143:2399` que envolve o Card. É composição de tela, resolvida em SI-02.15a pelo consumidor, não retune do primitive.
  - `--radius-0-5` (2px) não tem utilitário Tailwind (`rounded-0.5` compila para nada, per `.claude/rules/frontend-design-system.md`), por isso o bullet do `Checkbox` pede `rounded-[var(--radius-0-5)]` em vez de um nome de escala.
  - `.claude/rules/frontend-design-system.md` não tem seção "Variant Name Aliases (Figma → code)" — mapa de aliases vazio, então só as formas 1 (retune exato) e 3 (aditiva) do schema se aplicam; nenhuma forma 2 foi emitida.
  - AC verificada: `git diff --name-only HEAD -- next-frontend` vazio ao fim do SI (o relatório mora na pasta do plano, fora do subprojeto).

### SI-02.15a — Tela de cadastro de conta (visual shell)
- **Status:** completed
- **Tests:** no tests (shell smoke-gated pelo build); suíte existente sem regressão — 69 passando
- **Observations:**
  - Decisões de drift aplicadas mecanicamente: `text-field.tsx` (slot `trailing` + `min-w-[200px]`), `card.tsx` (radius, borda, min-width, radius dos filhos `img`), `progress-linear.tsx` (wrapper de 12px com a barra de 4px centrada), `checkbox.tsx` (5 retunes). Os dois `create` foram cumpridos pela ação 2.
  - **`Updated existing DS` fora dos bullets do relatório:** `CardHeader` (`rounded-t-xl`) e `CardFooter` (`rounded-b-xl`) ficaram com o radius shadcn depois do retune do container para `rounded-2`. Não são utilitários com prefixo de variante, então o *post-edit variant-conflict guard* não dispara; mas deixá-los divergentes criaria contradição interna no mesmo arquivo. Retunados para `rounded-t-2` / `rounded-b-2`. O relatório de drift **não** foi reescrito retroativamente, conforme o schema.
  - `text-field.tsx` deixou de ser um `<input>` nu: o frame (altura, borda, fundo, radius) migrou para um wrapper e o input ficou transparente dentro dele, que é a estrutura do próprio Figma (`Text field` → `State-layer` → `Content` + `Trailing icon`). O anel de foco virou `has-[input:focus-visible]:shadow-focus-ring` no wrapper para não acender quando o toggle de senha recebe foco. `app/login/page.tsx`, único consumidor anterior, não passava `className` e não precisou de ajuste.
  - `signup-form.tsx` já nasceu com `"use client"` — `ProgressLinear` e `Checkbox` são primitives Radix e não renderizam a partir de um Server Component. Isso antecipa a ação 1 da SI-02.15b, mas era condição para o shell compilar.
  - `SignupSuccessPanel` não tem nó no Figma (lacuna de design registrada no `context.md`): compus copy e layout a partir da escala tipográfica da própria tela, per `auth-frontend/TD-09`. O botão de reenvio ainda não está ligado.
  - Fronteira do swap form↔painel: `page.tsx` permanece Server Component com `Card` + seta de voltar + `BrandLogo` + `AuthFooter`; o `SignupForm` é quem troca o corpo pelo painel na SI-02.15b. Mantém a fronteira de cliente o mais profunda possível, per `next-frontend/CLAUDE.md` § Architecture.
  - A seta de voltar aponta para `/` — nem o Figma nem o UI Contract definem o destino.
  - **Bloqueio pré-existente, fora do escopo desta SI:** `npm run build` falha com `Invalid environment variables: API_BASE_URL` porque `next-frontend/.env` não existe (o `compose.yaml` marca o `env_file` como `required: false`) e os route handlers importam `lib/api/client.ts`, que valida o env em tempo de import. Quebrado desde a SI-02.10, não por esta SI. Verificado com `-e API_BASE_URL=http://nestjs-api:3000`: build passa, `/signup` pré-renderiza como estático. **↳ Resolvido em 2026-08-22** — ver o bloco "Bloqueio do build" nas Observations da SI-02.15b.
  - ACs verificadas: `npx tsc --noEmit` limpo, `npm run lint` só com o warning pré-existente em `lib/forms/__tests__/schemas.test.ts`, `npm run check:tokens` OK, e screenshot da `/signup` conferida contra o nó `140:333` — composição, espaçamentos e tipografia batem dentro da tolerância do DS.

### SI-02.15b — Tela de cadastro de conta (lógica & wiring)
- **Status:** completed
- **Tests:** 13 novos (9 em `signup-form.test.tsx`, 4 em `signup-success-panel.test.tsx`); 82 no total, sem regressão
- **Observations:**
  - **Campo `name` passou a ser persistido** (decisão do usuário tomada logo após esta SI, revertendo a da SI-02.6). O `name` entrou no `signupSchema`, é validado (obrigatório, ≤255) e vai no corpo do `POST` — a ação 4 do plano voltou a valer como escrita. A mudança de backend que a viabilizou está descrita no bloco "Persistência do `name`" abaixo.
  - **`EMAIL_JA_CONFIRMADO` não é alcançável pelo backend real:** `resendConfirmation` no `auth.service.ts` sempre devolve `204` para conta inexistente ou já confirmada, por design de não revelar estado (nota já registrada no próprio route handler da SI-02.12). O `409` é tratado pelo ramo genérico de erro em vez de ganhar copy própria; o teste da linha correspondente do plano cobre esse caminho. Só o `429` tem tratamento distinto — cooldown —, que é o que a AC exige.
  - `lib/forms/signup-schema.ts` precisou de um ajuste de tipo: a anotação era `z.ZodType<Out>`, que deixa o input `unknown` e faz o `zodResolver` degradar o `useForm` para `FieldValues` (3 erros de `tsc`). Passou a `z.ZodType<SignupFields, SignupFields>`. Comportamento idêntico — os 12 testes de `schemas.test.ts` seguem passando. **`login-schema.ts` e `forgot-password-schema.ts` têm a mesma anotação e vão esbarrar nisso nas SIs 02.16b e 02.17b.**
  - `vitest.setup.dom.ts` ganhou um stub de `ResizeObserver`: o `jsdom` não o implementa e os primitives Radix medem os nós com ele (`@radix-ui/react-use-size`), então renderizar o `<Checkbox>` lançava na fase de layout effects. É buraco de ambiente da lane, não dependência do teste.
  - `mocks/bff-handlers.ts` deixou de estar vazio — ganhou o caminho feliz de `/api/auth/register` (`201`) e `/api/auth/resend-confirmation` (`204`), como o próprio docstring do arquivo previa. Desfechos de erro ficam em `server.use(...)` por teste.
  - Gate do submit implementado com `mode: "onChange"` + `disabled={!termsAccepted || !isValid || isSubmitting}`, per a AC. Efeito colateral: o botão nasce desabilitado, antes de o usuário tocar em qualquer campo.
  - Heurística de força de senha vive dentro do `signup-form.tsx` (privada ao módulo), não em `lib/` — evita criar um artefato de `lib/` que exigiria arquivo de teste próprio, e ela é coberta pelos testes do componente. As duas copies mais fortes ("Fair"/"Strong") são invenção do implementador: o Figma só desenha o estado fraco.
  - E2E da tela (`next-frontend/specs/signup.plan.md`) é autorado externamente por `/plan-test-specs`, fora desta SI.
  - ACs verificadas: 84 testes passando no frontend (191 unit + 45 E2E no backend), `tsc --noEmit` limpo nos dois lados, `lint` só com o warning pré-existente, `check:tokens` OK, `check-api-types-drift.sh` OK e `npm run build` verde sem injeção manual de env.

#### Bloqueio do build — resolvido (2026-08-22)

- `next-frontend/.env` criado a partir do `.env.example`. O arquivo é gitignored, então o passo entrou no `next-frontend/CLAUDE.md` § Development Environment junto com a explicação da falha.
- O bloco `env_file` do `compose.yaml` foi **removido**, não corrigido. Injetar o `.env` como ambiente do container sombreia a cascata do `@next/env`: o loader do Next nunca sobrescreve variável já presente em `process.env`, então `.env.test` deixava de valer e `lib/__tests__/env.test.ts` passava a ler o valor de desenvolvimento. Nada precisa da injeção — `next build`/`dev`/`start`, `vitest.config.mts` e `playwright.config.ts` chamam `loadEnvConfig` por conta própria. O motivo ficou comentado no próprio `compose.yaml`.
- `npm run build` agora passa sem nenhuma injeção manual de env.

#### Persistência do `name` — mudança fora do plano da fase (2026-08-22)

Pedida pelo usuário depois da SI-02.15b, com a opção "`users.name` + semear `channel.name`" escolhida entre três alternativas apresentadas.

- **Backend (`nestjs-project`, slice `auth` — fora do escopo desta fase):** `User` ganhou a coluna `name` (varchar 255, NOT NULL); `RegisterDto` ganhou `name` (`@IsString`, `@Length(1, 255)`); `CreateUserInput` e `usersService.create` passam a persistir; `channelService.createForUser` passou a semear `channel.name` a partir de `user.name` em vez do prefixo do e-mail. Efeito colateral desejado: o e-mail de confirmação, que já saudava por `channel.name`, passa a usar o nome real.
- **Migration `1787426798153-AddUserName`:** a CLI gerou um `ADD ... NOT NULL` seco, que quebra em qualquer banco com contas existentes. Reescrita à mão em três passos (adiciona nullable → backfill de `channels.name`, com fallback no prefixo do e-mail → `SET NOT NULL`), que é caso legítimo de data migration — a CLI não expressa backfill. Rodada com sucesso no banco de dev.
- **Contrato:** `openapi.json` regenerado e `next-frontend/lib/api/schema.d.ts` propagado por `./scripts/generate-api-types.sh`. O `RegisterBffRequest` derivado quebrou o build do frontend exatamente onde deveria — no `signupSchema`, que declara `RegisterBffRequest & { confirmPassword }`. É a rede de segurança do contrato funcionando.
- **Testes ajustados:** `auth.service.spec` e `channel.service.spec` (fixtures); os quatro specs que fazem `INSERT INTO users` cru; e os E2E que chamam `POST /auth/register`. Cuidado necessário: `whitelist`/`forbidNonWhitelisted` do `ValidationPipe` rejeita `name` em `POST /auth/login`, então só os registers receberam o campo.
- **Correção fora de escopo:** `api-error.decorators.spec.ts` afirmava que `ErrorResponseDto` tem exatamente `statusCode`/`error`/`message`. O commit `c062a64` (SI-02.1) adicionou `details` e deixou a asserção defasada — a suíte do backend já estava vermelha antes desta mudança. Assertion atualizada.

### SI-02.16.0 — Drift audit: Tela de login
- **Status:** pending

### SI-02.16a — Tela de login (visual shell)
- **Status:** pending

### SI-02.16b — Tela de login (lógica & wiring)
- **Status:** pending

### SI-02.17.0 — Drift audit: Tela de solicitação de redefinição de senha
- **Status:** pending

### SI-02.17a — Tela de solicitação de redefinição de senha (visual shell)
- **Status:** pending

### SI-02.17b — Tela de solicitação de redefinição de senha (lógica & wiring)
- **Status:** pending
