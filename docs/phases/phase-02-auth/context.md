---
kind: phase
name: phase-02-auth
sources_mtime:
  docs/project-plan.md: "2026-05-30T14:30:22Z"
  docs/decisions/technical-decisions-auth.md: "2026-08-22T12:55:20Z"
  docs/decisions/technical-decisions-http-error-contract.md: "2026-08-22T12:55:46Z"
  docs/decisions/technical-decisions-openapi-spec.md: "2026-08-08T21:32:44Z"
  docs/decisions/technical-decisions-next-frontend-api-typing.md: "2026-08-15T16:15:37Z"
  docs/decisions/technical-decisions-next-frontend-env-config.md: "2026-08-10T10:30:53Z"
  docs/decisions/technical-decisions-next-frontend-msw-base.md: "2026-08-15T19:59:53Z"
  docs/phases/phase-01-config/context.md: "2026-08-08T20:55:11Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-08T20:01:09Z"
---

# phase-02-auth — Context

## Scope

**Phase name:** Cadastro, Login e Gerenciamento de Conta

**Slice:** `auth` — autenticação e gerenciamento de conta: cadastro, confirmação por e-mail, login/sessão, logout e recuperação de senha. Slice de backend da Fase 02.

**Capabilities** (literal, `covers_capabilities` da doc de decisões da slice):

- Serviço de envio de e-mails transacionais
- Cadastro de usuário com e-mail e senha
- Criação automática do canal do usuário a partir do prefixo do e-mail
- Confirmação de conta via e-mail com link de ativação
- Login e controle de sessão do usuário
- Logout
- Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Capabilities da fase completa** (literal, `docs/project-plan.md` — a oitava pertence à slice irmã `auth-frontend`):

- Serviço de envio de e-mails transacionais
- Cadastro de usuário com e-mail e senha
- Criação automática do canal do usuário a partir do prefixo do e-mail
- Confirmação de conta via e-mail com link de ativação
- Login e controle de sessão do usuário
- Logout
- Recuperação de senha: solicitação via e-mail → link com token → redefinição
- Telas de cadastro, login, confirmação de conta e recuperação de senha

**Out of scope:** _Não especificado no `project-plan.md`._ As telas ficaram fora desta slice por `auth/TD-09` (backend-only) e são entregues pela slice irmã `auth-frontend`.

**Deliverables:** fluxo completo de cadastro → confirmação → login → recuperação de senha funcionando. Canal criado automaticamente para cada usuário.

**Affected subprojects:**

- `nestjs-project` — toda a API de autenticação
- `next-frontend` — sem implementação nesta slice; os contratos que o frontend deve honrar ficam fixados em `auth/TD-03`, `auth/TD-06` e `auth/TD-09`

**Deferred subprojects:** _None._

**Sequencing notes:** "> Depende de: Fase 01"

**Neighbors (for boundary detection only):**

