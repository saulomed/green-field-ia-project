---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-08-09
scope_description: "Base de configuração de variáveis de ambiente do next-frontend: acesso tipado, validação, organização e fronteira server/client. Inclui também a convenção de carregamento de env no ambiente de teste, cuja implementação é delegada à task de MSW (que materializa o ferramental Vitest)."
---

# Technical Decisions — Configuração de Ambiente do `next-frontend`

_Subprojects in scope:_

- `next-frontend/` — alvo exclusivo destas decisões. Hoje não há **nenhuma** leitura de `process.env` no código (`grep` em `app/`, `components/`, `lib/`, `scripts/` retorna zero); existe apenas o `.env.example` com `API_BASE_URL` e `NEXT_PUBLIC_API_BASE_URL`. É greenfield puro.
- `nestjs-project/` — sem decisão em aberto aqui. O backend já tem sua base de configuração fechada em `config/TD-01..TD-04`; este documento não altera nada lá. A relação é de **espelhamento de princípio**, não de código compartilhado — registrada na Revision de 2026-08-09 em `config/TD-02`.

## Contexto e Restrições

Estado instalado (`next-frontend/package.json`): `next@16.2.12`, `react@19.2.4`, `typescript@^5`, Tailwind v4, shadcn/radix. **Nenhuma biblioteca de validação instalada** — o front não herda `joi` nem `class-validator` do backend (são `node_modules` de outro subprojeto, sem workspace compartilhado).

Restrições herdadas (não reabrir):

- Duas base URLs por design (`next-frontend/CLAUDE.md` § API Integration): `API_BASE_URL=http://nestjs-api:3000` para código server-side e `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` para o browser. A regra de host do `CLAUDE.md` raiz e sua exceção para o browser estão fechadas.
- O token de sessão trafega em cookie `httpOnly` (`auth/TD-03`) — o frontend **nunca** manuseia segredo de auth via env.
- O client tipado da API será `openapi-typescript` + `openapi-fetch` (`openapi-spec/TD-05`), com adoção diferida. Este documento decide de onde esse client lê a base URL, não qual client é.
- O princípio de "um arquivo de config por domínio, sem leitura direta de `process.env` fora do loader" foi estendido ao `next-frontend/` pela Revision de 2026-08-09 em `config/TD-02` — mas a **mecânica** (`registerAs`, `ConfigModule`) é exclusiva do NestJS e não se transporta.
- Testes: Vitest + MSW, com handlers que devem ler a base URL **da mesma variável que o código de produção usa** (`next-frontend/CLAUDE.md` § Testing, linha 147). Ferramental ainda não existe.

Restrições de plataforma confirmadas na documentação do Next.js 16.2 (via Context7):

- Variáveis `NEXT_PUBLIC_*` são **inlinadas no bundle JavaScript em build time** — não são lidas em runtime pelo browser.
- Server Components acessam `process.env` diretamente; para forçar leitura em **runtime** (em vez de congelar no build durante prerender), é preciso `await connection()` de `next/server`, que opta a rota por renderização dinâmica.
- A ordem de carregamento dos arquivos é `.env.{mode}.local` > `.env.local` > `.env.{mode}` > `.env`, com `mode = test` quando `NODE_ENV=test`. `@next/env`'s `loadEnvConfig()` expõe esse mesmo carregamento para scripts e ferramentas fora do runtime do Next.

---

## TD-01: Estratégia de acesso à configuração e enforcement da fronteira server/client

**Scope:** Frontend

**Trigger:** O usuário quer "uma base de configuração no next-frontend para organizar variáveis de ambiente, tipo como fizemos com o nestjs-project" — hoje não existe nenhuma, e a primeira leitura de `process.env` do projeto está prestes a ser escrita.

