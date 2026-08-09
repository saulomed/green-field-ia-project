---
kind: phase
name: phase-01-config
affected_subprojects: [nestjs-project]
sources_mtime:
  docs/decisions/technical-decisions-config.md: "2026-08-08T20:15:50Z"
---

# Fase 01 — Configuração Base do Projeto

## Objective

Estabelecer a fundação do monorepo: versionamento Git único, ambiente de desenvolvimento via Docker Compose, gestão de configuração tipada e organizada por domínio (sem leitura direta de `process.env`) e fundação de banco PostgreSQL com TypeORM (migrations e seeds, sem tabelas), além de formalizar a fundação de IA para coding.

---

## Step Implementations

### SI-01.1 — Consolidação do monorepo e versionamento Git

**Description:** Unificar o projeto em um único repositório Git na raiz e estabelecer a estratégia de branches.

**Technical actions:**

- Inicializar um repositório Git único na raiz do monorepo (`green-field-ai-project/`).
- Remover o `.git` aninhado de `nestjs-project/`, incorporando seus arquivos ao repositório raiz.
- Criar `.gitignore` na raiz cobrindo `node_modules/`, `dist/`, `coverage/`, `.env` e artefatos de IDE.
- Criar as branches de longa duração `main` (estável) e `dev` (integração), conforme Git Flow.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- A raiz é um repositório Git único; `git status` na raiz rastreia `nestjs-project/`, `docs/` e `.claude/`.
- Não existe diretório `.git` aninhado em `nestjs-project/`.
- As branches `main` e `dev` existem (`git branch` lista ambas).
- `.env`, `node_modules/` e `dist/` não aparecem em `git status` (ignorados).

---

### SI-01.2 — Ambiente de desenvolvimento via Docker Compose

**Description:** Finalizar e validar o ambiente Docker com os serviços de fundação (api, db, mailpit).

**Technical actions:**

