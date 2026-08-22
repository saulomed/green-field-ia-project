---
kind: phase
name: phase-02-auth-frontend
sources_mtime:
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-auth-frontend.md: "2026-08-18T22:04:39Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T14:35:43Z"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15T19:59:53Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/phases/phase-01-config/context.md: "2026-08-08T20:55:11Z"
  docs/phases/phase-02-auth/context.md: "2026-08-22T12:58:26Z"
  docs/phases/phase-02-auth/library-refs.md: "2026-08-22T13:01:14Z"
  docs/inventories/screen-inventory-phase-02-auth-frontend.md: "2026-08-17T18:54:57Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-15T19:51:14Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# phase-02-auth-frontend — Context

## Scope

**Phase name:** Cadastro, Login e Gerenciamento de Conta

**Slice:** `auth-frontend` — as telas de auth no `next-frontend`, sua submissão através do BFF (route handlers do Next) e a mecânica de sessão no cliente. Slice de frontend da Fase 02, dependente da slice `auth` (`depends_on_slices: [auth]`).

**Capabilities** (literal, `covers_capabilities` da doc de decisões da slice):

- Telas de cadastro, login, confirmação de conta e recuperação de senha

**Capabilities da fase completa** (literal, `docs/project-plan.md` — as sete primeiras pertencem à slice irmã `auth`):

- Serviço de envio de e-mails transacionais
- Cadastro de usuário com e-mail e senha
- Criação automática do canal do usuário a partir do prefixo do e-mail
- Confirmação de conta via e-mail com link de ativação
- Login e controle de sessão do usuário
- Logout
- Recuperação de senha: solicitação via e-mail → link com token → redefinição
- Telas de cadastro, login, confirmação de conta e recuperação de senha

**Out of scope:** _Não especificado no `project-plan.md`._ Dentro da capability desta slice, duas superfícies estão explicitamente adiadas e registradas em `## Non-UI / Deferred Capabilities`: a tela de confirmação de conta (`auth-frontend/TD-07`, Adiada) e a tela de redefinição de senha `/reset-password` (lacuna de design). O slice entrega `/signup`, `/login` e `/forgot-password`.

**Deliverables:** fluxo completo de cadastro → confirmação → login → recuperação de senha funcionando. Canal criado automaticamente para cada usuário. _(Deliverable declarado no plano para a fase inteira; a parte desta slice é a superfície de UI dos fluxos de cadastro, login e solicitação de recuperação.)_

**Affected subprojects:**

- `next-frontend` — todo o escopo de implementação desta slice: as telas, os route handlers do BFF que as servem e a mecânica de sessão no cliente (`auth-frontend/TD-01` a `TD-11`)
- `nestjs-project` — sem TD de implementação própria nesta slice, mas alcançado por decisões cross-layer: `auth-frontend/TD-03` (propagação dos cookies de sessão), `auth-frontend/TD-11` (promoção dos códigos de domínio a `enum` no `ErrorResponseDto`) e as três TDs de `http-error-contract`, cujo envelope decidido implica alterar `src/common/filters/http-exception.filter.ts`

**Deferred subprojects:** _None._

**Sequencing notes:** "Depende de: Fase 01". Dentro da Fase 02, esta slice depende da slice `auth`, cuja API de auth já está entregue e não é reaberta aqui.

**Neighbors (for boundary detection only):**

- **Phase 01:** Preparação de toda a fundação do projeto: repositório, ambiente de desenvolvimento, projetos Next.js e Nest.js, banco de dados PostgreSQL e serviços auxiliares.
- **Phase 03:** Upload e Processamento de Vídeos — "Depende de: Fase 01, Fase 02"

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries | Renders in |
|-----|--------|-------|-------|--------|----------|-----------|------------|
| auth-frontend/TD-01 | phase | Frontend | Mecanismo de submissão dos formulários de auth | decided | A | — | frontend-runtime |
| auth-frontend/TD-02 | phase | Frontend | Cliente HTTP do BFF para o `nestjs-api` | decided | A | openapi-fetch | frontend-runtime |
| auth-frontend/TD-03 | phase | Cross-layer | Propagação dos cookies de sessão até o browser | decided | B | — | frontend-runtime |
| auth-frontend/TD-04 | phase | Frontend | Renovação do access token — onde e quando | decided | A | — | frontend-runtime |
| auth-frontend/TD-05 | phase | Frontend | Fronteira de guarda — como o app sabe que há sessão | decided | A | — | frontend-runtime |
| auth-frontend/TD-06 | phase | Frontend | Formulários — biblioteca e origem do schema | decided | A | react-hook-form, @hookform/resolvers, zod | frontend-runtime |
| auth-frontend/TD-07 | phase | Cross-layer | Destino do link de confirmação de conta e tela | decided | Adiada | — | — |
|     └─ Last revision: 2026-08-18 — Recommendation reescrita para refletir o adiamento; o texto original… | | | | | | | |
| auth-frontend/TD-08 | phase | Frontend | Provisionamento do stack E2E e semeadura de sessão | decided | A | @playwright/test | frontend-runtime |
| auth-frontend/TD-09 | phase | Frontend | Destino do usuário após o cadastro bem-sucedido | decided | A | — | — |
| auth-frontend/TD-10 | phase | Frontend | Ciclo de vida do estado do banco entre execuções E2E | decided | A | — | frontend-runtime |
| auth-frontend/TD-11 | phase | Cross-layer | Formato do corpo de erro que o BFF devolve ao browser | decided | A | — | — |
| http-error-contract/TD-01 | ad-hoc | Cross-layer | Shape do envelope de resposta de erro HTTP | decided | B | — | — |
|     └─ Last revision: 2026-08-22 — Registrado que o campo `details` é contrato pr… | | | | | | | |
| http-error-contract/TD-02 | ad-hoc | Cross-layer | Tipo do campo `message` — string única vs array | decided | A | — | — |
|     └─ Last revision: 2026-08-22 — Campo `Capability:` estendido com o bullet "Te… | | | | | | | |
| http-error-contract/TD-03 | ad-hoc | Cross-layer | Como o frontend consome o catálogo de códigos | decided | A | @nestjs/swagger, openapi-typescript | — |
|     └─ Last revision: 2026-08-22 — Campo `Capability:` estendido com o bullet "Te… | | | | | | | |