**Context:** Esta é a decisão-raiz: define se `process.env` é lido em qualquer lugar ou apenas num módulo único, e — o ponto que não existe no backend — se a separação entre variável server-only e variável pública é apenas **convenção de prefixo** ou é **verificada**. O risco concreto é assimétrico em relação ao NestJS: no front, ler uma variável server-only dentro de um subtree `"use client"` não gera erro; o Next apenas substitui por `undefined` no bundle (ou, se a variável tiver prefixo `NEXT_PUBLIC_`, embute o valor no JavaScript público). Uma falha desse tipo é silenciosa em dev e permanente em produção — o valor fica no artefato distribuído. O projeto não tem segredo no front hoje, mas terá (chaves de analytics, base URLs de storage), e a fronteira precisa existir antes disso.

**Options:**

### Option A: `process.env` direto, com convenção de prefixo
- Cada consumidor lê `process.env.API_BASE_URL` no ponto de uso; a disciplina de não vazar server-only fica a cargo do code review e do prefixo `NEXT_PUBLIC_`.
- **Pros:** zero dependência e zero código novo; é o caminho que a própria documentação do Next mostra.
- **Cons:** o tipo é `string | undefined` em todo ponto de uso, forçando `!` ou guarda repetida; nenhuma variável ausente é detectada até o request que a usa; contraria diretamente o princípio herdado de `config/TD-01`/`config/TD-02` (o backend proibiu leitura direta justamente por isso); a fronteira server/client não é verificada por nada.

### Option B: Módulo de config próprio (`lib/env.ts`), validado no import
- Um único módulo parseia e valida `process.env` com um schema, exporta um objeto tipado e congelado, e é a **única** referência a `process.env` no projeto (regra sustentada por ESLint `no-restricted-properties`). A separação server/client é feita à mão: dois exports (ou dois arquivos), com `import "server-only"` marcando o lado server para que o bundler falhe o build se um Client Component o importar.
- **Pros:** espelha fielmente o padrão do backend (loader único, tipos derivados do schema, falha na inicialização e não no request); dependência única (a lib de validação da TD-02); controle total sobre formato de erro e defaults; `server-only` transforma o vazamento em erro de build, não em bug silencioso.
- **Cons:** o enforcement da fronteira depende de o autor lembrar de colocar `import "server-only"` no arquivo certo — é verificado, mas não é automático; código próprio a manter (~40 linhas); a checagem de que toda `NEXT_PUBLIC_*` foi destructurada literalmente (exigência do inlining em build time) fica por conta da disciplina.

### Option C: `@t3-oss/env-nextjs`
- Biblioteca dedicada: `createEnv({ server, client, shared, experimental__runtimeEnv })` valida na importação e **impõe em runtime e em tipo** que (i) toda chave do bloco `client` tenha prefixo `NEXT_PUBLIC_` e (ii) acesso a uma variável do bloco `server` a partir do browser lance erro (`onInvalidAccess`). Aceita qualquer validador Standard Schema v1 (Zod, Valibot, ArkType), então compõe com a TD-02.
- **Pros:** a fronteira server/client passa a ser garantida pela biblioteca, não por convenção — é a única opção que fecha o modo de falha descrito no Context; `experimental__runtimeEnv` obriga a destructuração literal das chaves públicas, que é exatamente o que o inlining do Next exige, eliminando a classe de bug "variável pública vira `undefined` no bundle"; `emptyStringAsUndefined: true` resolve o caso `VAR=` do `.env`.
- **Cons:** uma dependência de produção a mais num projeto que hoje tem 9; a API tem arestas de versionamento (`experimental__` no nome do campo há várias releases); as chaves públicas precisam ser listadas duas vezes (no schema e no `runtimeEnv`), o que é redundância real ainda que intencional; adiciona uma camada de indireção sobre um problema que, com 2 variáveis, ainda é pequeno.

**Recommendation:** Option C — a diferença material entre B e C não é tipagem (as duas entregam), é **onde mora o enforcement da fronteira**: em B ele depende de o autor lembrar do `import "server-only"` a cada arquivo novo; em C ele é estrutural, e a exigência de destructuração literal em `experimental__runtimeEnv` neutraliza de graça o modo de falha mais caro do Next (uma `NEXT_PUBLIC_*` que silenciosamente vira `undefined` no bundle). Com 2 variáveis hoje o custo parece desproporcional, mas as fases 03–07 acrescentam base URL de storage, chaves de player e provavelmente analytics — todas atravessando essa fronteira. Option B é a escolha defensável se a preferência for não adicionar dependência: entrega o mesmo resultado com mais disciplina exigida. Option A está descartada — reabre por omissão a decisão que `config/TD-01` fechou.