- **Phase 01:** Preparação de toda a fundação do projeto: repositório, ambiente de desenvolvimento, projetos Next.js e Nest.js, banco de dados PostgreSQL e serviços auxiliares.
- **Phase 03:** Upload e Processamento de Vídeos — "Depende de: Fase 01, Fase 02"

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| auth/TD-01 | phase | Backend | Estratégia de autenticação (stateless vs stateful) | decided | A — JWT stateless | @nestjs/jwt |
| auth/TD-02 | phase | Backend | Biblioteca / abordagem de implementação | decided | A — Passport | @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt |
| auth/TD-03 | phase | Cross-layer | Armazenamento do token no cliente | decided | A — cookie httpOnly+Secure+SameSite | cookie-parser |
| auth/TD-04 | phase | Backend | Controle de sessão, refresh e logout | decided | A — access curto + refresh com rotação | @nestjs/jwt, typeorm |
|     └─ Last revision: 2026-06-27 — Refresh token passa de string opaca a JWT assinado, m… | | | | | | |
| auth/TD-05 | phase | Backend | Algoritmo de hashing de senha | decided | B — argon2id | argon2 |
| auth/TD-06 | phase | Cross-layer | Tokens de confirmação de conta e de redefinição de senha | decided | A — token opaco hasheado (reset) + JWT (confirm) | @nestjs/jwt |
|     └─ Last revision: 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migr… | | | | | | |
| auth/TD-07 | phase | Backend | Serviço de envio de e-mails transacionais | decided | A — @nestjs-modules/mailer sobre SMTP | @nestjs-modules/mailer, nodemailer, handlebars |
| auth/TD-08 | phase | Backend | Proteção contra força bruta nos endpoints de auth | decided | A — rate limiting | @nestjs/throttler |
| auth/TD-09 | phase | Cross-layer | Escopo de frontend da fase | decided | A — backend-only; telas adiadas | — |
|     └─ Last revision: 2026-08-22 — Campo `Capability:` trocado de "Telas de cadastro, login, confirmação de conta e… | | | | | | |
| auth/TD-10 | phase | Backend | Política de colisão de nickname do canal | decided | B — sufixo aleatório curto | — |
| auth/TD-11 | phase | Backend | Política de senha | decided | A — mín. 8, máx. 128, sem complexidade | class-validator |
| auth/TD-12 | phase | Backend | TTLs (expirações) dos tokens | decided | A — 15min / 7d / 24h / 1h | — |
| auth/TD-13 | phase | Backend | Valores de rate limit (`@nestjs/throttler`) | decided | A — 100/min; 5/min; 3/h; 3/h | @nestjs/throttler |
| auth/TD-14 | phase | Backend | Escopo do logout | decided | A — revoga apenas a família/sessão atual | — |
| auth/TD-15 | phase | Backend | Proteção CSRF dos cookies | decided | A — SameSite=Strict | — |
| auth/TD-16 | phase | Backend | Tratamento de falha no envio de e-mail no cadastro | decided | A — envio best-effort | — |
| auth/TD-17 | phase | Backend | Revogação de sessões na redefinição de senha | decided | A — revoga todas as sessões ativas | — |
| auth/TD-18 | phase | Backend | Dono da persistência de `User` | decided | A — `UsersService` dono exclusivo | typeorm |
| auth/TD-19 | phase | Backend | Padrão de participação em transação dos serviços | decided | A — híbrido `metodo(args, manager?)` | typeorm |
|     └─ Last revision: 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteira… | | | | | | |
| http-error-contract/TD-01 | ad-hoc | Cross-layer | Shape do envelope de resposta de erro HTTP | decided | B — `{statusCode, error, message, details}` | — |
| http-error-contract/TD-02 | ad-hoc | Cross-layer | Tipo do campo `message` — string única vs array | decided | A — sempre `string` | — |
| http-error-contract/TD-03 | ad-hoc | Cross-layer | Como o frontend consome o catálogo de códigos | decided | A — derivado da spec | @nestjs/swagger, openapi-typescript |

_`Renders in` column omitted: no TD in scope declares the field (all `—`)._

_Source files:_

