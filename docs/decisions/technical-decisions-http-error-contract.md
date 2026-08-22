---
scope_type: ad-hoc
related_phases: [2]
status: decided
date: 2026-08-22
scope_description: "Contrato de resposta de erro HTTP da API: shape do envelope, tipo do campo message e como o frontend consome os códigos de domínio"
---

# Technical Decisions — Contrato de Resposta de Erro HTTP

_Subprojects in scope:_

- `nestjs-project/` — produz o envelope. Já existe implementação em `src/common/filters/http-exception.filter.ts` e uma hierarquia de `DomainException` em `src/common/exceptions/`; o que falta é a decisão que fixa o contrato, não o código.
- `next-frontend/` — consome o envelope. `auth-frontend/TD-11` decidiu que as três telas de auth têm superfície de erro no nível do formulário, e essa superfície precisa saber qual shape chega e como distinguir erro de campo de erro de formulário.

**Por que uma doc ad-hoc e não uma TD dentro de `technical-decisions-auth.md`:** o envelope não é propriedade da slice de auth. A Fase 02 é apenas a primeira a expor endpoints HTTP no `nestjs-project`; toda fase seguinte (upload, vídeos, comentários) herda esse contrato. Registrá-lo aqui, com `related_phases: [2]`, deixa-o disponível para a Fase 02 sem torná-lo dependente de uma slice de backend específica — e permite que fases futuras o herdem acrescentando o próprio número a `related_phases`.

**Estado atual (o que está implementado hoje, e que estas TDs decidem manter ou mudar):** o filtro global `@Catch()` devolve `{ statusCode, error, message }`. Para `DomainException`, `error` carrega o código de domínio (`CREDENCIAIS_INVALIDAS`, `EMAIL_JA_EXISTE`, …) e `message` é uma string em português. Para erros do `ValidationPipe`, `error` é `"Bad Request"` e `message` é um **array** de strings. Para o resto, `INTERNAL_SERVER_ERROR` / `"An unexpected error occurred"`.

---

## TD-01: Shape do envelope de resposta de erro HTTP

**Scope:** Cross-layer

**Capability:** Transversal — covers: Cadastro de usuário com e-mail e senha; Confirmação de conta via e-mail com link de ativação; Login e controle de sessão do usuário; Logout; Recuperação de senha: solicitação via e-mail → link com token → redefinição; Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** Todo endpoint de erro da API responde com este objeto, e o frontend o desserializa em todo `catch`. Sem TD, o shape existe apenas na prosa de `phase-02-auth.md § Error Catalog` e no corpo do filtro — duas fontes que ninguém obriga a concordar. O `plan-validate` da slice `auth` acusa isso como `MD-1` desde a primeira rodada. A decisão é cross-layer por definição: o backend produz, o frontend consome, e a spec OpenAPI (`openapi-spec/TD-07`) documenta.

**Options:**

### Option A: Manter `{ statusCode, error, message }` — três campos, `error` como código de domínio
- É exatamente o que está implementado e catalogado. `statusCode` duplica o status HTTP; `error` carrega o código estável de domínio; `message` é texto legível.
- **Pros:** zero retrabalho — o filtro, as 7 entradas do Error Catalog e as 8 suítes e2e existentes já assumem esse shape; `error` como código estável dá ao frontend uma chave para `switch` sem depender de texto; duplicar `statusCode` no corpo é redundante mas inofensivo e comum na prática NestJS.
- **Cons:** colide semanticamente com o default do framework, onde `error` é o *nome* do status HTTP (`"Bad Request"`, `"Conflict"`) e não um código de domínio — quem lê a resposta do `ValidationPipe` e a de uma `DomainException` vê o mesmo campo com duas naturezas diferentes; não há campo para detalhes por campo de formulário.

### Option B: `{ statusCode, error, message, details }` — acrescenta `details` opcional para erro por campo
- Mesmo shape da Option A mais um `details` opcional, presente só quando o erro tem granularidade por campo (`details: [{ field: "email", message: "..." }]`).
- **Pros:** dá ao frontend o que `auth-frontend/TD-11` precisa para decidir entre marcar um campo e mostrar erro de formulário, sem heurística sobre o texto; mantém tudo que a Option A já entrega, então a migração é aditiva e as e2e existentes seguem passando; alinha com o que RFC 9457 (`problem+json`) chama de extensões.
- **Cons:** exige normalizar a saída do `ValidationPipe` para popular `details` (hoje ela vem como array em `message`); um campo opcional gera dois caminhos de leitura no frontend.

