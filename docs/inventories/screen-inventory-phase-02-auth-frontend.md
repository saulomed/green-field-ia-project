# phase-02-auth-frontend — Screen Inventory

> **Phase:** Cadastro, Login e Gerenciamento de Conta — slice de frontend (`auth-frontend`)
> **Status:** Validated
> **Date:** 2026-08-17
> **Screens in scope:** 3

_Extension run de 2026-08-17: acrescentado o estado de sucesso pós-cadastro em `/signup`, exigido por `auth-frontend/TD-09`. Nenhuma tela nova; nenhuma chamada ao Figma MCP — o estado não existe no design, e suas linhas derivam da TD. Referências de status das TDs atualizadas (TD-06 decidida, TD-07 Adiada, TD-11 decidida)._

---

## Screen: Tela de cadastro de conta

**Route:** `/signup`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-333 (node `btF0MZVd48p33ufSP08RrX:140:333`)
**Purpose (from project-plan.md):** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre o cadastro de conta.

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| SignupForm — container "Login" do card (143:2399) | Server-connected | ✗ | `next-frontend/components/signup-form.tsx (new)` | agrega os 4 campos, o checkbox e o botão de submit; validação local + submissão ao backend ⇒ Server-connected |
| Card (143:2400) | Presentational | ✗ | `next-frontend/components/ui/card.tsx (new)` | container visual do formulário; descrição Figma "Cards are versatile containers" |
| BackLink — arrow_back (143:2407) | Local-interactive | ✗ | new | âncora de navegação client-side (voltar); rota de destino não indicada no Figma |
| ArrowBackIcon (I143:2407;107:246) | Presentational | ✗ | `next-frontend/components/icons/arrow-back.tsx (new)` | ícone SVG hand-maintained; não existe biblioteca externa de ícones no projeto |
| BrandLogo (2387:2263) | Presentational | ✓ | `next-frontend/components/brand-logo.tsx` | lockup play-mark + wordmark "StreamTube" |
| Heading "Create account" (143:2429) | Presentational | ✗ | new | `<h1>` puro (Inter/Heading/H1) |
| Subtitle "Join the community and start sharing." (143:2442) | Presentational | ✗ | new | `<p>` puro (Inter/Body/MD) |
| FormLabel "Full Name" (2172:347) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | — |
| TextField — Full Name (143:2433) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | estado do input é client-side; submissão pertence ao SignupForm |
| FormLabel "Email address" (2172:350) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | — |
| TextField — Email address (143:2434) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | — |
| FormLabel "Password" (2172:353) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | — |
| TextField — Password (143:2435) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | possui trailing icon de visibilidade |
| PasswordVisibilityToggle — Trailing icon (I143:2435;82:6685) | Local-interactive | ✗ | `next-frontend/components/ui/icon-button.tsx (new)` | toggle de visibilidade de senha é local por regra do projeto; mesma instância no campo Confirm Password (I143:2436;82:6685) |
| EyeIcon — remove_red_eye (I143:2435;82:6685;58665:37349;143:341) | Presentational | ✗ | `next-frontend/components/icons/eye.tsx (new)` | ícone SVG hand-maintained; reutilizado nos dois campos de senha |
| ProgressLinear — medidor de força da senha (143:2446) | Local-interactive | ✗ | `next-frontend/components/ui/progress-linear.tsx (new)` | força calculada no cliente a partir do valor digitado; não depende do backend |
| PasswordStrengthHint "Weak password. Add numbers and symbols." (143:2444) | Presentational | ✗ | new | `<p>` de texto auxiliar (Inter/Caption, `--warning-text`) |
| FormLabel "Confirm Password" (2172:356) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | — |
| TextField — Confirm Password (143:2436) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | — |
| TermsCheckbox — Checkbox (143:2445) | Local-interactive | ✗ | `next-frontend/components/ui/checkbox.tsx (new)` | estado de aceite vive no cliente; gate de habilitação do submit |
| TermsText com links Terms of Service / Privacy Policy (143:2439) | Presentational | ✗ | new | `<p>` com dois links inline; destinos não definidos no Figma |
| Button "Create account" (143:2443) | Server-connected | ✓ | `next-frontend/components/ui/button.tsx` | dispara a submissão do cadastro |
| AuthFooter — "Already have an account? / Sign in" (2394:2284) | Local-interactive | ✓ | `next-frontend/components/auth-footer.tsx` | link de navegação client-side para `/login` |
| SignupSuccessPanel (sem nó Figma — origem `auth-frontend/TD-09`) | Server-connected | ✗ | `next-frontend/components/signup-success-panel.tsx (new)` | substitui o card do formulário após o `201`; renderiza o e-mail devolvido pelo `RegisterResponseDto` e hospeda a CTA de reenvio — **não existe no Figma**, ver Observations |
| SignupSuccessHeading + copy "confirme seu e-mail" (sem nó Figma — origem `auth-frontend/TD-09`) | Presentational | ✗ | new | `<h2>` + `<p>` puro-DOM dentro do painel; copy não definida no Figma |
| ResendConfirmationButton (sem nó Figma — origem `auth-frontend/TD-09`) | Server-connected | ✓ | `next-frontend/components/ui/button.tsx` | CTA de reenvio; chama `/api/auth/resend-confirmation` (endpoint já entregue por `auth/TD-09`) |
| LoginLink do painel de sucesso (sem nó Figma — origem `auth-frontend/TD-09`) | Local-interactive | ✗ | new | link inline para `/login`; `auth-footer.tsx` é candidato a reuso, mas a escolha é da SI |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Submeter cadastro de nova conta com nome, e-mail e senha | SignupForm (submit via Button "Create account") | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |
| Exibir erros de cadastro retornados pelo servidor (ex.: e-mail já em uso) | SignupForm | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |
| Exibir a confirmação do cadastro com o e-mail registrado, substituindo o formulário após o `201` | SignupSuccessPanel | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |
| Reenviar o e-mail de confirmação da conta recém-cadastrada | ResendConfirmationButton (dentro do SignupSuccessPanel) | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |

