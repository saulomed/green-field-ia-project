---
subproject: frontend
runner: playwright
scope: phase-02-auth-frontend
si: SI-02.17b
target_file: tests/forgot-password.e2e-spec.ts
---

# Tela de solicitação de redefinição de senha — Test Plan

## Application Overview

`/forgot-password` é a **etapa de solicitação** do fluxo de recuperação: coleta um e-mail e submete a `POST /api/auth/forgot-password` pelo route handler do BFF. O upstream responde `204` independentemente de a conta existir, por design — a tela não pode revelar se o endereço está cadastrado, e é essa indistinguibilidade que a maior parte deste plano verifica. A etapa de **redefinição** (`/reset-password`), onde o link do e-mail aterrissa, está diferida por lacuna de design e não existe nesta fase; nenhum link desta tela pode levar até lá.

O frame do Figma e o `<h1>` chamam-se "Reset password", mas o conteúdo é a solicitação. A rota é `/forgot-password`.

## Test Scenarios

### 1. Solicitação

**Setup:** stack real per `auth-frontend/TD-08` — `nestjs-api`, `db` e `mailpit` de pé, Playwright dirigindo o build de produção. Identidade única por execução per `auth-frontend/TD-10`, **sem reset de estado**. O cenário que precisa de conta cadastrada a cria dentro da própria execução.

#### 1.1. solicitacao-com-email-cadastrado-exibe-confirmacao

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Cadastrar uma conta com a identidade única desta execução.
    - expect: a conta existe
  2. Usuário abre `/forgot-password` e digita esse e-mail.
    - expect: o botão de envio fica habilitado
  3. Usuário clica no botão de envio.
    - expect: a requisição a `/api/auth/forgot-password` retorna `204`
    - expect: a tela passa ao estado de confirmação — o formulário deixa de ser o conteúdo principal
    - expect: capturar o texto exibido no estado de confirmação
  4. Verificar a caixa do Mailpit para esse e-mail.
    - expect: chegou uma mensagem de recuperação de senha

#### 1.2. email-desconhecido-produz-exatamente-a-mesma-tela

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/forgot-password` e digita um e-mail que não existe no banco.
    - expect: o botão de envio fica habilitado
  2. Usuário clica no botão de envio.
    - expect: a requisição retorna `204` — mesmo status do caso com conta existente
    - expect: a tela passa ao estado de confirmação
    - expect: o texto exibido é **idêntico** ao capturado no cenário 1.1
  3. Comparar as duas respostas do BFF byte a byte (status, corpo e headers observáveis).
    - expect: nada nelas permite inferir se a conta existe

### 2. Validação e limites

**Setup:** mesma do grupo 1. O cenário de validação não deve alcançar a rede.

#### 2.1. email-malformado-bloqueia-sem-ir-a-rede

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/forgot-password` com o campo vazio.
    - expect: o botão de envio está desabilitado
  2. Usuário digita um endereço sem `@`.
    - expect: o botão de envio continua desabilitado ou o submit é rejeitado localmente
    - expect: nenhuma requisição a `/api/auth/forgot-password` foi emitida
  3. Usuário corrige para um endereço bem formado.
    - expect: o botão de envio fica habilitado

#### 2.2. rate-limit-exibe-erro-neutro-quanto-a-existencia-da-conta

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/forgot-password` e submete repetidamente até o backend responder `429` (rate limit de `auth/TD-13`).
    - expect: a requisição retorna `429`
  2. Observar a tela.
    - expect: o erro aparece em nível de formulário
    - expect: o texto não menciona nem sugere se o e-mail informado existe

### 3. Fronteira de escopo

**Setup:** mesma do grupo 1. Nenhuma ida à rede necessária.

#### 3.1. nenhum-link-leva-a-reset-password

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/forgot-password`.
    - expect: nenhum elemento âncora da página aponta para `/reset-password`
  2. Usuário submete o formulário e alcança o estado de confirmação.
    - expect: também no estado de confirmação nenhum elemento âncora aponta para `/reset-password`
  3. Navegar diretamente para `/reset-password`.
    - expect: a rota não existe nesta fase — a aplicação responde com sua página de rota não encontrada
