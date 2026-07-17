# Decisões Técnicas — Fase 02: Cadastro, Login e Gerenciamento de Conta

> **Fase:** Cadastro, Login e Gerenciamento de Conta (Auth)
> **Status:** Decidido
> **Data:** 2026-06-04
> **Atualizado:** 2026-06-27 — DT-09 a DT-17 adicionadas, formalizando as decisões resolvidas durante o planejamento (`plan-phase`).

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

**Decisão:** Opção A — _atualizada em 2026-06-27:_ o **refresh token passa a ser um JWT assinado** (em vez de string opaca), mas continua **rastreado no PostgreSQL pelo seu `jti`** (família, rotação e detecção de reuso preservados — RFC 9700). A persistência permanece obrigatória; muda apenas o formato do valor (opaco → JWT) e o que se persiste (o `jti`, não o hash do valor).

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

**Decisão:** _atualizada em 2026-06-27 — dividida por fluxo:_
- **Confirmação de conta → JWT assinado stateless** (claim `purpose: confirm`, sem tabela). O reuso é naturalmente neutralizado pela flag `is_confirmed` (replay → `EMAIL_JA_CONFIRMADO`). _Consequência:_ ao reenviar a confirmação, JWTs de confirmação anteriores permanecem válidos até expirar (não são mais invalidados) — risco baixo, pois todos confirmam a mesma conta.
- **Reset de senha → Opção A (token opaco hasheado no banco), mantida.** Exige uso único e revogação reais (links pendentes devem morrer após a redefinição), que o JWT stateless não garante.

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

## Decisões resolvidas durante o planejamento (`plan-phase`)

> As três pendências antes listadas em "Fora do escopo desta pesquisa" foram resolvidas aqui (DT-10, DT-11, DT-12) junto com a definição dos valores de rate limit (DT-13) e novas decisões surgidas na validação do plano (DT-09, DT-14 a DT-17).

## DT-09: Escopo de frontend da Fase 02

**Contexto:** O `project-plan.md` lista "Telas de cadastro, login, confirmação e recuperação" como capacidade da Fase 02, mas a Fase 01 adiou explicitamente o Next.js e o `nextjs-project/` ainda não existe. As decisões DT-01 a DT-08 são todas de backend.

**Opções:**

### Opção A: Backend-only (telas adiadas)
- Esta fase entrega apenas a API de autenticação no `nestjs-project/`; as telas vão para uma fase futura de frontend, quando o Next.js for inicializado.
- **Prós:** escopo coeso; alinha com o adiamento do Next.js feito na Fase 01; não mistura fundação de frontend com auth de backend.
- **Contras:** o fluxo só fica "visível ao usuário final" numa fase posterior.

### Opção B: Incluir Next.js + telas nesta fase
- Inicializar o `nextjs-project/` e implementar as 4 telas além da API.
- **Prós:** entrega o fluxo ponta a ponta numa única fase.
- **Contras:** dobra o escopo (dois subprojetos); mistura inicialização de frontend com auth.

**Recomendação:** Opção A — mantém o escopo coeso e respeita o adiamento do Next.js da Fase 01.

**Decisão:** **Opção A** — backend-only; telas adiadas. (O link de confirmação/reset nos e-mails apontará para a futura rota do frontend via `APP_BASE_URL`.)

**Correção (pós-implementação):** a implementação inicial montou o link apontando para o próprio path da API (`/auth/confirm`, `/auth/reset-password`), que só aceita POST com o token no body — um link de e-mail sempre abre via GET no navegador, então o clique nunca bateria na rota. Corrigido para apontar a paths de página dedicados, distintos dos paths da API: `/confirm-account` e `/reset-password` (placeholders para as rotas que a futura fase de frontend deve implementar; a página lerá o `token` da query string via GET e então chamará o POST real da API com o token no body).

---

## DT-10: Política de colisão de nickname do canal

> Resolve a pendência "Colisão de nickname do canal".

**Contexto:** O canal nasce do prefixo do e-mail, mas prefixos colidem entre domínios (`john@gmail`, `john@hotmail` → `john`). Em todos os casos o prefixo é normalizado (minúsculas, remoção de caracteres fora de `[a-z0-9]`).

