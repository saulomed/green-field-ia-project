---
scope_type: phase
related_phases: [2]
covers_capabilities:
  - "Telas de cadastro, login, confirmação de conta e recuperação de senha"
depends_on_slices: [auth]
status: decided
date: 2026-08-17
scope_description: "Slice de frontend da Fase 02: as telas de auth no next-frontend, sua submissão através do BFF e a mecânica de sessão no cliente"
---

# Technical Decisions — Telas de Autenticação (slice de frontend da Fase 02)

_Subprojects in scope:_

- `next-frontend/` — todo o escopo de implementação deste slice: as telas de cadastro, login, confirmação e recuperação de senha, os route handlers do BFF que as servem, e a mecânica de sessão no cliente (TD-01 a TD-11).
- `nestjs-project/` — sem TD de implementação própria, mas três decisões cross-layer o alcançam: a TD-03 (propagação dos cookies de sessão através do BFF), a TD-07 (destino do link de confirmação) e a TD-11 (formato do corpo de erro consumido pelas telas), cujas opções recomendadas exigem uma Revision em `auth/TD-06`, possivelmente um ajuste de atributo de cookie e — se a TD-11 for pela Option A — a promoção dos códigos de domínio a `enum` no `ErrorResponseDto`. A API de auth em si está entregue e não é reaberta aqui.

## Contexto do slice

A Fase 02 foi entregue **backend-only** por decisão explícita (`auth/TD-09`, Option A): as 19 SIs cobriram a API de autenticação e a capability *"Telas de cadastro, login, confirmação de conta e recuperação de senha"* ficou registrada como **deferred** em `docs/phases/phase-02-auth/context.md`. Este documento é o slice que a retoma, agora que o `next-frontend/` existe e sua fundação está pronta.

**Fronteira acordada com o usuário:** o slice cobre as quatro telas **e** a mecânica de sessão no cliente que as torna funcionais (propagação de cookie, renovação do access token, guarda de rota), além do bootstrap do Playwright. Sem essa segunda metade, o login funcionaria por 15 minutos e quebraria em silêncio — as telas seriam entregues sem entregar o fluxo.

**Restrições já fixadas (não reabrir):**

- **Transporte do token** (`auth/TD-03`): cookies `httpOnly` + `Secure` + `SameSite`, emitidos pela API. O frontend nunca lê o token em JavaScript e nunca usa `localStorage`.
- **TTLs** (`auth/TD-12`): access 15min, refresh 7d, confirmação 24h, reset 1h. Refresh com rotação e detecção de reúso (`auth/TD-04` — um refresh já rotacionado devolve `TOKEN_REUTILIZADO`).
- **Sem URL pública da API** (`next-frontend-env-config/TD-04`): o browser só chama rotas relativas; `API_BASE_URL` é server-side e resolve pelo nome de serviço do Compose.
- **Contrato tipado** (`next-frontend-api-typing/TD-01`/`TD-02`): `lib/api/schema.d.ts` é gerado da spec e nunca editado; `lib/api/contracts.ts` **deriva** dele por `Pick`/`Omit`/`Extract`/`Exclude`; `components/` e `hooks/` importam só de lá. Nenhuma forma de DTO é redigitada à mão em lugar nenhum.
- **Sem validação de runtime na fronteira BFF↔NestJS** (`next-frontend-api-typing/TD-03`): o gatilho de reavaliação é a existência de codegen de Zod a partir da spec, e ele não ocorreu.
- **Lanes de teste** (`next-frontend-msw-base/TD-01`/`TD-04`): `node` para `app/api/**` e `lib/**` com o fake do NestJS; `jsdom` para `components/**` e `hooks/**` com o fake das rotas relativas do BFF.
- **Design system** (`.claude/rules/frontend-design-system.md`): Figma FC-Tube é fonte da verdade; primitivas shadcn precisam ser reconciliadas antes do primeiro uso. Nada aqui decide aparência.
- **Next.js 16**: `middleware.ts` está deprecado — o arquivo de convenção é `proxy.ts`, e o build **falha** se os dois existirem.

**Dependências entre as TDs:** a TD-02 pressupõe a TD-01 (é o cliente que os route handlers usam). A TD-04 e a TD-05 pressupõem a TD-03 (só se renova e só se guarda uma sessão cujo cookie chega ao browser). A TD-06 pressupõe a TD-01 (o mecanismo de submissão determina como o formulário entrega os dados). A TD-09 pressupõe a TD-01 (o desfecho do submit depende de como ele é submetido) e conversa com a TD-07 (as duas descrevem trechos consecutivos do mesmo fluxo de confirmação). A TD-10 pressupõe a TD-08 (só existe política de estado de banco se a suíte rodar contra um banco real).

---

## TD-01: Mecanismo de submissão dos formulários de auth

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** As quatro telas são compostas quase inteiramente de **mutações** (registrar, autenticar, solicitar reset, redefinir). O Next.js 16 oferece dois caminhos oficiais para isso, e a escolha define onde vive a chamada ao `nestjs-api`, como o cookie de sessão chega ao browser, e qual das duas lanes de teste já montadas cobre o fluxo. É a decisão-raiz do slice: TD-02, TD-03 e TD-06 se apoiam nela.

**Options:**

### Option A: Route handlers do BFF (`app/api/auth/**/route.ts`) + `fetch("/api/...")` no cliente
- Cada fluxo ganha um route handler que recebe o POST do browser, chama o `nestjs-api` e devolve status + corpo. O componente cliente faz `fetch` relativo e trata a resposta.
- **Pros:** é a forma que toda a fundação já entregue assume — `contracts.ts` **já** registra `POST /api/auth/login → POST /auth/login`, `mocks/bff-handlers.ts` existe para essas rotas relativas, e o `next-frontend/CLAUDE.md` descreve o teste de BFF como "importar e chamar o handler direto"; erros chegam como status HTTP, casando 1:1 com o `ErrorResponseDto` do backend; a fronteira é reaproveitável por qualquer cliente futuro.
- **Cons:** sem progressive enhancement (o formulário não funciona sem JS); mais código por fluxo (handler + entrada em `contracts.ts` + `fetch` + estado de pendência à mão); duas camadas para uma mutação que o Next resolve em uma.

