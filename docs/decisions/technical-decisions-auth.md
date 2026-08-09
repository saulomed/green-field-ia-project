---
scope_type: phase
related_phases: [2]
status: decided
date: 2026-06-04
scope_description: "Autenticação e gerenciamento de conta: cadastro, confirmação por e-mail, login/sessão, logout e recuperação de senha"
---

# Technical Decisions — Cadastro, Login e Gerenciamento de Conta

_Subprojects in scope:_

- `nestjs-project/` — toda a API de autenticação (TD-01 a TD-08, TD-10 a TD-19)
- `next-frontend/` — sem TD de implementação: a TD-09 decidiu backend-only e adiou as telas; o que fica fixado aqui são os contratos que o frontend futuro deve honrar (TD-03 transporte do token, TD-06/TD-09 rotas de página nos links de e-mail)

## Contexto da fase

Esta fase entrega o fluxo completo de **cadastro → confirmação por e-mail → login → logout → recuperação de senha**, além da criação automática do canal a partir do prefixo do e-mail.

**Restrições já fixadas (não reabrir):**

- Stack do backend: **NestJS 11 + TypeScript + Express** (`nestjs-project/`).
- Banco: **PostgreSQL** (ORM: TypeORM, conforme padrão do projeto).
- Envio de e-mail é feito **via SMTP** (definido no diagrama de arquitetura — a API se comunica com o Email Service por SMTP).
- Tudo roda em **Docker Compose**; conexões usam o nome do serviço como host, nunca `localhost`.
- Nenhuma biblioteca de auth está instalada ainda — todas as opções abaixo são compatíveis com a stack atual.

As decisões TD-03 e TD-04 dependem de TD-01. TD-06 é independente da estratégia de sessão.

**Histórico do documento:** as TD-09 a TD-17 foram adicionadas em 2026-06-27, formalizando as decisões resolvidas durante o planejamento da fase; as três pendências antes listadas em "Fora do escopo desta pesquisa" (colisão de nickname, política de senha, expiração dos tokens) foram resolvidas em TD-10 a TD-12, e os valores de rate limit em TD-13. As TD-18 e TD-19 vieram do ajuste de fronteiras de domínio feito após a entrega (SI-02.17 a SI-02.19), onde estavam registradas inline como `DT-A`/`DT-B`.

---

## TD-01: Estratégia de autenticação (stateless vs stateful)

**Scope:** Backend

**Capability:** Login e controle de sessão do usuário

**Context:** A fase precisa de "login e controle de sessão" e "logout". A forma como a sessão é representada define todo o resto do desenho de auth.

**Options:**

### Option A: JWT stateless (access token assinado)
- O servidor emite um JWT assinado no login; cada request carrega o token e é validado pela assinatura, sem consultar o banco.
- **Pros:** sem estado no servidor; escala horizontalmente sem dependência compartilhada; suportado nativamente pelo NestJS (`@nestjs/jwt`).
- **Cons:** logout/revogação não são triviais (token válido até expirar); exige desenho de refresh para sessões longas (ver TD-04).

### Option B: Sessão stateful no servidor (session id + store)
- O login cria uma sessão persistida (PostgreSQL ou Redis); o cliente guarda apenas um session id em cookie.
- **Pros:** logout e revogação imediatos (basta apagar a sessão); modelo mental simples.
- **Cons:** exige um store de sessão; o diagrama de arquitetura **não** prevê Redis para auth, e a fila/cache ainda é "TBD"; acopla a API a estado compartilhado.

**Recommendation:** Option A (JWT stateless) — o PostgreSQL já está na stack e viabiliza revogação/refresh via tabela (TD-04) sem introduzir Redis, que não está previsto na arquitetura desta fase. Alinha com o suporte de primeira classe do NestJS.

**Decision:** Option A — JWT stateless.

**Libraries:** @nestjs/jwt

---

## TD-02: Biblioteca / abordagem de implementação

**Scope:** Backend

**Capability:** Login e controle de sessão do usuário

**Context:** Decidida a estratégia (TD-01), é preciso escolher como implementar guards, validação de credenciais e emissão de token.

**Options:**

### Option A: Passport.js (`@nestjs/passport` + `passport-jwt` + `passport-local` + `@nestjs/jwt`)
- Abordagem oficial documentada pelo NestJS: `LocalStrategy` valida login, `JwtStrategy` protege rotas via `AuthGuard`.
- **Pros:** caminho recomendado e mais documentado para Nest 11; estratégias reutilizáveis; fácil estender (OAuth no futuro).
- **Cons:** mais peças (estratégias + guards); pequena curva de entendimento do ciclo do Passport.

