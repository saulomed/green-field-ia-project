---
subproject: frontend
runner: playwright
scope: phase-02-auth-frontend
si: SI-02.16b
target_file: tests/login.e2e-spec.ts
---

# Tela de login — Test Plan

## Application Overview

`/login` autentica um usuário já cadastrado a partir de e-mail e senha, submetendo a `POST /api/auth/login` pelo route handler do BFF. O sucesso não devolve token ao JavaScript: o BFF **reemite** o par de cookies de sessão com `HttpOnly`, `Secure` e `SameSite=Strict` no `path` dele — é a única prova de ponta a ponta de que a Option B de `auth-frontend/TD-03` entrega o que a Option A não entregaria. O backend usa `CREDENCIAIS_INVALIDAS` tanto para e-mail desconhecido quanto para senha errada, então a tela não pode apontar qual dos dois falhou; conta não confirmada recebe `403 EMAIL_NAO_CONFIRMADO` e ganha um CTA de reenvio.

## Test Scenarios

### 1. Autenticação

**Setup:** stack real per `auth-frontend/TD-08` — `nestjs-api`, `db` e `mailpit` de pé, Playwright dirigindo o build de produção. Identidade única por execução per `auth-frontend/TD-10`, **sem reset de estado**. Cada cenário deste grupo cria e confirma sua própria conta dentro da execução (cadastro → captura do link no Mailpit → confirmação), porque nenhum teste pode assumir conta pré-existente. Bootstrap em `next-frontend/tests/auth.setup.ts`.

#### 1.1. login-com-credenciais-validas-inicia-sessao

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Criar e confirmar uma conta com a identidade única desta execução.
    - expect: a conta está confirmada
  2. Usuário abre `/login` e preenche e-mail e senha corretos.
    - expect: o botão "Sign in" fica habilitado
  3. Usuário clica em "Sign in".
    - expect: a requisição a `/api/auth/login` retorna `200`
    - expect: o browser passa a carregar os cookies de sessão, emitidos no `path` do BFF
    - expect: nenhuma mensagem de erro é exibida na tela
  4. Usuário navega para uma rota que exige sessão e observa a resposta do BFF.
    - expect: a sessão é aceita — a chamada autenticada não retorna `401`

#### 1.2. cookie-de-sessao-inacessivel-ao-javascript

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Criar e confirmar uma conta e autenticar-se com sucesso em `/login`.
    - expect: a sessão está estabelecida
  2. Ler `document.cookie` no contexto da página.
    - expect: nenhum dos cookies de sessão aparece — todos são `HttpOnly`
  3. Inspecionar os cookies do contexto do browser.
    - expect: cada cookie de sessão declara `httpOnly`, `secure` e `sameSite=Strict`

### 2. Erros do servidor

**Setup:** mesma do grupo 1.

#### 2.1. credenciais-invalidas-nao-revelam-qual-campo-falhou

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Criar e confirmar uma conta com a identidade única desta execução.
    - expect: a conta está confirmada
  2. Usuário abre `/login` e submete o e-mail correto com uma senha incorreta.
    - expect: o erro aparece em nível de formulário, não associado a nenhum campo
    - expect: capturar o texto exibido
  3. Usuário submete um e-mail que não existe no banco, com qualquer senha.
    - expect: o erro aparece em nível de formulário
    - expect: o texto exibido é **idêntico** ao capturado no passo anterior
  4. Comparar as duas respostas do BFF.
    - expect: ambas são `401` com o mesmo código de domínio — nada distingue e-mail desconhecido de senha errada

#### 2.2. conta-nao-confirmada-oferece-reenvio-de-confirmacao

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Cadastrar uma conta com a identidade única desta execução e **não** confirmá-la.
    - expect: a conta existe e está pendente de confirmação
  2. Usuário abre `/login` e submete as credenciais dessa conta.
    - expect: a requisição retorna `403`
    - expect: o erro aparece em nível de formulário, distinto do erro de credenciais inválidas
    - expect: um CTA de reenvio de confirmação está visível
  3. Usuário aciona o CTA de reenvio.
    - expect: a requisição a `/api/auth/resend-confirmation` é emitida
    - expect: uma nova mensagem de confirmação chega ao Mailpit para esse e-mail

### 3. Navegação

**Setup:** mesma do grupo 1. Nenhum cenário deste grupo precisa de conta.

#### 3.1. links-da-tela-navegam-sem-recarregar

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-08-22T15:12:17Z

**Steps:**
  1. Usuário abre `/login`.
    - expect: o link "Forgot password?" e o link de cadastro do rodapé estão visíveis
  2. Usuário clica em "Forgot password?".
    - expect: a URL passa a ser `/forgot-password`
    - expect: a navegação é client-side — não houve recarga completa do documento
  3. Usuário volta para `/login` e clica no link de cadastro do rodapé.
    - expect: a URL passa a ser `/signup`
    - expect: a navegação é client-side