### Option B: Server Actions (`"use server"`) com `<form action>` + `useActionState`
- A mutação vira uma função server-side invocada diretamente pelo `<form>`; `useActionState` devolve estado, erros e `pending` sem código de fetch.
- **Pros:** é o caminho canônico do Next 16 para mutação, conforme a documentação oficial; funciona sem JavaScript; `cookies().set()` é de primeira classe; nenhuma rota HTTP pública de auth fica exposta para varredura ou abuso direto; menos código.
- **Cons:** invalida a forma de três tasks já entregues — `contracts.ts` foi desenhado por rota `/api/...`, `bff-handlers.ts` nasceu para interceptá-las e a TD-04 do `msw-base` divide as lanes por essa fronteira; a chamada de uma Action é um RPC para a rota da página, não um `fetch` de URL previsível, então a lane `jsdom` deixa de conseguir fakeá-la por caminho; não há ponto de registro de contrato análogo ao route handler.

### Option C: Híbrido — Server Action nas telas, route handler só onde um endpoint HTTP real for necessário
- Formulários usam Actions; `/api/auth/refresh` e afins permanecem route handlers.
- **Pros:** pega o melhor de cada caminho por caso de uso.
- **Cons:** duas fronteiras de mutação convivendo, cada uma com sua tipagem, seu fake e sua regra de teste — o custo cognitivo permanente supera a economia pontual num escopo de quatro telas.

**Recommendation:** Option A — não por superioridade técnica intrínseca (a Option B é o idioma mais moderno e ganha em progressive enhancement), mas porque três tasks já entregues materializaram a fronteira `/api/...`: o contrato do login já está escrito em `contracts.ts`, o arquivo de fake das rotas relativas já existe vazio esperando o primeiro handler, e as regras de teste do `next-frontend/CLAUDE.md` descrevem essa forma em detalhe. Trocar agora paga em retrabalho de fundação por um benefício — funcionar sem JS — que o projeto nunca pediu.

**Decision:** Option A — route handlers do BFF (`app/api/auth/**/route.ts`) + `fetch("/api/...")` no cliente.

**Renders in:** frontend-runtime

---

## TD-02: Cliente HTTP do BFF para o `nestjs-api` — adoção do `openapi-fetch`

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** A `openapi-spec/TD-05` escolheu `openapi-typescript` (tipos) **+ `openapi-fetch`** (client) como estratégia de consumo do contrato, mas adotou só a primeira metade: a segunda ficou registrada como **deferred** em `docs/tasks/task-openapi-spec/context.md`, com o gatilho literal *"quando as telas entrarem em escopo"*. Elas entraram. Hoje `contracts.ts` tipa a **declaração** do contrato, mas o **ponto de chamada** ainda seria um `fetch` cru — um caminho ou método errado na URL compila sem reclamar. _(Depende de TD-01.)_

**Options:**

### Option A: Adotar `openapi-fetch` nos route handlers
- `createClient<paths>({ baseUrl: config.api.baseUrl })` num módulo de `lib/api/`; cada handler chama `client.POST("/auth/login", { body })` e recebe `{ data, error }` já discriminados por status.
- **Pros:** cumpre a `openapi-spec/TD-05` como escrita, encerrando o diferimento; caminho, método, corpo e status são verificados **no ponto de chamada**, não só na declaração; o `{ data, error }` casa com o perfil de erro padronizado do backend (`ErrorResponseDto`); o mecanismo de `client.use(middleware)` é o lugar natural para a propagação de cookie da TD-03 e o retry de refresh da TD-04, em um só ponto em vez de repetido por handler.
- **Cons:** nova dependência de runtime; `onError` **não** intercepta 4xx/5xx (a doc é explícita: são respostas "bem-sucedidas" com status ruim), então o tratamento de erro vive em `onResponse` ou no ponto de chamada; o relay de `Set-Cookie` exige alcançar o `Response` cru, o que o client expõe mas não facilita; mais um par de versões a manter compatível com `openapi-typescript` 7.x.

### Option B: `fetch` nativo + derivações em `contracts.ts` (forma atual)
- Cada handler monta a URL a partir de `config.api.baseUrl` e tipa entrada/saída pelos tipos derivados.
- **Pros:** zero dependência nova; controle total sobre headers e sobre o objeto `Response`, que a TD-03 vai precisar; `contracts.ts` já faz o trabalho de tipagem que importa para os componentes.
- **Cons:** o ponto de chamada fica sem rede — `fetch(\`${base}/auth/loginn\`)` compila; deixa a `openapi-spec/TD-05` meio-adotada indefinidamente, sem nenhuma decisão registrando que a outra metade foi abandonada.

### Option C: Wrapper próprio tipado por `paths`
- Uma função interna que recebe caminho e método tipados a partir de `paths` e monta o `fetch`.
- **Pros:** sem dependência externa, com verificação no ponto de chamada.
- **Cons:** é reescrever `openapi-fetch` com menos casos cobertos e manutenção não paga — exatamente o que a `openapi-spec/TD-05` já decidiu não fazer.

**Recommendation:** Option A — o diferimento registrado tinha um gatilho explícito e ele foi atingido; adotar agora fecha a cadeia contract-driven no único elo que ainda estava solto (o ponto de chamada) e dá um lugar único, e não repetido por handler, para a mecânica das TD-03 e TD-04.

**Decision:** Option A — adotar `openapi-fetch` nos route handlers, com `createClient<paths>` num módulo de `lib/api/`.

**Renders in:** frontend-runtime

**Libraries:** openapi-fetch

---

## TD-03: Propagação dos cookies de sessão do `nestjs-api` até o browser

**Scope:** Cross-layer

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** A `auth/TD-03` fixou que a API emite a sessão em cookies `httpOnly`, e a spec documenta que `POST /auth/login` define `access_token` e `refresh_token` — **este último com `path=/auth`**. Só que o browser nunca fala com o `nestjs-api` (`next-frontend-env-config/TD-04`): o `Set-Cookie` da API chega a um `fetch` server-side dentro do container, não ao navegador. Alguém precisa levá-lo adiante — e o `path=/auth` da API se refere às rotas **dela**, que não são as rotas `/api/auth/...` do BFF. É cross-layer porque duas das opções exigem mexer no backend entregue. _(Depende de TD-01.)_