**Decision:** Option C — `@t3-oss/env-nextjs` com blocos `server` / `client` / `shared` e `experimental__runtimeEnv`. O enforcement da fronteira server/client passa a ser estrutural (a biblioteca lança ao acessar variável server-only no browser e exige destructuração literal das chaves públicas), não convencional.

**Renders in:** frontend-runtime

**Libraries:** @t3-oss/env-nextjs

---

## TD-02: Biblioteca de validação do schema de ambiente

**Scope:** Frontend

**Trigger:** A TD-01 (em qualquer das opções B ou C) exige um validador, e o `next-frontend` não tem nenhum instalado — nem herda o `joi` do backend, já que não há workspace compartilhado entre os subprojetos.

**Context:** A escolha não se esgota em validar env. O `next-frontend` vai precisar de validação de formulário nas telas de cadastro/login (Fase 02 do plano) e de parsing de resposta nos route handlers, e a decisão natural é que seja a mesma biblioteca — trocar depois custa mais que escolher agora. O peso no bundle importa apenas se a lib acabar num Client Component; validação de env é server-side e tree-shakeable, mas validação de formulário não é. _(Depende de TD-01: se a TD-01 for Option A, esta TD é dispensada.)_

**Options:**

### Option A: Zod v4
- Schema declarativo com inferência de tipo (`z.infer`); implementa Standard Schema v1, então pluga direto no `createEnv` da TD-01 Option C.
- **Pros:** padrão de fato do ecossistema React/Next — integrações prontas com React Hook Form, Server Actions e `openapi-fetch`; documentação e exemplos abundantes; a v4 reduziu significativamente o bundle e o custo de tipos frente à v3.
- **Cons:** o mais pesado dos três no bundle do cliente quando usado em formulários; a superfície de API é grande para o uso restrito de validar 2–5 variáveis.

### Option B: Valibot
- Mesma proposta declarativa, mas com API modular por funções (`v.pipe(v.string(), v.url())`), otimizada para tree-shaking. Também implementa Standard Schema v1.
- **Pros:** bundle client significativamente menor que Zod quando só um subconjunto de validadores é usado — relevante num projeto que já cuida do peso do front; API estável.
- **Cons:** ecossistema de integrações menor (adapters de formulário existem, mas são menos exercitados); menos familiar para quem chega ao projeto; o ganho de bundle é irrelevante para o caso de uso desta TD (env é server-side), só se paga se a lib também virar a de formulários.

### Option C: Validação manual, sem biblioteca
- Uma função no próprio `lib/env.ts` que checa presença e formato das variáveis com `URL()`/`typeof` e lança erro agregado.
- **Pros:** dependência zero; para 2 variáveis, cabe em 20 linhas legíveis; nenhum acoplamento a versionamento de terceiros.
- **Cons:** os tipos precisam ser escritos à mão em paralelo às checagens, criando duas fontes de verdade que divergem em silêncio — o oposto do que `config/TD-03` buscou no backend; não pluga no `createEnv` da TD-01 Option C, que espera um Standard Schema; a decisão de validação de formulário fica em aberto e provavelmente traz uma lib depois, tornando este código morto.

### Option D: Reusar Joi no frontend
- Instalar `joi` também no `next-frontend`, mantendo a mesma biblioteca dos dois lados do monorepo.
- **Pros:** simetria literal com `config/TD-03`; uma única sintaxe de validação para quem transita entre os subprojetos.
- **Cons:** Joi não implementa Standard Schema, então não compõe com a TD-01 Option C; a inferência de tipo é fraca (`Joi` não deriva tipos TS do schema — exigiria escrever a interface à mão, o mesmo defeito da Option C); é uma lib pensada para Node, pesada e não tree-shakeable no browser, o que a inviabiliza para formulários; a simetria é cosmética — os subprojetos não compartilham código, só aparência.