- auth — `docs/decisions/technical-decisions-auth.md` (scope_type: phase, related_phases: [2])
- http-error-contract — `docs/decisions/technical-decisions-http-error-contract.md` (scope_type: ad-hoc, related_phases: [2])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Serviço de envio de e-mails transacionais | auth/TD-07 |
| Cadastro de usuário com e-mail e senha | auth/TD-05, auth/TD-11, auth/TD-16, auth/TD-18, http-error-contract/TD-01 _(pending)_, http-error-contract/TD-02 _(pending)_, http-error-contract/TD-03 _(pending)_ |
| Criação automática do canal do usuário a partir do prefixo do e-mail | auth/TD-10, auth/TD-19 |
| Confirmação de conta via e-mail com link de ativação | auth/TD-06, auth/TD-12, http-error-contract/TD-01 _(pending)_, http-error-contract/TD-03 _(pending)_ |
| Login e controle de sessão do usuário | auth/TD-01, auth/TD-02, auth/TD-03, auth/TD-04, auth/TD-08, auth/TD-12, auth/TD-13, auth/TD-15, http-error-contract/TD-01 _(pending)_, http-error-contract/TD-02 _(pending)_, http-error-contract/TD-03 _(pending)_ |
| Logout | auth/TD-04, auth/TD-14, http-error-contract/TD-01 _(pending)_ |
| Recuperação de senha: solicitação via e-mail → link com token → redefinição | auth/TD-06, auth/TD-08, auth/TD-12, auth/TD-13, auth/TD-17, http-error-contract/TD-01 _(pending)_, http-error-contract/TD-02 _(pending)_, http-error-contract/TD-03 _(pending)_ |
| Telas de cadastro, login, confirmação de conta e recuperação de senha | — _(pertence à slice irmã `auth-frontend`; `auth/TD-09` a cita apenas para registrar o adiamento)_ |

_A slice declara `covers_capabilities` com os sete primeiros bullets; o gate de cobertura desta slice se aplica a eles. A oitava linha consta para dar a visão da fase e é propriedade da slice `auth-frontend`. As três TDs de `http-error-contract` estão `pending` — cobrem as capabilities acima por `Transversal — covers:`, mas ainda sem decisão._

## Decisions Detail

### auth/TD-01

**Recommendation:** o PostgreSQL já está na stack e viabiliza revogação/refresh via tabela (TD-04) sem introduzir Redis, que não está previsto na arquitetura desta fase. Alinha com o suporte de primeira classe do NestJS.
**Libraries:** @nestjs/jwt

### auth/TD-02

**Recommendation:** é o padrão oficial do NestJS 11, cobre `local` + `jwt` com guards declarativos e deixa a porta aberta para OAuth sem retrabalho. A Option B é defensável se o objetivo for minimizar dependências.
**Libraries:** @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt

### auth/TD-03

**Recommendation:** para o **refresh token** e, idealmente, também para o access token — reduz a superfície de XSS, que é relevante numa plataforma com conteúdo gerado por usuário (comentários). Acompanha proteção CSRF via `SameSite`.
**Libraries:** cookie-parser

### auth/TD-04

**Recommendation:** entrega logout real e revogação sem adicionar Redis, aproveitando o banco já previsto; é o padrão recomendado pela RFC 9700 para refresh tokens.
**Libraries:** @nestjs/jwt, typeorm

**Revisions:**
- 2026-06-27 — Refresh token passa de string opaca a JWT assinado, mantendo o rastreio no PostgreSQL pelo `jti` (família, rotação e detecção de reuso preservadas, RFC 9700). Rationale: a persistência continua obrigatória; muda apenas o formato do valor (opaco → JWT) e o que se persiste (o `jti`, não o hash do valor).

### auth/TD-05

**Recommendation:** é a recomendação atual do OWASP para senhas em aplicações novas e o projeto é greenfield; o único cuidado é garantir a compilação do binding nativo na imagem Docker. bcrypt permanece uma escolha segura e mais simples se quiser evitar dependência nativa.
**Libraries:** argon2

### auth/TD-06

**Recommendation:** confirmação e reset exigem **uso único e revogação** (após redefinir a senha, links pendentes devem morrer), o que o JWT stateless não garante sozinho. O PostgreSQL já está disponível para isso.
**Libraries:** @nestjs/jwt

**Revisions:**
- 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migra para JWT assinado stateless (sem tabela); o reset de senha mantém a Option A original. Rationale: o reuso da confirmação já é neutralizado pela flag `is_confirmed` (replay → `EMAIL_JA_CONFIRMADO`), enquanto o reset exige uso único e revogação reais (links pendentes devem morrer após a redefinição). Consequência aceita: ao reenviar a confirmação, JWTs anteriores seguem válidos até expirar — risco baixo, pois todos confirmam a mesma conta.