**Options:**

### Option A: Relay literal do `Set-Cookie` + revisão do `path` no backend
- O handler copia `response.headers.getSetCookie()` para a própria resposta, sem tocar nos atributos; em contrapartida o backend passa a emitir o `refresh_token` com um `path` que case com a rota do BFF.
- **Pros:** o backend continua sendo o dono único dos atributos de cookie (TTL, `SameSite`, `Secure`), então nada é redigitado do lado do frontend e as expirações não podem divergir.
- **Cons:** exige alterar um backend entregue para acomodar uma necessidade de frontend; alargar o `path` do refresh desfaz o estreitamento que a `auth/TD-04` escolheu de propósito; o `Secure` emitido pela API quebra o desenvolvimento em `http://localhost:3001` a menos que o backend já o condicione ao ambiente.

### Option B: O BFF reemite os cookies com atributos próprios
- O handler lê nome, valor e `Max-Age` do `Set-Cookie` upstream e chama `cookies().set()` com o `path` das rotas do BFF, `sameSite`, e `secure` condicionado ao ambiente.
- **Pros:** os atributos que o navegador enxerga passam a ser definidos pela camada que de fato encara o navegador — que é onde o `path` correto é conhecível; o descasamento de caminho desaparece sem tocar no backend; `Secure` em desenvolvimento resolve-se onde o problema existe; nome e TTL continuam **lidos** do upstream, não redigitados, então não nasce uma segunda fonte de verdade.
- **Cons:** exige parsear o `Set-Cookie` upstream; o frontend passa a conhecer a existência de dois cookies de sessão (embora não os seus valores nem prazos).

### Option C: O BFF encapsula os dois tokens num cookie de sessão próprio (cifrado)
- Os tokens da API viram payload de um único cookie assinado/cifrado do Next (padrão `iron-session`).
- **Pros:** um cookie só, totalmente sob controle do frontend.
- **Cons:** contradiz a `auth/TD-03`, que fixou o formato de transporte da sessão; adiciona dependência de criptografia e um segredo novo a gerir; cria um segundo formato de sessão para manter em sincronia com o primeiro.

**Recommendation:** Option B — o descasamento de `path` é estrutural, não um bug: os caminhos da API são dela e nunca vão coincidir com os do BFF. Reemitir na camada que encara o browser resolve isso, mais o `Secure` em desenvolvimento, sem revisar um backend já entregue; e ler nome/TTL do `Set-Cookie` upstream mantém o backend como dono dos valores, preservando o princípio de não duplicar contrato.

**Decision:** Option B — o BFF reemite os cookies com atributos próprios, lendo nome, valor e `Max-Age` do `Set-Cookie` upstream e aplicando `path` das rotas do BFF, `sameSite` e `secure` condicionado ao ambiente.

**Renders in:** frontend-runtime

---

## TD-04: Renovação do access token — onde e quando o refresh acontece

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** O access token expira em 15 minutos e o refresh tem **rotação com detecção de reúso** (`auth/TD-04`, `auth/TD-12`): apresentar um refresh já rotacionado devolve `TOKEN_REUTILIZADO` e derruba a família de sessão. Alguém precisa chamar `POST /auth/refresh` — e a escolha de onde determina se uma corrida entre duas requisições concorrentes mata a sessão do usuário. Sem esta decisão, a tela de login entrega uma sessão que expira em silêncio. _(Depende de TD-03.)_

**Options:**

### Option A: Sob demanda no BFF — retry no 401 upstream
- Ao receber 401 do `nestjs-api`, o handler chama `/auth/refresh` uma vez, repete a requisição original e repassa os cookies novos. Com a TD-02, mora num `onResponse` do client.
- **Pros:** preguiçoso — nenhuma requisição enquanto o usuário está ocioso; um único ponto de implementação; o browser só vê o resultado final, sem saber que houve renovação.
- **Cons:** duas requisições concorrentes disparam dois refreshes, e com rotação a segunda apresenta um token já girado → `TOKEN_REUTILIZADO` → sessão derrubada por uma corrida, não por ataque. Exige guarda de *single-flight* (uma promessa compartilhada por processo), o que é frágil com múltiplas instâncias do Next.

### Option B: Proativo no `proxy.ts`
- O arquivo de convenção do Next 16 (sucessor do `middleware.ts` deprecado) verifica a cada navegação casada pelo `matcher` se o cookie de access sumiu e renova antes de renderizar.
- **Pros:** um lugar só, executando **antes** do render, então nenhuma página chega a renderizar meio-autenticada; navegações são serializadas pelo próprio fluxo, o que reduz a superfície de corrida.
- **Cons:** roda em toda requisição casada, incluindo prefetch — e a documentação do Next é explícita em recomendar que o proxy faça apenas verificações otimistas de cookie, não trabalho de rede; não cobre uma página aberta há muito tempo que só faz chamadas de cliente.

### Option C: Temporizador no cliente
- Código de browser chama `/api/auth/refresh` pouco antes da expiração.
- **Pros:** cobre páginas de vida longa sem navegação.
- **Cons:** o cliente precisaria conhecer o TTL, que é um valor do backend vazando para o bundle; uma aba adormecida acorda e dispara uma rajada; a coordenação de "só um refresh por vez" vai parar na camada menos confiável de todas.

**Recommendation:** Option A — neste slice a única chamada autenticada é `/users/me`, então a janela de concorrência é estreita e o custo do *single-flight* é baixo; e o gatilho reativo (401 real) é o único que não presume conhecer a expiração. A Option B passa a valer a pena quando a Fase 04 trouxer telas protegidas de verdade, e as duas compõem sem conflito — o proxy decide se redireciona, o BFF decide se renova.

**Decision:** Option A — sob demanda no BFF, com retry único no 401 upstream e guarda de *single-flight* para evitar `TOKEN_REUTILIZADO` por corrida.

**Renders in:** frontend-runtime

---