_Source files:_

- auth-frontend — `docs/decisions/technical-decisions-auth-frontend.md` (scope_type: phase, related_phases: [2])
- http-error-contract — `docs/decisions/technical-decisions-http-error-contract.md` (scope_type: ad-hoc, related_phases: [2])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Telas de cadastro, login, confirmação de conta e recuperação de senha | auth-frontend/TD-01, auth-frontend/TD-02, auth-frontend/TD-03, auth-frontend/TD-04, auth-frontend/TD-05, auth-frontend/TD-06, auth-frontend/TD-07, auth-frontend/TD-08, auth-frontend/TD-09, auth-frontend/TD-10, auth-frontend/TD-11, http-error-contract/TD-01, http-error-contract/TD-02, http-error-contract/TD-03 |

_A slice declara `covers_capabilities` com um único bullet. As onze TDs de `auth-frontend` o citam literalmente no campo `Capability:`; as três de `http-error-contract` passaram a cobri-lo em 2026-08-22, quando o `Capability: Transversal — covers:` de cada uma foi estendido com o bullet das telas (validation.md IC-6, resolvido por Revision nas três). A doc `http-error-contract` é `ad-hoc` com `related_phases: [2]`, então é de escopo corrente nas duas slices da fase: cobre os bullets de backend pela slice `auth` e o bullet das telas por esta._

## Decisions Detail

### auth-frontend/TD-01

**Recommendation:** não por superioridade técnica intrínseca (a Option B é o idioma mais moderno e ganha em progressive enhancement), mas porque três tasks já entregues materializaram a fronteira `/api/...`: o contrato do login já está escrito em `contracts.ts`, o arquivo de fake das rotas relativas já existe vazio esperando o primeiro handler, e as regras de teste do `next-frontend/CLAUDE.md` descrevem essa forma em detalhe. Trocar agora paga em retrabalho de fundação por um benefício — funcionar sem JS — que o projeto nunca pediu.
**Renders in:** frontend-runtime
**Libraries:** —

### auth-frontend/TD-02

**Recommendation:** o diferimento registrado tinha um gatilho explícito e ele foi atingido; adotar agora fecha a cadeia contract-driven no único elo que ainda estava solto (o ponto de chamada) e dá um lugar único, e não repetido por handler, para a mecânica das TD-03 e TD-04.
**Renders in:** frontend-runtime
**Libraries:** openapi-fetch

### auth-frontend/TD-03

**Recommendation:** o descasamento de `path` é estrutural, não um bug: os caminhos da API são dela e nunca vão coincidir com os do BFF. Reemitir na camada que encara o browser resolve isso, mais o `Secure` em desenvolvimento, sem revisar um backend já entregue; e ler nome/TTL do `Set-Cookie` upstream mantém o backend como dono dos valores, preservando o princípio de não duplicar contrato.
**Renders in:** frontend-runtime
**Libraries:** —

### auth-frontend/TD-04

**Recommendation:** neste slice a única chamada autenticada é `/users/me`, então a janela de concorrência é estreita e o custo do *single-flight* é baixo; e o gatilho reativo (401 real) é o único que não presume conhecer a expiração. A Option B passa a valer a pena quando a Fase 04 trouxer telas protegidas de verdade, e as duas compõem sem conflito — o proxy decide se redireciona, o BFF decide se renova.
**Renders in:** frontend-runtime
**Libraries:** —

### auth-frontend/TD-05

**Recommendation:** Option A para a lógica de redirecionamento deste slice — é barata, é o padrão documentado e é a única que cobre prefetch; a autorização de verdade continua sendo do backend, que já responde 401 corretamente. A Option B entra por cima na Fase 04, quando existir uma superfície protegida cujo conteúdo dependa do usuário: as duas são complementares (otimista no proxy, real no layout), não alternativas.
**Renders in:** frontend-runtime
**Libraries:** —

### auth-frontend/TD-06

**Recommendation:** Option A, com o schema **tipado contra `contracts.ts`** e não escrito solto. É a combinação que dá UX por campo sem abrir a segunda fonte de verdade: se o backend mudar a forma do payload, o `tsc --noEmit` acusa no schema em vez de o formulário passar a postar um corpo errado silenciosamente. Fica registrado que o schema do cliente é afordância de UX — a autoridade sobre a regra (incluindo a política de senha) permanece no backend, que revalida sempre.
**Renders in:** frontend-runtime
**Libraries:** react-hook-form, @hookform/resolvers, zod

### auth-frontend/TD-07

**Recommendation:** Nenhuma das três opções neste slice. As três resolvem um problema que não está aberto: `auth/TD-09` já entrega um fluxo de confirmação funcional (o link do e-mail aponta direto para `GET /auth/confirm`, e a revisão de 2026-07-18 removeu deliberadamente a tela intermediária por ela não ter nada a pedir ao usuário). A Option A reintroduziria essa tela e exigiria mudar o `204` para `302` no backend — custo de contrato cross-layer por uma superfície que não pede input; a Option B a desloca sem resolver a pré-busca por scanner; a Option C põe apresentação na API. O slice já carrega a lacuna de design de `/reset-password` e a do painel de sucesso do cadastro; abrir uma terceira, com backend a reboque, não se justifica aqui. A tela de confirmação fica registrada como capability diferida e volta quando houver design e um motivo para o usuário aterrissar nela.
**Libraries:** —

**Revisions:**
- 2026-08-18 — Recommendation reescrita para refletir o adiamento; o texto original, que recomendava a Option A e mandava abrir uma Revision em `auth/TD-06` para a mudança de `204` para `302`, fica preservado aqui: _"Option A — entrega a tela que a capability pede sem desfazer a razão da revisão anterior (o token continua sendo assunto exclusivo do backend) e reaproveita a `APP_BASE_URL` já configurada. Ao decidir esta TD, registrar a Revision correspondente em `auth/TD-06` descrevendo a mudança de `204` para `302`."_ Rationale: Recommendation realinhada à decisão de adiamento — o `## Decisions Detail` do `context.md` carrega apenas a Recommendation, e é dela que o `/plan-build` extrai a prosa das ações técnicas, de modo que a divergência entre recomendar a Option A e ter decidido Adiada faria o build redigir SIs para entregar uma tela diferida (IC-5).