**Recommendation:** Option A (Zod v4) — a decisão real não é "o que valida 2 variáveis melhor" (as quatro validam), é qual biblioteca o front vai carregar quando as telas de formulário chegarem, e aí Zod é a que tem integração pronta com React Hook Form e com o `openapi-fetch` de `openapi-spec/TD-05`, evitando uma segunda lib depois. Option B é a escolha certa se o peso do bundle do cliente for tratado como restrição dura — o ganho é real, o custo é ecossistema menor. Option D é simetria aparente que não se sustenta tecnicamente: Joi não gera tipos nem compõe com a TD-01 Option C.

**Decision:** Option A — Zod v4. Implementa Standard Schema v1, então pluga direto no `createEnv` da TD-01, e é a mesma biblioteca que servirá à validação de formulários das telas de auth.

**Libraries:** zod

---

## TD-03: Organização das variáveis — arquivo único vs namespaces por domínio

**Scope:** Frontend

**Trigger:** A Revision de 2026-08-09 em `config/TD-02` estendeu ao `next-frontend` o princípio de namespacing por domínio, mas deixou explícito que a mecânica não se transporta — resta decidir a forma concreta no front.

**Context:** O backend tem 25 variáveis em 4 namespaces (`app`, `database`, `mail`, `auth`, `swagger`). O front tem **2**, ambas do mesmo domínio (a API). A pergunta é se o namespacing se paga agora ou se é estrutura antecipada. O crescimento previsível pelo plano: Fase 03 traz base URL de object storage, Fase 05 possivelmente configuração de player, Fase 07 traz analytics e a URL pública de produção — algo como 6 a 10 variáveis em 3 domínios ao fim do projeto, uma ordem de grandeza abaixo do backend. _(Depende de TD-01.)_

**Options:**

### Option A: Arquivo único (`lib/env.ts`), agrupado por comentário
- Um só módulo com todas as variáveis; a separação por domínio existe como seções comentadas e como prefixo no nome da chave (`API_*`, `STORAGE_*`).
- **Pros:** proporcional ao tamanho real do problema; um único ponto de import (`import { env } from "@/lib/env"`), sem decidir de qual arquivo importar; a TD-01 Option C já exige um único `createEnv`, então múltiplos arquivos exigiriam múltiplas chamadas e perderiam a validação atômica.
- **Cons:** com 10 variáveis o arquivo fica com ~60 linhas — ainda legível, mas sem fronteira estrutural; diverge da forma (não do princípio) adotada no backend.

### Option B: Namespaces por domínio em `lib/config/`
- Um arquivo por domínio (`api.config.ts`, `storage.config.ts`), cada um exportando seu próprio slice validado, compostos por um barrel `lib/config/index.ts`.
- **Pros:** simetria estrutural com `nestjs-project/src/config/`, que é o que o usuário pediu ao citar o backend; cada módulo importa só o domínio que usa; escala sem refatoração se o front crescer além do previsto.
- **Cons:** cria 3 arquivos para 2 variáveis hoje; com a TD-01 Option C, um `createEnv` por arquivo significa validação fragmentada (cada slice falha isoladamente, sem relatório único de erro) — ou exige montar o schema em partes e chamar `createEnv` uma vez só, que é o namespacing virando apenas organização de schema, não de módulos.

### Option C: Namespacing só no objeto exportado, arquivo único
- Um `lib/env.ts` com um único `createEnv`, mas o export final reagrupado em objeto aninhado: `config.api.baseUrl`, `config.api.publicBaseUrl`, `config.storage.baseUrl`.
- **Pros:** consumidores enxergam fronteiras de domínio (`config.api.*`) sem custo de arquivos; validação continua atômica e com relatório de erro único; o custo de migrar para Option B depois é mecânico, porque os call sites já falam em domínios.
- **Cons:** duas representações no mesmo arquivo (chaves planas no schema, objeto aninhado no export) — uma camada de mapeamento a manter em sincronia manualmente; não é o formato do backend, então a simetria continua sendo de princípio e não de forma.

