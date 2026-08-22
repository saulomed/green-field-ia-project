# phase-02-auth-frontend — Progress

**Status:** completed
**SIs:** 27/27 completed

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
- **Status:** completed
- **Tests:** no tests (audit-only; o relatório é o entregável)
- **Observations:**
  - A ação técnica 1 nomeia a skill `figma:figma-implement-design`, que não existe — mesma pendência já registrada em SI-02.15.0. Auditoria feita com `figma-design-to-code` + `get_design_context` no nó `138:179`; nada ficou bloqueado, porque o procedimento está descrito no próprio SI e no schema do relatório. SI-02.17.0 repete o nome errado.
  - Cinco dos seis componentes reusados voltaram `alinhado` com `Prior` "honored" — o esperado, já que a tela de login não pede nada além do que `/signup` já exigiu. Nenhum `CONFLICT`: as duas telas concordam em todas as dimensões auditadas.
  - Único drift: `card.tsx` perdeu o `min-w-[280px]` da base quando o `/simplify` de SI-02.15b o moveu para o call site. O nó `143:1250` pede o mesmo valor no mesmo lugar, então a decisão é `exception` (não `auto-Edit`) — reinstalar na base duplicaria uma restrição de composição. SI-02.16a deve aplicar `min-w-[280px]` no `Card` da página, como `/signup` faz.
  - `app/login/page.tsx` já existe de fase anterior e monta o cartão com um `div` cru (`rounded-2 border border-border bg-card`) em vez do `Card`. SI-02.16a substitui a árvore, conforme a ação técnica 2 já antecipa.
  - Inconsistência de copy confirmada no Figma: o placeholder do campo de senha (`147:540`) diz "Enter your email". A página em disco já usa "Enter your password". **Confirmado pelo usuário em 2026-08-22 como erro do design**; a página em disco já está correta e o Figma é que precisa ser ajustado. SI-02.16a herda a decisão.
  - `git diff --name-only HEAD -- next-frontend` vazio ao fim do SI, como exige a AC.

### SI-02.16a — Tela de login (visual shell)
- **Status:** completed
- **Tests:** no tests (shell aferido pelo build; unit em SI-02.16b, E2E por `/plan-test-specs`)
- **Observations:**
  - Ação 1 (aplicar as decisões de drift) foi um no-op de código: as seis linhas do relatório são `skip` ×5 + `exception` ×1. O `min-w-[280px]` do `Card` entrou no call site da página, como a `exception` determina.
  - `app/login/page.tsx` foi reescrita: o cartão feito de `div` cru (`rounded-2 border border-border bg-card`) virou `<Card>`, e o formulário saiu da página para `components/login-form.tsx`. Nenhum nó novo do Figma foi introduzido — é a mesma árvore, agora pelo primitive.
  - Grupo da senha (`147:537`) montado como uma única linha `flex-wrap` com `justify-between`: label à esquerda, "Forgot password?" à direita e o `TextField` (que já é `w-full`) quebrando para a linha de baixo. É a tradução direta do `content-start flex flex-wrap` do Figma, sem wrapper extra.
  - Placeholder da senha mantido em "Enter your password", divergindo do Figma (`147:540` diz "Enter your email"). A inconsistência já estava registrada no inventário e no SI; reproduzi-la seria copiar um erro de copy evidente. **Confirmado pelo usuário em 2026-08-22 como erro do design** — nenhuma mudança de código foi necessária, e o ajuste pendente é no arquivo Figma.
  - **Verificação visual não executada:** os browsers do Playwright vivem em `/home/node/.cache/ms-playwright`, fora do bind mount, e foram apagados quando o container foi recriado para a mudança de `env_file` (SI-02.15b). A AC "a renderização corresponde ao nó `138:179`" fica aferida só pelo build e pela paridade estrutural com `/signup`, que foi verificada visualmente. Restaurar com `docker compose exec next-frontend npx playwright install chromium`.
  - `npx tsc --noEmit`, `npm run build`, `npm run check:tokens` e `npm run lint` passam (lint com o único warning pré-existente de `_password`).