### Observations

- **Estado de carregamento ausente no Figma:** não há variante de loading/disabled para o Button "Create account" nem instância de spinner no nó. O DS já possui `next-frontend/components/icons/spinner.tsx`, mas nenhuma evidência de uso nesta tela — não foi inventariado como componente para evitar invenção.
- **Estados de erro de campo ausentes:** o `TextField` aparece apenas no estado enabled; não há variante de erro/validação inline no nó, embora o formulário exija validação local (nome, e-mail, senha, confirmação) antes da submissão.
- **Destino do BackLink (143:2407) não definido:** o Figma não indica a rota de retorno (home `/` ou `/login`). Fica como questão aberta para o plano.
- **Destinos de "Terms of Service" e "Privacy Policy" (143:2439) não definidos:** não há telas correspondentes no escopo desta fase; os links provavelmente apontarão para rotas ainda inexistentes.
- **Após o submit bem-sucedido — decidido por `auth-frontend/TD-09` (Option A), extension run de 2026-08-17.** O Figma não indica desfecho, e a TD fechou a lacuna sem criar rota nova: o usuário **permanece em `/signup`** e o card do formulário é substituído pelo `SignupSuccessPanel`. As quatro linhas do painel na tabela acima são as únicas do inventário **sem nó Figma** — vieram da TD, não do node tree. O `201` do `POST /auth/register` não emite cookie de sessão (não há auto-login) e o login de conta não confirmada é rejeitado com `403 EMAIL_NAO_CONFIRMADO`, e é por isso que o painel precisa hospedar o reenvio em vez de empurrar o usuário para `/login`.
- **Lacuna de design remanescente no painel de sucesso:** copy, layout e estados (envio em curso, reenvio bem-sucedido, cooldown do reenvio) não existem em nenhum nó. A SI da tela precisará de decisão de copy ou de uma rodada de design antes da implementação.
- **Reuso:** `PasswordVisibilityToggle` e `EyeIcon` aparecem duas vezes (campos Password e Confirm Password) — uma única implementação atende ambos.
- **A11y:** o `ProgressLinear` de força de senha e o `PasswordStrengthHint` precisam de associação programática com o campo de senha (`aria-describedby`); o toggle de visibilidade precisa de rótulo acessível — nenhum dos dois está anotado no Figma.
- **Componente com nome enganoso:** o frame do card está nomeado "Login" (143:2399) no Figma, mas o conteúdo é o cadastro; o nome foi ignorado em favor do conteúdo real.

---

## Screen: Tela de login

