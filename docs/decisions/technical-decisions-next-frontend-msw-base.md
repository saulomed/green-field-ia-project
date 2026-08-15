---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-08-15
scope_description: "Base de testes do next-frontend com Vitest + MSW: separação de ambientes de execução por lane, biblioteca de DOM, tipagem dos handlers a partir do contrato OpenAPI e superfície de fake das rotas relativas do BFF. Inclui a materialização do contrato de teste diferido de lib/env.ts (seis casos devidos pela next-frontend-env-config), que passa a ser o primeiro teste da lane de node. Não inclui o bootstrap do Playwright nem a criação do primeiro route handler do BFF."
---

# Technical Decisions — Base de Testes com MSW do `next-frontend`

_Subprojects in scope:_

- `next-frontend/` — recebe todo o ferramental: `vitest.config.ts`, `vitest.setup.ts`, `mocks/`, o script `test` e as dependências de teste. Todas as TDs abaixo materializam arquivos aqui.
- `nestjs-project/` — **nenhuma decisão aberta.** Participa apenas como produtor da `nestjs-project/openapi.json`, que a TD-03 consome para tipar os fixtures. Nada no backend muda.
- Raiz do repositório — **nenhuma decisão aberta.** Os scripts de codegen já existem (`scripts/generate-api-types.sh`) e não são tocados; não há `package.json` de raiz.

---

## O que já está decidido — não reabrir

Boa parte do contrato de testes deste subprojeto já é regra vigente em `next-frontend/CLAUDE.md` § Testing e na skill `testing-guide-next-frontend`. Este documento **não** reabre nenhum destes pontos; ele resolve apenas o que sobrou em aberto quando o ferramental for de fato instalado.

- **Vitest** roda unit + integração; **Playwright** roda E2E. Sufixos, localização (`__tests__/` ao lado do artefato, `tests/` só para E2E) e nomes de script (`test`, `test:watch`, `test:e2e`) estão fixados.
- **MSW (`msw/node`)** é o único fake sancionado do `nestjs-api`. Nenhum teste Vitest abre conexão real. `vi.mock` sobre o `fetch` global é proibido.
- **Layout de `mocks/`** (`handlers.ts` + `server.ts` com `setupServer`) e o ciclo de vida em `vitest.setup.ts` (`server.listen({ onUnhandledRequest: "error" })` / `resetHandlers()` / `close()`).
- **Base URL upstream** vem de `config.api.baseUrl` (`@/lib/env`), nunca de `process.env` nem hardcoded — `next-frontend-env-config/TD-04`.
- **Carregamento de env no teste** via `loadEnvConfig(process.cwd())` de `@next/env` no topo do `vitest.config.ts`, lendo o `.env.test` versionado — `next-frontend-env-config/TD-05`. `@next/env` já está em `devDependencies`.
- **Filosofia de cobertura:** pragmática, sem threshold percentual.

**Fora de escopo desta pesquisa:** o bootstrap do Playwright (`playwright.config.ts`, script `test:e2e`, `tests/auth.setup.ts`). A `next-frontend-env-config` delimitou a esta task apenas o eixo Vitest + MSW. O ferramental de E2E permanece sem dono e merece task própria.

---

## TD-01: Separação dos ambientes de execução do Vitest (`node` vs DOM)

**Scope:** Frontend

**Trigger:** As duas lanes de teste do subprojeto exigem ambientes incompatíveis entre si, e a configuração precisa decidir como separá-los antes que o primeiro teste exista.

**Context:** Testes de route handler importam `@/lib/env`, e `@t3-oss/env-core` decide server vs client por `typeof window === "undefined"`. Sob um ambiente de DOM a guarda de fronteira dispara e a simples importação do módulo lança — o problema está registrado em `docs/tasks/task-next-frontend-env-config/progress.md` (SI-3) e é a razão de o contrato de teste diferido de `lib/env.ts` exigir `environment: "node"`. Na direção oposta, testes de client component precisam de DOM, e handlers MSW de caminho relativo (`/api/...`) só resolvem contra um `location` de documento, que não existe em `node`. O template de `vitest.config.ts` da skill `testing-guide-next-frontend` declara um único `environment: "happy-dom"` global — o que quebra a lane de route handler no primeiro teste. Decidir isto é pré-requisito da TD-04.

**Options:**

