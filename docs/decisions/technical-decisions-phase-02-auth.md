# Decisões Técnicas — Fase 02: Cadastro, Login e Gerenciamento de Conta

> **Fase:** Cadastro, Login e Gerenciamento de Conta (Auth)
> **Status:** Decidido
> **Data:** 2026-06-04

---

## Contexto da fase

Esta fase entrega o fluxo completo de **cadastro → confirmação por e-mail → login → logout → recuperação de senha**, além da criação automática do canal a partir do prefixo do e-mail.

**Restrições já fixadas (não reabrir):**

- Stack do backend: **NestJS 11 + TypeScript + Express** (`nestjs-project/`).
- Banco: **PostgreSQL** (ORM: TypeORM, conforme padrão do projeto).
- Envio de e-mail é feito **via SMTP** (definido no diagrama de arquitetura — a API se comunica com o Email Service por SMTP).
- Tudo roda em **Docker Compose**; conexões usam o nome do serviço como host, nunca `localhost`.
- Nenhuma biblioteca de auth está instalada ainda — todas as opções abaixo são compatíveis com a stack atual.

As decisões DT-03 e DT-04 dependem de DT-01. DT-06 é independente da estratégia de sessão.

---

## DT-01: Estratégia de autenticação (stateless vs stateful)

**Contexto:** A fase precisa de "login e controle de sessão" e "logout". A forma como a sessão é representada define todo o resto do desenho de auth.

**Opções:**

### Opção A: JWT stateless (access token assinado)
- O servidor emite um JWT assinado no login; cada request carrega o token e é validado pela assinatura, sem consultar o banco.
- **Prós:** sem estado no servidor; escala horizontalmente sem dependência compartilhada; suportado nativamente pelo NestJS (`@nestjs/jwt`).
- **Contras:** logout/revogação não são triviais (token válido até expirar); exige desenho de refresh para sessões longas (ver DT-04).

### Opção B: Sessão stateful no servidor (session id + store)
- O login cria uma sessão persistida (PostgreSQL ou Redis); o cliente guarda apenas um session id em cookie.
- **Prós:** logout e revogação imediatos (basta apagar a sessão); modelo mental simples.
- **Contras:** exige um store de sessão; o diagrama de arquitetura **não** prevê Redis para auth, e a fila/cache ainda é "TBD"; acopla a API a estado compartilhado.

**Recomendação:** Opção A (JWT stateless) — o PostgreSQL já está na stack e viabiliza revogação/refresh via tabela (DT-04) sem introduzir Redis, que não está previsto na arquitetura desta fase. Alinha com o suporte de primeira classe do NestJS.

**Decisão:** A jwt

---

## DT-02: Biblioteca / abordagem de implementação

**Contexto:** Decidida a estratégia (DT-01), é preciso escolher como implementar guards, validação de credenciais e emissão de token.

**Opções:**

### Opção A: Passport.js (`@nestjs/passport` + `passport-jwt` + `passport-local` + `@nestjs/jwt`)
- Abordagem oficial documentada pelo NestJS: `LocalStrategy` valida login, `JwtStrategy` protege rotas via `AuthGuard`.
- **Prós:** caminho recomendado e mais documentado para Nest 11; estratégias reutilizáveis; fácil estender (OAuth no futuro).
- **Contras:** mais peças (estratégias + guards); pequena curva de entendimento do ciclo do Passport.

### Opção B: JWT manual (somente `@nestjs/jwt`, sem Passport)
- Guard customizado lê o header, valida o token com `JwtService` e injeta o usuário; login valida credenciais no service.
- **Prós:** menos dependências; controle total e explícito do fluxo; também documentado pelo NestJS ("authentication" sem Passport).
- **Contras:** reimplementa o que o Passport já entrega; integração futura com provedores externos (OAuth) exige mais trabalho.

### Opção C: Solução pronta de auth (ex.: better-auth / Lucia)
- Framework de auth completo que abstrai sessão, tokens e fluxos.
- **Prós:** muitos fluxos prontos.
- **Contras:** menos idiomático em NestJS; acopla a fase a um framework externo; sobra funcionalidade para o escopo atual.

**Recomendação:** Opção A (Passport) — é o padrão oficial do NestJS 11, cobre `local` + `jwt` com guards declarativos e deixa a porta aberta para OAuth sem retrabalho. A Opção B é defensável se o objetivo for minimizar dependências.

**Decisão:** opção A

---

## DT-03: Armazenamento do token no cliente

> Depende de DT-01.

**Contexto:** Definido o JWT, é preciso decidir onde o frontend (Next.js) guarda o token, o que afeta segurança (XSS/CSRF) e o desenho dos endpoints.

**Opções:**

### Opção A: Cookie `httpOnly` + `Secure` + `SameSite`
- A API envia o token em cookie `httpOnly`; o browser o reenvia automaticamente.
- **Prós:** inacessível a JavaScript (mitiga roubo por XSS); enviado automaticamente; bom encaixe com SSR do Next.js.
- **Contras:** exige proteção CSRF (`SameSite=Lax/Strict` + token anti-CSRF quando necessário); configuração de CORS/cookies entre origens.