**Route:** `/login`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=138-179 (node `btF0MZVd48p33ufSP08RrX:138:179`)
**Purpose (from project-plan.md):** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre a autenticação de um usuário já cadastrado.

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Card (143:1250) | Presentational | ✗ | `next-frontend/components/ui/card.tsx (new)` | container do formulário de login; see screen: Tela de cadastro de conta |
| BrandLogo (2387:2244) | Presentational | ✓ | `next-frontend/components/brand-logo.tsx` | ícone + wordmark "StreamTube"; see screen: Tela de cadastro de conta |
| Heading de título da tela — "Sign in" (143:2273) | Presentational | ✗ | new | `<h1>` puro-DOM |
| FormLabel — "Email address" (2172:253) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | see screen: Tela de cadastro de conta |
| TextField — e-mail (147:536) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | placeholder "Enter your email"; see screen: Tela de cadastro de conta |
| FormLabel — "Password" (2172:263) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | see screen: Tela de cadastro de conta |
| ForgotPasswordLink — "Forgot password?" (147:539) | Local-interactive | ✗ | new | link inline no header do campo de senha; apenas troca de rota |
| TextField — senha (147:540) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | sem toggle de visibilidade neste nó (ver Observations) |
| Button — "Sign in" (147:541) | Server-connected | ✓ | `next-frontend/components/ui/button.tsx` | submit do formulário de autenticação |
| AuthFooter (2394:2271) | Local-interactive | ✓ | `next-frontend/components/auth-footer.tsx` | "Don't have an account?" + link "Sign up"; see screen: Tela de cadastro de conta |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Autenticar usuário a partir de e-mail e senha e iniciar sessão | Button — "Sign in" (147:541) | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |

### Observations

- **Copy incorreta no campo de senha:** o `TextField` de senha (147:540) usa o placeholder "Enter your email" no Figma — provavelmente herdado do campo de e-mail por duplicação. Confirmar o texto correto com o design antes de implementar.
- **Divergência com a tela de cadastro:** este nó **não** contém `PasswordVisibilityToggle` nem `EyeIcon` no campo de senha, e também não contém `BackLink`/`ArrowBackIcon` nem subtítulo/helper text. Nenhum desses foi adicionado à tabela porque não existe na árvore do nó. A tela de cadastro tem o toggle nos dois campos de senha — a inconsistência entre as duas telas é de design, e vale confirmar se é intencional.
- **Não há nó `<form>` na árvore:** os campos, o botão de submit e o agrupamento (147:534 / 147:537) são frames de layout. A semântica de formulário (submit, validação local, estados de erro/loading) é introduzida na implementação — o `Button` é o portador do comportamento server-connected.
- O `Card` (143:1250) contém apenas um `State-layer` vazio (`I143:1250;143:1247`) e é posicionado em `inset-0` atrás do conteúdo — é o fundo/borda do cartão, não um wrapper hierárquico do conteúdo no Figma.
- O link "Forgot password?" (147:539) aponta para `/forgot-password`, tela inventariada nesta mesma fase.
- Nenhum componente adicional aparece no screenshot além dos listados na árvore de `get_design_context`.

---

## Screen: Tela de solicitação de redefinição de senha

