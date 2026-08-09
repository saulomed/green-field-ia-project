---
kind: task
name: task-db-named-volume
test_specs_aware: false
pipeline: none
---

# Task db-named-volume — Persistir os dados do Postgres em volume nomeado

> **Nota de proveniência:** esta task foi redigida à mão, fora do pipeline `/plan-*` — não há `context.md`, `library-refs.md` nem `validation.md` associados.

## Objective

O serviço `db` não declara volume: o Postgres grava num **volume anônimo** criado junto com o container. Qualquer `docker compose down` — e qualquer mudança que recrie o container — descarta o banco de desenvolvimento.

## Problem

`nestjs-project/compose.yaml` declara o serviço `db` sem a chave `volumes`. A imagem `postgres:17` traz `VOLUME /var/lib/postgresql/data` no seu Dockerfile, então o Docker cria um volume **anônimo** a cada `create`:

```
"Name": "06afd72dd0f4e587e971c77e178e55217bf8ada3cdedc5c50e7b531183285b0e"
```

Consequências já observadas na prática, em 09/08/2026, ao migrar o ambiente para o `compose.yaml` da raiz: o projeto Compose mudou de `nestjs-project` para `green-field-ai-project`, um container `db` novo foi criado com um volume anônimo novo, e **o banco nasceu vazio**. O volume antigo continua no disco, órfão e sem nome que o identifique.

Um volume nomeado sobrevive a `down`, a recriação do container e a troca do nome do projeto (quando declarado com `name:` explícito), e é descartável de propósito com `docker compose down -v`.

## Step Implementations

### SI-1 — Declarar volume nomeado para o serviço `db`

**Description:** Torna a persistência explícita e endereçável por nome, em vez de depender de um volume anônimo cujo identificador é um hash.

**Technical actions:**

1. Em `nestjs-project/compose.yaml`, adicionar ao serviço `db`:
   ```yaml
   volumes:
     - db-data:/var/lib/postgresql/data
   ```
2. Declarar o volume no bloco top-level do mesmo arquivo:
   ```yaml
   volumes:
     db-data:
   ```
3. Verificar como o `include:` do `compose.yaml` da raiz resolve o volume — o nome final é prefixado pelo nome do projeto (`green-field-ai-project_db-data`). Se a estabilidade do nome entre projetos importar, declarar `name: streamtube-db-data` explicitamente no bloco do volume; do contrário, aceitar o prefixo e registrar a escolha.
4. Documentar em `nestjs-project/CLAUDE.md`, na seção de ambiente, que `docker compose down` **preserva** os dados e que apagá-los exige `docker compose down -v` — um comando destrutivo que nunca deve ser executado sem autorização explícita do usuário.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose config` na raiz lista `db-data` na seção `volumes`.
- Ciclo de prova: subir o ambiente, criar uma tabela/registro, `docker compose down`, subir de novo — o dado continua lá.
- `docker volume ls` mostra o volume com nome legível, não um hash.
- `nestjs-project/CLAUDE.md` distingue `down` de `down -v`.

---

### SI-2 — Recuperar ou descartar o volume órfão

**Description:** O banco anterior à migração não é perdido — ele está num volume órfão. Decidir conscientemente o destino dele evita tanto a perda silenciosa quanto o acúmulo de lixo no disco.

**Technical actions:**

1. Localizar o volume órfão: `docker volume ls -qf dangling=true` (o candidato conhecido é `06afd72dd0f4e587e971c77e178e55217bf8ada3cdedc5c50e7b531183285b0e`).
2. Inspecionar o conteúdo antes de decidir — montá-lo somente-leitura num container descartável e conferir se há dados que valem a recuperação.
3. **Se valer:** `pg_dump` a partir do volume antigo e `psql` restaurando no `db-data` novo.
4. **Se não valer:** `docker volume rm <hash>` — **destrutivo e irreversível; exige autorização explícita do usuário antes de executar.**

**Tests:** _(empty — Infra)_

**Dependencies:** SI-1

**Acceptance criteria:**

- O destino do volume órfão foi decidido e registrado (recuperado ou removido), não deixado pendente por omissão.
- Nenhum volume dangling do Postgres deste projeto permanece sem justificativa.

---

## Deliverables

- [ ] SI-1 — Volume nomeado `db-data` no serviço `db`
- [ ] SI-2 — Volume órfão recuperado ou descartado, com decisão registrada