### Option B: JWT manual (somente `@nestjs/jwt`, sem Passport)
- Guard customizado lê o header, valida o token com `JwtService` e injeta o usuário; login valida credenciais no service.
- **Pros:** menos dependências; controle total e explícito do fluxo; também documentado pelo NestJS ("authentication" sem Passport).
- **Cons:** reimplementa o que o Passport já entrega; integração futura com provedores externos (OAuth) exige mais trabalho.

### Option C: Solução pronta de auth (ex.: better-auth / Lucia)
- Framework de auth completo que abstrai sessão, tokens e fluxos.
- **Pros:** muitos fluxos prontos.
- **Cons:** menos idiomático em NestJS; acopla a fase a um framework externo; sobra funcionalidade para o escopo atual.

**Recommendation:** Option A (Passport) — é o padrão oficial do NestJS 11, cobre `local` + `jwt` com guards declarativos e deixa a porta aberta para OAuth sem retrabalho. A Option B é defensável se o objetivo for minimizar dependências.

**Decision:** Option A — Passport (`@nestjs/passport` + `@nestjs/jwt`).

**Libraries:** @nestjs/passport, passport-jwt, passport-local, @nestjs/jwt

---

## TD-03: Armazenamento do token no cliente

**Scope:** Cross-layer

**Capability:** Login e controle de sessão do usuário

**Context:** Definido o JWT, é preciso decidir onde o frontend (Next.js) guarda o token, o que afeta segurança (XSS/CSRF) e o desenho dos endpoints. É um contrato entre os dois subprojetos: a API decide como emite o token e o frontend precisa consumi-lo da mesma forma. _(Depende de TD-01.)_

**Options:**

### Option A: Cookie `httpOnly` + `Secure` + `SameSite`
- A API envia o token em cookie `httpOnly`; o browser o reenvia automaticamente.
- **Pros:** inacessível a JavaScript (mitiga roubo por XSS); enviado automaticamente; bom encaixe com SSR do Next.js.
- **Cons:** exige proteção CSRF (`SameSite=Lax/Strict` + token anti-CSRF quando necessário); configuração de CORS/cookies entre origens.

### Option B: Token no corpo da resposta (cliente guarda em memória/localStorage)
- A API retorna `access_token` no JSON; o frontend o anexa no header `Authorization: Bearer`.
- **Pros:** simples; sem CSRF; modelo padrão dos exemplos do NestJS.
- **Cons:** vulnerável a XSS se persistido em `localStorage`; o frontend precisa gerenciar o ciclo de vida do token.

**Recommendation:** Option A (cookie `httpOnly`) para o **refresh token** e, idealmente, também para o access token — reduz a superfície de XSS, que é relevante numa plataforma com conteúdo gerado por usuário (comentários). Acompanha proteção CSRF via `SameSite`.

**Decision:** Option A — cookie `httpOnly` + `Secure` + `SameSite`.

**Libraries:** cookie-parser

---

## TD-04: Controle de sessão, refresh e logout

**Scope:** Backend

**Capability:** Transversal — covers: Login e controle de sessão do usuário; Logout

**Context:** Com JWT, o access token deve ser curto por segurança, mas a sessão do usuário precisa durar. Isso define como funcionam "controle de sessão" e "logout". _(Depende de TD-01 — faz sentido apenas se JWT stateless.)_

**Options:**

### Option A: Access token curto + refresh token com rotação (persistido no PostgreSQL)
- Access token curto (ex.: 15 min); refresh token de vida longa armazenado **hasheado** no banco; a cada uso o refresh é rotacionado e o anterior invalidado (RFC 9700).
- **Pros:** logout real (apaga o refresh do banco); detecção de reuso de token roubado; usa o PostgreSQL já existente, sem Redis.
- **Cons:** exige tabela de refresh tokens e lógica de rotação; mais endpoints (`/refresh`, `/logout`).

### Option B: Access token curto + blacklist de tokens revogados
- Tokens válidos até expirar, exceto os adicionados a uma lista de revogação consultada a cada request.
- **Pros:** logout imediato sem rotação.
- **Cons:** reintroduz estado consultado em todo request (perde a vantagem do stateless); a lista cresce e precisa de limpeza.

### Option C: Apenas access token, sem refresh
- Um único token com expiração média (ex.: 1–2 h); logout é só descartar o token no cliente.
- **Pros:** o mais simples; nenhuma tabela extra.
- **Cons:** logout não revoga de fato; trade-off ruim entre segurança (token curto) e UX (relogar com frequência).

**Recommendation:** Option A (refresh com rotação no PostgreSQL) — entrega logout real e revogação sem adicionar Redis, aproveitando o banco já previsto; é o padrão recomendado pela RFC 9700 para refresh tokens.

**Decision:** Option A — access token curto + refresh token com rotação; o refresh é um JWT assinado, rastreado no PostgreSQL pelo seu `jti`.