## TD-05: Fronteira de guarda — como o app sabe que há sessão

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** As próprias telas de auth precisam de uma guarda **invertida**: quem já está autenticado não deve ver `/login` nem `/signup`, e depois do login precisa ir para algum lugar. Como o cookie é `httpOnly` (`auth/TD-03`), o JavaScript do browser não consegue lê-lo — a verificação é obrigatoriamente server-side. A escolha aqui é a mesma que a Fase 04 vai herdar quando houver telas realmente protegidas. _(Depende de TD-03.)_

**Options:**

### Option A: `proxy.ts` com verificação otimista por presença de cookie
- O arquivo de convenção do Next 16 lê o cookie de sessão e redireciona; a autorização real permanece na API, que rejeita com 401 o que não valer.
- **Pros:** um lugar único para toda a lógica de redirecionamento, inclusive das rotas futuras; roda antes do render, então não há flash de UI errada; é o padrão documentado pelo Next para este caso.
- **Cons:** presença de cookie não é sessão válida — um cookie expirado passa pela guarda e só é rejeitado adiante; exige cuidado com o `matcher` para não rodar em `_next/*` e assets.

### Option B: Verificação por layout em Server Component
- `app/(auth)/layout.tsx` chama `/api/users/me` e usa `redirect()` conforme o resultado.
- **Pros:** verificação **real** contra a API, não presunção; colocada junto das rotas que protege; sem arquivo de convenção global.
- **Cons:** uma requisição por navegação; não alcança rotas prefetched ou estáticas; replicada em cada layout protegido conforme o app cresce.

### Option C: Verificação no cliente após hidratação
- Um hook consulta `/api/users/me` e redireciona no efeito.
- **Pros:** nenhum.
- **Cons:** flash de conteúdo errado; inútil como garantia, já que a decisão acontece depois de a página existir. Descartada.

**Recommendation:** Option A para a lógica de redirecionamento deste slice — é barata, é o padrão documentado e é a única que cobre prefetch; a autorização de verdade continua sendo do backend, que já responde 401 corretamente. A Option B entra por cima na Fase 04, quando existir uma superfície protegida cujo conteúdo dependa do usuário: as duas são complementares (otimista no proxy, real no layout), não alternativas.

**Decision:** Option A — `proxy.ts` com verificação otimista por presença de cookie. A autorização real permanece no backend.

**Renders in:** frontend-runtime

---

## TD-06: Formulários — biblioteca e origem do schema de validação

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** São quatro formulários com campos, estados de erro e pendência. O `zod@4` já está instalado e a `next-frontend-env-config/TD-02` o escolheu antecipando literalmente *"a mesma biblioteca que servirá à validação de formulários das telas de auth"*. A política de senha já está fixada no backend (`auth/TD-11`: mínimo 8, máximo 128, sem complexidade obrigatória). A pergunta aberta não é *se* haverá Zod, mas **quem orquestra o formulário** e **de onde vem a forma do payload** — porque um schema escrito à mão espelhando o DTO é exatamente a segunda fonte de verdade que o `CLAUDE.md` raiz proíbe. _(Depende de TD-01.)_

**Options:**

### Option A: React Hook Form + `@hookform/resolvers` + schema Zod amarrado ao contrato
- `useForm({ resolver: zodResolver(schema) })`, com o schema declarado como `z.ZodType<LoginBffRequest>` — o tipo vem de `contracts.ts`, então remover um campo do DTO no backend quebra o **build** do schema.
- **Pros:** biblioteca madura, com re-render mínimo e integração conhecida com as primitivas Radix/shadcn do projeto; a amarração por `z.ZodType<…>` mantém o princípio contract-driven intacto — os nomes de campo são conferidos contra o tipo gerado, não redigitados livremente; UX por campo (validar no blur, erro inline) sai de graça.
- **Cons:** duas dependências novas; obriga `"use client"` em todo formulário; a validação existe em dois lugares (cliente e API) — aceitável, desde que fique claro que a do cliente é conforto, não autoridade.

### Option B: `<form>` nativo + `useActionState`, validando com Zod no servidor
- Sem biblioteca de formulário: o estado de erro volta do servidor e é renderizado.
- **Pros:** zero dependência; é o caminho canônico do Next quando a submissão é uma Server Action.
- **Cons:** com a TD-01 na Option A não há Action para alimentar o `useActionState`, então o encaixe se perde; validação por campo antes do submit tem de ser escrita à mão.

### Option C: Sem validação no cliente — só o 400 da API
- O formulário submete e o `ErrorResponseDto` alimenta a mensagem de erro.
- **Pros:** uma única fonte de verdade de validação (o `class-validator` do backend), zero risco de divergência, menos código.
- **Cons:** um ida-e-volta de rede para um e-mail com typo; e o corpo de erro do backend traz `message`, mas a spec não declara a qual campo cada mensagem pertence — mapear erro para campo exigiria um contrato que não existe.

**Recommendation:** Option A, com o schema **tipado contra `contracts.ts`** e não escrito solto. É a combinação que dá UX por campo sem abrir a segunda fonte de verdade: se o backend mudar a forma do payload, o `tsc --noEmit` acusa no schema em vez de o formulário passar a postar um corpo errado silenciosamente. Fica registrado que o schema do cliente é afordância de UX — a autoridade sobre a regra (incluindo a política de senha) permanece no backend, que revalida sempre.

**Decision:** Option A — React Hook Form + `@hookform/resolvers` + schema Zod **tipado contra `contracts.ts`** (`z.ZodType<...>`), não escrito solto. O schema do cliente é afordância de UX; a autoridade sobre a regra permanece no backend.

**Renders in:** frontend-runtime

**Libraries:** react-hook-form, @hookform/resolvers, zod

---

## TD-07: Destino do link de confirmação de conta e a tela correspondente

**Scope:** Cross-layer

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** A revisão de 2026-07-18 na `auth/TD-06` converteu a confirmação para `GET /auth/confirm?token=…` **na própria API**, com o link do e-mail apontando direto para lá — justamente porque a confirmação não exige nenhum dado do usuário. A API responde `204`, `400` (`TOKEN_INVALIDO`) ou `409` (`EMAIL_JA_CONFIRMADO`). O problema aparece agora: a capability desta fase exige uma **tela de confirmação de conta**, e um navegador que segue esse link cai numa página em branco (204) ou num JSON cru de erro. É cross-layer porque o link mora num template de e-mail do backend e seu destino é uma rota do frontend.