**Route:** `/forgot-password`
**Figma:** https://www.figma.com/design/btF0MZVd48p33ufSP08RrX/FC-Tube?node-id=140-289 (node `btF0MZVd48p33ufSP08RrX:140:289`)
**Purpose (from project-plan.md):** "Telas de cadastro, login, confirmação de conta e recuperação de senha" — esta tela cobre a etapa de **solicitação** do link de recuperação de senha por e-mail.

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Card (143:2308) | Presentational | ✗ | `next-frontend/components/ui/card.tsx (new)` | container do formulário; see screen: Tela de cadastro de conta |
| BackLink (âncora de voltar, DOM puro) (143:2343) | Local-interactive | ✗ | new | wrapper de navegação em torno do ícone `arrow_back`; não existe nó próprio de âncora no tree — see screen: Tela de cadastro de conta |
| ArrowBackIcon (143:2343) | Presentational | ✗ | `next-frontend/components/icons/arrow-back.tsx (new)` | SVG `arrow_back` (`I143:2343;107:246`); see screen: Tela de cadastro de conta |
| BrandLogo (2387:2252) | Presentational | ✓ | `next-frontend/components/brand-logo.tsx` | ícone play + wordmark "StreamTube"; see screen: Tela de cadastro de conta |
| Heading de título da tela (143:2347) | Presentational | ✗ | new | `<h1>` com texto "Reset password" |
| Subtitle / helper text (143:2353) | Presentational | ✗ | new | `<p>` "Enter your email and we'll send you a reset link" |
| Email field (grupo de campo) (2713:2086) | Presentational | ✗ | new | frame de layout que agrupa FormLabel + TextField; sem comportamento próprio |
| FormLabel (2172:282) | Presentational | ✓ | `next-frontend/components/ui/form-label.tsx` | label "Email address"; see screen: Tela de cadastro de conta |
| TextField (143:2351) | Local-interactive | ✓ | `next-frontend/components/ui/text-field.tsx` | placeholder "Enter your email"; see screen: Tela de cadastro de conta |
| Button (submit) (143:2354) | Server-connected | ✓ | `next-frontend/components/ui/button.tsx` | label "Send reset link"; see screen: Tela de cadastro de conta |
| AuthFooter (2394:2276) | Local-interactive | ✓ | `next-frontend/components/auth-footer.tsx` | Question "Remember your password?" / Link "Sign up" — ver Observations; see screen: Tela de cadastro de conta |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Solicitar o envio do e-mail de recuperação de senha para o endereço informado | Button (submit) (143:2354) | "Telas de cadastro, login, confirmação de conta e recuperação de senha" |

### Observations

- **Copy inconsistente no AuthFooter (2394:2276):** a pergunta é `"Remember your password?"` mas o rótulo do link é `"Sign up"`. A pergunta sugere destino de login (`Sign in`), enquanto o rótulo aponta para cadastro. Reportado verbatim conforme o node tree, sem correção silenciosa — requer decisão de copy e de rota de destino.
- **Identidade da tela vs. label do frame:** o frame Figma chama-se "Reset password" e o `<h1>` também, mas o conteúdo (campo de e-mail + botão "Send reset link") é a etapa de *solicitação*. A rota emitida é `/forgot-password`; `/reset-password` fica reservada para a tela de definição da nova senha, que não está neste nó nem em nenhum outro do arquivo.
- **BackLink sem nó próprio:** o node tree contém apenas o ícone `arrow_back` (143:2343); não há nó de âncora envolvendo-o. A classificação `Local-interactive` vem da lista herdada da Tela de cadastro de conta, não de evidência de interação neste tree. O destino da navegação de volta não é determinável a partir do Figma.
- **Sem estados de erro/loading no nó:** o tree não expõe variantes de erro de validação do campo, estado de carregamento do botão, nem mensagem de sucesso pós-envio.
- **Orçamento Figma:** apenas `get_design_context` foi chamado; a imagem do nó veio embutida na resposta, dispensando `get_screenshot`. Nenhum componente foi observado apenas no screenshot e ausente do `get_design_context`.

---

## Reconciliation summary

| Capability (project-plan.md) | Covered by | Screens |
|------------------------------|------------|---------|
| "Telas de cadastro, login, confirmação de conta e recuperação de senha" | SignupForm + Button "Create account" (143:2443); SignupSuccessPanel + ResendConfirmationButton (sem nó — `auth-frontend/TD-09`); Button "Sign in" (147:541); Button "Send reset link" (143:2354) | `/signup`, `/login`, `/forgot-password` |

**Cobertura parcial declarada.** A capability é uma única linha do `project-plan.md` que nomeia quatro telas. Este inventário cobre três das quatro superfícies que ela implica — cadastro (incluindo o estado de sucesso pós-`201`), login e solicitação de recuperação. As duas lacunas remanescentes — tela de confirmação de conta e tela de redefinição de senha — estão registradas em `## Open questions` e, desde o ciclo de `/plan-resolve` de 2026-08-17, também em `## Non-UI / Deferred Capabilities` do `context.md` com status `deferred`. As origens são distintas: a primeira é decisão de escopo ratificada por `auth-frontend/TD-07` (Adiada), a segunda é ausência de design.

## Open questions

**Lacunas de escopo e de design**