- Consolidar `nestjs-project/compose.yaml` com `nestjs-api`, `db` (postgres:17) e `mailpit`.
- Externalizar credenciais e portas para um arquivo `.env` (via `env_file`/`environment`) e versionar `.env.example`.
- Garantir healthcheck do `db` (`pg_isready`) e `depends_on: condition: service_healthy` na API.
- Confirmar que hosts internos usam nomes de serviço (`db`, `mailpit`) e nunca `localhost`.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose -f nestjs-project/compose.yaml up -d` sobe os três serviços com status running.
- `docker compose ... exec db pg_isready -U streamtube` retorna "accepting connections".
- A UI do Mailpit responde na porta 8025 e o SMTP na 1025.
- A API só inicia após o `db` reportar healthy.

---

### SI-01.3 — Gestão de configuração tipada e namespaced (@nestjs/config)

**Description:** Centralizar, validar e organizar as variáveis de ambiente por domínio, expondo acesso tipado e eliminando leituras diretas de `process.env` no código da aplicação. _(Decisões: `config/TD-01` `registerAs`+`ConfigType`, `config/TD-02` namespaces por domínio, `config/TD-03` manter Joi, `config/TD-04` loader compartilhado.)_

**Technical actions:**

- Criar arquivos de configuração namespaced em `src/config/` com `registerAs` (`@nestjs/config@^4.0.0`): `app.config.ts` (`PORT`, `NODE_ENV`), `database.config.ts` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) e `mail.config.ts` (`MAIL_HOST`, `MAIL_PORT`).
- Extrair uma função pura `buildDatabaseOptions(env)` (reaproveitável fora do DI do Nest) e usá-la como factory do namespace `database` — fonte única das opções de conexão (per `config/TD-04`).
- Manter a validação com Joi em `src/config/env.validation.ts` cobrindo todas as variáveis — incluindo `PORT` e `NODE_ENV` com defaults (`3000`, `development`) — falhando o boot se ausentes/inválidas; documentar `PORT`/`NODE_ENV` em `.env.example`.
- Registrar `ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig, mailConfig], validationSchema })` no `AppModule`.
- Atualizar `src/main.ts` para obter a porta via `ConfigService` (namespace `app`), eliminando o `process.env.PORT` direto.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `env.validation` (schema Joi) | Unit: rejeita variável obrigatória ausente/inválida e aplica os defaults de `PORT`/`NODE_ENV` | `src/config/env.validation.spec.ts` |
| `buildDatabaseOptions` | Unit: monta as opções do Postgres a partir do env (host = nome de serviço, porta numérica) | `src/config/database.config.spec.ts` |

**Dependencies:** SI-01.2

**Acceptance criteria:**

- A aplicação falha ao iniciar com erro de validação se uma variável obrigatória (`DB_*`, `MAIL_*`) estiver ausente.
- Variáveis são acessíveis de forma tipada por namespace (`ConfigType<typeof databaseConfig>`), sem magic strings nem `process.env` no código da aplicação.
- `PORT` ausente assume o default `3000` e a aplicação sobe nessa porta; `NODE_ENV` ausente assume `development`.
- `.env.example` lista todas as variáveis com `DB_HOST=db` e `MAIL_HOST=mailpit` (nomes de serviço, nunca `localhost`).

---

### SI-01.4 — Fundação do banco de dados com TypeORM (sem tabelas)

**Description:** Configurar TypeORM, DataSource e ferramentas de migration, sem criar entidades/tabelas.

**Technical actions:**

- Instalar `@nestjs/typeorm@^11.0.0`, `typeorm@^0.3.0` e `pg@^8.0.0`.
- Criar `src/database/data-source.ts` exportando um `DataSource` cujas opções vêm de `buildDatabaseOptions(process.env)` (fonte única compartilhada com o namespace `database`, per `config/TD-04`), com `synchronize:false`, `migrationsTableName` e globs de `migrations` e `entities`.
- Registrar `TypeOrmModule.forRootAsync` em um `DatabaseModule` global injetando `databaseConfig` (`ConfigType<typeof databaseConfig>`), sem acesso por string ao `ConfigService`.
- Adicionar scripts ao `package.json` (`migration:generate`, `migration:run`, `migration:revert`, `migration:show`) via TypeORM CLI apontando para `data-source.ts`.
- Criar o diretório vazio `src/database/migrations/` (sem entidades/tabelas ainda).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `DatabaseModule` / `DataSource` | Integration: app boota e o DataSource conecta ao Postgres real (serviço `db`); `synchronize` desativado não cria tabelas | `src/database/database.integration.spec.ts` |

**Dependencies:** SI-01.3

**Acceptance criteria:**

- A aplicação inicia e conecta ao Postgres (`db`) sem entidades registradas.
- `npm run migration:run` executa sem erro e cria apenas a tabela de controle `typeorm_migrations` (nenhuma migration de domínio).
- `synchronize` está desativado — nenhuma tabela de domínio é criada automaticamente.
- O DataSource resolve host e credenciais via `buildDatabaseOptions` — mesma fonte de opções usada pelo `DatabaseModule`.

---

### SI-01.5 — Infraestrutura de seeds

**Description:** Estabelecer o runner e a estrutura de seeds, sem seeders de dados (não há tabelas).

**Technical actions:**

- Criar `src/database/seeds/seed.ts` que inicializa um `DataSource` a partir de `buildDatabaseOptions(process.env)` (mesma fonte do app/CLI, per `config/TD-04`) e executa seeders registrados.
- Adicionar script `seed` ao `package.json` executando o runner via ts-node.
- Estabelecer o diretório `src/database/seeds/` com um orquestrador, sem seeders de dados.
- Documentar como registrar novos seeders em fases futuras.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-01.4

**Acceptance criteria:**

- `npm run seed` executa o runner sem erro e finaliza com código de saída 0 (nenhum dado inserido — sem tabelas).
- O runner usa a mesma fonte de opções de DB (`buildDatabaseOptions`) que o app e o `data-source.ts`.

---

### SI-01.6 — Formalização da fundação de IA para coding

**Description:** Documentar e verificar os ativos de IA já existentes no repositório.

**Technical actions:**

- Criar `docs/ai-foundation.md` documentando skills (`.claude/skills/`), rules (`.claude/rules/`), `skills-lock.json`, `.mcp.json` (servidor postgres) e os `CLAUDE.md` (raiz + `nestjs-project`).
- Verificar a integridade do `skills-lock.json` (hashes das skills externas).
- Documentar a configuração do MCP postgres e como conectá-lo ao banco local `streamtube`.
- Garantir que `.claude/` é versionado no repositório raiz (referência cruzada com SI-01.1).

**Tests:** _(empty — Infra)_

**Dependencies:** SI-01.1

**Acceptance criteria:**

- `docs/ai-foundation.md` existe e lista skills, rules, MCP e arquivos `CLAUDE.md`.
- `.claude/` é rastreado pelo Git na raiz.
- A documentação descreve como o servidor MCP postgres conecta ao banco `streamtube`.

---

## Technical Specifications

_Omitida: a Fase 01 é puramente de infraestrutura — não introduz entidades de banco (sem tabelas) nem endpoints HTTP, portanto nenhuma subseção do checklist de aplicabilidade se aplica._

---

## Dependency Map

```
SI-01.1 (root)
└── SI-01.6 — depends on SI-01.1 (o `.claude/` precisa estar versionado na raiz)
SI-01.2 (root, independent)
└── SI-01.3 — depends on SI-01.2 (as variáveis vêm do ambiente Compose)
    └── SI-01.4 — depends on SI-01.3 (o DataSource consome `buildDatabaseOptions`)
        └── SI-01.5 — depends on SI-01.4 (o runner reusa o DataSource)
```

## Deliverables

- [x] Repositório Git único na raiz, com branches `main` e `dev`, e sem `.git` aninhado em `nestjs-project/`
- [x] Ambiente Docker Compose (db/api/mailpit) sobe e o `db` reporta healthy
- [x] `@nestjs/config` com namespaces tipados (`app`/`database`/`mail`), validação Joi (incl. `PORT`/`NODE_ENV` com defaults) e `.env.example` documentado (`DB_HOST=db`, `MAIL_HOST=mailpit`)
- [x] Nenhuma leitura direta de `process.env` no código da aplicação — acesso tipado via `ConfigType`; entrypoints CLI (`data-source.ts`, `seed.ts`) usam a função compartilhada `buildDatabaseOptions`
- [x] TypeORM configurado (`synchronize:false`), scripts de migration e diretório de migrations vazio
- [x] `npm run migration:run` cria apenas `typeorm_migrations` (sem tabelas de domínio)
- [x] Seed runner executável (`npm run seed`) sem seeders de dados
- [x] `docs/ai-foundation.md` documentando a fundação de IA
- [x] Todos os testes de SI passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`)
- [x] Verificação de tipos/compilação passa (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run build`)