**Options:**

### Option A: A API redireciona para uma página do frontend com o resultado na query
- `GET /auth/confirm` passa a responder `302` para `${APP_BASE_URL}/confirm-account?status=ok|invalid|already`; a página é um Server Component síncrono que renderiza a mensagem e a CTA (entrar / reenviar confirmação).
- **Pros:** o usuário sempre aterrissa numa página do StreamTube, em qualquer desfecho; nenhum token trafega pelo frontend, preservando a intenção da revisão de 2026-07-18; `APP_BASE_URL` já existe no backend, configurada para os links de reset; a página é puramente apresentacional, sem chamada de API — a mais barata das quatro telas.
- **Cons:** exige uma Revision em `auth/TD-06` e uma alteração no controller entregue; a semântica HTTP do endpoint muda (204/400/409 → 302), o que é ruim para um consumidor programático — embora este endpoint só seja consumido por cliques de e-mail.

### Option B: O link do e-mail volta a apontar para a página `/confirm-account?token=…`
- A página lê o token da query, chama o BFF, o BFF chama a API, e o resultado é renderizado — simétrico ao fluxo de `/reset-password`.
- **Pros:** simetria com o reset; o frontend é dono da experiência inteira de aterrissagem; nenhuma mudança de semântica HTTP na API.
- **Cons:** reverte deliberadamente a revisão de 2026-07-18, que removeu essa tela intermediária por ela não ter nada a pedir ao usuário; reintroduz o token no frontend sem ganho; e não resolve o risco de pré-busca por scanner de e-mail — apenas o desloca um salto.

### Option C: A própria API devolve HTML
- O endpoint responde uma página HTML de sucesso/erro.
- **Pros:** nenhuma rota nova no frontend.
- **Cons:** coloca apresentação na API, contra o diagrama de arquitetura e contra o design system inteiro. Descartada.

**Recommendation:** Nenhuma das três opções neste slice. As três resolvem um problema que não está aberto: `auth/TD-09` já entrega um fluxo de confirmação funcional (o link do e-mail aponta direto para `GET /auth/confirm`, e a revisão de 2026-07-18 removeu deliberadamente a tela intermediária por ela não ter nada a pedir ao usuário). A Option A reintroduziria essa tela e exigiria mudar o `204` para `302` no backend — custo de contrato cross-layer por uma superfície que não pede input; a Option B a desloca sem resolver a pré-busca por scanner; a Option C põe apresentação na API. O slice já carrega a lacuna de design de `/reset-password` e a do painel de sucesso do cadastro; abrir uma terceira, com backend a reboque, não se justifica aqui. A tela de confirmação fica registrada como capability diferida e volta quando houver design e um motivo para o usuário aterrissar nela.

**Decision:** Adiada — nenhuma das três opções é adotada neste slice. Mantém-se o comportamento já entregue por `auth/TD-09` (o link do e-mail aponta direto para `GET /auth/confirm`), e tanto a tela de confirmação quanto a mudança de `204` para `302` ficam diferidas para fase posterior. Registrado em `## Non-UI / Deferred Capabilities` do `context.md`. Nenhuma Revision é aberta em `auth/TD-09`.
**Libraries:** —
**Revisions:**
- 2026-08-18 — Recommendation reescrita para refletir o adiamento; o texto original, que recomendava a Option A e mandava abrir uma Revision em `auth/TD-06` para a mudança de `204` para `302`, fica preservado aqui: _"Option A — entrega a tela que a capability pede sem desfazer a razão da revisão anterior (o token continua sendo assunto exclusivo do backend) e reaproveita a `APP_BASE_URL` já configurada. Ao decidir esta TD, registrar a Revision correspondente em `auth/TD-06` descrevendo a mudança de `204` para `302`."_ Rationale: Recommendation realinhada à decisão de adiamento — o `## Decisions Detail` do `context.md` carrega apenas a Recommendation, e é dela que o `/plan-build` extrai a prosa das ações técnicas, de modo que a divergência entre recomendar a Option A e ter decidido Adiada faria o build redigir SIs para entregar uma tela diferida (IC-5).

---

## TD-08: Provisionamento do stack E2E e semeadura de sessão autenticada

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** O `next-frontend/CLAUDE.md` já fixa as regras de E2E — Playwright, sufixo `*.e2e-spec.ts`, pasta `tests/`, rodando sobre o build de produção — mas registra explicitamente que `playwright.config.ts`, `tests/auth.setup.ts` e o script `test:e2e` **não existem** e que nenhuma task os possui. Também fixa que Server Components assíncronos são irrenderizáveis pelo Vitest, o que deixa parte destas telas sem cobertura possível fora do Playwright. A ferramenta não está em questão; o que está aberto é **contra qual stack** a suíte roda e como um teste chega ao estado autenticado. Isso decide se a cadeia cookie → refresh → 401 real das TD-03 e TD-04 é provada por alguém.

**Options:**

### Option A: Stack completo — Playwright contra `nestjs-api` + `db` + `mailpit` reais
- A suíte sobe o build de produção do Next e conversa com os serviços do Compose raiz; `tests/auth.setup.ts` faz um login real uma vez e persiste o `storageState`; os tokens de confirmação e de reset são lidos pela API HTTP do Mailpit.
- **Pros:** prova exatamente o que a lane Vitest+MSW não pode provar por construção — relay de cookie, rotação de refresh, 401 de verdade; o Mailpit já expõe API HTTP, e ler o link do e-mail é o **único** caminho para testar confirmação e recuperação de senha ponta a ponta; é o que o `CLAUDE.md` já descreve como o papel do Playwright.
- **Cons:** exige política de reset do banco entre execuções; é a lane mais lenta; uma regressão do backend faz a suíte do frontend falhar (ruído de atribuição).

### Option B: Só frontend — `nestjs-api` fakeado também no E2E
- O build do Next roda contra um stub do upstream.
- **Pros:** rápido, hermético, sem ciclo de vida de banco.
- **Cons:** duplica exatamente a garantia que a lane de BFF em Vitest já dá, agora com o custo de um navegador; e não consegue exercitar os fluxos de confirmação e reset, que dependem de um e-mail real chegar a algum lugar.