### auth/TD-07

**Recommendation:** respeita o transporte SMTP já definido na arquitetura, é idiomático no NestJS e permite desenvolver/testar todo o fluxo de e-mail localmente sem enviar mensagens reais.
**Libraries:** @nestjs-modules/mailer, nodemailer, handlebars

### auth/TD-08

**Recommendation:** é barato adicionar junto com os endpoints de auth e protege diretamente os fluxos sensíveis desta fase. O limite em memória é aceitável agora; trocar por store compartilhado é um ajuste futuro.
**Libraries:** @nestjs/throttler

### auth/TD-09

**Recommendation:** mantém o escopo coeso e respeita o adiamento do Next.js da Fase 01.
**Libraries:** —

**Revisions:**
- 2026-07-17 — Links de e-mail passam a apontar para paths de página dedicados (`/confirm-account`, `/reset-password`), distintos dos paths da API. Rationale: a implementação inicial apontava para `/auth/confirm` e `/auth/reset-password`, que só aceitam POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca alcançaria a rota. A página lê o `token` da query string e então chama o POST real da API.
- 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`, com o link do e-mail voltando a apontar direto para a API; o reset de senha permanece apontando para a página `/reset-password`. Rationale: a confirmação não exige nenhum dado do usuário além do token, dispensando tela intermediária; o reset exige formulário para a nova senha. Trade-off aceito: `GET` é pré-buscável por scanners/proxies de e-mail, podendo disparar a confirmação automaticamente — risco baixo dado o token assinado e expirável (24h).
- 2026-08-22 — Campo `Capability:` trocado de "Telas de cadastro, login, confirmação de conta e recuperação de senha" para `Transversal — covers:` com os sete bullets que a slice `auth` reivindica em `covers_capabilities`. Rationale: sob o modelo de slicing, o bullet das telas passou a ser propriedade da slice irmã `auth-frontend`, e o `Capability:` é o campo pelo qual o `/plan-build` agrupa TDs — apontando para fora do escopo declarado, a TD ficaria órfã no artefato final. A decisão (Option A — backend-only) não muda; o adiamento das telas segue descrito na prosa e registrado em `## Non-UI / Deferred Capabilities` (validation.md IC-2).

### auth/TD-10

**Recommendation:** determinística e previsível.
**Libraries:** —

### auth/TD-11

**Recommendation:** alinhada à recomendação atual do OWASP.
**Libraries:** class-validator

### auth/TD-12

**Recommendation:** equilíbrio padrão.
**Libraries:** —

### auth/TD-13

**Recommendation:** protege os fluxos sensíveis com folga para uso legítimo.
**Libraries:** @nestjs/throttler

### auth/TD-14

**Recommendation:** comportamento padrão esperado.
**Libraries:** —

### auth/TD-15

**Recommendation:** suficiente nesta fase; token anti-CSRF pode entrar num hardening futuro.
**Libraries:** —

### auth/TD-16

**Recommendation:** o reenvio de confirmação (já previsto) cobre a falha sem acoplar o cadastro ao SMTP.
**Libraries:** —

### auth/TD-17

**Recommendation:** encerrar tudo é a postura segura e alinha com o uso único dos tokens (TD-06).
**Libraries:** —

### auth/TD-18

**Recommendation:** a Option B só se sustenta enquanto o auth for o único consumidor de `User`, o que deixa de valer já na fase de canal/vídeos.
**Libraries:** typeorm

### auth/TD-19

**Recommendation:** preserva o contrato obrigatório do TypeORM dentro da transação sem tornar todo chamador refém de abrir uma.
**Libraries:** typeorm

**Revisions:**
- 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio (antes registradas inline como `DT-A`/`DT-B` em `docs/phases/phase-02-auth-refactor.md`). Rationale: mantinham um terceiro namespace de IDs fora de `docs/decisions/`, invisível para o pipeline; promovidas a TD-18/TD-19 na migração de formato.