### auth-frontend/TD-08

**Recommendation:** os fluxos de confirmação e de recuperação de senha só são verificáveis com e-mail real, e o Mailpit já está no ambiente exatamente para isso; a Option B pagaria o preço de um navegador para provar o que já está provado. O ruído de atribuição do stack completo é aceitável num monorepo onde as duas pontas versionam juntas.
**Renders in:** frontend-runtime
**Libraries:** @playwright/test

### auth-frontend/TD-09

**Recommendation:** o 403 do backend torna a Option B um beco sem saída disfarçado de próximo passo, e a Option C abre uma segunda lacuna de design no slice que já tem uma. Permanecer na tela é o menor delta: um estado a acrescentar numa tela que já existe no Figma, com o reenvio de confirmação ao alcance. Ao decidir esta TD, registrar que o inventário `screen-inventory-phase-02-auth-frontend` precisa de um extension run para o estado de sucesso do cadastro — o mesmo extension run que a TD-07 já demanda, se ela for pela Option A.
**Libraries:** —

### auth-frontend/TD-10

**Recommendation:** os quatro fluxos deste slice são todos de **criação** (cadastrar, autenticar o usuário recém-criado, confirmar, redefinir senha): nenhum depende de estado que o próprio teste não possa produzir, então o determinismo que a Option B compra não é usado, e ela o cobra destruindo o banco de desenvolvimento. A Option C é o destino correto, mas o gatilho dela é a existência de um pipeline de CI, que a decisão de CI/CD ainda pendente vai definir — até lá é infraestrutura paga adiantado. Ao decidir por A, registrar o gatilho explícito: **quando houver CI, ou quando surgir um teste que dependa de estado pré-existente, reavaliar em favor da Option C.**
**Renders in:** frontend-runtime
**Libraries:** —

### auth-frontend/TD-11

**Recommendation:** a fronteira de erro já é contract-driven sem que ninguém escreva nada: `contracts.ts` deriva `LoginBffErrorResponse` da spec por `Exclude`, então repassar verbatim é a única opção cujo tipo **já existe e já se atualiza sozinho** quando o backend muda. A Option B abriria à mão exatamente a segunda fonte de verdade que `next-frontend-api-typing/TD-02` fechou, e pagaria isso por um desacoplamento que é aparente: o mapeamento código→campo continua existindo, só muda de arquivo. A Option C é a mais tentadora e a mais frágil — ela ancora comportamento de produção no texto de mensagens do `class-validator`, e resolve um caso raro por construção, já que o schema Zod do cliente (TD-06) valida os mesmos campos antes do submit; um `400` de validação chegando à tela em produção significa divergência entre o schema do cliente e os DTOs do backend, ou seja, um bug a corrigir, não um erro de usuário a renderizar por campo — tratá-lo como `root.serverError` é a leitura honesta. Ao decidir por A, registrar duas consequências: **(i)** os códigos de domínio do backend passam a ser contrato de UI, e a proteção natural é declará-los como `enum` no `ErrorResponseDto` para que a renomeação quebre o `tsc` do frontend em vez da tela — um ajuste pequeno no `nestjs-project`, que é o que torna esta TD `Cross-layer` e não `Frontend`; **(ii)** a tabela código→destino do RHF mora no cliente e deve ficar num módulo único, não replicada por formulário.
**Libraries:** —

### http-error-contract/TD-01

**Recommendation:** é a única que resolve o problema que está de fato aberto sem reabrir o que já funciona. A Option A congela um contrato que deixa `auth-frontend/TD-11` sem matéria-prima: sem `details`, distinguir "e-mail inválido" (erro de campo) de "credenciais inválidas" (erro de formulário) obrigaria o frontend a inferir do `statusCode` ou do texto, que é exatamente o acoplamento frágil que um contrato deveria eliminar. A Option C paga o custo de reescrever filtro, catálogo e suítes e2e por interoperabilidade externa que nenhum requisito pede. A Option B é aditiva: `details` é opcional, nada do que existe quebra, e as e2e atuais continuam válidas sem edição.
**Libraries:** —

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.
- 2026-08-22 — Registrado que o campo `details` é **contrato preparado, sem consumidor nesta fase**. Rationale: a Recommendation desta TD justificou a Option B pela necessidade da `auth-frontend/TD-11` de distinguir erro de campo de erro de formulário, mas a TD-11 foi decidida como Option A e faz essa distinção pelos **códigos de domínio** (`TD-03`), mandando o `400` do `ValidationPipe` para `root.serverError` em vez de renderizá-lo por campo. Não há conflito em runtime — `details` pode existir e o cliente ignorá-lo —, mas a premissa que sustentava a Option B não vale nesta fase (validation.md IC-7). A decisão é mantida: o campo fica disponível para o primeiro consumidor que precisar de granularidade por campo.

### http-error-contract/TD-02

**Recommendation:** é a que casa com a TD-01 Option B e a única que dá ao frontend um tipo sobre o qual dá para escrever código sem narrowing. O custo real da Option A (o filtro precisa conhecer o shape do `ValidationPipe`) é contido: é um ponto único no código, coberto por `http-exception.filter.spec.ts`, e uma quebra em major do NestJS aparece nesse teste. A Option B tem o mesmo efeito de tipagem por um preço pior — obriga a editar as 8 suítes e2e existentes e deixa um array de um elemento como forma canônica. A Option C é o estado atual, que é o problema.
**Libraries:** —

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.

### http-error-contract/TD-03

**Recommendation:** é a única compatível com a comunicação dirigida por contrato que o `CLAUDE.md` fixa como princípio do projeto, e reusa um pipeline que já existe e já está pago. A Option B resolve o mesmo problema abrindo um segundo canal de contrato e exigindo uma decisão de tooling de monorepo (workspaces, contexto de build do Docker) desproporcional ao ganho. A Option C é descartável por um caso concreto e imediato: `EMAIL_JA_EXISTE` e `EMAIL_JA_CONFIRMADO` compartilham o `409` e exigem telas diferentes — sem o código, o frontend não consegue distingui-los. A janela de defasagem da spec é real, mas é a mesma que todo o resto do contrato já aceita, e `scripts/check-api-types-drift.sh` existe para detectá-la.
**Libraries:** @nestjs/swagger, openapi-typescript

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.