### Option A: `projects` do Vitest, um por lane
- Dois projetos inline em `test.projects`: um `node` com `include` sobre `app/api/**` e `lib/**`, outro DOM com `include` sobre `components/**` e `hooks/**`. `extends: true` herda a raiz (plugins, alias, `loadEnvConfig`).
- **Pros:** a separação é declarada num lugar só e não depende de disciplina por arquivo; um teste novo cai na lane certa pelo caminho onde nasce; cada projeto pode ter o seu próprio `setupFiles`, o que a TD-04 aproveita; é o substituto oficial do removido `environmentMatchGlobs` (Vitest 4).
- **Cons:** mais verboso; a saída do runner passa a ser rotulada por projeto; um arquivo fora dos globs não roda em lane nenhuma e some silenciosamente.

### Option B: ambiente DOM global + docblock `// @vitest-environment node` por arquivo
- Um `environment` único no config; cada suíte de route handler ou de `lib/env` abre com o comentário que troca o ambiente daquele arquivo.
- **Pros:** config mínimo; o ambiente fica visível no topo do próprio teste; é o mecanismo documentado do Vitest para exceções pontuais.
- **Cons:** depende de o autor lembrar do docblock — esquecer produz uma falha de importação obscura vinda de dentro do `@t3-oss/env-core`, não uma mensagem sobre ambiente; não permite `setupFiles` distintos por lane, então o setup de DOM (matchers de `jest-dom`) carrega também nos testes de node.

### Option C: ambiente `node` global + docblock DOM nos testes de componente
- A inversão da Option B: `node` é o default e os testes de client component declaram o ambiente de DOM.
- **Pros:** a lane que hoje tem contrato de teste escrito (`lib/env.ts`) funciona sem cerimônia; falhar por falta de DOM dá erro legível (`document is not defined`).
- **Cons:** inverte o default em relação ao volume esperado de testes (componentes e hooks tendem a ser a maioria num frontend); o mesmo risco de esquecimento da Option B, só que deslocado; segue sem `setupFiles` por lane.

**Recommendation:** Option A — é o único caminho que dá `setupFiles` por lane, o que a TD-04 precisa para não misturar as duas superfícies de fake, e é o mecanismo que a documentação do Vitest 4 indica depois de remover `environmentMatchGlobs`. O custo é verbosidade num arquivo que se escreve uma vez; o custo das outras duas é uma classe de erro recorrente cuja mensagem não aponta para a causa.

**Decision:** Option A — `test.projects` com dois projetos inline: um `environment: "node"` cobrindo `app/api/**` e `lib/**`, outro com o ambiente de DOM da TD-02 cobrindo `components/**` e `hooks/**`. Ambos herdam a raiz com `extends: true` (plugins, alias, `loadEnvConfig`) e cada um declara o seu próprio `setupFiles`, que é o que viabiliza a Option B da TD-04.

**Renders in:** frontend-runtime

**Libraries:** vitest

---

## TD-02: Biblioteca de DOM da lane de browser — `jsdom` ou `happy-dom`

**Scope:** Frontend

**Trigger:** As duas fontes que o projeto costuma seguir divergem: o template da skill `testing-guide-next-frontend` fixa `happy-dom`, e o guia oficial de Vitest do Next.js 16 instala `jsdom`.

**Context:** A escolha entra em `vitest.config.ts` e em `devDependencies`, e depois é cara de trocar porque testes escritos contra as lacunas de uma implementação passam a falhar na outra. O fator específico deste projeto é o design system: `components/ui/` é shadcn sobre `radix-ui`, e os primitivos de overlay do Radix (popover, select, dialog) dependem de medição de layout e de APIs de observação que as duas implementações cobrem de forma desigual. Ainda não existe nenhum teste escrito, então o custo de decidir agora é zero e o de decidir errado só aparece depois.

**Options:**

### Option A: `jsdom`
- Implementação madura e mais completa em cobertura de spec; é a que o guia oficial de testes do Next.js instala.
- **Pros:** menor chance de esbarrar numa API ausente ao testar componentes que compõem primitivos Radix; a maioria das receitas e issues de RTL/Next assume jsdom, então erro obscuro tem resposta pesquisável; alinha com a documentação oficial do framework.
- **Cons:** notoriamente mais lento no boot por arquivo de teste; pacote maior.

### Option B: `happy-dom`
- Implementação mais nova, focada em performance, com superfície de API menor.
- **Pros:** significativamente mais rápido; é o que o template já escrito na skill assume, então adotá-lo não exige corrigir a skill.
- **Cons:** cobertura de spec menor — lacunas aparecem justamente em medição de layout e observers, que é o terreno dos overlays do Radix; quando falha, a mensagem tende a ser um `undefined` em API de browser, difícil de atribuir ao ambiente.

