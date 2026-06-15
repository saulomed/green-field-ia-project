# Decisões Técnicas — Fase 01: Sistema de Configuração

> **Fase:** 01 — Fundação (Sistema de Configuração)
> **Status:** Decidido
> **Data:** 2026-06-15

## Contexto e Restrições

A base de configuração já existe (`@nestjs/config@^4.0.4`, `joi@^18.2.1`, `ConfigModule.forRoot`
global com schema Joi). Estas decisões tratam de **evoluir** esse sistema para eliminar leituras
diretas de `process.env` e organizar as variáveis por domínio.

Restrições herdadas (não reabrir):
- NestJS 11 + TypeScript + Express; PostgreSQL + TypeORM.
- Docker Compose: host sempre por nome de serviço (`db`, `mailpit`), nunca `localhost`.
- Joi e `@nestjs/config` já instalados e em uso.

---

## DT-01: Estratégia de acesso tipado à configuração

**Contexto:** Hoje o acesso é por magic string (`config.get<string>('DB_HOST')` em
`database.module.ts`) e há `process.env` direto em `main.ts`. Precisamos de um padrão único,
tipado, para consumir config sem strings soltas nem `process.env` espalhado.

**Opções:**

### Opção A: Manter `ConfigService.get<T>('KEY')`
- Continua usando o `ConfigService` global com chaves em string e generic de tipo.
- **Prós:** zero mudança estrutural; já funciona; sem boilerplate.
- **Contras:** chaves não tipadas (typo só falha em runtime); tipo do retorno é uma promessa não verificada; sem autocompletar.

### Opção B: Config namespaced com `registerAs` + injeção via `ConfigType`
- Cada domínio vira um objeto tipado (`registerAs('database', () => ({...}))`), injetado com `@Inject(databaseConfig.KEY)` e `ConfigType<typeof databaseConfig>`.
- **Prós:** tipagem forte real + autocompletar; sem magic strings; agrupa naturalmente as variáveis (resolve DT-02); padrão oficial NestJS 11.
- **Contras:** um pouco mais de setup inicial (um arquivo por namespace + `forFeature`).

### Opção C: Classe `AppConfigService` (wrapper com getters tipados)
- Um serviço próprio encapsula o `ConfigService` expondo getters tipados (`get dbHost(): string`).
- **Prós:** ponto único de acesso; tipado; fácil de mockar em teste.
- **Contras:** boilerplate manual cresce com cada variável; reimplementa o que `ConfigType` já entrega de graça.

**Recomendação:** Opção B — `registerAs` + `ConfigType` é o padrão oficial do NestJS 11, dá tipagem forte sem manutenção manual de getters e já resolve a organização por domínio (DT-02).

**Decisão:** **Opção B** — config namespaced com `registerAs` + injeção tipada via `ConfigType`.

---

## DT-02: Organização das variáveis (namespacing por domínio)

**Contexto:** O usuário pediu explicitamente para definir "como organizar as variáveis". Hoje
estão num único `Joi.object` plano em `env.validation.ts`. Depende de DT-01.

**Opções:**

### Opção A: Schema único plano (atual)
- Todas as variáveis num só objeto; acesso por chave global.
- **Prós:** simples; tudo num lugar enquanto há poucas variáveis.
- **Contras:** não escala — ao crescer (storage, fila, auth) vira uma lista grande sem fronteiras de domínio.

### Opção B: Namespaces por domínio em `src/config/`
- Um arquivo de config por domínio (`database.config.ts`, `mail.config.ts`, `app.config.ts`), cada um com `registerAs`; registrados via `ConfigModule.forRoot({ load: [...] })` ou `forFeature`.
- **Prós:** fronteiras claras por domínio; cada módulo importa só o que precisa; escala com as próximas fases; alinha com Single Responsibility do projeto.
- **Contras:** mais arquivos; exige convenção de nomenclatura consistente.

**Recomendação:** Opção B — agrupar por domínio (`app` com `PORT`/`NODE_ENV`, `database`, `mail`) prepara o terreno para as próximas fases sem refatorar depois; é o complemento natural da DT-01 B. _(Depende de DT-01.)_

