# AI Foundation — StreamTube

Documentação dos ativos de IA para coding presentes neste repositório. Esses recursos orientam o Claude Code durante o desenvolvimento, garantindo consistência, segurança e aderência às boas práticas do projeto.

---

## Estrutura de Ativos

```
.claude/
├── rules/                  # Regras locais do projeto (carregadas automaticamente)
│   ├── nestjs-common-conventions.md
│   ├── nestjs-controllers.md
│   ├── nestjs-dtos.md
│   ├── nestjs-entities.md
│   ├── nestjs-layer-separation.md
│   ├── nestjs-modules.md
│   ├── nestjs-services.md
│   ├── nestjs-testing.md
│   └── typeorm-migrations.md
├── skills/                 # Skills instaladas (via skills-lock.json)
│   ├── nestjs-best-practices/
│   └── typeorm/
└── settings.local.json     # Permissões de ferramentas para este projeto

CLAUDE.md                   # Instruções globais do projeto (raiz)
nestjs-project/CLAUDE.md    # Instruções específicas do backend NestJS
.mcp.json                   # Configuração do servidor MCP PostgreSQL
skills-lock.json            # Lock file das skills externas
```

---

## Rules (`.claude/rules/`)

As rules são carregadas automaticamente pelo Claude Code para todos os arquivos correspondentes ao glob configurado. Elas definem convenções obrigatórias para o projeto.

| Arquivo | Escopo | Conteúdo |
|---------|--------|----------|
| `nestjs-common-conventions.md` | Global NestJS | Naming, DI por construtor, async/await, constantes |
| `nestjs-controllers.md` | `*.controller.ts` | REST conventions, decorators, status codes |
| `nestjs-dtos.md` | `*.dto.ts` | Validação com class-validator, tipagem |
| `nestjs-entities.md` | `*.entity.ts` | TypeORM entities, colunas, relacionamentos |
| `nestjs-layer-separation.md` | Global | Separação de camadas (Controller → Service → Repository) |
| `nestjs-modules.md` | `*.module.ts` | Estrutura de módulos, imports, exports |
| `nestjs-services.md` | `*.service.ts` | Regras de negócio, injeção, transações |
| `nestjs-testing.md` | `*.spec.ts`, `*.e2e-spec.ts` | Testes unitários, integração e e2e |
| `typeorm-migrations.md` | `**/migrations/**` | Imutabilidade, geração via CLI, segurança |

---

## Skills (`.claude/skills/`)

Skills são conjuntos de instruções e regras empacotadas para ativar comportamentos especializados. Gerenciadas via `skills-lock.json`.

### `nestjs-best-practices`

- **Fonte:** `kadajett/agent-nestjs-skills` (GitHub)
- **Hash:** `1b6f82e889d19d305e38e35594de08eca0242321f353cafa4cf5e61dd3aa1a73`
- **Ativação:** Automática ao trabalhar em módulos, controllers, serviços, auth/segurança e testes NestJS
- **Conteúdo:** 30+ regras cobrindo arquitetura, DI, performance, segurança, testes e DevOps

### `typeorm`

- **Fonte:** `mindrally/skills` (GitHub)
- **Hash:** `a78bf5815e02755d36eeda49e3e2e87b6e4e161cd90c6cbfb29dc447c4084b99`
- **Ativação:** Automática ao trabalhar com entidades, migrations, repositórios e queries TypeORM
- **Conteúdo:** Regras para DataSource, entidades, migrations, relacionamentos, transações e queries

---

## Skills Locais (`.claude/skills/`)

Além das skills externas, o projeto possui skills locais:

| Skill | Arquivo | Propósito |
|-------|---------|-----------|
| `plan-phase` | `plan-phase/SKILL.md` | Planejar implementação de fases do projeto |
| `research` | `research/SKILL.md` | Pesquisar e consultar documentação via MCP |

---

## CLAUDE.md

O projeto mantém dois arquivos `CLAUDE.md` com instruções contextuais:

| Arquivo | Escopo | Principais instruções |
|---------|--------|-----------------------|
| `CLAUDE.md` (raiz) | Projeto inteiro | Visão geral, arquitetura C4, Git Flow, convenções, política de testes, limites de escopo |
| `nestjs-project/CLAUDE.md` | Backend NestJS | Startup do ambiente, comandos Docker, convenções TypeScript/REST, lookup de documentação |

---

## MCP Server PostgreSQL (`.mcp.json`)

O servidor MCP PostgreSQL permite que o Claude Code consulte o banco de dados diretamente durante o desenvolvimento, sem sair do contexto da conversa.

### Configuração

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://streamtube:streamtube@localhost/streamtube"
      ]
    }
  }
}
```

### Como conectar ao banco local `streamtube`

1. **Inicie o container do banco:**
   ```bash
   docker compose -f nestjs-project/compose.yaml up -d db
   ```

2. **Verifique que o banco está aceitando conexões:**
   ```bash
   docker compose -f nestjs-project/compose.yaml exec db pg_isready -U streamtube
   ```

3. **O MCP server conecta via `localhost:5432`** — o container expõe a porta 5432 no host. A string de conexão `postgresql://streamtube:streamtube@localhost/streamtube` é válida para acesso do host ou de outros processos no host.

4. **Uso:** Com o servidor MCP ativo, o Claude Code pode executar queries SQL diretamente durante a sessão de desenvolvimento usando a ferramenta `mcp__postgres__query`.

> **Nota:** Dentro dos containers Docker, use `db` como host (nome do serviço), nunca `localhost`. O MCP server roda no host, por isso usa `localhost`.

---

## `skills-lock.json`

Arquivo de lock para as skills externas instaladas. Garante que as skills usadas em desenvolvimento sejam sempre as mesmas versões verificadas.

```json
{
  "version": 1,
  "skills": {
    "nestjs-best-practices": {
      "source": "kadajett/agent-nestjs-skills",
      "sourceType": "github",
      "skillPath": "SKILL.md",
      "computedHash": "1b6f82e..."
    },
    "typeorm": {
      "source": "mindrally/skills",
      "sourceType": "github",
      "skillPath": "typeorm/SKILL.md",
      "computedHash": "a78bf58..."
    }
  }
}
```

Para verificar a integridade das skills instaladas, compare o `computedHash` com o hash atual dos arquivos de skill. Qualquer divergência indica que o conteúdo da skill foi alterado.

---

## Referências Cruzadas

- Arquitetura do sistema: [`docs/diagrams/software-arch.mermaid`](diagrams/software-arch.mermaid)
- Plano geral do projeto: [`docs/project-plan.md`](project-plan.md)
- Configuração do projeto NestJS: [`nestjs-project/CLAUDE.md`](../nestjs-project/CLAUDE.md)
