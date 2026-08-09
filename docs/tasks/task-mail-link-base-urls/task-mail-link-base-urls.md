---
kind: task
name: task-mail-link-base-urls
test_specs_aware: false
pipeline: none
---

# Task mail-link-base-urls — Separar as base URLs dos links de e-mail

> **Nota de proveniência:** esta task foi redigida à mão, fora do pipeline `/plan-*` — não há `context.md`, `library-refs.md` nem `validation.md` associados. Se ela crescer, rode `/plan-context` para materializar os artefatos que faltam.

## Objective

`MailService` monta os links de confirmação de conta e de redefinição de senha a partir de **uma única** base URL (`APP_BASE_URL`), mas os dois links têm destinos diferentes por decisão explícita — e agora esses destinos estão em **hosts diferentes**.

## Problem

`auth/TD-09` (revisão de 2026-07-18) fixa dois destinos distintos:

- **Confirmação** → rota da **API**: `GET /auth/confirm?token=…` (não exige tela; o backend consome o token direto).
- **Reset de senha** → rota de **página do frontend**: `/reset-password?token=…` (exige formulário para a nova senha).

`nestjs-project/src/mail/mail.service.ts` usa `this.appBaseUrl` para os dois:

```typescript
const link = `${this.appBaseUrl}/auth/confirm?token=${token}`;     // linha 33 — destino: API
const link = `${this.appBaseUrl}/reset-password?token=${token}`;   // linha 51 — destino: frontend
```

Com `APP_BASE_URL=http://localhost:3000` (a API), o link de reset aponta para `http://localhost:3000/reset-password` — **rota que não existe no backend**. Antes da containerização do frontend isso já estava incorreto de acordo com a TD-09; agora que o frontend ouve em `http://localhost:3001`, o defeito é inequívoco e não tem como ser mascarado por coincidência de porta.

## Step Implementations

### SI-1 — Desdobrar `appBaseUrl` em duas base URLs no namespace `mail`

**Description:** Uma variável não consegue endereçar dois hosts. Separar torna o contrato da TD-09 explícito na configuração, em vez de implícito no caminho concatenado.

**Technical actions:**

1. Em `nestjs-project/src/config/mail.config.ts`, substituir `appBaseUrl` por dois campos, resolvidos inteiramente dentro da factory (convenção `config/TD-01`):
   - `apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000'` — base dos links que a **API** atende.
   - `frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:3001'` — base dos links que uma **página do frontend** atende.
2. Em `nestjs-project/src/config/env.validation.ts`, trocar `APP_BASE_URL: Joi.string().uri()` por `API_BASE_URL` e `FRONTEND_BASE_URL`, ambos `Joi.string().uri()`.
3. Atualizar `nestjs-project/.env.example` e o `.env` local: remover `APP_BASE_URL`, adicionar `API_BASE_URL=http://localhost:3000` e `FRONTEND_BASE_URL=http://localhost:3001`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `mailConfig` | Unit: cada variável mapeia para o seu campo; defaults aplicados na ausência das duas | `src/config/mail.config.spec.ts` **(arquivo novo** — `mail.config.ts` é o único namespace sem spec; seguir o padrão de `database.config.spec.ts` / `swagger.config.spec.ts`) |
| `envValidationSchema` | Unit: `FRONTEND_BASE_URL` não-URI derruba a validação com a variável nomeada na mensagem | `src/config/env.validation.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- O namespace `mail` expõe `apiBaseUrl` e `frontendBaseUrl`; `appBaseUrl` não existe mais em lugar nenhum do código.
- A aplicação sobe sem as duas variáveis declaradas, caindo nos defaults `:3000` e `:3001`.
- `API_BASE_URL` inválida impede o boot com mensagem que nomeia a variável.

---

### SI-2 — Apontar cada link de e-mail para a sua base URL

**Description:** Materializa a TD-09 no ponto onde o link é construído — é a correção do defeito propriamente dita.

**Technical actions:**

1. Em `nestjs-project/src/mail/mail.service.ts`, substituir o campo `appBaseUrl` por `apiBaseUrl` e `frontendBaseUrl`, lidos do namespace `mail` no construtor.
2. `sendConfirmation` passa a montar `${this.apiBaseUrl}/auth/confirm?token=${token}`.
3. `sendPasswordReset` passa a montar `${this.frontendBaseUrl}/reset-password?token=${token}`.
4. Atualizar `src/mail/mail.service.spec.ts`: o mock de `ConfigService` devolve as duas base URLs, e cada asserção de `context.link` verifica a base **correta** para o seu fluxo — hoje ambas checam a mesma constante, o que deixaria a regressão passar despercebida.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `MailService.sendConfirmation` | Unit: o link começa por `apiBaseUrl` e o path é `/auth/confirm` | `src/mail/mail.service.spec.ts` |
| `MailService.sendPasswordReset` | Unit: o link começa por `frontendBaseUrl` (host **diferente** do da confirmação) e o path é `/reset-password` | `src/mail/mail.service.spec.ts` |

**Dependencies:** SI-1

**Acceptance criteria:**

- Com `API_BASE_URL` e `FRONTEND_BASE_URL` apontando para hosts distintos, os dois e-mails carregam hosts distintos — verificável na UI do Mailpit (`http://localhost:8025`).
- Clicar no link de confirmação recebido no Mailpit confirma a conta (a rota existe e responde).
- O link de reset aponta para `http://localhost:3001/reset-password?token=…`.
- A suíte E2E da fase 02 continua passando sem alteração — nenhum status code, body ou cookie muda.

---

## Fora de escopo

- **Implementar a página `/reset-password` no `next-frontend/`.** Esta task garante que o link aponte para o lugar certo; a tela em si pertence à fase de frontend de autenticação. Até lá, o link resolve para um 404 do Next — que é o comportamento correto e honesto, ao contrário do 404 da API de hoje, que aponta para o host errado.
- Qualquer mudança no formato ou na natureza dos tokens (`auth/TD-06` permanece intacta).

## Deliverables

- [ ] SI-1 — Desdobrar `appBaseUrl` em `apiBaseUrl` + `frontendBaseUrl`
- [ ] SI-2 — Apontar cada link de e-mail para a sua base URL

**Full test suites:**

- [ ] Backend tests pass (`docker compose exec nestjs-api npm test`)
- [ ] E2E tests pass (`docker compose exec nestjs-api npm run test:e2e`)
- [ ] Type/compilation checks pass (`docker compose exec nestjs-api npm run build`)
- [ ] Lint passes (`docker compose exec nestjs-api npm run lint`)