**Libraries:** @nestjs/jwt, typeorm

**Revisions:**
- 2026-06-27 — Refresh token passa de string opaca a JWT assinado, mantendo o rastreio no PostgreSQL pelo `jti` (família, rotação e detecção de reuso preservadas, RFC 9700). Rationale: a persistência continua obrigatória; muda apenas o formato do valor (opaco → JWT) e o que se persiste (o `jti`, não o hash do valor).

---

## TD-05: Algoritmo de hashing de senha

**Scope:** Backend

**Capability:** Cadastro de usuário com e-mail e senha

**Context:** O cadastro armazena senha. A escolha do algoritmo de hashing é uma decisão de segurança fixa para todo o sistema.

**Options:**

### Option A: bcrypt (`bcrypt` ou `bcryptjs`)
- Hashing adaptativo com fator de custo configurável; padrão de mercado há anos.
- **Pros:** maduro, amplamente auditado; exemplos do NestJS usam bcrypt; simples de configurar.
- **Cons:** limite de 72 bytes na senha; não é memory-hard (mais exposto a ataque com GPU que argon2).

### Option B: argon2id (`argon2` / node-argon2)
- Vencedor da Password Hashing Competition; memory-hard, com custo de memória, tempo e paralelismo ajustáveis.
- **Pros:** recomendação atual do OWASP para novas aplicações; resistente a GPU/ASIC; sem limite prático de tamanho.
- **Cons:** binding nativo (compilação no container — atenção no Dockerfile); menos onipresente que bcrypt nos exemplos.

**Recommendation:** Option B (argon2id) — é a recomendação atual do OWASP para senhas em aplicações novas e o projeto é greenfield; o único cuidado é garantir a compilação do binding nativo na imagem Docker. bcrypt permanece uma escolha segura e mais simples se quiser evitar dependência nativa.

**Decision:** Option B — argon2id.

**Libraries:** argon2

---

## TD-06: Tokens de confirmação de conta e de redefinição de senha

**Scope:** Cross-layer

**Capability:** Transversal — covers: Confirmação de conta via e-mail com link de ativação; Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Context:** Confirmação de conta e recuperação de senha enviam um link com token por e-mail. A natureza desse token é independente da sessão de login (TD-01/TD-04). É cross-layer porque o link embutido no e-mail define qual rota (API ou página do frontend) recebe o token e em que verbo.

**Options:**

### Option A: Token opaco aleatório, hasheado e persistido no banco
- Gera bytes aleatórios (ex.: 32 bytes), envia o valor no link e guarda apenas o **hash** + expiração + usuário no PostgreSQL; valida por lookup e invalida após uso (uso único).
- **Pros:** revogável e de uso único por natureza; não vaza dados no link; expiração e consumo controlados no banco.
- **Cons:** exige tabela(s) de tokens e limpeza de expirados.

### Option B: JWT assinado com propósito (`purpose: confirm | reset`)
- Token autocontido com claim de propósito e expiração curta; validado pela assinatura, sem persistência.
- **Pros:** sem tabela; expiração embutida.
- **Cons:** não é uso único sem estado adicional (um reset usado continua válido até expirar); revogar exige blacklist; reaproveita segredo de assinatura para fluxo sensível.

**Recommendation:** Option A (token opaco hasheado no banco) — confirmação e reset exigem **uso único e revogação** (após redefinir a senha, links pendentes devem morrer), o que o JWT stateless não garante sozinho. O PostgreSQL já está disponível para isso.

**Decision:** Option A — token opaco hasheado no banco para o reset de senha; a confirmação de conta usa JWT assinado stateless (claim `purpose: confirm`, sem tabela).

**Libraries:** @nestjs/jwt

**Revisions:**
- 2026-06-27 — Decisão dividida por fluxo: confirmação de conta migra para JWT assinado stateless (sem tabela); o reset de senha mantém a Option A original. Rationale: o reuso da confirmação já é neutralizado pela flag `is_confirmed` (replay → `EMAIL_JA_CONFIRMADO`), enquanto o reset exige uso único e revogação reais (links pendentes devem morrer após a redefinição). Consequência aceita: ao reenviar a confirmação, JWTs anteriores seguem válidos até expirar — risco baixo, pois todos confirmam a mesma conta.

---

## TD-07: Serviço de envio de e-mails transacionais

**Scope:** Backend

**Capability:** Serviço de envio de e-mails transacionais

**Context:** A fase exige "serviço de envio de e-mails transacionais" para confirmação e recuperação. A arquitetura fixa o transporte em **SMTP**; resta decidir a biblioteca e o ambiente de desenvolvimento.

**Options:**