### Opção B: Token no corpo da resposta (cliente guarda em memória/localStorage)
- A API retorna `access_token` no JSON; o frontend o anexa no header `Authorization: Bearer`.
- **Prós:** simples; sem CSRF; modelo padrão dos exemplos do NestJS.
- **Contras:** vulnerável a XSS se persistido em `localStorage`; o frontend precisa gerenciar o ciclo de vida do token.

**Recomendação:** Opção A (cookie `httpOnly`) para o **refresh token** e, idealmente, também para o access token — reduz a superfície de XSS, que é relevante numa plataforma com conteúdo gerado por usuário (comentários). Acompanha proteção CSRF via `SameSite`.

**Decisão:** Opção A

---

## DT-04: Controle de sessão, refresh e logout

> Depende de DT-01 (faz sentido apenas se JWT stateless).

**Contexto:** Com JWT, o access token deve ser curto por segurança, mas a sessão do usuário precisa durar. Isso define como funcionam "controle de sessão" e "logout".

**Opções:**

### Opção A: Access token curto + refresh token com rotação (persistido no PostgreSQL)
- Access token curto (ex.: 15 min); refresh token de vida longa armazenado **hasheado** no banco; a cada uso o refresh é rotacionado e o anterior invalidado (RFC 9700).
- **Prós:** logout real (apaga o refresh do banco); detecção de reuso de token roubado; usa o PostgreSQL já existente, sem Redis.
- **Contras:** exige tabela de refresh tokens e lógica de rotação; mais endpoints (`/refresh`, `/logout`).

### Opção B: Access token curto + blacklist de tokens revogados
- Tokens válidos até expirar, exceto os adicionados a uma lista de revogação consultada a cada request.
- **Prós:** logout imediato sem rotação.
- **Contras:** reintroduz estado consultado em todo request (perde a vantagem do stateless); a lista cresce e precisa de limpeza.

### Opção C: Apenas access token, sem refresh
- Um único token com expiração média (ex.: 1–2 h); logout é só descartar o token no cliente.
- **Prós:** o mais simples; nenhuma tabela extra.
- **Contras:** logout não revoga de fato; trade-off ruim entre segurança (token curto) e UX (relogar com frequência).

**Recomendação:** Opção A (refresh com rotação no PostgreSQL) — entrega logout real e revogação sem adicionar Redis, aproveitando o banco já previsto; é o padrão recomendado pela RFC 9700 para refresh tokens.

**Decisão:** opção A

---

## DT-05: Algoritmo de hashing de senha

**Contexto:** O cadastro armazena senha. A escolha do algoritmo de hashing é uma decisão de segurança fixa para todo o sistema.

**Opções:**

### Opção A: bcrypt (`bcrypt` ou `bcryptjs`)
- Hashing adaptativo com fator de custo configurável; padrão de mercado há anos.
- **Prós:** maduro, amplamente auditado; exemplos do NestJS usam bcrypt; simples de configurar.
- **Contras:** limite de 72 bytes na senha; não é memory-hard (mais exposto a ataque com GPU que argon2).

### Opção B: argon2id (`argon2` / node-argon2)
- Vencedor da Password Hashing Competition; memory-hard, com custo de memória, tempo e paralelismo ajustáveis.
- **Prós:** recomendação atual do OWASP para novas aplicações; resistente a GPU/ASIC; sem limite prático de tamanho.
- **Contras:** binding nativo (compilação no container — atenção no Dockerfile); menos onipresente que bcrypt nos exemplos.

**Recomendação:** Opção B (argon2id) — é a recomendação atual do OWASP para senhas em aplicações novas e o projeto é greenfield; o único cuidado é garantir a compilação do binding nativo na imagem Docker. bcrypt permanece uma escolha segura e mais simples se quiser evitar dependência nativa.

**Decisão:** B argon2id

---

## DT-06: Tokens de confirmação de conta e de redefinição de senha

**Contexto:** Confirmação de conta e recuperação de senha enviam um link com token por e-mail. A natureza desse token é independente da sessão de login (DT-01/04).

**Opções:**

### Opção A: Token opaco aleatório, hasheado e persistido no banco
- Gera bytes aleatórios (ex.: 32 bytes), envia o valor no link e guarda apenas o **hash** + expiração + usuário no PostgreSQL; valida por lookup e invalida após uso (uso único).
- **Prós:** revogável e de uso único por natureza; não vaza dados no link; expiração e consumo controlados no banco.
- **Contras:** exige tabela(s) de tokens e limpeza de expirados.

### Opção B: JWT assinado com propósito (`purpose: confirm | reset`)
- Token autocontido com claim de propósito e expiração curta; validado pela assinatura, sem persistência.
- **Prós:** sem tabela; expiração embutida.
- **Contras:** não é uso único sem estado adicional (um reset usado continua válido até expirar); revogar exige blacklist; reaproveita segredo de assinatura para fluxo sensível.

