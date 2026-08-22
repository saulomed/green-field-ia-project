# phase-02-auth-frontend — Screen Inventory Progress

**Status:** completed
**Screens:** 3/3 completed

## Reconciled screen list

| # | Screen name                                     | URL (fileKey:nodeId)            | Status  |
|---|-------------------------------------------------|---------------------------------|---------|
| 1 | Tela de cadastro de conta                       | btF0MZVd48p33ufSP08RrX:140:333  | completed |
| 2 | Tela de login                                   | btF0MZVd48p33ufSP08RrX:138:179  | completed |
| 3 | Tela de solicitação de redefinição de senha     | btF0MZVd48p33ufSP08RrX:140:289  | completed |

## Extension run — 2026-08-17

Extension run **sem tela nova**: o delta é um *estado* da tela 1 (`/signup`), exigido por `auth-frontend/TD-09` (Option A). A lista reconciliada acima não muda — continua 3/3.

O caso não é o canônico do skill, que pressupõe uma tela nova e uma extração do Figma. Aqui **nenhuma chamada ao Figma MCP foi feita**, porque a própria TD-09 registra que o estado de sucesso não existe no design ("o estado não existe no Figma e exige um extension run no inventário"). As quatro linhas acrescentadas à tabela de `/signup` — `SignupSuccessPanel`, o heading/copy, `ResendConfirmationButton` e o `LoginLink` — são as únicas do inventário derivadas de uma TD em vez do node tree, e estão marcadas como tal na coluna de componente e nas Observations da tela.

Também foram atualizadas as referências de status defasadas que o inventário carregava desde 2026-08-15: `TD-06` (agora decidida), `TD-07` (Adiada — a condicional sobre `/confirm-account` resolveu-se em sentido negativo) e `TD-11` (decidida, com a consequência de exigir superfície de erro no nível do formulário nas três telas).

Passos 6 e 7 do extension run executados: validação cross-screen rodada, e `## Reconciliation summary` + `## Open questions` reescritas por inteiro.

## Screens removed as out-of-scope

- ~~Tela de confirmação de conta~~ — usuário: "nós só vamos implementar as telas de cadastro de conta, tela de login e reset de senha, o restante não iremos implementar agora"
- ~~Tela de redefinição de senha (novo password com token)~~ — não existe no Figma; o nó `140:289`, apesar do rótulo "Reset password", é o formulário de solicitação do link. Ver Open questions.

## Blocking issues — RESOLVIDOS em 2026-08-15

Ambos os bloqueios abaixo foram superados na retomada: a cota do Figma MCP renovou e as telas 2 e 3 foram re-extraídas do node tree, com node ids reais. Os blocos reconstruídos a partir de código/prosa foram descartados sem nunca terem sido anexados. Registro mantido como histórico da sessão.

**Lição aplicada no re-despacho:** o esgotamento veio do retry — um agente tentou `get_design_context` três vezes, outro varreu três ferramentas distintas. Na segunda rodada cada agente recebeu teto de 2 chamadas, ordem fixa (`get_design_context` primeiro) e proibição de reintentar ou trocar de ferramenta em erro de cota. O agente da tela 3 gastou apenas 1 chamada: a imagem veio embutida na resposta do `get_design_context`, dispensando o `get_screenshot`.


- **2026-08-15 — Tela de login (`138:179`) não extraída.** O sub-agente recebeu `You've reached the Figma MCP tool call limit on the Starter plan` em três tentativas de `get_design_context` / `get_screenshot`. A cota do plano Starter está esgotada nesta sessão. A tela **não** foi anexada ao inventário: um bloco derivado de `app/login/page.tsx` em vez do nó Figma seria indistinguível de uma extração real para o `/plan-build`, que lê estas tabelas mecanicamente. Re-despachar quando a cota voltar. Enquanto isso o inventário permanece `Status: Pending`.

- **2026-08-15 — Tela de solicitação de redefinição de senha (`140:289`) não extraída.** Mesmo bloqueio: `get_design_context`, `get_screenshot` e `get_metadata` falharam com o limite do plano Starter. A tela **não** foi anexada, pela mesma razão da anterior. O screenshot obtido pelo parent **antes** do esgotamento da cota (usado para resolver a rota `/forgot-password`) continua válido como evidência da identidade da tela, mas não substitui a árvore de nós — não há node id de nenhum componente filho.

**Ao retomar:** rodar `/screen-inventory auth-frontend` novamente. O preflight lê este progress file, pula a coleta de URLs e re-despacha apenas as linhas `pending`. A tela 1 já está em disco e não é reprocessada.

**Duas observações levantadas pelo agente da tela 3 que sobrevivem ao bloqueio** (vieram do screenshot já obtido, não da árvore):

- O rodapé lê "Remember your password?" seguido de link rotulado **"Sign up"** — a pergunta pede login ("Sign in"), não cadastro. Provável erro de copy no Figma. Confirmar rótulo verbatim na re-extração.
- A seta de voltar no topo-esquerdo precisa de `next-frontend/components/icons/arrow-back.tsx (new)`, o mesmo alvo já identificado na tela de cadastro — uma implementação atende as duas.

## Decisions log

- ✓ [DECISION: "reset de senha" — só a redefinição, ou solicitação + redefinição?] — resolvido: o usuário forneceu uma única URL, e o screenshot do nó `140:289` mostra campo de e-mail + "Send reset link" ⇒ é a **solicitação**. Rota `/forgot-password` (a rota `/reset-password` está reservada para a página de redefinição pelo link de e-mail, per `auth/TD-09` revisão de 2026-07-17).
- ✓ [DECISION: destino do usuário após o `201` do cadastro] — resolvido fora do inventário, por `auth-frontend/TD-09` (Option A): permanece em `/signup`, formulário substituído pelo painel de sucesso. Aplicado no extension run de 2026-08-17.
- ✓ [DECISION: `/confirm-account` passa a existir?] — resolvido em sentido negativo por `auth-frontend/TD-07` (Adiada). Nenhuma tela nova a inventariar.