## Inherited Decisions Detail

_Dedupe aplicado: o `phases-reader` devolveu também `http-error-contract/TD-01` a `TD-03` (via a slice irmã `auth`), suprimidas aqui por já estarem em `## Decisions Detail` como TDs de escopo corrente._

### config/TD-01

**Recommendation:** `registerAs` + `ConfigType` é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (TD-02).
**Libraries:** @nestjs/config

### config/TD-02

**Recommendation:** agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da TD-01 B. _(Depende de TD-01.)_
**Libraries:** @nestjs/config

### config/TD-03

**Recommendation:** já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da TD-01 (B), não da lib de validação.
**Libraries:** joi

### config/TD-04

**Recommendation:** uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.
**Libraries:** typeorm

### auth/TD-01 _(from slice auth)_

**Recommendation:** o PostgreSQL já está na stack e viabiliza revogação/refresh via tabela (TD-04) sem introduzir Redis, que não está previsto na arquitetura desta fase. Alinha com o suporte de primeira classe do NestJS.
**Libraries:** @nestjs/jwt

### auth/TD-02 _(from slice auth)_

**Recommendation:** é o padrão oficial do NestJS 11, cobre `local` + `jwt` com guards declarativos e deixa a porta aberta para OAuth sem retrabalho. A Option B é defensável se o objetivo for minimizar dependências.
**Libraries:** @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt

### auth/TD-03 _(from slice auth)_

**Recommendation:** para o **refresh token** e, idealmente, também para o access token — reduz a superfície de XSS, que é relevante numa plataforma com conteúdo gerado por usuário (comentários). Acompanha proteção CSRF via `SameSite`.
**Libraries:** cookie-parser

### auth/TD-04 _(from slice auth)_

**Recommendation:** entrega logout real e revogação sem adicionar Redis, aproveitando o banco já previsto; é o padrão recomendado pela RFC 9700 para refresh tokens.
**Libraries:** @nestjs/jwt, typeorm

**Revisions:**
- 2026-06-27 — Refresh token passa de string opaca a JWT assinado, mantendo o rastreio no PostgreSQL pelo `jti` (família, rotação e detecção de reuso preservadas, RFC 9700). Rationale: a persistência continua obrigatória; muda apenas o formato do valor (opaco → JWT) e o que se persiste (o `jti`, não o hash do valor).

### auth/TD-05 _(from slice auth)_

**Recommendation:** é a recomendação atual do OWASP para senhas em aplicações novas e o projeto é greenfield; o único cuidado é garantir a compilação do binding nativo na imagem Docker. bcrypt permanece uma escolha segura e mais simples se quiser evitar dependência nativa.
**Libraries:** argon2

### auth/TD-06 _(from slice auth)_

**Recommendation:** confirmação e reset exigem **uso único e revogação** (após redefinir a senha, links pendentes devem morrer), o que o JWT stateless não garante sozinho. O PostgreSQL já está disponível para isso.
**Libraries:** @nestjs/jwt

**Revisions:**
- 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migra para JWT assinado stateless (sem tabela); o reset de senha mantém a Option A original. Rationale: o reuso da confirmação já é neutralizado pela flag `is_confirmed` (replay → `EMAIL_JA_CONFIRMADO`), enquanto o reset exige uso único e revogação reais (links pendentes devem morrer após a redefinição). Consequência aceita: ao reenviar a confirmação, JWTs anteriores seguem válidos até expirar — risco baixo, pois todos confirmam a mesma conta.

### auth/TD-07 _(from slice auth)_

**Recommendation:** respeita o transporte SMTP já definido na arquitetura, é idiomático no NestJS e permite desenvolver/testar todo o fluxo de e-mail localmente sem enviar mensagens reais.
**Libraries:** @nestjs-modules/mailer, nodemailer, handlebars

### auth/TD-08 _(from slice auth)_

**Recommendation:** é barato adicionar junto com os endpoints de auth e protege diretamente os fluxos sensíveis desta fase. O limite em memória é aceitável agora; trocar por store compartilhado é um ajuste futuro.
**Libraries:** @nestjs/throttler

### auth/TD-09 _(from slice auth)_

**Recommendation:** mantém o escopo coeso e respeita o adiamento do Next.js da Fase 01.
**Libraries:** —

**Revisions:**
- 2026-07-17 — Links de e-mail passam a apontar para paths de página dedicados (`/confirm-account`, `/reset-password`), distintos dos paths da API. Rationale: a implementação inicial apontava para `/auth/confirm` e `/auth/reset-password`, que só aceitam POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca alcançaria a rota. A página lê o `token` da query string e então chama o POST real da API.
- 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`, com o link do e-mail voltando a apontar direto para a API; o reset de senha permanece apontando para a página `/reset-password`. Rationale: a confirmação não exige nenhum dado do usuário além do token, dispensando tela intermediária; o reset exige formulário para a nova senha. Trade-off aceito: `GET` é pré-buscável por scanners/proxies de e-mail, podendo disparar a confirmação automaticamente — risco baixo dado o token assinado e expirável (24h).
- 2026-08-22 — Campo `Capability:` trocado de "Telas de cadastro, login, confirmação de conta e recuperação de senha" para `Transversal — covers:` com os sete bullets que a slice `auth` reivindica em `covers_capabilities`. Rationale: sob o modelo de slicing, o bullet das telas passou a ser propriedade da slice irmã `auth-frontend`, e o `Capability:` é o campo pelo qual o `/plan-build` agrupa TDs — apontando para fora do escopo declarado, a TD ficaria órfã no artefato final. A decisão (Option A — backend-only) não muda; o adiamento das telas segue descrito na prosa e registrado em `## Non-UI / Deferred Capabilities` (validation.md IC-2).

### auth/TD-10 _(from slice auth)_