**Recommendation:** Option A (`jsdom`) — a diferença de velocidade só se paga com uma suíte grande, que este projeto não tem e não terá tão cedo, enquanto a diferença de cobertura cobra logo no primeiro teste de componente que abrir um overlay do Radix. Escolher `jsdom` também elimina a divergência com a documentação do Next.js. Se a decisão for esta, a skill `testing-guide-next-frontend` precisa ter o template de `vitest.config.ts` corrigido no mesmo commit — hoje ela diz `happy-dom`.

**Decision:** Option A — `jsdom`. A diferença de velocidade não se paga numa suíte deste tamanho, enquanto a diferença de cobertura cobra no primeiro teste de componente que abrir um overlay do Radix; a escolha também elimina a divergência com a documentação oficial do Next.js. **Consequência a executar no mesmo commit:** o template de `vitest.config.ts` da skill `testing-guide-next-frontend` (`references/external-systems.md`) diz `happy-dom` e passa a estar errado.

**Renders in:** frontend-runtime

**Libraries:** jsdom

---

## TD-03: Tipagem dos handlers MSW a partir do contrato OpenAPI (codegen)

**Scope:** Cross-layer

**Trigger:** A skill de testes instrui a usar literais inline nos fixtures "até o codegen existir" — e o codegen passou a existir na task `next-frontend-api-typing`, que entregou `lib/api/schema.d.ts` gerado da `openapi.json`.

**Context:** O fixture MSW é hoje o único lugar do frontend onde o shape de uma resposta do NestJS é escrito à mão. Isso importa mais aqui do que pareceria: `next-frontend-api-typing/TD-03` decidiu **não** validar respostas em runtime na fronteira BFF↔NestJS, aceitando explicitamente o risco de um campo removido virar `undefined` silencioso, e apostando na quebra de build como rede de segurança. Um fixture não tipado fura essa rede pelo lado dos testes: a suíte continua verde contra um contrato que não existe mais, o que é pior do que não ter teste, porque produz confiança falsa. A decisão é Cross-layer porque o que está em jogo é a sincronia do contrato entre os dois subprojetos. Há também uma consequência de regra: `next-frontend/CLAUDE.md` § Typed API contracts proíbe importar `lib/api/schema` fora de `lib/api/`, e qualquer opção tipada aqui precisa dizer como `mocks/` obtém os tipos.

**Options:**

### Option A: `openapi-msw` (`createOpenApiHttp<paths>()`)
- Wrapper tipado sobre o MSW, construído especificamente para a saída do `openapi-typescript`. O handler recebe `paths` como parâmetro de tipo e passa a verificar em build o caminho, o método, o status e o corpo da resposta (`response(200).json(...)`).
- **Pros:** transforma mudança de contrato em erro de compilação **dentro do fixture**, que é exatamente a rede que a TD-03 de api-typing deixou faltando; um caminho ou status que não existe na spec não compila; `http.untyped` continua disponível para o que estiver fora da spec.
- **Cons:** mais uma dependência de desenvolvimento, com o seu próprio ritmo de compatibilidade com `msw` 2.x e `openapi-typescript` 7.x; acopla os fixtures a um wrapper de terceiros além do MSW.

### Option B: MSW puro com tipos derivados manualmente do schema gerado
- Handlers escritos com `http.post(...)` normal, tipando o corpo via `HttpResponse.json<components["schemas"]["RegisterResponseDto"]>(...)` ou um alias derivado.
- **Pros:** nenhuma dependência nova; usa os tipos gerados que já estão versionados; o corpo da resposta quebra em build se um campo sumir.
- **Cons:** só o **corpo** é verificado — caminho, método e status seguem sendo strings e números livres, então um endpoint renomeado no backend passa despercebido; exige disciplina em cada handler novo, sem nada que force a derivação.

### Option C: manter literais inline não tipados
- Status quo descrito na skill: payloads inline moldados a olho a partir da `openapi.json`.
- **Pros:** zero setup e zero dependência; honesto ao não fingir contrato.
- **Cons:** contradiz o princípio de comunicação orientada a contrato que o `CLAUDE.md` da raiz acabou de firmar; deixa a suíte verde contra contratos mortos, que é o modo de falha mais caro de todos.

**Recommendation:** Option A — é a única que fecha o buraco que a `next-frontend-api-typing/TD-03` conscientemente deixou aberto, e ela o fecha no lugar mais barato (build do teste, não runtime de produção). Vale um efeito colateral concreto: com a verificação de status, o fixture de `POST /auth/login` vai acusar de imediato a imprecisão já confirmada na spec do backend, que declara `RegisterResponseDto` como resposta 200 do login. Se adotada, decidir junto como `mocks/` acessa `paths` — reexportar o tipo por `lib/api/contracts.ts` mantém a regra de importação vigente sem carve-out; abrir exceção para `mocks/` é a alternativa mais direta e mais frouxa. Verificar a compatibilidade da versão de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0 no momento da instalação.