### Option C: Adiar o Playwright — cobrir o slice só com Vitest + MSW
- Nenhum bootstrap agora.
- **Pros:** custo zero neste slice.
- **Cons:** as páginas async RSC e todo o ciclo de sessão ficam sem cobertura alguma, e o próprio `CLAUDE.md` já declara o E2E como a única lane possível para elas — o débito seria assumido justamente no primeiro fluxo crítico do produto.

**Recommendation:** Option A — os fluxos de confirmação e de recuperação de senha só são verificáveis com e-mail real, e o Mailpit já está no ambiente exatamente para isso; a Option B pagaria o preço de um navegador para provar o que já está provado. O ruído de atribuição do stack completo é aceitável num monorepo onde as duas pontas versionam juntas.

**Decision:** Option A — stack completo: Playwright contra `nestjs-api` + `db` + `mailpit` reais.

**Renders in:** frontend-runtime

**Libraries:** @playwright/test

---

## TD-09: Destino do usuário após o cadastro bem-sucedido

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** O `POST /auth/register` entregue responde `201` com o `RegisterResponseDto` (`id`, `email`, `channel.nickname`) e **não emite cookies de sessão** — não há auto-login, por construção. O Figma não declara nenhum estado de sucesso para a tela de cadastro (o inventário registra apenas o `Button` "Create account" no estado enabled), então a interface fica sem desfecho definido. E o desfecho não é livre: `auth.service.ts` rejeita o login de conta não confirmada com **403 `EMAIL_NAO_CONFIRMADO`**, o que fecha o caminho mais óbvio. O backend já expõe `POST /auth/resend-confirmation` para o caso do e-mail que não chegou. Esta TD decide o que a SI da tela de cadastro precisa implementar depois do `201`. _(Depende de TD-01; adjacente à TD-07, que decide o outro extremo do mesmo fluxo.)_

**Options:**

### Option A: Permanecer em `/signup`, trocando o formulário por um estado de sucesso na própria tela
- Após o `201`, o componente cliente substitui o card do formulário por um painel "confirme seu e-mail" com o endereço cadastrado, a CTA de reenvio (`/api/auth/resend-confirmation`) e um link para `/login`.
- **Pros:** nenhuma rota nova e nenhuma tela nova — o delta de design é **um estado** da tela já inventariada, não um artefato inexistente; mantém o reenvio de confirmação ao alcance exatamente no momento em que ele é útil, aproveitando um endpoint já entregue; não empurra o usuário para uma tela cuja ação principal responderia 403.
- **Cons:** o estado não existe no Figma e exige um extension run no inventário; é estado de cliente — um reload volta ao formulário vazio, sem registro de que o cadastro ocorreu; a URL não é compartilhável nem linkável a partir do e-mail.

### Option B: Redirecionar para `/login` com um aviso carregado na query (`?registered=1`)
- A tela de login renderiza um alerta "cadastro concluído, confirme seu e-mail" acima do formulário.
- **Pros:** rota já existente e já inventariada; sobrevive a reload, porque o estado está na URL; nenhum ativo de design novo além de um alerta.
- **Cons:** deposita o usuário exatamente na tela cuja única ação disponível **falha** com 403 `EMAIL_NAO_CONFIRMADO` até a confirmação — é um caminho fechado apresentado como próximo passo; e a tela de login não tem onde acomodar o reenvio de confirmação sem virar outra coisa.

### Option C: Rota dedicada `/check-email` (Server Component síncrono)
- O cadastro redireciona para uma página própria de instrução, que também serve ao fluxo de "reenviar confirmação".
- **Pros:** sobrevive a reload, é linkável e é o lugar natural para o reenvio; reaproveitável por qualquer outro ponto que precise pedir a confirmação.
- **Cons:** cria uma **segunda** tela sem design no Figma num slice que já carrega a lacuna de `/reset-password` (IC-2); amplia o escopo de implementação e de inventário por um ganho que a Option A entrega quase inteiro.

**Recommendation:** Option A — o 403 do backend torna a Option B um beco sem saída disfarçado de próximo passo, e a Option C abre uma segunda lacuna de design no slice que já tem uma. Permanecer na tela é o menor delta: um estado a acrescentar numa tela que já existe no Figma, com o reenvio de confirmação ao alcance. Ao decidir esta TD, registrar que o inventário `screen-inventory-phase-02-auth-frontend` precisa de um extension run para o estado de sucesso do cadastro — o mesmo extension run que a TD-07 já demanda, se ela for pela Option A.

**Decision:** Option A — permanecer em `/signup`, trocando o formulário por um estado de sucesso na própria tela, com o reenvio de confirmação ao alcance.

---

## TD-10: Ciclo de vida do estado do banco entre execuções da suíte E2E

**Scope:** Frontend

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** A TD-08 coloca o Playwright contra `nestjs-api` + `db` + `mailpit` reais e lista, como contra, "exige política de reset do banco entre execuções" — sem decidi-la. Nenhuma fase anterior a entrega: a Fase 01 produziu migrations e um `seed.ts` cujo array de seeders está **vazio**, para o ciclo de desenvolvimento, não para isolamento entre suítes. A `testing-guide-next-frontend` também não prescreve padrão algum — ela descreve o papel do Playwright e para por aí. O efeito prático é concreto: a segunda execução da suíte falha no cadastro com `409 EMAIL_JA_EXISTE`. Agrava o problema o fato de o serviço `db` do Compose hospedar **um único** database (`streamtube`), que é o mesmo do desenvolvimento — qualquer estratégia destrutiva atinge os dados do usuário. O Mailpit tem o mesmo problema em menor escala: a caixa acumula mensagens entre execuções, e ler "o último e-mail" fica ambíguo. _(Depende de TD-08.)_

**Options:**

