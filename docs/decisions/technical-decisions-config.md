---
scope_type: phase
related_phases: [1]
status: decided
date: 2026-06-15
scope_description: "Sistema de configuração tipada do backend: acesso, organização por domínio, validação de schema e uso fora do container DI"
---

# Technical Decisions — Sistema de Configuração

_Subprojects in scope:_

- `nestjs-project/` — alvo exclusivo destas decisões (config tipada, namespaces por domínio, validação Joi, loader compartilhado com o CLI do TypeORM)
- `next-frontend/` — sem decisão em aberto nesta fase: o Next.js foi explicitamente adiado (ver `auth/TD-09`)

## Contexto e Restrições

A base de configuração já existe (`@nestjs/config@^4.0.4`, `joi@^18.2.1`, `ConfigModule.forRoot` global com schema Joi). Estas decisões tratam de **evoluir** esse sistema para eliminar leituras diretas de `process.env` e organizar as variáveis por domínio.

Restrições herdadas (não reabrir):

- NestJS 11 + TypeScript + Express; PostgreSQL + TypeORM.
- Docker Compose: host sempre por nome de serviço (`db`, `mailpit`), nunca `localhost`.
- Joi e `@nestjs/config` já instalados e em uso.

---

## TD-01: Estratégia de acesso tipado à configuração

**Scope:** Backend

**Capability:** Transversal — covers: Projeto Next.js (frontend) (será criado depois, não agora) e Nest.js (backend) inicializados; Ambiente de desenvolvimento local com todos os serviços via Docker Compose

**Context:** Hoje o acesso é por magic string (`config.get<string>('DB_HOST')` em `database.module.ts`) e há `process.env` direto em `main.ts`. Precisamos de um padrão único, tipado, para consumir config sem strings soltas nem `process.env` espalhado.

**Options:**

### Option A: Manter `ConfigService.get<T>('KEY')`
- Continua usando o `ConfigService` global com chaves em string e generic de tipo.
- **Pros:** zero mudança estrutural; já funciona; sem boilerplate.
- **Cons:** chaves não tipadas (typo só falha em runtime); tipo do retorno é uma promessa não verificada; sem autocompletar.

### Option B: Config namespaced com `registerAs` + injeção via `ConfigType`
- Cada domínio vira um objeto tipado (`registerAs('database', () => ({...}))`), injetado com `@Inject(databaseConfig.KEY)` e `ConfigType<typeof databaseConfig>`.
- **Pros:** tipagem forte real + autocompletar; sem magic strings; agrupa naturalmente as variáveis (resolve TD-02); padrão oficial NestJS 11.
- **Cons:** um pouco mais de setup inicial (um arquivo por namespace + `forFeature`).

### Option C: Classe `AppConfigService` (wrapper com getters tipados)
- Um serviço próprio encapsula o `ConfigService` expondo getters tipados (`get dbHost(): string`).
- **Pros:** ponto único de acesso; tipado; fácil de mockar em teste.
- **Cons:** boilerplate manual cresce com cada variável; reimplementa o que `ConfigType` já entrega de graça.

**Recommendation:** Option B (`registerAs` + `ConfigType`) — é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (TD-02).

**Decision:** Option B — config namespaced com `registerAs` + injeção tipada via `ConfigType`.

**Libraries:** @nestjs/config

**Revisions:**

- 2026-08-10 — A decisão passa a ter duas metades com alcances distintos: o **mecanismo** (`registerAs` + `ConfigType`) fica restrito ao `nestjs-project/`; o **princípio** ("sem magic strings e sem `process.env` no código da aplicação, concentrado num loader único") é promovido a transversal do monorepo.
  **Rationale:** `registerAs` e `ConfigType` são API de `@nestjs/config` e não existem no Next.js, mas o TD era herdado literalmente como convenção pelo `next-frontend/`, gerando um conflito (`ICC-2` em `docs/tasks/task-next-frontend-env-config/validation.md`) contra `next-frontend-env-config/TD-01`, que adotou `@t3-oss/env-nextjs` + `createEnv`. A adoção honra integralmente o princípio — toda leitura de `process.env` fica num módulo único, validado na importação — e diverge apenas na API, que é intransportável entre as stacks. Completa a delimitação que a Revision de 2026-08-09 em TD-02 iniciou.

---

## TD-02: Organização das variáveis (namespacing por domínio)

**Scope:** Backend

**Capability:** Transversal — covers: Projeto Next.js (frontend) (será criado depois, não agora) e Nest.js (backend) inicializados; Ambiente de desenvolvimento local com todos os serviços via Docker Compose

**Context:** O usuário pediu explicitamente para definir "como organizar as variáveis". Hoje estão num único `Joi.object` plano em `env.validation.ts`. Depende de TD-01.

**Options:**

### Option A: Schema único plano (atual)
- Todas as variáveis num só objeto; acesso por chave global.
- **Pros:** simples; tudo num lugar enquanto há poucas variáveis.
- **Cons:** não escala — ao crescer (storage, fila, auth) vira uma lista grande sem fronteiras de domínio.

### Option B: Namespaces por domínio em `src/config/`
- Um arquivo de config por domínio (`database.config.ts`, `mail.config.ts`, `app.config.ts`), cada um com `registerAs`; registrados via `ConfigModule.forRoot({ load: [...] })` ou `forFeature`.
- **Pros:** fronteiras claras por domínio; cada módulo importa só o que precisa; escala com as próximas fases; alinha com Single Responsibility do projeto.
- **Cons:** mais arquivos; exige convenção de nomenclatura consistente.

**Recommendation:** Option B (namespaces por domínio) — agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da TD-01 B. _(Depende de TD-01.)_