### http-error-contract/TD-01

**Recommendation:** é a única que resolve o problema que está de fato aberto sem reabrir o que já funciona. A Option A congela um contrato que deixa `auth-frontend/TD-11` sem matéria-prima: sem `details`, distinguir "e-mail inválido" (erro de campo) de "credenciais inválidas" (erro de formulário) obrigaria o frontend a inferir do `statusCode` ou do texto, que é exatamente o acoplamento frágil que um contrato deveria eliminar. A Option C paga o custo de reescrever filtro, catálogo e suítes e2e por interoperabilidade externa que nenhum requisito pede. A Option B é aditiva: `details` é opcional, nada do que existe quebra, e as e2e atuais continuam válidas sem edição.
**Libraries:** —

### http-error-contract/TD-02

**Recommendation:** é a que casa com a TD-01 Option B e a única que dá ao frontend um tipo sobre o qual dá para escrever código sem narrowing. O custo real da Option A (o filtro precisa conhecer o shape do `ValidationPipe`) é contido: é um ponto único no código, coberto por `http-exception.filter.spec.ts`, e uma quebra em major do NestJS aparece nesse teste. A Option B tem o mesmo efeito de tipagem por um preço pior — obriga a editar as 8 suítes e2e existentes e deixa um array de um elemento como forma canônica. A Option C é o estado atual, que é o problema.
**Libraries:** —

### http-error-contract/TD-03

**Recommendation:** é a única compatível com a comunicação dirigida por contrato que o `CLAUDE.md` fixa como princípio do projeto, e reusa um pipeline que já existe e já está pago. A Option B resolve o mesmo problema abrindo um segundo canal de contrato e exigindo uma decisão de tooling de monorepo (workspaces, contexto de build do Docker) desproporcional ao ganho. A Option C é descartável por um caso concreto e imediato: `EMAIL_JA_EXISTE` e `EMAIL_JA_CONFIRMADO` compartilham o `409` e exigem telas diferentes — sem o código, o frontend não consegue distingui-los. A janela de defasagem da spec é real, mas é a mesma que todo o resto do contrato já aceita, e `scripts/check-api-types-drift.sh` existe para detectá-la.
**Libraries:** @nestjs/swagger, openapi-typescript

## Inherited Decisions Detail

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

### openapi-spec/TD-01

**Recommendation:** o backend de auth já está implementado e validado por `class-validator`, então o code-first documenta o que existe hoje sem retrabalho e sem risco de divergência; a Option B só se paga quando o contrato precisa preceder a implementação em times paralelos, o que não é o caso, e a Option C reabre a decisão de validação de `config/TD-03` por um benefício tangencial.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-02

**Recommendation:** o plugin elimina o boilerplate e mantém a spec sincronizada com as regras de `class-validator` já escritas, enquanto o `@ApiProperty()` reservado para exemplos e casos ambíguos evita a duplicação sistemática da Option B; o critério de override deve ficar registrado no `nestjs-project/CLAUDE.md`.
**Libraries:** @nestjs/swagger

### openapi-spec/TD-03

**Recommendation:** entrega o valor real da UI (explorar a API em desenvolvimento) sem ampliar a superfície exposta em produção nem introduzir um segundo esquema de autenticação; se um integrador externo surgir, a Option C continua alcançável ligando a flag e adicionando o guard, sem desfazer nada.
**Libraries:** @nestjs/swagger, @nestjs/config

### openapi-spec/TD-04

**Recommendation:** versionar o contrato é o que torna uma quebra de compatibilidade visível no code review, e é o único caminho compatível tanto com o CLI plugin da TD-02 quanto com codegen de frontend offline; o custo de defasagem se resolve depois com um check no CI da Fase 07 (`git diff --exit-code openapi.json` após regerar). O arquivo mora em `nestjs-project/` porque `docs/` é reservado a documentação autoral, não a artefato gerado.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