**Decision:** Option A — `openapi-msw` (`createOpenApiHttp<paths>()`), com caminho, método, status e corpo verificados em build. **Sub-decisão do acesso a `paths`:** `mocks/` obtém o tipo por **reexportação a partir de `lib/api/contracts.ts`**, não por importação direta de `lib/api/schema`. Assim a regra de `next-frontend-api-typing/TD-02` — só `lib/api/` toca o arquivo gerado — permanece intacta e **sem carve-out**, e `mocks/` passa a ser um consumidor do módulo de contrato como qualquer outro. Verificar na instalação a compatibilidade de `openapi-msw` com `msw` 2.x e `openapi-typescript` 7.13.0.

**Renders in:** frontend-runtime

**Libraries:** openapi-msw, msw

---

## TD-04: Superfície de fake da lane de browser — as rotas relativas do BFF

**Scope:** Frontend

**Trigger:** Existem duas fronteiras HTTP falsificáveis no frontend, e a skill de testes só descreve uma delas.

**Context:** `mocks/handlers.ts` está especificado como "um handler por endpoint do NestJS tocado pelo BFF" — ou seja, a fronteira **BFF↔NestJS**, em URLs absolutas derivadas de `config.api.baseUrl`. Mas por `next-frontend-env-config/TD-04` um client component nunca fala com o NestJS: ele chama `/api/...` relativo, e quem responde é o route handler. Nos testes de componente esse route handler não existe (nenhum servidor sobe), então a fronteira **componente↔BFF** também precisa de fake — e esses handlers são de caminho relativo, resolvidos contra o `location` do documento, inúteis para a lane de node. Com `onUnhandledRequest: "error"`, um teste de componente que dispare `fetch('/api/...')` sem handler correspondente falha. A escolha depende da TD-01: só a Option A daquela TD oferece `setupFiles` por lane. Note que não há conflito entre as duas superfícies — na lane de node o route handler é invocado como função, sem tráfego HTTP em `/api/...`.

**Options:**

### Option A: um único `mocks/handlers.ts` com as duas superfícies
- Os handlers upstream (absolutos) e os do BFF (relativos) convivem no mesmo array, carregado por um `setupFiles` comum.
- **Pros:** um arquivo só e um `server.ts` só; nada muda em relação ao layout já descrito na skill.
- **Cons:** apaga a distinção entre duas fronteiras que representam contratos diferentes; metade dos handlers fica sempre inerte na lane que está rodando; a tipagem da TD-03 só se aplica aos upstream, então o arquivo vira meio tipado e meio não.

### Option B: dois conjuntos, compostos por lane
- `mocks/handlers.ts` mantém a fronteira upstream (tipada pela TD-03) e um `mocks/bff-handlers.ts` declara as rotas relativas; cada projeto da TD-01/A carrega o seu `setupFiles`, que monta o `setupServer` com o conjunto pertinente.
- **Pros:** cada lane só vê a fronteira que de fato exercita, e `onUnhandledRequest: "error"` continua significando algo nas duas; a separação documenta sozinha que são contratos distintos; o conjunto do BFF é o lugar natural para derivar tipos de `lib/api/contracts.ts`, que é justamente a fronteira que aquele módulo modela.
- **Cons:** um arquivo e uma indireção a mais; exige que a TD-01 tenha resolvido em Option A.

### Option C: só a superfície upstream por padrão; a lane de browser declara handler por teste
- `mocks/handlers.ts` fica só com o upstream; cada teste de componente registra o que precisa com `server.use(...)`.
- **Pros:** nenhum arquivo novo; o que cada teste finge fica explícito ao lado da asserção.
- **Cons:** abandona a filosofia "default handler + override pontual" que a skill fixa para a outra lane; repete boilerplate a cada teste; sem default, o caminho feliz é reescrito toda vez e diverge sozinho.

**Recommendation:** Option B — preserva o padrão de default + override que o projeto já adotou e evita o efeito mais nocivo da Option A, que é embaralhar duas fronteiras com garantias de tipagem diferentes logo no arquivo onde a TD-03 quer precisão. Com uma única rota de BFF hoje, B e C custam quase o mesmo; a diferença aparece na terceira rota, e B é a que não precisa ser refeita lá. Se a TD-01 não for decidida como Option A, esta TD deve cair para a Option C, não para a A — sem `setupFiles` por lane, a composição da Option B não tem onde acontecer.

