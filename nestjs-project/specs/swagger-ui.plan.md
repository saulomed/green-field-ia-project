---
subproject: backend
runner: jest+supertest
scope: task-openapi-spec
si: SI-3
target_file: test/swagger-ui.e2e-spec.ts
---

# Swagger UI Test Plan

## Application Overview

O `SwaggerModule` monta o documento OpenAPI a partir dos controllers já existentes (code-first) e expõe duas rotas irmãs: a UI interativa em `{swagger.path}` e o documento serializado em `{swagger.path}-json`. As duas só existem quando o namespace de configuração `swagger` resolve `enabled: true` — em produção a flag é `false` e as rotas simplesmente não são registradas, sem guard e sem `403`. O documento declara o esquema de segurança `jwt-cookie` (`apiKey` sobre o cookie `access_token`), que é o que permite exercitar endpoints protegidos pela própria UI depois de um login.

## Test Scenarios

### 1. Exposição por ambiente

**Setup:** `createTestApp()` de `test/support/create-test-app.ts`, estendido para aplicar `setupSwagger(app)` antes de `app.init()` — `Test.createTestingModule` não executa `main.ts`, então o wiring do Swagger precisa ser reproduzido no bootstrap de teste, exatamente como já acontece com `ValidationPipe` e `HttpExceptionFilter`. O valor de `swagger.enabled` é controlado por override do namespace `swaggerConfig` no módulo de teste.

#### 1.1. ui-disponivel-quando-habilitado

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-09T14:32:22Z

**Steps:**
  1. Bootstrap da aplicação de teste com `swagger.enabled = true` e `swagger.path = 'api/docs'`.
  2. `GET /api/docs`
    - expect: status `200`
    - expect: `content-type` começa com `text/html`
    - expect: corpo contém o markup da UI do Swagger
  3. `GET /api/docs-json`
    - expect: status `200`
    - expect: `content-type` começa com `application/json`
    - expect: corpo tem `openapi` igual a `"3.0.0"`
    - expect: corpo tem a chave `paths` não vazia

#### 1.2. ui-ausente-quando-desabilitado

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-08-09T14:32:22Z

**Steps:**
  1. Bootstrap da aplicação de teste com `swagger.enabled = false`.
  2. `GET /api/docs`
    - expect: status `404`
  3. `GET /api/docs-json`
    - expect: status `404`
  4. Verificar que os demais endpoints seguem funcionando: `GET /`
    - expect: status `200` — desligar a documentação não afeta a API

#### 1.3. path-configuravel-pelo-namespace

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-08-09T14:32:22Z

**Steps:**
  1. Bootstrap da aplicação de teste com `swagger.enabled = true` e `swagger.path = 'docs-alternativo'`.
  2. `GET /docs-alternativo`
    - expect: status `200`
  3. `GET /api/docs`
    - expect: status `404` — a UI existe apenas no path configurado

### 2. Contrato do documento servido

**Setup:** mesma aplicação de teste do grupo 1 com `swagger.enabled = true`; as asserções leem o JSON de `GET {swagger.path}-json`.

#### 2.1. documento-declara-security-scheme-de-cookie

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-08-09T14:32:22Z

**Steps:**
  1. `GET /api/docs-json`
    - expect: status `200`
  2. Inspecionar `components.securitySchemes` do corpo
    - expect: existe a entrada `jwt-cookie`
    - expect: `jwt-cookie.type` é `"apiKey"`
    - expect: `jwt-cookie.in` é `"cookie"`
    - expect: `jwt-cookie.name` é `"access_token"`
  3. Inspecionar os endpoints protegidos no documento
    - expect: `paths['/auth/refresh'].post.security` referencia `jwt-cookie`
    - expect: `paths['/auth/logout'].post.security` referencia `jwt-cookie`
    - expect: `paths['/users/me'].get.security` referencia `jwt-cookie`
  4. Inspecionar um endpoint público no documento
    - expect: `paths['/auth/register'].post` não declara `security`

### 3. Sessão por cookie exercitada pelo contrato documentado

**Setup:** aplicação de teste com `swagger.enabled = true` e banco truncado no `beforeEach`; usuário confirmado criado via fluxo de registro + confirmação, como nos demais e2e de auth.

#### 3.1. sessao-por-cookie-apos-login

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-08-09T14:32:22Z

**Steps:**
  1. `POST /auth/login` com as credenciais do usuário confirmado
    - expect: status `200`
    - expect: header `set-cookie` contém `access_token` com `HttpOnly`
    - expect: header `set-cookie` contém `refresh_token` com `Path=/auth`
  2. `GET /users/me` reenviando os cookies recebidos, sem nenhum header `Authorization`
    - expect: status `200`
    - expect: corpo tem `email` igual ao do usuário logado
  3. `GET /users/me` sem cookie algum
    - expect: status `401`
    - expect: corpo tem `error` igual a `"SESSAO_INVALIDA"`

_O trajeto equivalente na UI — clicar em "Try it out" no `POST /auth/login` e em seguida no `GET /users/me` — depende de `swaggerOptions.withCredentials: true` e do navegador; este cenário cobre a mesma garantia no nível do protocolo, que é o que o esquema `jwt-cookie` documenta. A verificação visual do "Try it out" permanece manual._