- **Tela de confirmação de conta — fora do escopo, agora por decisão registrada.** Era decisão informal do usuário ("nós só vamos implementar as telas de cadastro de conta, tela de login e reset de senha"); a `auth-frontend/TD-07` foi **Adiada** e ratificou-a. A condicional que esta seção carregava desde 2026-08-15 ("se a Option A for escolhida, a tela `/confirm-account` passa a existir e este inventário precisa de um extension run") resolveu-se **em sentido contrário**: nenhuma das três opções foi adotada, o link do e-mail continua apontando direto para `GET /auth/confirm` conforme `auth/TD-09`, e não há tela nova a inventariar. A capability está registrada como `deferred` no `context.md`. **Não é mais questão aberta** — mantida aqui como registro do desfecho.
- **Estado de sucesso do cadastro não existe no Figma.** `auth-frontend/TD-09` (Option A) decidiu o comportamento e este extension run o inventariou, mas as quatro linhas correspondentes na tabela de `/signup` são as únicas do documento sem nó Figma. Copy, layout e os estados do reenvio (em curso, concluído, cooldown) seguem indefinidos. É a lacuna de design **ativa** deste inventário.
- **Tela de redefinição de senha (`/reset-password`) não existe no Figma.** É a tela onde o link do e-mail aterrissa e onde o usuário define a nova senha — o backend já a pressupõe (`auth/TD-09`, revisão de 2026-07-17, aponta o link de reset para essa rota de página). Sem ela, o fluxo de recuperação fica pela metade: a solicitação existe, a redefinição não. É lacuna de design, não de planejamento. Registrada como `deferred` no `context.md`.

**Inconsistências de copy no Figma** (confirmar com quem desenhou antes de implementar)

- **Tela de login, campo de senha (147:540):** placeholder diz `"Enter your email"` — copy duplicada do campo de e-mail.
- **Tela de solicitação de reset, AuthFooter (2394:2276):** pergunta `"Remember your password?"` com link rotulado `"Sign up"`. Quem lembrou a senha quer entrar, não se cadastrar.
- **Tela de cadastro, frame do card (143:2399):** nomeado "Login" no Figma, mas o conteúdo é o cadastro. Nome ignorado em favor do conteúdo; não afeta implementação, mas confunde quem navega o arquivo.

**Divergências entre telas irmãs**

- **Toggle de visibilidade de senha:** presente nos dois campos de senha da tela de cadastro (`I143:2435;82:6685`, `I143:2436;82:6685`), ausente no campo de senha do login (147:540). Intencional?
- **BackLink:** presente em cadastro (143:2407) e em solicitação de reset (143:2343), ausente no login. Em ambas as telas onde existe, **o destino da navegação de volta não está definido no Figma**.

**Estados não modelados no Figma** (afetam as três telas)

- Nenhuma tela declara variante de **loading/disabled** para o botão de submit. `next-frontend/components/icons/spinner.tsx` já existe no repo e é o alvo natural, mas não há evidência de uso em nenhum nó.
- Nenhuma tela declara variante de **erro de validação inline** no `TextField`, embora as três exijam validação antes da submissão. A `auth-frontend/TD-06` já está **decidida** (Option A — React Hook Form + resolver Zod tipado contra `contracts.ts`), então o mecanismo existe; o que falta é a **variante visual** do campo em erro, que continua ausente do Figma.
- A tela de solicitação de reset não declara **mensagem de sucesso pós-envio**. Diferente do cadastro, esta lacuna **não** foi fechada por TD — `auth-frontend/TD-09` decide apenas o desfecho do `/signup`.
- **Destino dos erros de servidor:** `auth-frontend/TD-11` (decidida, Option A) fixou que o `400` do `ValidationPipe` vai para `root.serverError` e os códigos de domínio são mapeados por campo num módulo único do cliente. Isso implica, nas três telas, uma **superfície de erro no nível do formulário** além do erro por campo — e ela também não está modelada em nenhum nó.

**Destinos de rota indefinidos**

- Links "Terms of Service" e "Privacy Policy" na tela de cadastro (143:2439) — não há telas correspondentes em nenhuma fase do `project-plan.md`.

**Acessibilidade** (não anotada no Figma)

- Tela de cadastro: o `ProgressLinear` de força de senha (143:2446) e o `PasswordStrengthHint` (143:2444) precisam de associação programática com o campo de senha (`aria-describedby`); o toggle de visibilidade precisa de rótulo acessível.