### Option A: `@nestjs-modules/mailer` (Nodemailer) via SMTP + Mailpit/MailHog no dev
- Módulo NestJS sobre Nodemailer, com suporte a templates (Handlebars/Pug/EJS); em produção aponta para um SMTP real; no dev, um container Mailpit/MailHog captura os e-mails.
- **Pros:** integração idiomática com NestJS (injeção de `MailerService`); templates prontos; respeita o SMTP do diagrama; dev sem custo nem envio real.
- **Cons:** uma dependência a mais; SMTP de produção precisa ser provisionado depois.

### Option B: Nodemailer "puro" encapsulado num serviço próprio
- Usar `nodemailer` diretamente dentro de um `MailService` customizado, sem o módulo wrapper.
- **Pros:** menos dependências; controle total do transporte e dos templates.
- **Cons:** reimplementa configuração, DI e templating que o módulo já oferece.

### Option C: Provedor transacional via API HTTP (Resend / SendGrid)
- Envio por API HTTP do provedor em vez de SMTP direto.
- **Pros:** entregabilidade e métricas gerenciadas; menos infra de e-mail.
- **Cons:** **conflita com a arquitetura atual** (que define SMTP) — a maioria também oferece SMTP, mas a API HTTP foge do desenho; acopla a um SaaS nesta fase.

**Recommendation:** Option A (`@nestjs-modules/mailer` + Mailpit no dev) — respeita o transporte SMTP já definido na arquitetura, é idiomático no NestJS e permite desenvolver/testar todo o fluxo de e-mail localmente sem enviar mensagens reais.

**Decision:** Option A — `@nestjs-modules/mailer` sobre SMTP, com Mailpit no ambiente de desenvolvimento.

**Libraries:** @nestjs-modules/mailer, nodemailer, handlebars

---

## TD-08: Proteção contra força bruta nos endpoints de auth

**Scope:** Backend

**Capability:** Transversal — covers: Login e controle de sessão do usuário; Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Context:** Login, solicitação de reset e reenvio de confirmação são alvos clássicos de brute-force e abuso. Definir a proteção agora evita retrabalho.

**Options:**

### Option A: Rate limiting com `@nestjs/throttler`
- Guard de rate limit global, com limites mais estritos via `@Throttle()` nos endpoints sensíveis (login, reset, reenvio).
- **Pros:** pacote oficial do NestJS; declarativo por rota; cobre brute-force e abuso de envio de e-mail.
- **Cons:** armazenamento padrão em memória não é compartilhado entre instâncias (suficiente para esta fase; storage externo pode vir depois).

### Option B: Sem rate limiting nesta fase
- Adiar a proteção para uma fase posterior de hardening.
- **Pros:** menos uma peça agora.
- **Cons:** deixa endpoints de credenciais e de e-mail expostos a abuso desde o primeiro deploy; é barato fazer junto com o auth.

**Recommendation:** Option A (`@nestjs/throttler`) — é barato adicionar junto com os endpoints de auth e protege diretamente os fluxos sensíveis desta fase. O limite em memória é aceitável agora; trocar por store compartilhado é um ajuste futuro.

**Decision:** Option A — rate limiting com `@nestjs/throttler`.

**Libraries:** @nestjs/throttler

---

## TD-09: Escopo de frontend da fase

**Scope:** Cross-layer

**Capability:** Telas de cadastro, login, confirmação de conta e recuperação de senha

**Context:** O `project-plan.md` lista "Telas de cadastro, login, confirmação e recuperação" como capacidade da Fase 02, mas a Fase 01 adiou explicitamente o Next.js e o `next-frontend/` ainda não existe. As decisões TD-01 a TD-08 são todas de backend. A decisão é cross-layer porque fixa quais rotas de página o frontend futuro precisa expor para os links de e-mail funcionarem.

**Options:**

### Option A: Backend-only (telas adiadas)
- Esta fase entrega apenas a API de autenticação no `nestjs-project/`; as telas vão para uma fase futura de frontend, quando o Next.js for inicializado.
- **Pros:** escopo coeso; alinha com o adiamento do Next.js feito na Fase 01; não mistura fundação de frontend com auth de backend.
- **Cons:** o fluxo só fica "visível ao usuário final" numa fase posterior.

### Option B: Incluir Next.js + telas nesta fase
- Inicializar o `next-frontend/` e implementar as 4 telas além da API.
- **Pros:** entrega o fluxo ponta a ponta numa única fase.
- **Cons:** dobra o escopo (dois subprojetos); mistura inicialização de frontend com auth.

**Recommendation:** Option A (backend-only) — mantém o escopo coeso e respeita o adiamento do Next.js da Fase 01.

**Decision:** Option A — backend-only; telas adiadas. O link de reset nos e-mails aponta para a rota de página do frontend futuro via `APP_BASE_URL`; a confirmação aponta direto para a API.