**Opções:**

### Opção A: Sufixo numérico incremental
- `john`, `john1`, `john2`… Determinístico e legível.
- **Prós:** previsível; handles amigáveis.
- **Contras:** permite enumeração sequencial de contas.

### Opção B: Sufixo aleatório curto
- `john-a1b2` — 4 caracteres alfanuméricos aleatórios na colisão.
- **Prós:** evita enumeração sequencial; resolve a colisão sem interromper o cadastro.
- **Contras:** handles um pouco menos amigáveis.

### Opção C: Bloquear e exigir escolha manual
- Cadastro solicita um nickname manual quando o prefixo já existe.
- **Prós:** usuário controla o handle.
- **Contras:** adiciona campo/fluxo extra ao cadastro.

**Recomendação:** Opção A — determinística e previsível.

**Decisão:** **Opção B** — sufixo aleatório curto (ex.: `johndoe-a1b2`), evitando enumeração sequencial.

---

## DT-11: Política de senha

> Resolve a pendência "Política de senha".

**Contexto:** O cadastro e a redefinição validam a senha. argon2id (DT-05) não tem o limite de 72 bytes do bcrypt; em todos os casos aplica-se um máximo de 128 caracteres para evitar DoS de hashing.

**Opções:**

### Opção A: Mínimo 8, sem complexidade obrigatória
- Prioriza comprimento sobre composição (OWASP moderno).
- **Prós:** menor atrito; recomendação atual do OWASP.
- **Contras:** aceita senhas comuns se longas o bastante (mitigável com checagem de breach no futuro).

### Opção B: Mínimo 8 + maiúscula, minúscula e número
- Exige classes de caracteres.
- **Prós:** força composição mínima.
- **Contras:** regras de composição têm eficácia questionável e aumentam atrito.

### Opção C: Mínimo 12 + maiúscula, minúscula, número e símbolo
- Política mais rígida.
- **Prós:** senhas mais fortes por padrão.
- **Contras:** maior atrito no cadastro.

**Recomendação:** Opção A — alinhada à recomendação atual do OWASP.

**Decisão:** **Opção A** — mínimo 8, sem complexidade obrigatória, máximo 128 caracteres.

---

## DT-12: TTLs (expirações) dos tokens

> Resolve a pendência "tempo de expiração concretos de cada token".

**Contexto:** Access token (DT-01/04), refresh token (DT-04) e tokens opacos de confirmação/reset (DT-06) precisam de expirações concretas.

**Opções:**

### Opção A: access 15min / refresh 7d / confirm 24h / reset 1h
- Equilíbrio padrão OWASP entre segurança e UX.
- **Prós:** access curto com refresh rotacionado; janelas de e-mail usuais.
- **Contras:** —

### Opção B: access 15min / refresh 30d / confirm 48h / reset 30min
- Sessão mais longa, confirmação mais folgada, reset mais curto.
- **Prós:** menos relogins.
- **Contras:** refresh de 30 dias amplia a janela de um refresh roubado.

### Opção C: access 5min / refresh 24h / confirm 12h / reset 15min
- Mais conservador.
- **Prós:** menor janela de exposição.
- **Contras:** refresh frequente; janelas de e-mail curtas (risco de expirar antes do clique).

**Recomendação:** Opção A — equilíbrio padrão.

**Decisão:** **Opção A** — access 15min, refresh 7d, confirmação 24h, reset 1h.

---

## DT-13: Valores de rate limit (`@nestjs/throttler`)

> Complementa a DT-08, que escolheu o `@nestjs/throttler` mas não fixou valores.

**Contexto:** É preciso definir o limite global e os limites estritos dos endpoints sensíveis (login, solicitação de reset, reenvio de confirmação).

**Opções:**

### Opção A: global 100/min; login 5/min; reset 3/h; reenvio confirmação 3/h
- **Prós:** protege brute-force de credenciais e abuso de e-mail sem atrapalhar uso legítimo.
- **Contras:** —

### Opção B: global 60/min; login 5/15min; reset 3/h; reenvio 3/h
- **Prós:** login mais estrito.
- **Contras:** pode bloquear retentativas legítimas (5 a cada 15 min).