**Revisions:**
- 2026-08-08 — Geração do `openapi.json` é **sob demanda**, não acoplada ao build: `openapi:generate` é um script standalone invocado manualmente (dentro do container, ex.: `docker compose run --rm nestjs-api npm run openapi:generate`), nunca um hook de `postbuild` nem etapa obrigatória do pipeline. Rationale: o bootstrap do `AppModule` inicializa `TypeOrmModule` e valida todo o schema Joi, exigindo Postgres, Mailpit e todas as variáveis obrigatórias no ar — e o host `db` só resolve dentro da rede do Compose (convenção herdada da fase 02). Como o contrato muda com pouca frequência, rodar sob demanda paga esse custo apenas quando a spec realmente precisa ser regerada, em vez de tornar todo `nest build` dependente da infraestrutura.

### openapi-spec/TD-05

**Recommendation:** dá a garantia essencial (mudança incompatível de contrato falha no `tsc` do frontend) com a menor superfície de dependência e sem antecipar a decisão de data fetching do frontend, que deve ser tomada quando as telas entrarem em escopo; a Option C carrega essa decisão junto e a Option B cobra custo de código gerado e instabilidade de `0.x` por uma DX marginalmente melhor. A adoção pode ficar **diferida** até as telas existirem — o que este TD fixa agora é a estratégia, para que a TD-04 gere o artefato no formato certo.
**Libraries:** openapi-typescript, openapi-fetch

### openapi-spec/TD-06

**Recommendation:** é a única que descreve fielmente o contrato já decidido em `auth/TD-03` sem alterar a implementação de autenticação; a Option B compra conveniência de teste ao preço de reabrir uma decisão de segurança fechada, o que não se justifica.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### openapi-spec/TD-07

**Recommendation:** é o único caminho que mantém a spec fiel por endpoint sem o custo de repetição da Option A nem a imprecisão da Option C; com poucos endpoints hoje, criar os três decoradores agora é barato e evita que a convenção se degrade quando vídeos e comentários multiplicarem os controllers.
**Renders in:** ui-contracts
**Libraries:** @nestjs/swagger

### next-frontend-api-typing/TD-01

**Recommendation:** é a única que entrega a garantia de type-check **sem** tocar no isolamento do Compose, que a restrição de `build.context` torna caro nas outras duas; o custo real (tipos defasados) é exatamente o que o check de drift no CI elimina, e o diff visível do `.d.ts` no PR é um efeito colateral desejável quando o backend muda um DTO. A Option C é a resposta certa para o dia em que houver um segundo consumidor da spec, não hoje.
**Libraries:** openapi-typescript

### next-frontend-api-typing/TD-02

**Recommendation:** dado que o `openapi.json` e os DTOs já são a fonte de verdade upstream, derivar por utility types entrega a honestidade da Option C com o custo da Option A, e é a única que mantém o vínculo de build sem inventar infraestrutura; a Option D é sedutora mas paga engenharia de tipos própria para resolver a metade fácil do problema, e a Option A já nasce errada no primeiro endpoint do projeto que é `auth`.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-api-typing/TD-03

**Recommendation:** o risco que as Options B e C endereçam é o de spec defasada, e esse risco tem uma correção mais barata e mais a montante (o check de drift do TD-01, mais a conferência da resposta de `/auth/login` no backend); introduzir schemas Zod à mão agora recria a segunda fonte de verdade que a `openapi-spec/TD-05` foi escolhida para eliminar. Reavaliar quando existir codegen de schemas Zod **a partir da spec** — aí a Option C passa a custar quase nada e a recomendação muda.
**Renders in:** frontend-runtime
**Libraries:** —

### next-frontend-env-config/TD-01