**Revisions:**
- 2026-07-17 — Links de e-mail passam a apontar para paths de página dedicados (`/confirm-account`, `/reset-password`), distintos dos paths da API. Rationale: a implementação inicial apontava para `/auth/confirm` e `/auth/reset-password`, que só aceitam POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca alcançaria a rota. A página lê o `token` da query string e então chama o POST real da API.
- 2026-07-18 — Confirmação de conta convertida para `GET /auth/confirm?token=…`, com o link do e-mail voltando a apontar direto para a API; o reset de senha permanece apontando para a página `/reset-password`. Rationale: a confirmação não exige nenhum dado do usuário além do token, dispensando tela intermediária; o reset exige formulário para a nova senha. Trade-off aceito: `GET` é pré-buscável por scanners/proxies de e-mail, podendo disparar a confirmação automaticamente — risco baixo dado o token assinado e expirável (24h).

---

## TD-10: Política de colisão de nickname do canal

**Scope:** Backend

**Capability:** Criação automática do canal do usuário a partir do prefixo do e-mail

**Context:** O canal nasce do prefixo do e-mail, mas prefixos colidem entre domínios (`john@gmail`, `john@hotmail` → `john`). Em todos os casos o prefixo é normalizado (minúsculas, remoção de caracteres fora de `[a-z0-9]`).

**Options:**

### Option A: Sufixo numérico incremental
- `john`, `john1`, `john2`… Determinístico e legível.
- **Pros:** previsível; handles amigáveis.
- **Cons:** permite enumeração sequencial de contas.

### Option B: Sufixo aleatório curto
- `john-a1b2` — 4 caracteres alfanuméricos aleatórios na colisão.
- **Pros:** evita enumeração sequencial; resolve a colisão sem interromper o cadastro.
- **Cons:** handles um pouco menos amigáveis.

### Option C: Bloquear e exigir escolha manual
- Cadastro solicita um nickname manual quando o prefixo já existe.
- **Pros:** usuário controla o handle.
- **Cons:** adiciona campo/fluxo extra ao cadastro.

**Recommendation:** Option A (sufixo numérico incremental) — determinística e previsível.

**Decision:** Option B — sufixo aleatório curto (ex.: `johndoe-a1b2`), evitando enumeração sequencial.

---

## TD-11: Política de senha

**Scope:** Backend

**Capability:** Cadastro de usuário com e-mail e senha

**Context:** O cadastro e a redefinição validam a senha. argon2id (TD-05) não tem o limite de 72 bytes do bcrypt; em todos os casos aplica-se um máximo de 128 caracteres para evitar DoS de hashing.

**Options:**

### Option A: Mínimo 8, sem complexidade obrigatória
- Prioriza comprimento sobre composição (OWASP moderno).
- **Pros:** menor atrito; recomendação atual do OWASP.
- **Cons:** aceita senhas comuns se longas o bastante (mitigável com checagem de breach no futuro).

### Option B: Mínimo 8 + maiúscula, minúscula e número
- Exige classes de caracteres.
- **Pros:** força composição mínima.
- **Cons:** regras de composição têm eficácia questionável e aumentam atrito.

### Option C: Mínimo 12 + maiúscula, minúscula, número e símbolo
- Política mais rígida.
- **Pros:** senhas mais fortes por padrão.
- **Cons:** maior atrito no cadastro.

**Recommendation:** Option A (mínimo 8, sem complexidade) — alinhada à recomendação atual do OWASP.

**Decision:** Option A — mínimo 8, sem complexidade obrigatória, máximo 128 caracteres.

**Libraries:** class-validator

---

## TD-12: TTLs (expirações) dos tokens

**Scope:** Backend

**Capability:** Transversal — covers: Login e controle de sessão do usuário; Confirmação de conta via e-mail com link de ativação; Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Context:** Access token (TD-01/TD-04), refresh token (TD-04) e tokens de confirmação/reset (TD-06) precisam de expirações concretas.

**Options:**

### Option A: access 15min / refresh 7d / confirm 24h / reset 1h
- Equilíbrio padrão OWASP entre segurança e UX.
- **Pros:** access curto com refresh rotacionado; janelas de e-mail usuais.
- **Cons:** —

### Option B: access 15min / refresh 30d / confirm 48h / reset 30min
- Sessão mais longa, confirmação mais folgada, reset mais curto.
- **Pros:** menos relogins.
- **Cons:** refresh de 30 dias amplia a janela de um refresh roubado.

### Option C: access 5min / refresh 24h / confirm 12h / reset 15min
- Mais conservador.
- **Pros:** menor janela de exposição.
- **Cons:** refresh frequente; janelas de e-mail curtas (risco de expirar antes do clique).

**Recommendation:** Option A (access 15min / refresh 7d / confirm 24h / reset 1h) — equilíbrio padrão.