**Recommendation:** determinística e previsível.
**Libraries:** —

### auth/TD-11 _(from slice auth)_

**Recommendation:** alinhada à recomendação atual do OWASP.
**Libraries:** class-validator

### auth/TD-12 _(from slice auth)_

**Recommendation:** equilíbrio padrão.
**Libraries:** —

### auth/TD-13 _(from slice auth)_

**Recommendation:** protege os fluxos sensíveis com folga para uso legítimo.
**Libraries:** @nestjs/throttler

### auth/TD-14 _(from slice auth)_

**Recommendation:** comportamento padrão esperado.
**Libraries:** —

### auth/TD-15 _(from slice auth)_

**Recommendation:** suficiente nesta fase; token anti-CSRF pode entrar num hardening futuro.
**Libraries:** —

### auth/TD-16 _(from slice auth)_

**Recommendation:** o reenvio de confirmação (já previsto) cobre a falha sem acoplar o cadastro ao SMTP.
**Libraries:** —

### auth/TD-17 _(from slice auth)_

**Recommendation:** encerrar tudo é a postura segura e alinha com o uso único dos tokens (TD-06).
**Libraries:** —

### auth/TD-18 _(from slice auth)_

**Recommendation:** a Option B só se sustenta enquanto o auth for o único consumidor de `User`, o que deixa de valer já na fase de canal/vídeos.
**Libraries:** typeorm

### auth/TD-19 _(from slice auth)_

**Recommendation:** preserva o contrato obrigatório do TypeORM dentro da transação sem tornar todo chamador refém de abrir uma.
**Libraries:** typeorm

**Revisions:**
- 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio (antes registradas inline como `DT-A`/`DT-B` em `docs/phases/phase-02-auth-refactor.md`). Rationale: mantinham um terceiro namespace de IDs fora de `docs/decisions/`, invisível para o pipeline; promovidas a TD-18/TD-19 na migração de formato.

### openapi-spec/TD-01 _(correlator-confirmed)_

**Recommendation:** o backend de auth já está implementado e validado por `class-validator`, então o code-first documenta o que existe hoje sem retrabalho e sem risco de divergência; a Option B só se paga quando o contrato precisa preceder a implementação em times paralelos, o que não é o caso, e a Option C reabre a decisão de validação de `config/TD-03` por um benefício tangencial.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-02 _(correlator-confirmed)_

**Recommendation:** o plugin elimina o boilerplate e mantém a spec sincronizada com as regras de `class-validator` já escritas, enquanto o `@ApiProperty()` reservado para exemplos e casos ambíguos evita a duplicação sistemática da Option B; o critério de override deve ficar registrado no `nestjs-project/CLAUDE.md`.
**Libraries:** @nestjs/swagger

### openapi-spec/TD-03 _(correlator-confirmed)_

**Recommendation:** entrega o valor real da UI (explorar a API em desenvolvimento) sem ampliar a superfície exposta em produção nem introduzir um segundo esquema de autenticação; se um integrador externo surgir, a Option C continua alcançável ligando a flag e adicionando o guard, sem desfazer nada.
**Libraries:** @nestjs/swagger, @nestjs/config

### openapi-spec/TD-04 _(correlator-confirmed)_

**Recommendation:** versionar o contrato é o que torna uma quebra de compatibilidade visível no code review, e é o único caminho compatível tanto com o CLI plugin da TD-02 quanto com codegen de frontend offline; o custo de defasagem se resolve depois com um check no CI da Fase 07 (`git diff --exit-code openapi.json` após regerar). O arquivo mora em `nestjs-project/` porque `docs/` é reservado a documentação autoral, não a artefato gerado.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

**Revisions:**
- 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acoplada ao build: `openapi:generate` é um script standalone invocado manualmente (dentro do container, ex.: `docker compose run --rm nestjs-api npm run openapi:generate`), nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Rationale: o bootstrap do `AppModule` inicializa `TypeOrmModule` e valida todo o schema Joi, exigindo Postgres, Mailpit e todas as variáveis obrigatórias no ar — e o host `db` só resolve dentro da rede do Compose (convenção herdada da fase 02). Como o contrato muda com pouca frequência, rodar sob demanda paga esse custo apenas quando a spec realmente precisa ser regerada, em vez de tornar todo `nest build` dependente da infraestrutura.

### openapi-spec/TD-05 _(correlator-confirmed)_

**Recommendation:** dá a garantia essencial (mudança incompatível de contrato falha no `tsc` do frontend) com a menor superfície de dependência e sem antecipar a decisão de data fetching do frontend, que deve ser tomada quando as telas entrarem em escopo; a Option C carrega essa decisão junto e a Option B cobra custo de código gerado e instabilidade de `0.x` por uma DX marginalmente melhor. A adoção pode ficar **diferida** até as telas existirem — o que este TD fixa agora é a estratégia, para que a TD-04 gere o artefato no formato certo.
**Libraries:** openapi-typescript, openapi-fetch

### openapi-spec/TD-06 _(correlator-confirmed)_

**Recommendation:** é a única que descreve fielmente o contrato já decidido em `auth/TD-03` sem alterar a implementação de autenticação; a Option B compra conveniência de teste ao preço de reabrir uma decisão de segurança fechada, o que não se justifica.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-07 _(correlator-confirmed)_

**Recommendation:** é o único caminho que mantém a spec fiel por endpoint sem o custo de repetição da Option A nem a imprecisão da Option C; com poucos endpoints hoje, criar os três decoradores agora é barato e evita que a convenção se degrade quando vídeos e comentários multiplicarem os controllers.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### next-frontend-api-typing/TD-01 _(correlator-confirmed)_

**Recommendation:** é a única que entrega a garantia de type-check **sem** tocar no isolamento do Compose, que a restrição de `build.context` torna caro nas outras duas; o custo real (tipos defasados) é exatamente o que o check de drift no CI elimina, e o diff visível do `.d.ts` no PR é um efeito colateral desejável quando o backend muda um DTO. A Option C é a resposta certa para o dia em que houver um segundo consumidor da spec, não hoje.
**Libraries:** openapi-typescript

### next-frontend-api-typing/TD-02 _(correlator-confirmed)_