### SI-02.16b — Tela de login (lógica & wiring)
- **Status:** completed
- **Tests:** 10 novos em `components/__tests__/login-form.test.tsx`; 94 passando no total (17 arquivos, sem regressão)
- **Observations:**
  - **Duas extrações de reuso**, feitas aqui porque a tela de login precisava das duas peças e duplicá-las seria pior do que mexer no código de `/signup`:
    - `hooks/use-resend-confirmation.ts` — a máquina de estados do reenvio (`idle`/`sending`/`sent`/`cooldown`/`error`) saiu do `SignupSuccessPanel`. As duas telas chamam o mesmo endpoint com os mesmos desfechos; a nota de contrato sobre o `409` que o backend nunca devolve foi junto.
    - `components/form-field.tsx` — o `Field` local do `signup-form.tsx` virou `FormField` compartilhado, com um slot `action` novo para o "Forgot password?" na linha do label. `PasswordField` continua local ao signup, porque o nó de login não tem o toggle de visibilidade.
  - **Destino pós-login:** nenhuma TD desta slice decide para onde ir depois do `200`. Implementado como `router.replace("/")` + `router.refresh()` — `/` é a única outra rota que existe, e o `refresh` faz os Server Components rerenderizarem já com a sessão. Escolha do implementador, registrada no docblock.
  - `CREDENCIAIS_INVALIDAS` cai em `root.serverError` sem tocar em `aria-invalid` de nenhum campo — dois testes cobrem isso, e um deles compara o texto exibido para senha errada e para e-mail desconhecido, provando que são idênticos. Sai de graça do `error-map.ts`, que só mapeia `EMAIL_JA_EXISTE` para campo.
  - O CTA de reenvio só aparece no `403 EMAIL_NAO_CONFIRMADO`, e o e-mail que ele reenvia é o que falhou no submit, guardado em estado — não o valor corrente do input, que o usuário pode ter editado depois. Superfície sem nó no Figma; copy e posicionamento são decisão do implementador, como o SI já previa.
  - `mocks/bff-handlers.ts` ganhou o caminho feliz de `POST /api/auth/login`, com o corpo amarrado por `satisfies LoginBffResponse`. O fake não declara cookie: o BFF os reemite e nada no browser os lê.
  - `useRouter` é mockado no teste (não tem implementação fora do runtime do Next). Os `vi.fn()` são de módulo — o factory do `vi.mock` é içado e não fecha sobre estado por teste —, então a contagem de chamadas vaza entre testes sem um `mockClear` no `beforeEach`; primeira rodada falhou exatamente por isso.
  - `npm test` (94), `npx tsc --noEmit`, `npm run build`, `npm run lint` (só o warning pré-existente de `_password`) e `npm run check:tokens` passam. O E2E de `specs/login.plan.md` continua sendo autoria externa do `/plan-test-specs`, e o lane E2E segue sem browsers instalados.

### SI-02.17.0 — Drift audit: Tela de solicitação de redefinição de senha
- **Status:** completed
- **Tests:** no tests (audit-only; o relatório é o entregável)
- **Observations:**
  - Terceira ocorrência do nome de skill errado (`figma:figma-implement-design`) nas Technical actions; auditoria feita com `figma-design-to-code` + `get_design_context` no nó `140:289`, como nas duas anteriores.
  - Seis dos sete componentes reusados voltaram `alinhado`. Nenhum `CONFLICT` em toda a fase: as três telas concordam em todas as dimensões auditadas, o que era o esperado — elas compartilham o mesmo cartão de autenticação.
  - `card.tsx` repete o `drift menor`/`exception` de SI-02.16.0, com `Prior` apontando para lá em vez de para SI-02.15.0 — a lineage segue a decisão mais recente sobre a mesma dimensão.
  - `ArrowBackIcon` aparece nesta tela (`143:2343`, 24px em `left-16/top-16`) com a mesma geometria de `/signup`; `alinhado`.
  - **Duas inconsistências de copy confirmadas no Figma**, ambas já registradas no inventário e ainda sem resposta de quem desenhou: o `AuthFooter` (`2394:2276`) pergunta "Remember your password?" mas rotula o link como "Sign up" — quem lembrou a senha quer entrar, não se cadastrar; e o destino do `BackLink` (`143:2343`) não está definido em nenhum lugar. SI-02.17a decidiu os dois; **o usuário confirmou em 2026-08-22 que o design está de fato errado.**
  - A AC pede `git diff --name-only HEAD -- next-frontend` vazio. Ele lista os arquivos de SI-02.16a/16b, que ainda não foram commitados — **nenhum deles foi tocado por este SI**, que não escreveu uma linha de código. A intenção da AC (auditoria não edita código) está satisfeita; a checagem literal só passaria com a árvore limpa.

### SI-02.17a — Tela de solicitação de redefinição de senha (visual shell)
- **Status:** completed
- **Tests:** no tests (shell aferido pelo build; unit em SI-02.17b, E2E por `/plan-test-specs`)
- **Observations:**
  - Ação 1 foi um no-op de código, como em SI-02.16a: sete linhas do relatório, seis `skip` e uma `exception`. O `min-w-[280px]` do `Card` entrou no call site.
  - **As duas inconsistências de copy foram decididas por mim, com autorização do usuário ("pode seguir como que você achar coerente"), e registradas no docblock da página:**
    - `AuthFooter`: o Figma emparelha "Remember your password?" com um link "Sign up". Quem lembrou a senha quer entrar, não se cadastrar — o link virou "Sign in" apontando para `/login`.
    - Back arrow (`143:2343`): sem destino no design. `/login` é a única tela que linka para cá, então é para lá que ele volta.
  - `h1` e a linha de apoio ficaram **dentro** do `ForgotPasswordForm`, não na página — assim SI-02.17b troca o bloco inteiro pela confirmação pós-envio, como `/signup` faz com o painel de sucesso. Diferente de `/login`, onde o `h1` ficou na página porque nada o substitui.
  - Nenhuma rota `/reset-password` foi criada; o build lista só `/forgot-password` e o handler `/api/auth/forgot-password`. A tela de redefinição segue diferida.
  - `npx tsc --noEmit`, `npm run build` e `npm run check:tokens` passam. Verificação visual segue indisponível (browsers do Playwright ausentes, mesma pendência de SI-02.16a).

