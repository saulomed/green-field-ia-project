---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-08-14
scope_description: "Adoção do codegen OpenAPI no next-frontend: pipeline de geração dos tipos, contrato tipado entre componentes e BFF, e política de validação de runtime na fronteira com o NestJS"
---

# Technical Decisions — Tipagem das chamadas de API do `next-frontend`

_Subprojects in scope:_

- `next-frontend/` — alvo principal: consome o `openapi.json`, tipa as chamadas do BFF para o NestJS e as chamadas dos componentes para o BFF (TD-01 a TD-03).
- `nestjs-project/` — produtor do artefato. Nenhum TD exclusivo aqui: `openapi-spec/TD-04` já fixou que `nestjs-project/openapi.json` é gerado por script e versionado, e este documento só decide como o consumidor o alcança.

## Contexto e restrições

`openapi-spec/TD-05` **já decidiu a estratégia**: `openapi-typescript` (tipos) + `openapi-fetch` (client). O que ficou explicitamente diferido foi a **adoção** no `next-frontend/`, registrada como capacidade diferida em `docs/tasks/task-openapi-spec/context.md`. Este documento não reabre a escolha da biblioteca — decide como adotá-la.

Restrições herdadas (não reabrir):

- `openapi-spec/TD-04` — `nestjs-project/openapi.json` é gerado por `npm run openapi:generate` e **versionado** no repositório. Hoje o arquivo existe, com 10 paths e 9 schemas.
- `openapi-spec/TD-05` — `openapi-typescript` + `openapi-fetch`. Versões atuais no registry: `openapi-typescript@7.13.0` (devDependency, gera `.d.ts`) e `openapi-fetch@0.17.0` (runtime, ainda `0.x`).
- `next-frontend-env-config/TD-04` — o browser **nunca** chama o NestJS diretamente; fala apenas com rotas relativas `/api/...` do BFF. Isso cria duas fronteiras HTTP distintas, e é a razão de este documento existir.
- `next-frontend-env-config/TD-01` — `lib/env.ts` é o único arquivo autorizado a ler `process.env`; a base URL upstream vem de `config.api.baseUrl`.
- `auth/TD-03` — o token trafega em cookie `httpOnly`. O BFF **reformata** a resposta upstream: o que o NestJS devolve no `/auth/login` não é o que o BFF devolve ao browser.

Restrições de ambiente levantadas neste levantamento (fatos, não decisões):

- O `compose.yaml` da raiz declara `build.context: ./next-frontend` e monta `./next-frontend:/home/node/app`. **O container do frontend não enxerga `nestjs-project/openapi.json`** — nem em build, nem em runtime. Qualquer opção que exija rodar o codegen de dentro do container depende de mudar o contexto ou acrescentar um mount.
- Não existe `package.json` na raiz: o monorepo **não** tem workspaces npm hoje. Introduzir `packages/*` é uma mudança de tooling, não um detalhe de implementação.
- Não existe nenhum route handler em `next-frontend/app/` ainda. A adoção é greenfield, sem migração.

---

## TD-01: Pipeline de codegen — onde o `.d.ts` é gerado, por quem, e se é versionado

**Scope:** Repo-wide

**Trigger:** O `openapi.json` mora em `nestjs-project/` e o consumidor em `next-frontend/`, cujo container não tem acesso ao diretório do produtor — é preciso decidir por onde o artefato atravessa essa fronteira.

**Context:** A garantia central da `openapi-spec/TD-05` é que um contrato incompatível quebre o `tsc` do frontend. Essa garantia só se realiza se o `.d.ts` estiver atualizado no momento do type-check, e é justamente aí que o isolamento do container morde: o comando canônico `npx openapi-typescript ../nestjs-project/openapi.json -o lib/api/schema.d.ts` **não roda** dentro do `next-frontend`, porque o caminho não existe lá. A escolha determina quem é o dono do arquivo gerado, se ele entra no git, e o que acontece quando alguém edita um DTO no backend e esquece de regerar.

**Options:**

### Option A: Gerar por script explícito, arquivo versionado, drift verificado no CI
- Um script na **raiz** do repositório (fora dos containers) roda `openapi-typescript` e escreve `next-frontend/lib/api/schema.d.ts`, que é commitado. O CI regenera e falha se o resultado diferir do commitado.
- **Pros:** o arquivo está sempre presente para o `tsc`, o `build` e o `lint` dentro do container, sem mudar contexto nem mount; o diff do `.d.ts` aparece no PR, tornando visível toda quebra de contrato; funciona sem workspaces.
- **Cons:** exige disciplina (ou o check de CI) para não commitar tipos velhos; um arquivo gerado no controle de versão gera ruído de diff.

