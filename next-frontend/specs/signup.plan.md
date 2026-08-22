---
subproject: frontend
runner: playwright
scope: phase-02-auth-frontend
si: SI-02.15b
target_file: tests/signup.e2e-spec.ts
---

# Tela de cadastro de conta — Test Plan

## Application Overview

`/signup` é a porta de entrada da plataforma: coleta nome, e-mail e senha, submete a `POST /api/auth/register` pelo route handler do BFF e, no `201`, substitui o card do formulário por um painel de sucesso que mostra o e-mail registrado e oferece o reenvio do e-mail de confirmação. O usuário **permanece em `/signup`** — não há auto-login, porque o backend rejeita o login de conta não confirmada com `403 EMAIL_NAO_CONFIRMADO`. A tela também carrega a validação local dos quatro campos e o gate de aceite dos termos.

## Test Scenarios

### 1. Cadastro bem-sucedido

**Setup:** stack real per `auth-frontend/TD-08` — `nestjs-api`, `db` e `mailpit` de pé, Playwright dirigindo o build de produção. Identidade única por execução per `auth-frontend/TD-10` (e-mail derivado de timestamp + UUID), **sem reset de estado entre execuções**. Bootstrap em `next-frontend/tests/auth.setup.ts`. Não há MSW nesta lane: a rede é real de ponta a ponta.

#### 1.1. cadastro-com-dados-validos-exibe-painel-de-sucesso

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/signup`.
    - expect: o formulário de cadastro está visível com os campos Full Name, Email address, Password e Confirm Password
  2. Usuário preenche os quatro campos com dados válidos, usando o e-mail único desta execução, e marca o checkbox de termos.
    - expect: o botão "Create account" fica habilitado
  3. Usuário clica em "Create account".
    - expect: a URL continua sendo `/signup` — não há redirecionamento
    - expect: o card do formulário deixa de estar visível
    - expect: o painel de sucesso está visível e exibe o e-mail exatamente como foi digitado
  4. Verificar a caixa do Mailpit para o e-mail desta execução.
    - expect: existe uma mensagem de confirmação de conta endereçada a ele

### 2. Erros do servidor

**Setup:** mesma do grupo 1. Este grupo precisa de uma conta pré-existente criada pelo próprio teste, dentro da mesma execução — nenhum cenário assume estado anterior no banco.

#### 2.1. email-ja-cadastrado-exibe-erro-no-campo-email

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário cadastra uma conta com o e-mail único desta execução e chega ao painel de sucesso.
    - expect: o painel de sucesso está visível
  2. Usuário recarrega `/signup` e preenche o formulário com o **mesmo** e-mail e dados válidos nos demais campos.
    - expect: o botão "Create account" fica habilitado
  3. Usuário clica em "Create account".
    - expect: o erro aparece **associado ao campo Email address**, não em nível de formulário
    - expect: o card do formulário continua visível — o painel de sucesso não é exibido
    - expect: a URL continua sendo `/signup`

#### 2.2. reenvio-de-confirmacao-a-partir-do-painel-de-sucesso

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário cadastra uma conta com o e-mail único desta execução.
    - expect: o painel de sucesso está visível com o botão de reenvio habilitado
  2. Usuário clica no botão de reenvio.
    - expect: a interface confirma o reenvio
  3. Verificar a caixa do Mailpit para o e-mail desta execução.
    - expect: há duas mensagens de confirmação — a do cadastro e a do reenvio
  4. Usuário aciona o reenvio repetidamente até o backend responder `429` (rate limit de `auth/TD-13`).
    - expect: o botão entra em cooldown e fica desabilitado
    - expect: o desfecho de rate limit é apresentado de forma distinta de um erro genérico de servidor

### 3. Validação no cliente

**Setup:** mesma do grupo 1. Nenhum cenário deste grupo deve alcançar a rede — a validação local barra o submit antes disso.

#### 3.1. submit-bloqueado-ate-termos-aceitos-e-campos-validos

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/signup` com o formulário vazio.
    - expect: o botão "Create account" está desabilitado
  2. Usuário preenche todos os campos com dados válidos mas **não** marca o checkbox de termos.
    - expect: o botão "Create account" continua desabilitado
  3. Usuário marca o checkbox de termos.
    - expect: o botão "Create account" fica habilitado
  4. Usuário apaga o campo Email address e digita um endereço malformado.
    - expect: o botão "Create account" volta a ficar desabilitado
    - expect: nenhuma requisição a `/api/auth/register` foi emitida durante todo o cenário

#### 3.2. confirmacao-de-senha-divergente-bloqueia-sem-ir-a-rede

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/signup` e preenche nome, e-mail e senha válidos, marcando o checkbox de termos.
    - expect: os campos estão preenchidos
  2. Usuário preenche Confirm Password com um valor diferente de Password.
    - expect: o botão "Create account" está desabilitado ou o submit é rejeitado localmente
    - expect: nenhuma requisição a `/api/auth/register` foi emitida
  3. Usuário corrige Confirm Password para igualar Password.
    - expect: o botão "Create account" fica habilitado

### 4. Acessibilidade

**Setup:** mesma do grupo 1. Asserções sobre a árvore de acessibilidade renderizada, sem ida à rede.

#### 4.1. campo-de-senha-associado-a-forca-e-dica

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/signup`.
    - expect: o campo Password declara `aria-describedby` apontando para os elementos da barra de força e da dica de senha
    - expect: cada toggle de visibilidade de senha expõe um nome acessível
  2. Usuário digita uma senha no campo Password.
    - expect: a barra de força reflete a mudança
  3. Usuário aciona o toggle de visibilidade do campo Password.
    - expect: apenas o campo Password troca de tipo — o campo Confirm Password permanece oculto