**Decisão:** **Opção B** — namespaces por domínio (`app`, `database`, `mail`) em `src/config/`.

---

## DT-03: Biblioteca/abordagem de validação do schema

**Contexto:** A validação na borda (falhar o boot se faltar variável) já roda com Joi. Vale revisitar
ao reorganizar, já que a abordagem de validação interage com a tipagem (DT-01).

**Opções:**

### Opção A: Manter Joi (`validationSchema`)
- Continua com `Joi.object({...})` passado a `ConfigModule.forRoot`. Validação separada da tipagem TS.
- **Prós:** já instalado e funcionando; suporta defaults, `.port()`, coerção; zero dependência nova.
- **Contras:** o schema Joi e os tipos TS são definidos separadamente (duas fontes de verdade para a forma da config).

### Opção B: class-validator + class-transformer (função `validate`)
- Define uma classe `EnvironmentVariables` com decorators e uma função `validate` passada ao `forRoot`.
- **Prós:** a própria classe vira a fonte de tipos; mesmo ecossistema usado em DTOs.
- **Contras:** adiciona 2 dependências; mais verboso para regras simples; classe ainda não usada no projeto.

### Opção C: Zod (`createZodValidationPipe`/função `validate` custom)
- Schema Zod único que valida e infere tipos (`z.infer`) numa só definição.
- **Prós:** validação + tipos numa fonte só; DX moderna.
- **Contras:** dependência nova; não é o padrão default do `@nestjs/config`; substituiria o Joi já em uso.

**Recomendação:** Opção A — manter Joi, que já está instalado, validando o boot e cobrindo defaults/coerção; trocar agora adiciona dependência e retrabalho sem ganho proporcional. A tipagem forte vem da DT-01 (B), não da lib de validação.

**Decisão:** **Opção A** — manter Joi (`validationSchema`).

---

## DT-04: Configuração em contextos fora do container DI (CLI TypeORM e seeds)

**Contexto:** `data-source.ts` (CLI de migrations) e `seed.ts` rodam fora do DI do Nest, então não
têm acesso fácil ao `ConfigService` — por isso leem `process.env` direto hoje. Precisamos de um padrão
que evite duplicar a montagem das opções de DB.

**Opções:**

### Opção A: Manter `process.env` direto nesses scripts (+ `dotenv`)
- Scripts CLI continuam lendo `process.env` com `dotenv` carregando `.env`.
- **Prós:** simples; é o padrão comum para entrypoints CLI do TypeORM.
- **Contras:** duplica a leitura das mesmas variáveis em 2+ arquivos; sem validação; divergência silenciosa do app Nest.

### Opção B: Loader de config compartilhado (função pura reaproveitada)
- Extrair uma função pura (ex.: `buildDatabaseOptions(env)`) usada pela factory `registerAs('database')` **e** por `data-source.ts`/`seed.ts`.
- **Prós:** fonte única de verdade para opções de DB; consistência entre app e CLI; testável.
- **Contras:** exige cuidado para a função não depender do runtime do Nest (manter pura).

**Recomendação:** Opção B — uma função pura compartilhada elimina a duplicação atual de `DB_*` entre `database.module.ts`, `data-source.ts` e `seed.ts`, mantendo CLI e app sempre alinhados.

**Decisão:** **Opção B** — loader/função pura compartilhada entre o app Nest e os scripts CLI.

---

## Resumo das Decisões

| ID | Decisão | Recomendação | Escolha |
|----|---------|--------------|---------|
| DT-01 | Estratégia de acesso tipado à config | `registerAs` + `ConfigType` (Opção B) | **Opção B** |
| DT-02 | Organização das variáveis (namespacing) | Namespaces por domínio (Opção B) | **Opção B** |
| DT-03 | Biblioteca de validação | Manter Joi (Opção A) | **Opção A** |
| DT-04 | Config fora do DI (CLI/seeds) | Loader compartilhado (Opção B) | **Opção B** |

> Observação: incluir `PORT` (lido em `main.ts`) e `NODE_ENV` no namespace `app` com validação,
> fechando a lacuna atual de variáveis lidas mas não validadas.
