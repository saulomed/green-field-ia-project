# Fase 01 — Configuração Base do Projeto

## Objetivo

Estabelecer a fundação do monorepo: versionamento Git único, ambiente de desenvolvimento via Docker Compose, gestão de configuração por ambiente e fundação de banco PostgreSQL com TypeORM (migrations e seeds, sem tabelas), além de formalizar a fundação de IA para coding.

---

## Implementações de Etapa

### IE-01.1 — Consolidação do monorepo e versionamento Git

**Descrição:** Unificar o projeto em um único repositório Git na raiz e estabelecer a estratégia de branches.

**Ações técnicas:**

- Inicializar um repositório Git único na raiz do monorepo (`green-field-ai-project/`).
- Remover o `.git` aninhado de `nestjs-project/`, incorporando seus arquivos ao repositório raiz.
- Criar `.gitignore` na raiz cobrindo `node_modules/`, `dist/`, `coverage/`, `.env` e artefatos de IDE.
- Criar as branches de longa duração `main` (estável) e `dev` (integração), conforme Git Flow.

**Dependências:** Nenhuma

**Critérios de aceitação:**

- A raiz é um repositório Git único; `git status` na raiz rastreia `nestjs-project/`, `docs/` e `.claude/`.
- Não existe diretório `.git` aninhado em `nestjs-project/`.
- As branches `main` e `dev` existem (`git branch` lista ambas).
- `.env`, `node_modules/` e `dist/` não aparecem em `git status` (ignorados).

---

### IE-01.2 — Ambiente de desenvolvimento via Docker Compose

**Descrição:** Finalizar e validar o ambiente Docker com os serviços de fundação (api, db, mailpit).

**Ações técnicas:**

- Consolidar `nestjs-project/compose.yaml` com `nestjs-api`, `db` (postgres:17) e `mailpit`.
- Externalizar credenciais e portas para um arquivo `.env` (via `env_file`/`environment`) e versionar `.env.example`.
- Garantir healthcheck do `db` (`pg_isready`) e `depends_on: condition: service_healthy` na API.
- Confirmar que hosts internos usam nomes de serviço (`db`, `mailpit`) e nunca `localhost`.

**Dependências:** Nenhuma

**Critérios de aceitação:**

- `docker compose -f nestjs-project/compose.yaml up -d` sobe os três serviços com status running.
- `docker compose ... exec db pg_isready -U streamtube` retorna "accepting connections".
- A UI do Mailpit responde na porta 8025 e o SMTP na 1025.
- A API só inicia após o `db` reportar healthy.

---

### IE-01.3 — Gestão de configuração por ambiente (@nestjs/config)

**Descrição:** Centralizar e validar variáveis de ambiente na inicialização da aplicação.

**Ações técnicas:**