### Opção C: global 200/min; login 10/min; reset 5/h; reenvio 5/h
- **Prós:** menor atrito.
- **Contras:** proteção mais fraca.

**Recomendação:** Opção A — protege os fluxos sensíveis com folga para uso legítimo.

**Decisão:** **Opção A** — global 100/min; login 5/min; forgot-password 3/h; resend-confirmation 3/h.

---

## DT-14: Escopo do logout

> Depende de DT-04 (refresh com rotação por família).

**Contexto:** O logout revoga refresh tokens. É preciso definir se encerra apenas a sessão atual ou todas as sessões do usuário.

**Opções:**

### Opção A: Apenas a sessão/família atual
- Revoga só a família do refresh em uso (dispositivo atual).
- **Prós:** comportamento esperado pela maioria dos usuários; não derruba outros dispositivos.
- **Contras:** não serve como "sair de todos os lugares" (pode vir como recurso futuro).

### Opção B: Todas as sessões do usuário
- Revoga todos os refresh tokens (logout global).
- **Prós:** encerra tudo de uma vez.
- **Contras:** surpreende o usuário ao deslogar outros dispositivos.

**Recomendação:** Opção A — comportamento padrão esperado.

**Decisão:** **Opção A** — logout revoga apenas a família/sessão atual.

---

## DT-15: Proteção CSRF dos cookies

> Depende de DT-03 (tokens em cookie `httpOnly`).

**Contexto:** Com tokens em cookie, é preciso mitigar CSRF. DT-03 já previu `SameSite`; resta definir se basta o `SameSite` ou se haverá token anti-CSRF dedicado.

**Opções:**

### Opção A: Apenas `SameSite=Strict`
- Cookies `httpOnly` + `Secure` + `SameSite=Strict`.
- **Prós:** suficiente para esta fase; sem peças extras.
- **Contras:** sem defesa em profundidade; revisitar se surgirem fluxos cross-site.

### Opção B: `SameSite` + token anti-CSRF (double-submit)
- Adiciona um token anti-CSRF além do `SameSite`.
- **Prós:** defesa em profundidade.
- **Contras:** mais peças (cookie/endpoint de CSRF, validação).

**Recomendação:** Opção A — suficiente nesta fase; token anti-CSRF pode entrar num hardening futuro.

**Decisão:** **Opção A** — `SameSite=Strict` (sem token anti-CSRF dedicado nesta fase).

---

## DT-16: Tratamento de falha no envio de e-mail durante o cadastro

**Contexto:** O cadastro grava usuário + canal no PostgreSQL e então envia o e-mail de confirmação via SMTP — uma operação que cruza um limite externo sem transação distribuída. É preciso definir o comportamento quando o SMTP/Mailpit estiver indisponível após o commit do cadastro.

**Opções:**

### Opção A: Best-effort (conta criada mesmo se o e-mail falhar)
- O cadastro commita; a falha de e-mail é logada; o usuário fica não confirmado e pode usar o reenvio de confirmação.
- **Prós:** desacopla a disponibilidade do SMTP da criação de conta; o reenvio cobre a falha.
- **Contras:** usuário pode não receber o e-mail e precisar acionar o reenvio.

### Opção B: Bloqueante (e-mail obrigatório para concluir o cadastro)
- O cadastro só é considerado concluído se o e-mail for enviado (falha desfaz/impede a criação).
- **Prós:** garante que todo cadastro gerou um e-mail.
- **Contras:** indisponibilidade do SMTP derruba o cadastro inteiro; acopla criação de conta à infraestrutura de e-mail.

**Recomendação:** Opção A — o reenvio de confirmação (já previsto) cobre a falha sem acoplar o cadastro ao SMTP.

**Decisão:** **Opção A** — envio best-effort; cadastro concluído mesmo com falha de e-mail.

---

## DT-17: Revogação de sessões na redefinição de senha

> Depende de DT-04 e DT-06.

**Contexto:** Ao redefinir a senha via token de reset, é preciso decidir o destino das sessões ativas (refresh tokens) do usuário.

**Opções:**