### Option B: Gerar em `predev`/`prebuild`, arquivo não versionado
- O `.d.ts` entra no `.gitignore` e é regerado automaticamente antes de cada `dev` e cada `build`.
- **Pros:** impossível ficar defasado; zero ruído de diff.
- **Cons:** exige que o container enxergue `nestjs-project/openapi.json` — na prática, mudar `build.context` para a raiz ou acrescentar um mount só para a spec, o que acopla os dois subprojetos no Compose; `tsc` e `lint` num checkout limpo falham antes do primeiro `dev`; o CI paga o codegen em todo job.

### Option C: Pacote compartilhado `packages/api-types` com workspaces npm
- Introduz `package.json` na raiz com workspaces; o pacote gera e publica os tipos, e `next-frontend` o consome como dependência.
- **Pros:** modela a dependência explicitamente; abre caminho para outros consumidores futuros (ex.: um worker de vídeo).
- **Cons:** introduz workspaces num monorepo que hoje não os tem, o que reverbera em Dockerfiles, `.dockerignore` e instalação de dependências dos dois subprojetos; custo alto para um consumidor só.

**Recommendation:** Option A — é a única que entrega a garantia de type-check **sem** tocar no isolamento do Compose, que a restrição de `build.context` torna caro nas outras duas; o custo real (tipos defasados) é exatamente o que o check de drift no CI elimina, e o diff visível do `.d.ts` no PR é um efeito colateral desejável quando o backend muda um DTO. A Option C é a resposta certa para o dia em que houver um segundo consumidor da spec, não hoje.

**Decision:** A — script na raiz do repositório gera `next-frontend/lib/api/schema.d.ts`, que é versionado; o CI regenera e falha se o resultado diferir do commitado.
**Libraries:** openapi-typescript

---

## TD-02: Contrato do BFF para os componentes — como as chamadas `/api/...` são tipadas

**Scope:** Frontend

**Trigger:** Os tipos gerados descrevem o contrato **NestJS↔BFF**; nada descreve o contrato **BFF↔componente**, que é o que os componentes de fato consomem.

**Context:** Por `next-frontend-env-config/TD-04` existem duas fronteiras HTTP, e por `auth/TD-03` elas **não** têm a mesma forma: o `POST /auth/login` upstream devolve um corpo JSON com dados do usuário, enquanto o route handler correspondente engole o `Set-Cookie` e devolve ao browser algo bem mais magro. Reaproveitar o tipo upstream do lado do componente seria mentir sobre o contrato — e mentir de um jeito que o `tsc` valida como verdade. A escolha decide onde mora a segunda fonte de tipos e qual o custo de mantê-la honesta. _(Depende de TD-01 — sem os tipos gerados disponíveis, nenhuma das opções derivadas se sustenta.)_

**Options:**

### Option A: Componentes importam diretamente os tipos gerados do upstream
- `components/` e `hooks/` importam de `lib/api/schema.d.ts` os mesmos tipos que o route handler usa.
- **Pros:** custo zero, nenhuma superfície nova; uma fonte de verdade só.
- **Cons:** é falso sempre que o BFF reformata — que é o caso já hoje, em auth; o componente passa a declarar tipos de campos que nunca chegam nele, e o `tsc` valida essa mentira sem reclamar.

### Option B: Módulo de contrato do BFF derivado por utility types
- Um `lib/api/contracts.ts` escrito à mão declara o contrato de cada rota `/api/...`, **derivando** dos tipos gerados via `Pick`/`Omit`/`Extract` em vez de redigitar campos.
- **Pros:** honesto sobre o que o BFF expõe; a derivação preserva a rede de segurança — remover um campo no DTO do backend quebra o `Pick` em build; sem dependência nova e sem passo de build extra.
- **Cons:** o mapa rota→tipo é mantido à mão; nada força um route handler novo a registrar seu contrato ali.

### Option C: Segunda spec OpenAPI, descrevendo o próprio BFF
- Os route handlers passam a ser descritos por uma spec própria, da qual se gera um segundo `.d.ts` e um segundo client.
- **Pros:** simetria total com o backend; o contrato do BFF vira artefato inspecionável, e o codegen fecha o ciclo automaticamente.
- **Cons:** o Next não gera essa spec sozinho — exige adotar um router com schema-first sobre os route handlers, ou manter a spec à mão; custo desproporcional para uma camada cuja única função é fina.

### Option D: Inferência de tipos a partir do próprio route handler
- Um helper `typedFetch` extrai o tipo de retorno do handler (`Awaited<ReturnType<typeof GET>>`) e o propaga ao chamador, ao estilo tRPC, sem codegen.
- **Pros:** zero manutenção — o contrato **é** o handler, então não há como divergir; sem artefato novo.
- **Cons:** o `Response` do Next é opaco por tipo (`NextResponse.json()` não carrega o tipo do corpo sem um wrapper genérico próprio); exige construir e sustentar essa engenharia de tipos; o mapa rota-string→handler continua sendo manual, só que em outro formato.