**Decision:** Option A — access 15min, refresh 7d, confirmação 24h, reset 1h.

---

## TD-13: Valores de rate limit (`@nestjs/throttler`)

**Scope:** Backend

**Capability:** Transversal — covers: Login e controle de sessão do usuário; Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Context:** Complementa a TD-08, que escolheu o `@nestjs/throttler` mas não fixou valores. É preciso definir o limite global e os limites estritos dos endpoints sensíveis (login, solicitação de reset, reenvio de confirmação).

**Options:**

### Option A: global 100/min; login 5/min; reset 3/h; reenvio confirmação 3/h
- **Pros:** protege brute-force de credenciais e abuso de e-mail sem atrapalhar uso legítimo.
- **Cons:** —

### Option B: global 60/min; login 5/15min; reset 3/h; reenvio 3/h
- **Pros:** login mais estrito.
- **Cons:** pode bloquear retentativas legítimas (5 a cada 15 min).

### Option C: global 200/min; login 10/min; reset 5/h; reenvio 5/h
- **Pros:** menor atrito.
- **Cons:** proteção mais fraca.

**Recommendation:** Option A (global 100/min; login 5/min; reset 3/h; reenvio 3/h) — protege os fluxos sensíveis com folga para uso legítimo.

**Decision:** Option A — global 100/min; login 5/min; forgot-password 3/h; resend-confirmation 3/h.

**Libraries:** @nestjs/throttler

---

## TD-14: Escopo do logout

**Scope:** Backend

**Capability:** Logout

**Context:** O logout revoga refresh tokens. É preciso definir se encerra apenas a sessão atual ou todas as sessões do usuário. _(Depende de TD-04 — refresh com rotação por família.)_

**Options:**

### Option A: Apenas a sessão/família atual
- Revoga só a família do refresh em uso (dispositivo atual).
- **Pros:** comportamento esperado pela maioria dos usuários; não derruba outros dispositivos.
- **Cons:** não serve como "sair de todos os lugares" (pode vir como recurso futuro).

### Option B: Todas as sessões do usuário
- Revoga todos os refresh tokens (logout global).
- **Pros:** encerra tudo de uma vez.
- **Cons:** surpreende o usuário ao deslogar outros dispositivos.

**Recommendation:** Option A (apenas a sessão/família atual) — comportamento padrão esperado.

**Decision:** Option A — logout revoga apenas a família/sessão atual.

---

## TD-15: Proteção CSRF dos cookies

**Scope:** Backend

**Capability:** Login e controle de sessão do usuário

**Context:** Com tokens em cookie, é preciso mitigar CSRF. A TD-03 já previu `SameSite`; resta definir se basta o `SameSite` ou se haverá token anti-CSRF dedicado. _(Depende de TD-03.)_

**Options:**

### Option A: Apenas `SameSite=Strict`
- Cookies `httpOnly` + `Secure` + `SameSite=Strict`.
- **Pros:** suficiente para esta fase; sem peças extras.
- **Cons:** sem defesa em profundidade; revisitar se surgirem fluxos cross-site.

### Option B: `SameSite` + token anti-CSRF (double-submit)
- Adiciona um token anti-CSRF além do `SameSite`.
- **Pros:** defesa em profundidade.
- **Cons:** mais peças (cookie/endpoint de CSRF, validação).

**Recommendation:** Option A (apenas `SameSite=Strict`) — suficiente nesta fase; token anti-CSRF pode entrar num hardening futuro.

**Decision:** Option A — `SameSite=Strict` (sem token anti-CSRF dedicado nesta fase).

---

## TD-16: Tratamento de falha no envio de e-mail durante o cadastro

**Scope:** Backend

**Capability:** Cadastro de usuário com e-mail e senha

**Context:** O cadastro grava usuário + canal no PostgreSQL e então envia o e-mail de confirmação via SMTP — uma operação que cruza um limite externo sem transação distribuída. É preciso definir o comportamento quando o SMTP/Mailpit estiver indisponível após o commit do cadastro.

**Options:**

### Option A: Best-effort (conta criada mesmo se o e-mail falhar)
- O cadastro commita; a falha de e-mail é logada; o usuário fica não confirmado e pode usar o reenvio de confirmação.
- **Pros:** desacopla a disponibilidade do SMTP da criação de conta; o reenvio cobre a falha.
- **Cons:** usuário pode não receber o e-mail e precisar acionar o reenvio.

### Option B: Bloqueante (e-mail obrigatório para concluir o cadastro)
- O cadastro só é considerado concluído se o e-mail for enviado (falha desfaz/impede a criação).
- **Pros:** garante que todo cadastro gerou um e-mail.
- **Cons:** indisponibilidade do SMTP derruba o cadastro inteiro; acopla criação de conta à infraestrutura de e-mail.