### Option A: Dados únicos por execução — sem reset de estado
- Cada spec deriva seus identificadores de um nonce (`user-${runId}-${n}@e2e.local`); `tests/auth.setup.ts` cadastra, confirma via Mailpit e persiste o `storageState` de um usuário criado naquela execução. A busca no Mailpit filtra por destinatário, não por recência.
- **Pros:** zero infraestrutura nova — nenhum serviço, nenhum database, nenhuma etapa destrutiva; não toca no banco de desenvolvimento, que é a única coisa realmente insubstituível no ambiente; resolve de quebra a ambiguidade da caixa do Mailpit, porque o filtro por destinatário é determinístico independente do que já esteja lá; libera `fullyParallel` sem coordenação, já que dois workers nunca disputam a mesma linha.
- **Cons:** o banco cresce indefinidamente com contas de teste (aceitável em desenvolvimento, mas é sujeira acumulada); não permite exercitar cenários que dependam de estado pré-existente que o teste não possa criar por conta própria; um teste que precise afirmar contagens globais ("nenhum usuário existe") torna-se impossível.

### Option B: Truncamento por `setup` project do Playwright contra o banco de desenvolvimento
- Um projeto `setup` (padrão documentado de `dependencies` + `teardown` no `playwright.config.ts`) executa `TRUNCATE ... RESTART IDENTITY CASCADE` nas tabelas de auth antes da suíte, e o `seed` repovoa fixtures.
- **Pros:** estado inicial conhecido e idêntico a cada execução, que é a definição de determinismo em teste; permite fixtures declarativas via o `seed.ts` já existente; é o mecanismo que o Playwright documenta para exatamente este fim.
- **Cons:** apaga o banco de desenvolvimento do usuário — o serviço `db` tem um database só, então "resetar para o E2E" e "perder o trabalho local" são o mesmo evento; e um truncamento global serializa a suíte, porque workers paralelos passam a compartilhar um estado que qualquer um deles pode zerar no meio do outro.

### Option C: Database dedicado ao E2E, com perfil `e2e` no Compose
- Um `streamtube_e2e` no mesmo serviço `db`, mais uma instância `nestjs-api-e2e` apontada para ele; o `setup` project roda `migration:run` + truncate, e o `teardown` limpa ao final.
- **Pros:** combina o determinismo da Option B com a preservação do banco de desenvolvimento; é o desenho que escala para CI, onde o isolamento deixa de ser conforto e vira requisito.
- **Cons:** duplica um serviço no Compose e um conjunto de variáveis de ambiente, ampliando a superfície que a `next-frontend-env-config` precisa manter coerente; a suíte passa a depender de subir e migrar uma segunda API antes do primeiro teste; é a resposta certa para um problema — execução concorrente em CI — que este repositório ainda não tem, já que não há pipeline.

**Recommendation:** Option A — os quatro fluxos deste slice são todos de **criação** (cadastrar, autenticar o usuário recém-criado, confirmar, redefinir senha): nenhum depende de estado que o próprio teste não possa produzir, então o determinismo que a Option B compra não é usado, e ela o cobra destruindo o banco de desenvolvimento. A Option C é o destino correto, mas o gatilho dela é a existência de um pipeline de CI, que a decisão de CI/CD ainda pendente vai definir — até lá é infraestrutura paga adiantado. Ao decidir por A, registrar o gatilho explícito: **quando houver CI, ou quando surgir um teste que dependa de estado pré-existente, reavaliar em favor da Option C.**

**Decision:** Option A — dados únicos por execução, sem reset de estado. Gatilho de reavaliação registrado: **quando houver pipeline de CI, ou quando surgir um teste que dependa de estado pré-existente, migrar para a Option C** (database dedicado com perfil `e2e` no Compose).

**Renders in:** frontend-runtime

---

## TD-11: Formato do corpo de erro que os route handlers do BFF devolvem ao browser

**Scope:** Cross-layer

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** A TD-01 fixa route handlers do BFF em `app/api/auth/**/route.ts` e a TD-02 fixa `openapi-fetch` como cliente do `nestjs-api`, mas nenhuma das duas diz o que o handler devolve quando o upstream falha — e este slice é a primeira vez que o `next-frontend` expõe superfície HTTP própria, então não há convenção anterior a herdar. A lacuna tem consumidor declarado: o inventário lista o verbo "Exibir erros de cadastro retornados pelo servidor (ex.: e-mail já em uso)" em `/signup`, que só é implementável contra uma forma conhecida. O backend já resolveu o seu lado e não é reaberto aqui: o `HttpExceptionFilter` global emite um envelope único `{ statusCode, error, message }` (`ErrorResponseDto`), onde `error` carrega o **código de domínio** legível por máquina (`EMAIL_JA_EXISTE` 409, `CREDENCIAIS_INVALIDAS` 401, `EMAIL_NAO_CONFIRMADO` 403, `TOKEN_INVALIDO` 400, entre outros), e a spec declara esse mesmo schema em **todos** os status de erro de `/auth/register` e `/auth/login`. Duas assimetrias moldam as opções. Primeira: o `400` do `ValidationPipe` foge do padrão — ali `error` é a prosa `'Bad Request'` e `message` é a concatenação por `'; '` de todas as constraints do `class-validator`, **sem nome de campo**, de modo que nenhum mapeamento por campo é derivável desse corpo sem parsear string. Segunda: `contracts.ts` já deriva `LoginBffErrorStatus` (por `Exclude` do status de sucesso) e `LoginBffErrorResponse` a partir da spec, então a fronteira BFF↔componente **já tem tipo de erro contract-driven** — o que falta é a política de comportamento, não a tipagem. Do lado do consumo, a TD-06 traz React Hook Form, cujo `setError` oferece nativamente os dois destinos que importam: o campo (`setError("email", …)`) e o formulário (`setError("root.serverError", …)`). _(Depende de TD-01, TD-02 e TD-06.)_

**Options:**

### Option A: Repasse transparente do envelope upstream, com o mapeamento no cliente
- O route handler devolve status e corpo do `nestjs-api` verbatim — `{ statusCode, error, message }` — e o componente consulta uma tabela local que traduz o código de domínio para o destino do RHF (`EMAIL_JA_EXISTE` → campo `email`; `CREDENCIAIS_INVALIDAS` → `root.serverError`). O `400` de validação vai para `root.serverError`, sem tentativa de mapear por campo.
- **Pros:** não abre segunda fonte de verdade — o tipo do corpo de erro já é derivado da spec em `contracts.ts`, então um status de erro novo no backend aparece na derivação sozinho; o BFF fica fino e sem lógica própria a testar; `error` já é código estável de máquina, que é exatamente a chave que um mapeamento por campo precisa; os fixtures do MSW por status (`msw-base/TD-03`) cobrem cada ramo sem infraestrutura nova.
- **Cons:** promove o vocabulário de domínio do backend a contrato de UI, e como `error` é `string` na spec (não um enum), renomear um código no backend não quebra o `tsc` do frontend — quebra a tela em runtime; a tabela de mapeamento é convenção repetida por formulário, sem enforcement estrutural.