**Decision:** Option B — namespaces por domínio (`app`, `database`, `mail`) em `src/config/`.

**Libraries:** @nestjs/config

**Revisions:**

- 2026-08-09 — O namespacing por domínio passa a reger também o `next-frontend/`, que ganha base própria de configuração de ambiente.
  **Rationale:** o TD-02 nasceu com `**Scope:** Backend` porque `auth/TD-09` adiara o frontend; com o Next.js entrando em escopo, o princípio de "um arquivo de config por domínio, sem leitura direta de `process.env` fora do loader" é reafirmado como transversal ao monorepo. A **mecânica** permanece específica de cada stack: `registerAs` + `ConfigModule.forRoot({ load })` continua exclusivo do `nestjs-project/`; o equivalente no `next-frontend/` (biblioteca de validação, separação server/client das variáveis, cisão `API_BASE_URL` vs `NEXT_PUBLIC_API_BASE_URL`) não é decidido aqui e requer TD próprio.

---

## TD-03: Biblioteca/abordagem de validação do schema

**Scope:** Backend

**Capability:** Ambiente de desenvolvimento local com todos os serviços via Docker Compose

**Context:** A validação na borda (falhar o boot se faltar variável) já roda com Joi. Vale revisitar ao reorganizar, já que a abordagem de validação interage com a tipagem (TD-01).

**Options:**

### Option A: Manter Joi (`validationSchema`)
- Continua com `Joi.object({...})` passado a `ConfigModule.forRoot`. Validação separada da tipagem TS.
- **Pros:** já instalado e funcionando; suporta defaults, `.port()`, coerção; zero dependência nova.
- **Cons:** o schema Joi e os tipos TS são definidos separadamente (duas fontes de verdade para a forma da config).

### Option B: class-validator + class-transformer (função `validate`)
- Define uma classe `EnvironmentVariables` com decorators e uma função `validate` passada ao `forRoot`.
- **Pros:** a própria classe vira a fonte de tipos; mesmo ecossistema usado em DTOs.
- **Cons:** adiciona 2 dependências; mais verboso para regras simples; classe ainda não usada no projeto.

### Option C: Zod (`createZodValidationPipe`/função `validate` custom)
- Schema Zod único que valida e infere tipos (`z.infer`) numa só definição.
- **Pros:** validação + tipos numa fonte só; DX moderna.
- **Cons:** dependência nova; não é o padrão default do `@nestjs/config`; substituiria o Joi já em uso.

**Recommendation:** Option A (manter Joi) — já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da TD-01 (B), não da lib de validação.

**Decision:** Option A — manter Joi (`validationSchema`).

**Libraries:** joi

**Revisions:**

- 2026-08-10 — A escolha de **Joi** fica delimitada ao `nestjs-project/`. O que rege o monorepo é o **comportamento** — validação de schema no boot, com variável obrigatória ausente derrubando a aplicação —, não a biblioteca que o implementa.
  **Rationale:** o TD era herdado literalmente como convenção pelo `next-frontend/`, gerando um conflito (`ICC-1` em `docs/tasks/task-next-frontend-env-config/validation.md`) contra `next-frontend-env-config/TD-02`, que adotou Zod v4. Joi é dependência de `nestjs-project/` e não se transporta: não implementa Standard Schema (logo não compõe com o `createEnv` de `next-frontend-env-config/TD-01`), não deriva tipos TypeScript do schema, e não é tree-shakeable no browser — o que a inviabiliza para a validação de formulários que o frontend terá. O comportamento exigido é preservado: `createEnv` valida na importação do módulo, derrubando o processo antes do primeiro request.

---

## TD-04: Configuração em contextos fora do container DI (CLI TypeORM e seeds)

**Scope:** Backend

**Capability:** Estrutura inicial do banco de dados PostgreSQL (schema, migrations e seeds) (sem tabelas ainda)

**Context:** `data-source.ts` (CLI de migrations) e `seed.ts` rodam fora do DI do Nest, então não têm acesso fácil ao `ConfigService` — por isso leem `process.env` direto hoje. Precisamos de um padrão que evite duplicar a montagem das opções de DB.

**Options:**

### Option A: Manter `process.env` direto nesses scripts (+ `dotenv`)
- Scripts CLI continuam lendo `process.env` com `dotenv` carregando `.env`.
- **Pros:** simples; é o padrão comum para entrypoints CLI do TypeORM.
- **Cons:** duplica a leitura das mesmas variáveis em 2+ arquivos; sem validação; divergência silenciosa do app Nest.

### Option B: Loader de config compartilhado (função pura reaproveitada)
- Extrair uma função pura (ex.: `buildDatabaseOptions(env)`) usada pela factory `registerAs('database')` **e** por `data-source.ts`/`seed.ts`.
- **Pros:** fonte única de verdade para opções de DB; consistência entre app e CLI; testável.
- **Cons:** exige cuidado para a função não depender do runtime do Nest (manter pura).

**Recommendation:** Option B (loader compartilhado) — uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.

**Decision:** Option B — loader/função pura compartilhada entre o app Nest e os scripts CLI.

**Libraries:** typeorm

---

## Notas de implementação

- Incluir `PORT` (lido em `main.ts`) e `NODE_ENV` no namespace `app` com validação, fechando a lacuna atual de variáveis lidas mas não validadas.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Estratégia de acesso tipado à config | `registerAs` + `ConfigType` (Option B) | **Option B** |
| TD-02 | Backend | Organização das variáveis (namespacing) | Namespaces por domínio (Option B) | **Option B** |
| TD-03 | Backend | Biblioteca de validação | Manter Joi (Option A) | **Option A** |
| TD-04 | Backend | Config fora do DI (CLI/seeds) | Loader compartilhado (Option B) | **Option B** |