### Opção A: Revogar todas as sessões ativas
- A redefinição revoga todos os refresh tokens do usuário.
- **Prós:** postura segura — redefinição costuma indicar comprometimento; expulsa um eventual invasor.
- **Contras:** o usuário precisa relogar em todos os dispositivos.

### Opção B: Manter as sessões existentes
- Apenas troca a senha; sessões seguem ativas.
- **Prós:** menos atrito.
- **Contras:** um invasor com sessão ativa permanece logado mesmo após a senha mudar.

**Recomendação:** Opção A — encerrar tudo é a postura segura e alinha com o uso único dos tokens (DT-06).

**Decisão:** **Opção A** — a redefinição de senha revoga todas as sessões ativas.

---

## Políticas de comportamento confirmadas no planejamento

Decisões de comportamento sem alternativas relevantes (derivadas das capacidades da fase), registradas para referência da implementação:

- **Login com conta não confirmada** → bloqueado com `403 EMAIL_NAO_CONFIRMADO` (derivado de "confirmação obrigatória" no `project-plan.md`).
- **Respostas neutras** em `forgot-password` e `resend-confirmation` → sempre `204`, sem revelar a existência/estado da conta.
- **Endpoint dedicado de reenvio de confirmação** incluído (implícito na DT-08, que prevê rate limit em "reenvio de confirmação").
- **Nova solicitação invalida pendências anteriores** → emitir um novo token de confirmação/reset invalida os tokens pendentes do mesmo propósito.

---

## Fora do escopo desta pesquisa

- Nenhuma pendência em aberto. As decisões antes encaminhadas para a `plan-phase` (colisão de nickname, política de senha, expiração de tokens) foram resolvidas em DT-10 a DT-12; os valores de rate limit, em DT-13.

---

## Resumo das Decisões

| ID | Decisão | Recomendação | Escolha |
|----|---------|--------------|---------|
| DT-01 | Estratégia de autenticação | JWT stateless | **JWT stateless** |
| DT-02 | Biblioteca de implementação | Passport (`@nestjs/passport` + `@nestjs/jwt`) | **Passport (`@nestjs/passport` + `@nestjs/jwt`)** |
| DT-03 | Armazenamento do token no cliente | Cookie `httpOnly` | **Cookie `httpOnly`** |
| DT-04 | Sessão / refresh / logout | Refresh com rotação no PostgreSQL | **Refresh JWT rastreado no PostgreSQL (jti) com rotação** |
| DT-05 | Hashing de senha | argon2id | **argon2id** |
| DT-06 | Tokens de confirmação e reset | Token opaco hasheado no banco | **Confirmação: JWT stateless · Reset: token opaco hasheado** |
| DT-07 | Serviço de e-mail | `@nestjs-modules/mailer` + SMTP/Mailpit | **`@nestjs-modules/mailer` + SMTP/Mailpit** |
| DT-08 | Proteção contra brute-force | `@nestjs/throttler` | **`@nestjs/throttler`** |
| DT-09 | Escopo de frontend da fase | Backend-only | **Backend-only (telas adiadas)** |
| DT-10 | Colisão de nickname do canal | Sufixo numérico incremental | **Sufixo aleatório curto** |
| DT-11 | Política de senha | Mín. 8, sem complexidade | **Mín. 8, sem complexidade, máx. 128** |
| DT-12 | TTLs dos tokens | access 15min / refresh 7d / confirm 24h / reset 1h | **access 15min / refresh 7d / confirm 24h / reset 1h** |
| DT-13 | Valores de rate limit | global 100/min; login 5/min; reset 3/h; reenvio 3/h | **global 100/min; login 5/min; forgot 3/h; resend 3/h** |
| DT-14 | Escopo do logout | Apenas a sessão/família atual | **Apenas a sessão/família atual** |
| DT-15 | Proteção CSRF | Apenas `SameSite=Strict` | **Apenas `SameSite=Strict`** |
| DT-16 | Falha de e-mail no cadastro | Best-effort | **Best-effort (conta criada mesmo assim)** |
| DT-17 | Sessões na redefinição de senha | Revogar todas | **Revogar todas as sessões ativas** |