**Decision:** Option B — `mocks/handlers.ts` mantém a fronteira upstream NestJS (tipada pela TD-03) e `mocks/bff-handlers.ts` declara as rotas relativas do BFF. Cada projeto da TD-01 carrega o seu `setupFiles`, que monta o `setupServer` com o conjunto pertinente, de modo que `onUnhandledRequest: "error"` continue significando algo nas duas lanes.

**Renders in:** frontend-runtime

**Libraries:** —

**Revisions:**
- 2026-08-15 — O "conjunto pertinente" de cada lane é fixado explicitamente: `node` recebe apenas `handlers`; a lane de DOM, apenas `bffHandlers`. Rationale: restrição técnica provada na implementação — `mocks/handlers.ts` importa `@/lib/env`, e `@t3-oss/env-core` lança `Attempted to access a server-side environment variable on the client` sob jsdom, então a separação deixa de ser preferência de design e passa a ser obrigatória numa das direções.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Frontend | Separação dos ambientes de execução do Vitest (`node` vs DOM) | Option A — `projects`, um por lane | **A** |
| TD-02 | Frontend | Biblioteca de DOM da lane de browser | Option A — `jsdom` | **A** |
| TD-03 | Cross-layer | Tipagem dos handlers MSW a partir do contrato OpenAPI (codegen) | Option A — `openapi-msw` | **A** |
| TD-04 | Frontend | Superfície de fake da lane de browser (rotas relativas do BFF) | Option B — dois conjuntos compostos por lane | **B** |

## Dependências entre decisões

- **TD-04 depende da TD-01.** A Option B da TD-04 só é implementável se a TD-01 for a Option A, que é a única que dá `setupFiles` por lane.
- **TD-02 alimenta a TD-01.** A biblioteca escolhida é o valor de `environment` do projeto de DOM, qualquer que seja o mecanismo de separação.
- **TD-03 herda de `next-frontend-api-typing`.** Consome `lib/api/schema.d.ts` e é regida pela regra de importação de `next-frontend/CLAUDE.md` § Typed API contracts.

## Efeitos colaterais a tratar na implementação

Não são decisões — são consequências que a task de implementação precisa absorver, registradas aqui para não se perderem.

- **A skill `testing-guide-next-frontend` fica desatualizada em três pontos** assim que estas TDs forem decididas: o template de `vitest.config.ts` (ambiente único e `happy-dom`, contra TD-01 e TD-02), o template de `mocks/handlers.ts` (literais inline, contra TD-03) e a seção `references/external-systems.md` § "Typing the fixtures", que ainda afirma que a adoção do codegen está diferida — deixou de ser verdade. A própria seção manda que quem adotar o cliente tipado a atualize no mesmo commit.
- **`next-frontend/CLAUDE.md` § Testing** abre dizendo que o ferramental não está ligado; deixa de valer com o bootstrap.
- **O contrato de teste diferido de `lib/env.ts` está no escopo desta task** (resolvido em `/plan-resolve`, AMB-1). São quatro casos de `lib/env.ts` mais dois do export `config`, todos descritos em `docs/tasks/task-next-frontend-env-config/progress.md` (SI-3 e SI-4). É o primeiro teste que a lane de `node` recebe, e ele valida por execução as ACs que a env-config fechou sem runner. Atenção às duas armadilhas já registradas lá: os casos exigem `vi.resetModules()` + `await import("../env")` por caso, e precisam rodar sob `environment: "node"` — que é exatamente o que a TD-01 garante.
- **O primeiro route handler do BFF fica fora desta task** (resolvido em `/plan-resolve`, AMB-2). Não existe nada em `app/api/` hoje, então a lane de integração (`*.integration.test.ts`) e o conjunto `mocks/bff-handlers.ts` nascem sem nenhum teste que os exercite — entregam estrutura, não cobertura. A decisão preserva o `CLAUDE.md` § Scope Limits (uma coisa por vez). **Consequência a carregar adiante:** a task que criar o primeiro route handler é dona do primeiro teste de integração e do primeiro handler de `bff-handlers.ts`, e é lá que a TD-03 e a TD-04 serão provadas por execução pela primeira vez.
- **Resolução do alias `@/*`.** O guia oficial do Next.js usa `vite-tsconfig-paths`; o template da skill duplica o mapeamento à mão em `resolve.alias`. Preferir o plugin evita uma segunda fonte de verdade para o mesmo mapeamento. Detalhe de implementação, sem TD.