### SI-02.17b — Tela de solicitação de redefinição de senha (lógica & wiring)
- **Status:** completed
- **Tests:** 6 novos em `components/__tests__/forgot-password-form.test.tsx`; 100 passando no total no frontend (18 arquivos), 191 unit + 45 e2e no backend, sem regressão
- **Observations:**
  - **A tela tem um único estado pós-submit, e isso é a feature.** O backend responde `204` exista ou não a conta, então não há nada em que ramificar — a UI não pode revelar o que não lhe foi contado. O `RequestSubmittedPanel` foi redigido nessa restrição: diz o que aconteceria *se* o endereço pertencesse a uma conta, nunca que um e-mail foi enviado. Copy é decisão do implementador (nenhum nó no Figma, e nenhuma TD fechou o texto, diferente de `/signup`).
  - O teste de indistinguibilidade compara o texto das duas telas com o próprio endereço removido de cada uma, provando que só o eco do e-mail difere. Comparar os textos crus passaria por acidente ou falharia por acidente, dependendo do endereço escolhido.
  - `429` e o `400` do `ValidationPipe` caem em `root.serverError` sem marcar `aria-invalid` no campo — o erro não pode virar canal lateral sobre a existência da conta. Sai de graça do `error-map.ts`; nenhum código de domínio alcança esta rota (o endpoint só declara `204`/`400`/`429`).
  - Um teste cobre resposta de erro **sem envelope** (`500` com corpo vazio), caminho que o `?? "Something went wrong."` já tratava mas que nenhuma das outras duas telas exercitava.
  - `mocks/bff-handlers.ts` ganhou o `204` de `POST /api/auth/forgot-password`. O fake não oferece um segundo desfecho de sucesso porque o contrato não tem um.
  - Verificação completa desta SI: frontend `npm test` (100), `npx tsc --noEmit`, `npm run build`, `npm run lint` (só o warning pré-existente de `_password`), `npm run check:tokens` e `./scripts/check-api-types-drift.sh`; backend `npm test` (191) e `npm run test:e2e` (45).
  - **Copy do Figma — resolvido (2026-08-22):** o usuário confirmou que as duas inconsistências (`AuthFooter` de `/forgot-password` rotulando "Sign up" sob "Remember your password?"; placeholder "Enter your email" no campo de senha de `/login`) são erros do design, e não do código. As três telas já divergiam do Figma nesses dois pontos por decisão registrada, então **nenhuma mudança de código foi necessária** — o ajuste que resta é no arquivo Figma, fora do alcance deste repositório.
  - **Playwright — resolvido (2026-08-22):** o lane E2E voltou a rodar (`npm run test:e2e`, 1 passando — só o smoke existe; os três specs de tela ainda são autoria externa do `/plan-test-specs`). Foram três problemas encadeados, todos corrigidos na infraestrutura em vez de por passo manual:
    1. **Bibliotecas de sistema ausentes.** A imagem `node:*-slim` não traz as dependências do Chromium; o binário morria com `libglib-2.0.so.0: cannot open shared object file`. A lista de `npx playwright install-deps --dry-run chromium` foi para o `Dockerfile.dev`, no root do build — instalá-la no container em execução exige `apt-get` como root e se perde na recriação seguinte.
    2. **Índice apt velho.** Com o `apt update` numa camada própria e o `apt install` em outra, o build quebrava com 404 nos `.deb` (o mirror publicou revisão nova; a camada cacheada apontava para versões que saíram do pool). Os dois viraram um `RUN` só.
    3. **Browsers apagados a cada recriação.** Eles vivem em `~/.cache/ms-playwright`, fora do bind mount. Agora há o volume nomeado `playwright-browsers` no `compose.yaml`. O diretório precisou ser criado no Dockerfile como `node`: um volume nomeado herda dono e permissões do diretório correspondente **na imagem**, e sem isso o Docker o materializava pertencente a root, com `npx playwright install` falhando em `EACCES ... __dirlock`.
  - **Verificação visual feita (2026-08-22):** as três telas foram renderizadas do build de produção e conferidas contra os nós do Figma. `/login` e `/forgot-password` batem com `138:179` e `140:289` na estrutura e nos tokens; as duas divergências de copy são as intencionais, já confirmadas pelo usuário.