### Option C: Adotar RFC 9457 `application/problem+json` — `{ type, title, status, detail, instance }`
- Troca o envelope caseiro pelo padrão IETF para erros HTTP, com `type` como URI identificando a classe do problema.
- **Pros:** padrão real, com ferramental e reconhecimento externo; `type` como URI é um identificador de erro mais durável que uma string de código; bom se a API algum dia for pública.
- **Cons:** reescreve o filtro, as 7 entradas do Error Catalog e toda asserção de erro nas 8 suítes e2e existentes, para uma API que hoje só tem um consumidor conhecido e interno; `Content-Type: application/problem+json` precisa ser tratado no `openapi-fetch` do frontend; o ganho é de interoperabilidade externa, que não é um requisito declarado em lugar nenhum do plano.

**Recommendation:** Option B — é a única que resolve o problema que está de fato aberto sem reabrir o que já funciona. A Option A congela um contrato que deixa `auth-frontend/TD-11` sem matéria-prima: sem `details`, distinguir "e-mail inválido" (erro de campo) de "credenciais inválidas" (erro de formulário) obrigaria o frontend a inferir do `statusCode` ou do texto, que é exatamente o acoplamento frágil que um contrato deveria eliminar. A Option C paga o custo de reescrever filtro, catálogo e suítes e2e por interoperabilidade externa que nenhum requisito pede. A Option B é aditiva: `details` é opcional, nada do que existe quebra, e as e2e atuais continuam válidas sem edição.

**Decision:** Option B — `{ statusCode, error, message, details }`. O campo `details` é **opcional** e presente apenas quando o erro tem granularidade por campo, no formato `[{ field, message }]`. Os três campos existentes mantêm a semântica atual: `statusCode` espelha o status HTTP, `error` carrega o código de domínio (`EMAIL_JA_EXISTE`, `CREDENCIAIS_INVALIDAS`, …) e `message` é texto legível. Mudança aditiva — o filtro `http-exception.filter.ts` passa a popular `details`, e as 8 suítes e2e existentes seguem válidas sem edição.
**Libraries:** —

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.
- 2026-08-22 — Registrado que o campo `details` é **contrato preparado, sem consumidor nesta fase**. Rationale: a Recommendation desta TD justificou a Option B pela necessidade da `auth-frontend/TD-11` de distinguir erro de campo de erro de formulário, mas a TD-11 foi decidida como Option A e faz essa distinção pelos **códigos de domínio** (`TD-03`), mandando o `400` do `ValidationPipe` para `root.serverError` em vez de renderizá-lo por campo. Não há conflito em runtime — `details` pode existir e o cliente ignorá-lo —, mas a premissa que sustentava a Option B não vale nesta fase (validation.md IC-7). A decisão é mantida: o campo fica disponível para o primeiro consumidor que precisar de granularidade por campo.

---

## TD-02: Tipo do campo `message` — string única vs array

**Scope:** Cross-layer

**Capability:** Transversal — covers: Cadastro de usuário com e-mail e senha; Login e controle de sessão do usuário; Recuperação de senha: solicitação via e-mail → link com token → redefinição; Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** Hoje o mesmo campo tem dois tipos conforme a origem do erro. Uma `DomainException` produz `message: "Credenciais inválidas"` (string); o `ValidationPipe` do NestJS 11 produz `message: ["email must be an email", "password is too short"]` (array) — comportamento confirmado na documentação oficial da versão instalada (`@nestjs/common ^11.0.1`). O frontend precisa de `typeof x === 'string' ? … : …` em todo ponto de leitura, e o tipo gerado a partir da spec OpenAPI vira uma união que contamina cada consumidor. Depende de TD-01.

**Options:**