### Option B: Envelope próprio do BFF, normalizado por campo
- O route handler traduz o erro upstream para uma forma desenhada para o consumo da tela, do tipo `{ code, fieldErrors?: Record<string, string>, formError?: string }`, fazendo no servidor tanto o mapeamento código→campo quanto a expansão do `message` concatenado do `400`. O componente só itera `fieldErrors` chamando `setError`.
- **Pros:** o componente fica burro e uniforme entre as três telas; o vocabulário do backend não vaza para o browser, então renomear um código de domínio é mudança contida no BFF; o tratamento do `400` acontece num lugar só, em vez de repetido por formulário.
- **Cons:** o tipo desse envelope não existe na spec e teria de ser **escrito à mão**, que é precisamente a segunda fonte de verdade que `next-frontend-api-typing/TD-02` e `openapi-spec/TD-05` foram escolhidas para eliminar; empurra uma decisão de UI (qual campo recebe qual erro) para longe da tela que a exibe; e o mapeamento no servidor não elimina o acoplamento aos códigos — apenas o move de camada.

### Option C: Repasse do envelope, com expansão do `400` de validação no BFF
- Híbrido: erros de domínio são repassados verbatim como na Option A, mas o `400` do `ValidationPipe` é interceptado no route handler, que quebra o `message` em `'; '` e infere o campo a partir do prefixo de cada constraint (`"email must be a valid email"` → `email`), devolvendo `fieldErrors` só nesse caso.
- **Pros:** ataca diretamente o único status em que o backend não entrega estrutura, preservando o resto da cadeia contract-driven; entrega erro por campo também na validação, que é onde a UX por campo mais aparece.
- **Cons:** o parse depende do **texto** das mensagens do `class-validator`, que não é contrato de coisa alguma e muda quando alguém ajusta uma mensagem ou traduz o backend; a mesma rota passa a responder com duas formas distintas conforme o status, que é a pior propriedade possível para tipar e para testar; e resolve um caso que, na prática, o schema Zod do cliente já impede de chegar ao servidor.

**Recommendation:** Option A — a fronteira de erro já é contract-driven sem que ninguém escreva nada: `contracts.ts` deriva `LoginBffErrorResponse` da spec por `Exclude`, então repassar verbatim é a única opção cujo tipo **já existe e já se atualiza sozinho** quando o backend muda. A Option B abriria à mão exatamente a segunda fonte de verdade que `next-frontend-api-typing/TD-02` fechou, e pagaria isso por um desacoplamento que é aparente: o mapeamento código→campo continua existindo, só muda de arquivo. A Option C é a mais tentadora e a mais frágil — ela ancora comportamento de produção no texto de mensagens do `class-validator`, e resolve um caso raro por construção, já que o schema Zod do cliente (TD-06) valida os mesmos campos antes do submit; um `400` de validação chegando à tela em produção significa divergência entre o schema do cliente e os DTOs do backend, ou seja, um bug a corrigir, não um erro de usuário a renderizar por campo — tratá-lo como `root.serverError` é a leitura honesta. Ao decidir por A, registrar duas consequências: **(i)** os códigos de domínio do backend passam a ser contrato de UI, e a proteção natural é declará-los como `enum` no `ErrorResponseDto` para que a renomeação quebre o `tsc` do frontend em vez da tela — um ajuste pequeno no `nestjs-project`, que é o que torna esta TD `Cross-layer` e não `Frontend`; **(ii)** a tabela código→destino do RHF mora no cliente e deve ficar num módulo único, não replicada por formulário.

**Decision:** Option A — repasse transparente do envelope upstream (`{ statusCode, error, message }`) com status verbatim; o mapeamento código de domínio → destino do React Hook Form mora no cliente, num módulo único e não replicado por formulário, e o `400` do `ValidationPipe` vai para `root.serverError` em vez de ser mapeado por campo. Consequência registrada: os códigos de domínio do backend passam a ser contrato de UI, e a proteção correspondente é promovê-los a `enum` no `ErrorResponseDto` do `nestjs-project` para que uma renomeação quebre o `tsc` do frontend em vez da tela.
**Libraries:** —

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Frontend | Mecanismo de submissão dos formulários de auth | A — route handlers do BFF + `fetch` relativo | _[pending]_ |
| TD-02 | Frontend | Cliente HTTP do BFF para o `nestjs-api` | A — adotar `openapi-fetch` | _[pending]_ |
| TD-03 | Cross-layer | Propagação dos cookies de sessão até o browser | B — BFF reemite com atributos próprios | _[pending]_ |
| TD-04 | Frontend | Renovação do access token | A — sob demanda no BFF, retry no 401 | _[pending]_ |
| TD-05 | Frontend | Fronteira de guarda de sessão | A — `proxy.ts` com verificação otimista | _[pending]_ |
| TD-06 | Frontend | Formulários e origem do schema de validação | A — React Hook Form + Zod amarrado ao contrato | _[pending]_ |
| TD-07 | Cross-layer | Destino do link de confirmação e a tela correspondente | A — API redireciona para `/confirm-account?status=…` | _[pending]_ |
| TD-08 | Frontend | Provisionamento do stack E2E | A — Playwright contra o stack completo + Mailpit | _[pending]_ |
| TD-09 | Frontend | Destino do usuário após o cadastro bem-sucedido | A — estado de sucesso na própria `/signup`, com reenvio | _[pending]_ |
| TD-10 | Frontend | Ciclo de vida do banco entre execuções do E2E | A — dados únicos por execução, sem reset | _[pending]_ |
| TD-11 | Cross-layer | Formato do corpo de erro dos route handlers do BFF | A — repasse verbatim do envelope, mapeamento no cliente | A |