**Recommendation:** Option A (best-effort) — o reenvio de confirmação (já previsto) cobre a falha sem acoplar o cadastro ao SMTP.

**Decision:** Option A — envio best-effort; cadastro concluído mesmo com falha de e-mail.

---

## TD-17: Revogação de sessões na redefinição de senha

**Scope:** Backend

**Capability:** Recuperação de senha: solicitação via e-mail → link com token → redefinição

**Context:** Ao redefinir a senha via token de reset, é preciso decidir o destino das sessões ativas (refresh tokens) do usuário. _(Depende de TD-04 e TD-06.)_

**Options:**

### Option A: Revogar todas as sessões ativas
- A redefinição revoga todos os refresh tokens do usuário.
- **Pros:** postura segura — redefinição costuma indicar comprometimento; expulsa um eventual invasor.
- **Cons:** o usuário precisa relogar em todos os dispositivos.

### Option B: Manter as sessões existentes
- Apenas troca a senha; sessões seguem ativas.
- **Pros:** menos atrito.
- **Cons:** um invasor com sessão ativa permanece logado mesmo após a senha mudar.

**Recommendation:** Option A (revogar todas) — encerrar tudo é a postura segura e alinha com o uso único dos tokens (TD-06).

**Decision:** Option A — a redefinição de senha revoga todas as sessões ativas.

---

## TD-18: Dono da persistência de `User`

**Scope:** Backend

**Capability:** Cadastro de usuário com e-mail e senha

**Context:** A revisão da implementação da Fase 02 encontrou o `UsersModule` como casca vazia: não existia `UsersService`, e toda a persistência de `User` (`exists`, `create`, `save`, `findOne`, `update`) vivia no `AuthService` via `dataSource.manager` — o domínio de usuários não tinha dono, violando o princípio de Responsabilidade Única declarado no `CLAUDE.md`. É preciso decidir quem detém o acesso à tabela `users`.

**Options:**

### Option A: `UsersService` como dono exclusivo da persistência
- Criar `UsersService` injetando `@InjectRepository(User)` e expondo as operações de domínio (`existsByEmail`, `create`, `findByEmail`, `findById`, `markConfirmed`, `updatePassword`); `AuthService` delega e o `UsersModule` deixa de exportar `TypeOrmModule`.
- **Pros:** fronteira de módulo real (o repositório fica encapsulado e o boot falha se outro módulo tentar injetá-lo); o domínio ganha dono; `AuthService` volta a ser orquestrador.
- **Cons:** uma camada de indireção a mais; exige repassar o `EntityManager` da transação de cadastro (ver TD-19).

### Option B: Manter a persistência no `AuthService`
- `AuthService` continua acessando `users` diretamente pelo `dataSource.manager`.
- **Pros:** nenhuma mudança; menos arquivos.
- **Cons:** o `UsersModule` permanece sem propósito; qualquer módulo futuro que precise de `User` replica o acesso ou depende do `AuthModule`; contraria a fronteira de domínio do projeto.

**Recommendation:** Option A (`UsersService` como dono) — a Option B só se sustenta enquanto o auth for o único consumidor de `User`, o que deixa de valer já na fase de canal/vídeos.

**Decision:** Option A — `UsersService` é o dono exclusivo da persistência de `User`; o `AuthService` delega.

**Libraries:** typeorm

---

## TD-19: Padrão de participação em transação dos serviços de domínio

**Scope:** Backend

**Capability:** Criação automática do canal do usuário a partir do prefixo do e-mail

**Context:** O cadastro cria `User` e `Channel` atomicamente numa transação aberta pelo `AuthService`. A documentação do TypeORM é explícita: dentro de uma transação é obrigatório resolver o repositório a partir do manager da transação (`manager.getRepository(...)`) — o repositório global injetado não participa dela. Isso precisa conviver com serviços que também operam fora de transação. _(Depende de TD-18.)_

**Options:**

### Option A: Padrão híbrido — `manager` opcional
- Cada método transacional recebe `manager?`: quando presente, resolve o repositório via `manager.getRepository(Entity)`; quando ausente, usa o repositório injetado. Ex.: `createForUser(user, manager?)`.
- **Pros:** o serviço é autônomo (opera sem depender do chamador) e ainda participa de transações alheias quando necessário; um único método por operação.
- **Cons:** cada método transacional carrega a resolução condicional do repositório.

### Option B: `manager` obrigatório em toda operação de escrita
- Todo método de escrita exige um `EntityManager` do chamador (situação encontrada na revisão: `ChannelService` não injetava repositório algum).
- **Pros:** um caminho único, sem condicional.
- **Cons:** o módulo não tem caminho autônomo de leitura/escrita; todo chamador é obrigado a abrir transação, mesmo para uma operação simples; `TypeOrmModule.forFeature` fica declarado sem uso.