**Recommendation:** dado que o `openapi.json` e os DTOs já são a fonte de verdade upstream, derivar por utility types entrega a honestidade da Option C com o custo da Option A, e é a única que mantém o vínculo de build sem inventar infraestrutura; a Option D é sedutora mas paga engenharia de tipos própria para resolver a metade fácil do problema, e a Option A já nasce errada no primeiro endpoint do projeto que é `auth`.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-api-typing/TD-03 _(correlator-confirmed)_

**Recommendation:** o risco que as Options B e C endereçam é o de spec defasada, e esse risco tem uma correção mais barata e mais a montante (o check de drift do TD-01, mais a conferência da resposta de `/auth/login` no backend); introduzir schemas Zod à mão agora recria a segunda fonte de verdade que a `openapi-spec/TD-05` foi escolhida para eliminar. Reavaliar quando existir codegen de schemas Zod **a partir da spec** — aí a Option C passa a custar quase nada e a recomendação muda.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-env-config/TD-01 _(correlator-confirmed)_

**Recommendation:** a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle). Com 2 variáveis hoje o custo parece desproporcional, mas as fases 03–07 acrescentam base URL de storage, chaves de player e provavelmente analytics — todas atravessando essa fronteira. Option B é a escolha defensável se a preferência for não adicionar dependência: entrega o mesmo resultado com mais disciplina exigida. Option A está descartada — reabre por omissão a decisão que `config/TD-01` fechou.
**Renders in:** frontend-runtime
**Libraries:** @t3-oss/env-nextjs

### next-frontend-env-config/TD-02 _(correlator-confirmed)_

**Recommendation:** a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois. Option B é a escolha certa se o peso do bundle do cliente for tratado como restrição dura — o ganho é real, o custo é ecossistema menor. Option D é simetria aparente que não se sustenta tecnicamente: Joi não gera tipos nem compõe com a TD-01 Option C.
**Libraries:** zod

### next-frontend-env-config/TD-03 _(correlator-confirmed)_

**Recommendation:** preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável. Option B é a resposta certa se a simetria estrutural literal com `src/config/` for o objetivo declarado — é defensável, custa organização antecipada. Option A é suficiente e honesta se a expectativa for que o front nunca passe de ~5 variáveis.
**Libraries:** —

### next-frontend-env-config/TD-04 _(correlator-confirmed)_

**Recommendation:** manter browser e API na mesma origem é o que faz esse cookie funcionar sem exceção. Option A é a escolha pragmática se a intenção for aceitar imagens por ambiente; Option B é a mais correta conceitualmente para uma imagem promovível, mas cobra prerender estático justamente na home da Fase 07, que é onde o estático mais vale.
**Libraries:** —

### next-frontend-env-config/TD-05 _(correlator-confirmed)_

**Recommendation:** reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real. Option B é a escolha certa se determinismo absoluto do suite valer mais que a duplicação das chaves. Option C deve ser descartada por incompatibilidade de ordem de execução com a validação-no-import da TD-01, não por preferência.
**Libraries:** @next/env

### next-frontend-msw-base/TD-01 _(correlator-confirmed)_

**Recommendation:** é o único caminho que dá `setupFiles` por lane, o que a TD-04 precisa para não misturar as duas superfícies de fake, e é o mecanismo que a documentação do Vitest 4 indica depois de remover `environmentMatchGlobs`. O custo é verbosidade num arquivo que se escreve uma vez; o custo das outras duas é uma classe de erro recorrente cuja mensagem não aponta para a causa.
**Renders in:** frontend-runtime
**Libraries:** vitest

### next-frontend-msw-base/TD-02 _(correlator-confirmed)_

**Recommendation:** a diferença de velocidade só se paga com uma suíte grande, que este projeto não tem e não terá tão cedo, enquanto a diferença de cobertura cobra logo no primeiro teste de componente que abrir um overlay do Radix. Escolher `jsdom` também elimina a divergência com a documentação do Next.js. Se a decisão for esta, a skill `testing-guide-next-frontend` precisa ter o template de `vitest.config.ts` corrigido no mesmo commit — hoje ela diz `happy-dom`.
**Renders in:** frontend-runtime
**Libraries:** jsdom

### next-frontend-msw-base/TD-03 _(correlator-confirmed)_

**Recommendation:** é a única que fecha o buraco que a `next-frontend-api-typing/TD-03` conscientemente deixou aberto, e ela o fecha no lugar mais barato (build do teste, não runtime de produção). Vale um efeito colateral concreto: com a verificação de status, o fixture de `POST /auth/login` vai acusar de imediato a imprecisão já confirmada na spec do backend, que declara `RegisterResponseDto` como resposta 200 do login. Se adotada, decidir junto como `mocks/` acessa `paths` — reexportar o tipo por `lib/api/contracts.ts` mantém a regra de importação vigente sem carve-out; abrir exceção para `mocks/` é a alternativa mais direta e mais frouxa. Verificar a compatibilidade da versão de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0 no momento da instalação.
**Renders in:** frontend-runtime
**Libraries:** openapi-msw, msw

### next-frontend-msw-base/TD-04 _(correlator-confirmed)_

**Recommendation:** preserva o padrão de default + override que o projeto já adotou e evita o efeito mais nocivo da Option A, que é embaralhar duas fronteiras com garantias de tipagem diferentes logo no arquivo onde a TD-03 quer precisão. Com uma única rota de BFF hoje, B e C custam quase o mesmo; a diferença aparece na terceira rota, e B é a que não precisa ser refeita lá. Se a TD-01 não for decidida como Option A, esta TD deve cair para a Option C, não para a A — sem `setupFiles` por lane, a composição da Option B não tem onde acontecer.
**Renders in:** frontend-runtime
**Libraries:** —

**Revisions:**
- 2026-08-15 — O "conjunto pertinente" de cada lane é fixado explicitamente: `node` recebe apenas `handlers`; a lane de DOM, apenas `bffHandlers`. Rationale: restrição técnica provada na implementação — `mocks/handlers.ts` importa `@/lib/env`, e `@t3-oss/env-core` lança `Attempted to access a server-side environment variable on the client` sob jsdom, então a separação deixa de ser preferência de design e passa a ser obrigatória numa das direções.