**Recommendation:** Option C — preserva o que a Revision de `config/TD-02` de fato exige (fronteiras de domínio visíveis no ponto de consumo) sem pagar por três arquivos para duas variáveis, e mantém a validação atômica que a TD-01 Option C torna desejável. Option B é a resposta certa se a simetria estrutural literal com `src/config/` for o objetivo declarado — é defensável, custa organização antecipada. Option A é suficiente e honesta se a expectativa for que o front nunca passe de ~5 variáveis.

**Decision:** Option C — arquivo único com um só `createEnv`, exportando um objeto reagrupado por domínio (`config.api.baseUrl`). Fronteiras de domínio visíveis no ponto de consumo, sem fragmentar a validação.

---

## TD-04: Momento de resolução das variáveis públicas — build time vs runtime no container

**Scope:** Repo-wide

**Trigger:** O `next-frontend` roda em container e o plano prevê deploy na Fase 07; `NEXT_PUBLIC_*` é inlinada no bundle em build time, então a imagem construída em dev não pode ser promovida para produção sem que a base URL pública mude junto.

**Context:** Confirmado na documentação do Next 16.2: `NEXT_PUBLIC_API_BASE_URL` é substituída literalmente no JavaScript durante o `next build` — não é lida do ambiente do container em runtime. Hoje isso é invisível porque `Dockerfile.dev` não executa build (o `CMD` é `tail -f /dev/null` e o dev server compila sob demanda, lendo o `.env` a cada boot). O problema aparece na primeira imagem de produção: `docker build` congela `http://localhost:3000` no bundle, e trocar a env var no `docker run` não muda nada — o front em produção continuaria chamando `localhost`. A decisão precisa ser tomada antes do Dockerfile de produção existir, porque ela determina se a imagem é parametrizável ou é por-ambiente. Isto **não** afeta `API_BASE_URL` (server-side), que é sempre lida em runtime pelo processo Node. _(Depende de TD-01.)_

**Options:**

### Option A: Build por ambiente — `ARG` no Dockerfile
- O `Dockerfile` de produção declara `ARG NEXT_PUBLIC_API_BASE_URL`, promovido a `ENV` antes do `next build`; cada ambiente constrói sua própria imagem.
- **Pros:** caminho canônico e documentado do Next; nenhum código de aplicação envolvido; o bundle final é totalmente estático e cacheável, sem custo de runtime.
- **Cons:** a imagem deixa de ser um artefato promovível — a mesma build testada em staging não é a que vai para produção, o que enfraquece a garantia do pipeline; qualquer mudança de URL pública exige rebuild completo.

### Option B: Runtime público via Server Component + `connection()`
- Nenhuma variável `NEXT_PUBLIC_*`: a base URL pública é lida em runtime por um Server Component (`await connection()` de `next/server`, que força renderização dinâmica) e injetada nos Client Components via prop ou Context provider no layout raiz.
- **Pros:** uma única imagem promovível por todos os ambientes, parametrizada só por `docker run -e`; elimina por construção a classe de bug "variável pública desatualizada no bundle"; a config pública passa a ter a mesma origem que a server-side, uma fonte de verdade só.
- **Cons:** `connection()` opta a rota por renderização dinâmica, custando o prerender estático das rotas que dependem da config — em telas de auth (o consumo previsto agora) isso é irrelevante, mas na home da Fase 07, que é candidata natural a estático, é um custo real; exige um provider no layout e disciplina para que nenhum Client Component leia a config de outra forma.