**Recommendation:** Option A (híbrido) — preserva o contrato obrigatório do TypeORM dentro da transação sem tornar todo chamador refém de abrir uma.

**Decision:** Option A — padrão híbrido: `metodo(args, manager?)` resolve o repositório do manager quando recebido e usa o injetado quando não.

**Libraries:** typeorm

**Revisions:**
- 2026-07-17 — Decisões formalizadas a partir do ajuste de fronteiras de domínio (antes registradas inline como `DT-A`/`DT-B` em `docs/phases/phase-02-auth-refactor.md`). Rationale: mantinham um terceiro namespace de IDs fora de `docs/decisions/`, invisível para o pipeline; promovidas a TD-18/TD-19 na migração de formato.

---

## Políticas de comportamento confirmadas no planejamento

Decisões de comportamento sem alternativas relevantes (derivadas das capacidades da fase), registradas para referência da implementação:

- **Login com conta não confirmada** → bloqueado com `403 EMAIL_NAO_CONFIRMADO` (derivado de "confirmação obrigatória" no `project-plan.md`).
- **Respostas neutras** em `forgot-password` e `resend-confirmation` → sempre `204`, sem revelar a existência/estado da conta.
- **Endpoint dedicado de reenvio de confirmação** incluído (implícito na TD-08, que prevê rate limit em "reenvio de confirmação").
- **Nova solicitação invalida pendências anteriores** → emitir um novo token de confirmação/reset invalida os tokens pendentes do mesmo propósito.

---

## Fora do escopo desta pesquisa

- Nenhuma pendência em aberto. As decisões antes encaminhadas para o planejamento (colisão de nickname, política de senha, expiração de tokens) foram resolvidas em TD-10 a TD-12; os valores de rate limit, em TD-13.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Estratégia de autenticação | JWT stateless (Option A) | **Option A — JWT stateless** |
| TD-02 | Backend | Biblioteca de implementação | Passport (Option A) | **Option A — `@nestjs/passport` + `@nestjs/jwt`** |
| TD-03 | Cross-layer | Armazenamento do token no cliente | Cookie `httpOnly` (Option A) | **Option A — cookie `httpOnly`** |
| TD-04 | Backend | Sessão / refresh / logout | Refresh com rotação no PostgreSQL (Option A) | **Option A — refresh JWT rastreado pelo `jti` com rotação** |
| TD-05 | Backend | Hashing de senha | argon2id (Option B) | **Option B — argon2id** |
| TD-06 | Cross-layer | Tokens de confirmação e reset | Token opaco hasheado no banco (Option A) | **Option A — confirmação: JWT stateless · reset: token opaco hasheado** |
| TD-07 | Backend | Serviço de e-mail | `@nestjs-modules/mailer` + SMTP/Mailpit (Option A) | **Option A — `@nestjs-modules/mailer` + SMTP/Mailpit** |
| TD-08 | Backend | Proteção contra brute-force | `@nestjs/throttler` (Option A) | **Option A — `@nestjs/throttler`** |
| TD-09 | Cross-layer | Escopo de frontend da fase | Backend-only (Option A) | **Option A — backend-only (telas adiadas)** |
| TD-10 | Backend | Colisão de nickname do canal | Sufixo numérico incremental (Option A) | **Option B — sufixo aleatório curto** |
| TD-11 | Backend | Política de senha | Mín. 8, sem complexidade (Option A) | **Option A — mín. 8, sem complexidade, máx. 128** |
| TD-12 | Backend | TTLs dos tokens | access 15min / refresh 7d / confirm 24h / reset 1h (Option A) | **Option A — access 15min / refresh 7d / confirm 24h / reset 1h** |
| TD-13 | Backend | Valores de rate limit | global 100/min; login 5/min; reset 3/h; reenvio 3/h (Option A) | **Option A — global 100/min; login 5/min; forgot 3/h; resend 3/h** |
| TD-14 | Backend | Escopo do logout | Apenas a sessão/família atual (Option A) | **Option A — apenas a sessão/família atual** |
| TD-15 | Backend | Proteção CSRF | Apenas `SameSite=Strict` (Option A) | **Option A — apenas `SameSite=Strict`** |
| TD-16 | Backend | Falha de e-mail no cadastro | Best-effort (Option A) | **Option A — best-effort** |
| TD-17 | Backend | Sessões na redefinição de senha | Revogar todas (Option A) | **Option A — revogar todas as sessões ativas** |
| TD-18 | Backend | Dono da persistência de `User` | `UsersService` como dono exclusivo (Option A) | **Option A — `UsersService` dono; `AuthService` delega** |
| TD-19 | Backend | Participação em transação dos serviços | Padrão híbrido com `manager?` (Option A) | **Option A — `metodo(args, manager?)`** |