- Instalar `@nestjs/config@^4.0.0` (compatível com NestJS 11).
- Registrar `ConfigModule.forRoot({ isGlobal: true })` no `AppModule`, carregando `.env`.
- Definir validação de schema das variáveis (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MAIL_HOST`, `MAIL_PORT`) — falhar o boot se ausentes/inválidas.
- Documentar todas as variáveis em `.env.example` com `DB_HOST=db` (nome do serviço, nunca `localhost`).

**Dependências:** IE-01.2

**Critérios de aceitação:**

- A aplicação falha ao iniciar com erro de validação se uma variável obrigatória estiver ausente.
- `.env.example` lista todas as variáveis com `DB_HOST=db`.
- `ConfigService` injeta valores tipados em qualquer módulo.

---

### IE-01.4 — Fundação do banco de dados com TypeORM (sem tabelas)

**Descrição:** Configurar TypeORM, DataSource e ferramentas de migration, sem criar entidades/tabelas.

**Ações técnicas:**

- Instalar `@nestjs/typeorm@^11.0.0`, `typeorm@^0.3.0` e `pg@^8.0.0`.
- Criar `src/database/data-source.ts` exportando um `DataSource` (postgres, host/credenciais via env, `synchronize:false`, `migrationsTableName`, globs de `migrations` e `entities`).
- Registrar `TypeOrmModule.forRootAsync` com `ConfigService` em um `DatabaseModule` global.
- Adicionar scripts ao `package.json` (`migration:generate`, `migration:run`, `migration:revert`, `migration:show`) via TypeORM CLI apontando para `data-source.ts`.
- Criar o diretório vazio `src/database/migrations/` (sem entidades/tabelas ainda).

**Testes:**

| Arquivo | Camada | Verifica |
|---------|--------|----------|
| src/database/database.integration.spec.ts | Integração | App boota e o DataSource conecta ao Postgres real (serviço `db`); `synchronize` desativado não cria tabelas |

**Dependências:** IE-01.3

**Critérios de aceitação:**

- A aplicação inicia e conecta ao Postgres (`db`) sem entidades registradas.
- `npm run migration:run` executa sem erro e cria apenas a tabela de controle `typeorm_migrations` (nenhuma migration de domínio).
- `synchronize` está desativado — nenhuma tabela de domínio é criada automaticamente.
- O DataSource resolve host e credenciais a partir das variáveis de ambiente.

---

### IE-01.5 — Infraestrutura de seeds

**Descrição:** Estabelecer o runner e a estrutura de seeds, sem seeders de dados (não há tabelas).

**Ações técnicas:**

- Criar `src/database/seeds/seed.ts` que inicializa o `DataSource` e executa seeders registrados.
- Adicionar script `seed` ao `package.json` executando o runner via ts-node.
- Estabelecer o diretório `src/database/seeds/` com um orquestrador, sem seeders de dados.
- Documentar como registrar novos seeders em fases futuras.

**Dependências:** IE-01.4

**Critérios de aceitação:**

- `npm run seed` executa o runner sem erro e finaliza com código de saída 0 (nenhum dado inserido — sem tabelas).
- O runner conecta ao mesmo Postgres configurado pelo DataSource.

---

### IE-01.6 — Formalização da fundação de IA para coding

**Descrição:** Documentar e verificar os ativos de IA já existentes no repositório.

**Ações técnicas:**

- Criar `docs/ai-foundation.md` documentando skills (`.claude/skills/`), rules (`.claude/rules/`), `skills-lock.json`, `.mcp.json` (servidor postgres) e os `CLAUDE.md` (raiz + `nestjs-project`).
- Verificar a integridade do `skills-lock.json` (hashes das skills externas).
- Documentar a configuração do MCP postgres e como conectá-lo ao banco local `streamtube`.
- Garantir que `.claude/` é versionado no repositório raiz (referência cruzada com IE-01.1).

**Dependências:** IE-01.1

**Critérios de aceitação:**

- `docs/ai-foundation.md` existe e lista skills, rules, MCP e arquivos `CLAUDE.md`.
- `.claude/` é rastreado pelo Git na raiz.
- A documentação descreve como o servidor MCP postgres conecta ao banco `streamtube`.

---

## Especificações Técnicas

_Omitida: a Fase 01 é puramente de infraestrutura — não introduz entidades de banco (sem tabelas) nem endpoints HTTP, portanto nenhuma subseção do checklist de aplicabilidade se aplica._

---

## Mapa de Dependências

```
IE-01.1 (sem deps)
└── IE-01.6
IE-01.2 (sem deps)
└── IE-01.3
    └── IE-01.4
        └── IE-01.5
```

## Entregáveis

- [ ] Repositório Git único na raiz, com branches `main` e `dev`, e sem `.git` aninhado em `nestjs-project/`
- [ ] Ambiente Docker Compose (db/api/mailpit) sobe e o `db` reporta healthy
- [ ] `@nestjs/config` com validação de variáveis e `.env.example` documentado (`DB_HOST=db`)
- [ ] TypeORM configurado (`synchronize:false`), scripts de migration e diretório de migrations vazio
- [ ] `npm run migration:run` cria apenas `typeorm_migrations` (sem tabelas de domínio)
- [ ] Seed runner executável (`npm run seed`) sem seeders de dados
- [ ] `docs/ai-foundation.md` documentando a fundação de IA
- [ ] Todos os testes de IE passam (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`)
- [ ] Verificação de tipos/compilação passa (`docker compose -f nestjs-project/compose.yaml exec nestjs-api npm run build`)