### Option C: Nenhuma URL pública — todo tráfego do browser passa pelo BFF
- O browser nunca chama a API diretamente: chama apenas rotas relativas (`/api/...`) dos route handlers do próprio Next, que rodam server-side e usam `API_BASE_URL`. `NEXT_PUBLIC_API_BASE_URL` é removida.
- **Pros:** o problema desaparece em vez de ser resolvido — não há variável pública para inlinar, e a imagem é promovível sem `connection()` nem custo de renderização; casa com o BFF que `next-frontend/CLAUDE.md` já descreve como o padrão de teste (route handlers testados como integração contra o MSW); mantém o cookie `httpOnly` de `auth/TD-03` numa origem só, o que simplifica o `SameSite=Strict` de `auth/TD-15`.
- **Cons:** todo request do browser ganha um salto extra de rede (browser → Next → Nest), com custo de latência e de um processo Node no caminho de dados; obriga a escrever um route handler para cada endpoint consumido pelo cliente, o que é trabalho real e recorrente; inviabiliza consumo direto de recursos de streaming da Fase 03/05, que precisam ir do browser ao storage sem intermediário.

**Recommendation:** Option C para o tráfego de API, com a ressalva explícita de que ela **não** cobre streaming e download de vídeo (Fases 03 e 05), que continuarão exigindo URL pública e devem ser decididos quando o object storage entrar em escopo. A justificativa é que o projeto já escolheu o BFF como a superfície testável do front (`CLAUDE.md` § Testing fixou route handlers + MSW como o lane de integração) e já escolheu cookie `httpOnly` + `SameSite=Strict` (`auth/TD-03`, `auth/TD-15`) — manter browser e API na mesma origem é o que faz esse cookie funcionar sem exceção. Option A é a escolha pragmática se a intenção for aceitar imagens por ambiente; Option B é a mais correta conceitualmente para uma imagem promovível, mas cobra prerender estático justamente na home da Fase 07, que é onde o estático mais vale.

**Decision:** Option C — sem variável pública: o browser consome apenas rotas relativas (`/api/...`) dos route handlers do Next, que usam `API_BASE_URL` server-side. `NEXT_PUBLIC_API_BASE_URL` é removida. Streaming e download de vídeo (Fases 03 e 05) ficam **fora** desta decisão e exigirão URL pública própria, a decidir quando o object storage entrar em escopo.

---

## TD-05: Carregamento da configuração no ambiente de teste

**Scope:** Frontend

**Trigger:** O contrato de testes já fixado em `next-frontend/CLAUDE.md` exige que os handlers MSW leiam a base URL "da mesma variável que o handler usa, nunca hardcoded" — mas o Vitest não roda dentro do runtime do Next e portanto não carrega `.env*` sozinho.

**Context:** O Next carrega `.env.{mode}.local` > `.env.local` > `.env.{mode}` > `.env` no boot do seu próprio servidor, com `mode = test` quando `NODE_ENV=test`. O Vitest não participa disso: sem configuração explícita, `process.env.API_BASE_URL` é `undefined` sob teste, e o módulo de config da TD-01 — que valida no import — **lançaria no primeiro import de qualquer teste**. Ou seja: a decisão de validar na inicialização (TD-01 B ou C) torna o carregamento de env em teste um pré-requisito, não um detalhe. Há ainda o risco inverso: se o Vitest herdar o `.env` real, um teste mal escrito pode escapar para `nestjs-api` de verdade, violando o `onUnhandledRequest: "error"` que o contrato exige. _(Depende de TD-01. Fronteira: esta TD decide de onde os testes tiram a config; a estrutura dos handlers MSW e o registro de fakes por fase são escopo da pesquisa separada de MSW.)_

**Options:**

### Option A: `loadEnvConfig()` de `@next/env` no `vitest.config.ts`
- O config do Vitest importa `loadEnvConfig(process.cwd())` no topo, reproduzindo exatamente a cascata de arquivos do Next — inclusive o `.env.test` quando `NODE_ENV=test`.
- **Pros:** uma linha, e é a API que o próprio Next expõe para este caso (scripts fora do runtime); a precedência de arquivos em teste é idêntica à de dev, sem uma segunda regra para aprender; um `.env.test` versionado dá valores determinísticos ao suite.
- **Cons:** `@next/env` é dependência transitiva do `next`, então importá-la diretamente é depender de um pacote que não está no `package.json` (resolvível adicionando-o explicitamente); se `.env.test` não existir, o teste herda o `.env` de desenvolvimento e passa a apontar para a URL real.