**Recomendação:** Opção A (token opaco hasheado no banco) — confirmação e reset exigem **uso único e revogação** (após redefinir a senha, links pendentes devem morrer), o que o JWT stateless não garante sozinho. O PostgreSQL já está disponível para isso.

**Decisão:** opção A

---

## DT-07: Serviço de envio de e-mails transacionais

**Contexto:** A fase exige "serviço de envio de e-mails transacionais" para confirmação e recuperação. A arquitetura fixa o transporte em **SMTP**; resta decidir a biblioteca e o ambiente de desenvolvimento.

**Opções:**

### Opção A: `@nestjs-modules/mailer` (Nodemailer) via SMTP + Mailpit/MailHog no dev
- Módulo NestJS sobre Nodemailer, com suporte a templates (Handlebars/Pug/EJS); em produção aponta para um SMTP real; no dev, um container Mailpit/MailHog captura os e-mails.
- **Prós:** integração idiomática com NestJS (injeção de `MailerService`); templates prontos; respeita o SMTP do diagrama; dev sem custo nem envio real.
- **Contras:** uma dependência a mais; SMTP de produção precisa ser provisionado depois.

### Opção B: Nodemailer "puro" encapsulado num serviço próprio
- Usar `nodemailer` diretamente dentro de um `MailService` customizado, sem o módulo wrapper.
- **Prós:** menos dependências; controle total do transporte e dos templates.
- **Contras:** reimplementa configuração, DI e templating que o módulo já oferece.

### Opção C: Provedor transacional via API HTTP (Resend / SendGrid)
- Envio por API HTTP do provedor em vez de SMTP direto.
- **Prós:** entregabilidade e métricas gerenciadas; menos infra de e-mail.
- **Contras:** **conflita com a arquitetura atual** (que define SMTP) — a maioria também oferece SMTP, mas a API HTTP foge do desenho; acopla a um SaaS nesta fase.

**Recomendação:** Opção A (`@nestjs-modules/mailer` + Mailpit no dev) — respeita o transporte SMTP já definido na arquitetura, é idiomático no NestJS e permite desenvolver/testar todo o fluxo de e-mail localmente sem enviar mensagens reais.

**Decisão:** Opção A

---

## DT-08: Proteção contra força bruta nos endpoints de auth

**Contexto:** Login, solicitação de reset e reenvio de confirmação são alvos clássicos de brute-force e abuso. Definir a proteção agora evita retrabalho.

**Opções:**

### Opção A: Rate limiting com `@nestjs/throttler`
- Guard de rate limit global, com limites mais estritos via `@Throttle()` nos endpoints sensíveis (login, reset, reenvio).
- **Prós:** pacote oficial do NestJS; declarativo por rota; cobre brute-force e abuso de envio de e-mail.
- **Contras:** armazenamento padrão em memória não é compartilhado entre instâncias (suficiente para esta fase; storage externo pode vir depois).

### Opção B: Sem rate limiting nesta fase
- Adiar a proteção para uma fase posterior de hardening.
- **Prós:** menos uma peça agora.
- **Contras:** deixa endpoints de credenciais e de e-mail expostos a abuso desde o primeiro deploy; é barato fazer junto com o auth.

**Recomendação:** Opção A (`@nestjs/throttler`) — é barato adicionar junto com os endpoints de auth e protege diretamente os fluxos sensíveis desta fase. O limite em memória é aceitável agora; trocar por store compartilhado é um ajuste futuro.

**Decisão:** opção A

---

## Fora do escopo desta pesquisa (encaminhar para `plan-phase`)

- **Colisão de nickname do canal:** o canal nasce do prefixo do e-mail (`john@gmail` → `john`), mas prefixos colidem entre domínios. A regra (sufixo numérico, valor aleatório ou bloqueio com escolha manual) é uma decisão de política a definir no planejamento da fase.
- **Política de senha** (tamanho mínimo, complexidade) e **tempo de expiração** concretos de cada token — valores de implementação para a `plan-phase`.

---

## Resumo das Decisões

| ID | Decisão | Recomendação | Escolha |
|----|---------|--------------|---------|
| DT-01 | Estratégia de autenticação | JWT stateless | **JWT stateless** |
| DT-02 | Biblioteca de implementação | Passport (`@nestjs/passport` + `@nestjs/jwt`) | **Passport (`@nestjs/passport` + `@nestjs/jwt`)** |
| DT-03 | Armazenamento do token no cliente | Cookie `httpOnly` | **Cookie `httpOnly`** |
| DT-04 | Sessão / refresh / logout | Refresh com rotação no PostgreSQL | **Refresh com rotação no PostgreSQL** |
| DT-05 | Hashing de senha | argon2id | **argon2id** |
| DT-06 | Tokens de confirmação e reset | Token opaco hasheado no banco | **Token opaco hasheado no banco** |
| DT-07 | Serviço de e-mail | `@nestjs-modules/mailer` + SMTP/Mailpit | **`@nestjs-modules/mailer` + SMTP/Mailpit** |
| DT-08 | Proteção contra brute-force | `@nestjs/throttler` | **`@nestjs/throttler`** |