**Recommendation:** a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle). Com 2 variáveis hoje o custo parece desproporcional, mas as fases 03–07 acrescentam base URL de storage, chaves de player e provavelmente analytics — todas atravessando essa fronteira. Option B é a escolha defensável se a preferência for não adicionar dependência: entrega o mesmo resultado com mais disciplina exigida. Option A está descartada — reabre por omissão a decisão que `config/TD-01` fechou.
**Renders in:** frontend-runtime
**Libraries:** @t3-oss/env-nextjs

### next-frontend-env-config/TD-02

**Recommendation:** a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois. Option B é a escolha certa se o peso do bundle do cliente for tratado como restrição dura — o ganho é real, o custo é ecossistema menor. Option D é simetria aparente que não se sustenta tecnicamente: Joi não gera tipos nem compõe com a TD-01 Option C.
**Libraries:** zod

### next-frontend-env-config/TD-03

**Recommendation:** preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável. Option B é a resposta certa se a simetria estrutural literal com `src/config/` for o objetivo declarado — é defensável, custa organização antecipada. Option A é suficiente e honesta se a expectativa for que o front nunca passe de ~5 variáveis.
**Libraries:** —

### next-frontend-env-config/TD-04

**Recommendation:** manter browser e API na mesma origem é o que faz esse cookie funcionar sem exceção. Option A é a escolha pragmática se a intenção for aceitar imagens por ambiente; Option B é a mais correta conceitualmente para uma imagem promovível, mas cobra prerender estático justamente na home da Fase 07, que é onde o estático mais vale.
**Libraries:** —

### next-frontend-env-config/TD-05

**Recommendation:** reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real. Option B é a escolha certa se determinismo absoluto do suite valer mais que a duplicação das chaves. Option C deve ser descartada por incompatibilidade de ordem de execução com a validação-no-import da TD-01, não por preferência.
**Libraries:** @next/env

### next-frontend-msw-base/TD-01

**Recommendation:** é o único caminho que dá `setupFiles` por lane, o que a TD-04 precisa para não misturar as duas superfícies de fake, e é o mecanismo que a documentação do Vitest 4 indica depois de remover `environmentMatchGlobs`. O custo é verbosidade num arquivo que se escreve uma vez; o custo das outras duas é uma classe de erro recorrente cuja mensagem não aponta para a causa.
**Renders in:** frontend-runtime
**Libraries:** vitest

### next-frontend-msw-base/TD-02

**Recommendation:** a diferença de velocidade só se paga com uma suíte grande, que este projeto não tem e não terá tão cedo, enquanto a diferença de cobertura cobra logo no primeiro teste de componente que abrir um overlay do Radix. Escolher `jsdom` também elimina a divergência com a documentação do Next.js. Se a decisão for esta, a skill `testing-guide-next-frontend` precisa ter o template de `vitest.config.ts` corrigido no mesmo commit — hoje ela diz `happy-dom`.
**Renders in:** frontend-runtime
**Libraries:** jsdom

### next-frontend-msw-base/TD-03

**Recommendation:** é a única que fecha o buraco que a `next-frontend-api-typing/TD-03` conscientemente deixou aberto, e ela o fecha no lugar mais barato (build do teste, não runtime de produção). Vale um efeito colateral concreto: com a verificação de status, o fixture de `POST /auth/login` vai acusar de imediato a imprecisão já confirmada na spec do backend, que declara `RegisterResponseDto` como resposta 200 do login. Se adotada, decidir junto como `mocks/` acessa `paths` — reexportar o tipo por `lib/api/contracts.ts` mantém a regra de importação vigente sem carve-out; abrir exceção para `mocks/` é a alternativa mais direta e mais frouxa. Verificar a compatibilidade da versão de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0 no momento da instalação.
**Renders in:** frontend-runtime
**Libraries:** openapi-msw, msw

### next-frontend-msw-base/TD-04