### Option A: `message` sempre string; erros de validação viram `details`
- O filtro normaliza a saída do `ValidationPipe`: junta as violações em `details` (por campo) e põe em `message` uma frase única de nível de formulário ("Verifique os campos destacados").
- **Pros:** tipo único e estável no contrato — `message: string` sem união, o que o `openapi-typescript` traduz limpo; separa claramente o que é texto para o usuário do que é dado estruturado por campo; casa exatamente com o `details` da TD-01 Option B.
- **Cons:** o filtro precisa conhecer e desmontar o shape interno do `ValidationPipe`, que é detalhe do framework e pode mudar entre majors; a frase genérica de formulário precisa ser escrita em algum lugar.

### Option B: `message` sempre array (`string[]`), inclusive para erro de domínio
- Uniformiza no outro sentido: uma `DomainException` produz `message: ["Credenciais inválidas"]`.
- **Pros:** também elimina a união de tipos, e sem precisar entender o interior do `ValidationPipe` — basta envelopar a string de domínio num array; é o menor diff no filtro.
- **Cons:** array de um elemento é um contrato desonesto para o caso esmagadoramente mais comum; todo consumidor escreve `message[0]` e ninguém sabe o que fazer quando vier mais de um; força editar as asserções de erro das 8 suítes e2e existentes, que hoje comparam string.

### Option C: Manter a união e documentá-la
- Aceita `string | string[]` como o contrato e deixa a discriminação para o consumidor.
- **Pros:** zero mudança no backend; é o comportamento efetivo de qualquer app NestJS que não customiza o filtro.
- **Cons:** empurra a complexidade para cada ponto de leitura do frontend, indefinidamente; o tipo gerado pela spec vira união e cada `catch` precisa de narrowing; é precisamente o tipo de ambiguidade de contrato que estas TDs existem para fechar.

**Recommendation:** Option A — é a que casa com a TD-01 Option B e a única que dá ao frontend um tipo sobre o qual dá para escrever código sem narrowing. O custo real da Option A (o filtro precisa conhecer o shape do `ValidationPipe`) é contido: é um ponto único no código, coberto por `http-exception.filter.spec.ts`, e uma quebra em major do NestJS aparece nesse teste. A Option B tem o mesmo efeito de tipagem por um preço pior — obriga a editar as 8 suítes e2e existentes e deixa um array de um elemento como forma canônica. A Option C é o estado atual, que é o problema.

**Decision:** Option A — `message` é sempre `string`. O filtro normaliza a saída do `ValidationPipe`: as violações por campo vão para `details` (conforme TD-01 Option B) e `message` recebe uma frase única de nível de formulário. O contrato deixa de ter união de tipos, e o tipo gerado a partir da spec OpenAPI é `message: string` sem narrowing no consumidor.
**Libraries:** —

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.

---

## TD-03: Como o frontend consome o catálogo de códigos de domínio

**Scope:** Cross-layer

**Capability:** Transversal — covers: Cadastro de usuário com e-mail e senha; Confirmação de conta via e-mail com link de ativação; Login e controle de sessão do usuário; Recuperação de senha: solicitação via e-mail → link com token → redefinição; Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** O campo `error` carrega códigos estáveis (`EMAIL_JA_EXISTE`, `CREDENCIAIS_INVALIDAS`, `TOKEN_INVALIDO`, …) e o frontend precisa ramificar sobre eles para escolher a mensagem e onde exibi-la. Hoje esses códigos existem em três lugares que ninguém obriga a concordar: as classes em `src/common/exceptions/`, a tabela do Error Catalog em `phase-02-auth.md` e — se o frontend os transcrever — um quarto lugar. O princípio de comunicação dirigida por contrato do `CLAUDE.md` proíbe explicitamente o mirror escrito à mão. Depende de TD-01.

**Options:**

### Option A: Enum TypeScript no backend, exposto na spec OpenAPI e derivado no frontend
- Os códigos viram um enum/união em `nestjs-project`, decorado de forma que `@nestjs/swagger` o emita na spec; o frontend deriva o tipo de `lib/api/schema.d.ts` como qualquer outro tipo do contrato.
- **Pros:** uma única fonte de verdade, e é a mesma que já governa todo o resto da comunicação FE↔BE (`openapi-spec/TD-05`, `next-frontend-api-typing`); um código removido ou renomeado quebra o `tsc` do frontend, que é o comportamento desejado; não acrescenta ferramenta nem pipeline — o codegen já existe e roda por `scripts/generate-api-types.sh`.
- **Cons:** exige que o enum apareça de fato na spec, o que depende de decorar as respostas de erro por endpoint (`openapi-spec/TD-07` já criou os decoradores, mas eles precisam referenciar o enum); a spec só regenera sob demanda (`openapi-spec/TD-04`, revisão de 2026-08-08), então há janela de defasagem até alguém rodar o script.
- **Depende de:** `openapi-spec/TD-04`, `openapi-spec/TD-05`, `openapi-spec/TD-07`.