## Inherited Conventions

- Configuração acessada exclusivamente via namespaces tipados (`registerAs` + `ConfigType`) — sem magic strings e sem `process.env` no código da aplicação _(from slice auth)_
- Entrypoints fora do container DI (CLI TypeORM, seeds) reusam a função pura `buildDatabaseOptions` em vez de remontar opções de conexão _(from slice auth)_
- Validação de ambiente com Joi no boot: variável obrigatória ausente derruba a aplicação _(from slice auth)_
- Hosts de serviço sempre pelo nome do serviço Compose (`db`, `mailpit`), nunca `localhost` _(from slice auth)_
- `synchronize: false` no TypeORM — mudanças de schema só via migrations versionadas _(from slice auth)_
- Prosa em português, identificadores e rótulos estruturais em inglês _(from slice auth)_

_Procedência: o `phases-reader` extraiu estes bullets de `docs/phases/phase-02-auth/context.md` (slice irmã, via `depends_on_slices`), e reportou explicitamente que `docs/phases/phase-01-config/phase-01-config.md` não tem seção `Conventions to Match` — o `## Inherited Conventions` da Fase 01 é o placeholder "nenhuma fase anterior". Os bullets acima foram sintetizados numa execução anterior a partir de `config/TD-01` a `config/TD-04` e das regras do repositório, não extraídos verbatim de uma seção de origem. São de segunda mão e verificadamente corretos._

## Inherited Deferred Capabilities

| Capability | Status | Origin phase | Rationale |
|-----------|--------|--------------|-----------|
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | phase-02-auth | Fase entregue backend-only; o Next.js não estava inicializado no planejamento. A capability foi depois reivindicada pela slice irmã `auth-frontend` _(from slice auth)_ |

_Informativa apenas — o `plan-validate` não dispara issues sobre entradas desta seção. A linha registra que a slice irmã `auth` adiou conscientemente a capability que **esta** slice reivindica em `covers_capabilities`: é o handoff, não uma pendência._

## UI Inventory

**Source:** `docs/inventories/screen-inventory-phase-02-auth-frontend.md`
**Screens in scope:** 3

### UI ↔ Capability Join

| Screen | Route | Verb | Capability | Covering Component |
|--------|-------|------|------------|-------------------|
| Tela de cadastro de conta | /signup | Submeter cadastro de nova conta com nome, e-mail e senha | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | SignupForm |
| Tela de cadastro de conta | /signup | Exibir erros de cadastro retornados pelo servidor (ex.: e-mail já em uso) | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | SignupForm |
| Tela de cadastro de conta | /signup | Exibir a confirmação do cadastro com o e-mail registrado, substituindo o formulário após o `201` | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | SignupSuccessPanel |
| Tela de cadastro de conta | /signup | Reenviar o e-mail de confirmação da conta recém-cadastrada | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | ResendConfirmationButton |
| Tela de login | /login | Autenticar usuário a partir de e-mail e senha e iniciar sessão | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | Button — "Sign in" |
| Tela de solicitação de redefinição de senha | /forgot-password | Solicitar o envio do e-mail de recuperação de senha para o endereço informado | "Telas de cadastro, login, confirmação de conta e recuperação de senha" | Button (submit) |

### Server-connected Components

- `SignupForm` (Tela de cadastro de conta) — `Reuse?: new`
- `Button "Create account"` (Tela de cadastro de conta) — `Reuse?: next-frontend/components/ui/button.tsx`
- `SignupSuccessPanel` (Tela de cadastro de conta) — `Reuse?: new`
- `ResendConfirmationButton` (Tela de cadastro de conta) — `Reuse?: next-frontend/components/ui/button.tsx`
- `Button — "Sign in"` (Tela de login) — `Reuse?: next-frontend/components/ui/button.tsx`
- `Button (submit)` (Tela de solicitação de redefinição de senha) — `Reuse?: next-frontend/components/ui/button.tsx`

### Open Questions from Inventory

**Lacunas de escopo e de design**

- **Tela de confirmação de conta — fora do escopo, agora por decisão registrada.** Era decisão informal do usuário ("nós só vamos implementar as telas de cadastro de conta, tela de login e reset de senha"); a `auth-frontend/TD-07` foi **Adiada** e ratificou-a. A condicional que esta seção carregava desde 2026-08-15 ("se a Option A for escolhida, a tela `/confirm-account` passa a existir e este inventário precisa de um extension run") resolveu-se **em sentido contrário**: nenhuma das três opções foi adotada, o link do e-mail continua apontando direto para `GET /auth/confirm` conforme `auth/TD-09`, e não há tela nova a inventariar. A capability está registrada como `deferred` no `context.md`. **Não é mais questão aberta** — mantida aqui como registro do desfecho.
- **Estado de sucesso do cadastro não existe no Figma.** `auth-frontend/TD-09` (Option A) decidiu o comportamento e este extension run o inventariou, mas as quatro linhas correspondentes na tabela de `/signup` são as únicas do documento sem nó Figma. Copy, layout e os estados do reenvio (em curso, concluído, cooldown) seguem indefinidos. É a lacuna de design **ativa** deste inventário.
- **Tela de redefinição de senha (`/reset-password`) não existe no Figma.** É a tela onde o link do e-mail aterrissa e onde o usuário define a nova senha — o backend já a pressupõe (`auth/TD-09`, revisão de 2026-07-17, aponta o link de reset para essa rota de página). Sem ela, o fluxo de recuperação fica pela metade: a solicitação existe, a redefinição não. É lacuna de design, não de planejamento. Registrada como `deferred` no `context.md`.

**Inconsistências de copy no Figma** (confirmar com quem desenhou antes de implementar)

- **Tela de login, campo de senha (147:540):** placeholder diz `"Enter your email"` — copy duplicada do campo de e-mail.
- **Tela de solicitação de reset, AuthFooter (2394:2276):** pergunta `"Remember your password?"` com link rotulado `"Sign up"`. Quem lembrou a senha quer entrar, não se cadastrar.
- **Tela de cadastro, frame do card (143:2399):** nomeado "Login" no Figma, mas o conteúdo é o cadastro. Nome ignorado em favor do conteúdo; não afeta implementação, mas confunde quem navega o arquivo.