**Recommendation:** preserva o padrão de default + override que o projeto já adotou e evita o efeito mais nocivo da Option A, que é embaralhar duas fronteiras com garantias de tipagem diferentes logo no arquivo onde a TD-03 quer precisão. Com uma única rota de BFF hoje, B e C custam quase o mesmo; a diferença aparece na terceira rota, e B é a que não precisa ser refeita lá. Se a TD-01 não for decidida como Option A, esta TD deve cair para a Option C, não para a A — sem `setupFiles` por lane, a composição da Option B não tem onde acontecer.
**Renders in:** frontend-runtime
**Libraries:** —

**Revisions:**
- 2026-08-15 — O "conjunto pertinente" de cada lane é fixado explicitamente: `node` recebe apenas `handlers`; a lane de DOM, apenas `bffHandlers`. Rationale: restrição técnica provada na implementação — `mocks/handlers.ts` importa `@/lib/env`, e `@t3-oss/env-core` lança `Attempted to access a server-side environment variable on the client` sob jsdom, então a separação deixa de ser preferência de design e passa a ser obrigatória numa das direções.

## Inherited Conventions

_Preservadas da revisão anterior deste `context.md`. O `phases-reader` desta execução retornou vazio, e a checagem confirmou que `docs/phases/phase-01-config/phase-01-config.md` de fato não tem seção `Conventions to Match` — as convenções abaixo foram sintetizadas numa execução anterior a partir de `config/TD-01` a `config/TD-04` e das regras do repositório. Mantidas por serem verificadamente corretas; deixá-las cair removeria restrições load-bearing do artefato._

- Configuração acessada exclusivamente via namespaces tipados (`registerAs` + `ConfigType`) — sem magic strings e sem `process.env` no código da aplicação _(from phase 01)_
- Entrypoints fora do container DI (CLI TypeORM, seeds) reusam a função pura `buildDatabaseOptions` em vez de remontar opções de conexão _(from phase 01)_
- Validação de ambiente com Joi no boot: variável obrigatória ausente derruba a aplicação _(from phase 01)_
- Hosts de serviço sempre pelo nome do serviço Compose (`db`, `mailpit`), nunca `localhost` _(from phase 01)_
- `synchronize: false` no TypeORM — mudanças de schema só via migrations versionadas _(from phase 01)_
- Prosa em português, identificadores e rótulos estruturais em inglês _(from phase 01)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## UI Inventory

_No screen inventory — UI↔API sync deferred. Run /screen-inventory auth and then rerun /plan-context auth to activate UI checks._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | Fase entregue backend-only; o Next.js não estava inicializado no planejamento. A capability foi depois reivindicada pela slice irmã `auth-frontend` | auth/TD-09 |

_Linha preservada da revisão anterior contra a regra literal de idempotência: o registro do adiamento é a única memória de que esta slice conscientemente não entregou as telas, e regenerá-lo como `_None._` apagaria a justificativa de `auth/TD-09`._

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service com branching + DB | Unit: lógica de branch (repo mockado) + Integration: contrato de DB |
| Service só com DB (sem branching) | Integration: contrato de DB |
| Service com lib configurada (JWT, cache) | Unit: lib real com config de teste |
| Service com dependência de efeito colateral (e-mail, storage) | Integration: serviço de captura real (Mailpit) ou adaptador local |
| Module com imports configurados | Unit: teste de compilação |
| Controller (`*.controller.ts`) | E2E apenas — NÃO escrever testes unitários |
| DTO (`*.dto.ts`) | E2E: um teste de wiring de validação por endpoint |
| Guard que delega lógica de negócio ao service | E2E + Unit se houver lógica interna complexa |
| Guard simples que delega ao Passport | E2E apenas |
| Strategy (Passport) | E2E via guard |
| Pipe (`*.pipe.ts`) | Unit |
| Interceptor (`*.interceptor.ts`) | Unit e/ou E2E |
| Exception Filter (`*.filter.ts`) | Unit + E2E |
| Middleware (`*.middleware.ts`) | E2E |

### next-frontend

_Sem implementação nesta slice — os requisitos de teste do frontend pertencem à slice irmã `auth-frontend`._