### Option B: Pacote compartilhado com os códigos, importado pelos dois lados
- Um `packages/error-codes` no monorepo, consumido por `nestjs-project` e `next-frontend`.
- **Pros:** fonte única sem depender do ciclo de regeneração da spec — a mudança propaga na hora, sem script intermediário; tipagem direta, sem camada de codegen.
- **Cons:** o repositório não tem workspaces configurados hoje, e `build.context: ./next-frontend` impede o container do frontend de enxergar qualquer coisa fora do próprio diretório — introduzir `packages/*` é uma decisão de tooling de monorepo (`Scope: Repo-wide`) bem maior que o problema que resolve; abre um segundo canal de contrato FE↔BE em paralelo ao OpenAPI, contrariando o princípio de fonte única.

### Option C: Frontend trata `error` como string opaca e ramifica só por `statusCode`
- O frontend não conhece os códigos; decide o que mostrar a partir do status HTTP e exibe `message` verbatim.
- **Pros:** acoplamento mínimo — acrescentar um código no backend nunca quebra o frontend; nenhum ferramental novo.
- **Cons:** impossibilita comportamento diferenciado por código dentro do mesmo status — `EMAIL_JA_EXISTE` e `EMAIL_JA_CONFIRMADO` são ambos `409` e pedem tratamentos distintos no cadastro; joga fora exatamente o valor de ter um código estável, deixando o campo `error` decorativo.

**Recommendation:** Option A — é a única compatível com a comunicação dirigida por contrato que o `CLAUDE.md` fixa como princípio do projeto, e reusa um pipeline que já existe e já está pago. A Option B resolve o mesmo problema abrindo um segundo canal de contrato e exigindo uma decisão de tooling de monorepo (workspaces, contexto de build do Docker) desproporcional ao ganho. A Option C é descartável por um caso concreto e imediato: `EMAIL_JA_EXISTE` e `EMAIL_JA_CONFIRMADO` compartilham o `409` e exigem telas diferentes — sem o código, o frontend não consegue distingui-los. A janela de defasagem da spec é real, mas é a mesma que todo o resto do contrato já aceita, e `scripts/check-api-types-drift.sh` existe para detectá-la.

**Decision:** Option A — os códigos de domínio viram um enum/união no `nestjs-project`, emitido na spec OpenAPI pelos decoradores de resposta de erro (`openapi-spec/TD-07`), e o `next-frontend` deriva o tipo de `lib/api/schema.d.ts` como qualquer outro tipo do contrato. Nenhum mirror escrito à mão no frontend. A janela de defasagem da spec (regeneração sob demanda, `openapi-spec/TD-04`) é a mesma já aceita para todo o contrato e é detectada por `scripts/check-api-types-drift.sh`.
**Libraries:** @nestjs/swagger, openapi-typescript

**Revisions:**
- 2026-08-22 — Campo `Capability:` estendido com o bullet "Telas de cadastro, login, confirmação de conta e recuperação de senha", que a slice `auth-frontend` reivindica em `covers_capabilities`. Rationale: Bullet acrescentado porque a slice de frontend consome o contrato. A doc tem `related_phases: [2]`, então é de escopo corrente nas duas slices da fase, mas o `Capability:` original só nomeava bullets de propriedade de `auth` — e o `/plan-build` agrupa TDs por esse campo, de modo que esta TD ficaria órfã no artefato de `auth-frontend` apesar de a `auth-frontend/TD-11` depender dela (validation.md IC-6). A decisão não muda.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Cross-layer | Shape do envelope de resposta de erro HTTP | Option B — `{ statusCode, error, message, details }` | **B** |
| TD-02 | Cross-layer | Tipo do campo `message` — string única vs array | Option A — sempre string; validação vai para `details` | **A** |
| TD-03 | Cross-layer | Como o frontend consome o catálogo de códigos de domínio | Option A — enum no backend via spec OpenAPI | **A** |