**Recommendation:** Option B — dado que o `openapi.json` e os DTOs já são a fonte de verdade upstream, derivar por utility types entrega a honestidade da Option C com o custo da Option A, e é a única que mantém o vínculo de build sem inventar infraestrutura; a Option D é sedutora mas paga engenharia de tipos própria para resolver a metade fácil do problema, e a Option A já nasce errada no primeiro endpoint do projeto que é `auth`.

**Decision:** B — `lib/api/contracts.ts` declara o contrato de cada rota `/api/...`, derivando dos tipos gerados via `Pick`/`Omit`/`Extract` em vez de redigitar campos.

**Renders in:** frontend-runtime

---

## TD-03: Validação de runtime na fronteira BFF↔NestJS

**Scope:** Frontend

**Trigger:** Tipos gerados são apagados na compilação — se a API responder algo fora do contrato em produção, nada percebe.

**Context:** O `.d.ts` gerado é uma promessa verificada em build contra a spec, não contra a resposta real. Duas coisas podem furá-la em runtime: a spec estar defasada em relação ao código do NestJS (o `openapi.json` atual, por exemplo, declara `RegisterResponseDto` como resposta do `POST /auth/login`, o que merece conferência do lado do backend), ou um proxy/erro de infra devolver um corpo inesperado. `zod@^4.4.3` já está instalado no `next-frontend` por `next-frontend-env-config/TD-02`, então validar não custa dependência nova — custa código e latência. _(Depende de TD-02 — o que se valida é a fronteira que ela definir.)_

**Options:**

### Option A: Sem validação de runtime — confiar na spec
- O BFF repassa o que recebe, tipado apenas em build.
- **Pros:** nenhum código extra, nenhuma latência; a spec versionada e o check de drift do TD-01 já cobrem a maior parte do risco.
- **Cons:** uma resposta fora do contrato vira `undefined` silencioso lá na frente, num componente, longe da causa.

### Option B: Validar toda resposta upstream com schemas Zod
- Cada route handler valida o corpo recebido do NestJS antes de reformatá-lo.
- **Pros:** a falha aparece na fronteira, com mensagem apontando o campo; protege contra spec defasada, que é o modo de falha real aqui.
- **Cons:** schemas Zod escritos à mão viram uma terceira fonte de verdade, que diverge da spec em silêncio — exatamente o problema que o codegen resolve; custo de manutenção por endpoint.

### Option C: Validar apenas o subconjunto que o BFF reexpõe ao browser
- Valida-se só os campos que o contrato do TD-02 promete ao componente, não a resposta upstream inteira.
- **Pros:** o esforço fica proporcional ao que de fato é consumido; pega a classe de erro que chega ao usuário; a superfície a manter é a mesma que o TD-02 já obriga a declarar.
- **Cons:** não detecta drift em campos que o BFF ignora; ainda duplica, em Zod, o que já está declarado em tipo.

**Recommendation:** Option A por ora — o risco que as Options B e C endereçam é o de spec defasada, e esse risco tem uma correção mais barata e mais a montante (o check de drift do TD-01, mais a conferência da resposta de `/auth/login` no backend); introduzir schemas Zod à mão agora recria a segunda fonte de verdade que a `openapi-spec/TD-05` foi escolhida para eliminar. Reavaliar quando existir codegen de schemas Zod **a partir da spec** — aí a Option C passa a custar quase nada e a recomendação muda.

**Decision:** A — sem validação de runtime por ora; o BFF repassa o que recebe, tipado apenas em build. Reavaliar quando existir codegen de schemas Zod a partir da spec, quando a Option C passa a custar quase nada.

**Renders in:** frontend-runtime

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Repo-wide | Pipeline de codegen — geração, versionamento e drift do `.d.ts` | Option A — script na raiz, arquivo versionado, drift no CI | _[pending]_ |
| TD-02 | Frontend | Contrato do BFF para os componentes | Option B — módulo derivado por utility types | _[pending]_ |
| TD-03 | Frontend | Validação de runtime na fronteira BFF↔NestJS | Option A — sem validação por ora | _[pending]_ |

## Observação para o backend (fora do escopo deste documento)

`nestjs-project/openapi.json` declara `RegisterResponseDto` como a resposta 200 do `POST /auth/login`. Pode ser reuso intencional do DTO, mas merece conferência: se for imprecisão da spec, ela se propaga direto para os tipos gerados aqui e para o contrato do TD-02. Vale uma task própria no `nestjs-project/`.