**Divergências entre telas irmãs**

- **Toggle de visibilidade de senha:** presente nos dois campos de senha da tela de cadastro (`I143:2435;82:6685`, `I143:2436;82:6685`), ausente no campo de senha do login (147:540). Intencional?
- **BackLink:** presente em cadastro (143:2407) e em solicitação de reset (143:2343), ausente no login. Em ambas as telas onde existe, **o destino da navegação de volta não está definido no Figma**.

**Estados não modelados no Figma** (afetam as três telas)

- Nenhuma tela declara variante de **loading/disabled** para o botão de submit. `next-frontend/components/icons/spinner.tsx` já existe no repo e é o alvo natural, mas não há evidência de uso em nenhum nó.
- Nenhuma tela declara variante de **erro de validação inline** no `TextField`, embora as três exijam validação antes da submissão. A `auth-frontend/TD-06` já está **decidida** (Option A — React Hook Form + resolver Zod tipado contra `contracts.ts`), então o mecanismo existe; o que falta é a **variante visual** do campo em erro, que continua ausente do Figma.
- A tela de solicitação de reset não declara **mensagem de sucesso pós-envio**. Diferente do cadastro, esta lacuna **não** foi fechada por TD — `auth-frontend/TD-09` decide apenas o desfecho do `/signup`.
- **Destino dos erros de servidor:** `auth-frontend/TD-11` (decidida, Option A) fixou que o `400` do `ValidationPipe` vai para `root.serverError` e os códigos de domínio são mapeados por campo num módulo único do cliente. Isso implica, nas três telas, uma **superfície de erro no nível do formulário** além do erro por campo — e ela também não está modelada em nenhum nó.

**Destinos de rota indefinidos**

- Links "Terms of Service" e "Privacy Policy" na tela de cadastro (143:2439) — não há telas correspondentes em nenhuma fase do `project-plan.md`.

**Acessibilidade** (não anotada no Figma)

- Tela de cadastro: o `ProgressLinear` de força de senha (143:2446) e o `PasswordStrengthHint` (143:2444) precisam de associação programática com o campo de senha (`aria-describedby`); o toggle de visibilidade precisa de rótulo acessível.

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| Tela de confirmação de conta (parte da capability "Telas de cadastro, login, confirmação de conta e recuperação de senha") | deferred | `auth-frontend/TD-07` foi Adiada — nenhuma opção adotada neste slice. Mantém-se o comportamento já entregue por `auth/TD-09`: o link do e-mail aponta direto para `GET /auth/confirm`, sem tela intermediária. A tela `/confirm-account` e a mudança de `204` para `302` ficam para fase posterior; nenhuma Revision é aberta em `auth/TD-09`. | auth-frontend/TD-07, auth/TD-09 |
| Tela de redefinição de senha `/reset-password` (parte da capability "Telas de cadastro, login, confirmação de conta e recuperação de senha") | deferred | A tela não existe no Figma, embora o backend já a pressuponha (`auth/TD-09`, revisão de 2026-07-17, aponta o link de reset para essa rota de página). O slice entrega a solicitação de recuperação (`/forgot-password`), não a redefinição. É lacuna de design a resolver antes de a capability poder ser considerada completa. | auth/TD-09 |

_Estas duas linhas foram gravadas por `/plan-resolve` em 2026-08-17 (resolução da IC-3) e **preservadas deliberadamente** nesta regeneração, como já haviam sido na de 2026-08-17. A regra de idempotência do skill zeraria a seção, mas ela é declarada como "read by plan-context / write-append by plan-resolve", e o placeholder `_None._` é especificado para a **primeira** montagem — que esta não é. Zerar aqui tornaria toda escrita do `plan-resolve` descartável na regeneração seguinte, que é exatamente o defeito que a IC-3 registrou._

## Testing Requirements

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| **Page** — sync RSC, no interaction (ex.: página estática de marketing) | Nenhum em nível de componente; cobrir só se fizer parte de um fluxo crítico → `*.e2e-spec.ts` |
| **Page** — sync RSC compondo filhos client | Testar os filhos client diretamente; cobrir a página renderizada via `*.e2e-spec.ts` |
| **Page** — async RSC (`async function Page()` com `await fetch`) | `*.e2e-spec.ts` apenas — o Vitest não consegue renderizá-la |
| **Layout** (`layout.tsx`) | Nenhum, salvo se adicionar lógica (gate de auth, renderização condicional); senão coberto via E2E |
| **Client component** (`"use client"`) com estado/handlers | `*.test.ts` — render com RTL, mock de `next/navigation` e `fetch` |
| **Feature component** (server, compõe primitivos, apresentacional) | Pular unit; cobrir via o E2E da página |
| **shadcn UI primitive** (`components/ui/*`) | Nenhum — confiar na biblioteca; cobrir via consumidores |
| **Icon** (`components/icons/*`) | Nenhum |
| **`lib/` utility** com branching | `*.test.ts` |
| **Custom hook** (`hooks/*`) | `*.test.ts` com `renderHook` de `@testing-library/react` |
| **Route handler** (`app/api/**/route.ts`) com branching | `*.test.ts` (lógica pura) e/ou `*.integration.test.ts` com MSW |
| **Route handler** (proxy simples para o NestJS) | `*.integration.test.ts` com MSW apenas |
| **Server action** | `*.integration.test.ts` com MSW; E2E para o fluxo de submit |
| **Middleware / error / loading / not-found / metadata** | Ver guia — depende do tipo |

### nestjs-project

_Alcançado por decisões cross-layer desta slice (`auth-frontend/TD-03`, `auth-frontend/TD-11`, `http-error-contract/TD-01` a `TD-03`), não por TD de implementação própria. As linhas pertinentes ao que essas decisões tocam:_

| Artifact type | Required layers |
|---------------|-----------------|
| Exception Filter | Unit + E2E |
| DTO | E2E: um teste de wiring de validação por endpoint |
| Controller | E2E apenas — não escrever testes unitários |
| Middleware | E2E |