### Option B: Bloco `env` estático no `vitest.config.ts`
- Os valores de teste são escritos literalmente na configuração do Vitest (`test: { env: { API_BASE_URL: "http://api.test", ... } }`), sem ler arquivo nenhum.
- **Pros:** determinístico por construção — o suite não depende de arquivo no disco nem do ambiente da máquina, e é impossível herdar acidentalmente a URL de dev; um leitor vê os valores de teste sem abrir outro arquivo.
- **Cons:** cria uma segunda fonte de verdade para as chaves de configuração; quando a TD-01 acrescentar uma variável obrigatória, o suite inteiro quebra no import até alguém lembrar de espelhá-la aqui — e a mensagem de erro não aponta para a causa.

### Option C: `.env.test` carregado por `dotenv` no setup file
- O `vitest.setup.ts` chama `dotenv.config({ path: ".env.test" })` antes de qualquer import do módulo de config.
- **Pros:** explícito sobre qual arquivo é lido, sem cascata implícita; `dotenv` é dependência trivial e estável.
- **Cons:** `setupFiles` roda **depois** que o Vitest resolve os imports do arquivo de teste, então um módulo de config que valida no topo do import já terá lançado — o que faz esta opção conflitar diretamente com a TD-01 B/C, exigindo carregamento lazy da config para funcionar; reimplementa mal a cascata que a Option A ganha de graça.

**Recommendation:** Option A, com um `.env.test` versionado no repositório apontando para hosts fictícios (`http://nestjs-api.test:3000`) — reusa a mesma precedência do runtime do Next, mantém uma fonte de verdade só para as chaves, e o host fictício garante que qualquer request não interceptado pelo MSW falhe de forma óbvia em vez de vazar para o serviço real. Option B é a escolha certa se determinismo absoluto do suite valer mais que a duplicação das chaves. Option C deve ser descartada por incompatibilidade de ordem de execução com a validação-no-import da TD-01, não por preferência.

**Decision:** Option A — `loadEnvConfig()` de `@next/env` no `vitest.config.ts`, com `.env.test` versionado apontando para hosts fictícios. A **materialização** do ferramental de teste (`vitest.config.ts`, `vitest.setup.ts`) fica fora do escopo desta task e pertence à pesquisa de MSW; o que se fixa aqui é a convenção que ela deve aplicar.

**Libraries:** @next/env

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Frontend | Estratégia de acesso à configuração e enforcement da fronteira server/client | Option C — `@t3-oss/env-nextjs` | Option C |
| TD-02 | Frontend | Biblioteca de validação do schema de ambiente | Option A — Zod v4 | Option A |
| TD-03 | Frontend | Organização das variáveis — arquivo único vs namespaces | Option C — namespacing no objeto exportado | Option C |
| TD-04 | Repo-wide | Momento de resolução das variáveis públicas — build time vs runtime | Option C — sem URL pública; browser fala só com o BFF | Option C |
| TD-05 | Frontend | Carregamento da configuração no ambiente de teste | Option A — `loadEnvConfig()` + `.env.test` versionado | Option A |

## Notes

- **Fronteira com as outras duas pesquisas pedidas.** Este documento decide **de onde** o código lê a configuração. Não decide o client HTTP tipado (`openapi-spec/TD-05` já fixou `openapi-typescript` + `openapi-fetch`; a adoção e a tipagem componente→BFF são pesquisa separada) nem a estrutura dos handlers MSW por fase. A TD-04, porém, **restringe** as duas: se a Option C for aceita, todo consumo de API pelo browser passa a exigir um route handler, o que muda a superfície que a pesquisa de MSW precisa cobrir.
- **Inconsistência observada, fora de escopo desta pesquisa.** `next-frontend/CLAUDE.md` linha 117 cita o client tipado como `openapi-spec/TD-07`, mas o TD correto é `openapi-spec/TD-05` (`TD-07` é documentação de respostas de erro). Corrigir em tarefa separada.
