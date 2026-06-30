---
name: implement-phase
description: "Executa um plano de implementação de fase passo a passo, respeitando dependências, rodando os testes relevantes após cada SI e só avançando quando os testes passam. Use sempre que o usuário pedir para implementar, executar, construir ou entregar uma fase planejada — incluindo variações como 'implementar a fase X', 'executar a phase-02', 'construir a fase de auth', 'rodar o plano da fase', 'implementar as SIs' ou qualquer pedido para transformar um documento de plano de fase (docs/phases/phase-NN-*.md) em código funcional."
disable-model-invocation: true
---

# Implement Phase

Executa um plano de implementação de fase SI a SI. Cada SI só é considerada concluída quando sua implementação existe **e**, se a SI tiver uma seção Tests, os testes ali listados passam. Avance para a próxima SI somente após a atual estar completa (testes passando quando a SI tem uma seção Tests).

Esta skill é a contraparte de execução da `plan-phase`. O documento do plano é o contrato — esta skill não toma decisões técnicas, ela as segue.

## Entradas

O usuário aponta para um documento de fase diretamente (ex.: `docs/phases/phase-02-auth.md`) ou se refere a ele por número/nome (ex.: "implementar a fase 02", "rodar a fase de auth"). Resolva o caminho antes de prosseguir:

- Se o número da fase for fornecido, procure por `docs/phases/phase-NN-*.md`.
- Se houver mais de um correspondente, pergunte ao usuário qual deles.
- Se o arquivo não existir, pare e avise o usuário — provavelmente ele precisa rodar a `plan-phase` primeiro.

O usuário também pode solicitar o **modo contínuo** no início da sessão com frases como "execute tudo", "não pause entre as SIs", "rode tudo de uma vez", "autopilot". O modo padrão pausa entre as SIs para confirmação.

## Contexto — leia antes de implementar

1. **O documento da fase** — `docs/phases/phase-NN-*.md`. Esta é a fonte primária. Analise o Objetivo, as Step Implementations (cada uma com Description, Technical actions, Tests, Dependencies, Acceptance criteria), as Technical Specifications, o Dependency Map e os Deliverables.
2. **Skill de guia de testes** — para cada subprojeto-alvo, use a Skill tool para carregar `testing-guide-{subproject}` se existir. Ela define como escrever e rodar testes em cada camada (Unit, Integration, E2E) para aquele subprojeto. A seção Tests de cada SI diz **quais** arquivos criar; o guia de testes diz **como** escrevê-los.

## Arquivo de progresso — persistência entre sessões

Um arquivo de progresso rastreia quais SIs foram concluídas, seus resultados de teste e observações fora de escopo. É a fonte da verdade para retomar uma fase entre sessões e para gerar o relatório final de conclusão.

- **Localização:** ao lado do documento da fase, com o sufixo `.progress.md` — ex.: `docs/phases/phase-02-auth.md` → `docs/phases/phase-02-auth.progress.md`
- **Criado:** durante "Montar a lista de tarefas das SIs" (início do zero) ou lido durante o Preflight (retomada)
- **Atualizado:** no passo 6 do loop por SI, após a conclusão de cada SI
- **Formato:**

```markdown
# Phase NN — <nome> — Progress

**Status:** in_progress | completed
**SIs:** X/Y completed

### SI-NN.X — <nome>
- **Status:** completed | pending
- **Tests:** <resultado ou "no tests">
- **Observations:** <notas fora de escopo ou "none">
```

Cada SI recebe uma seção. Apenas `Status`, `Tests` e `Observations` são atualizados — a estrutura é criada uma vez e as entradas são preenchidas conforme as SIs são concluídas.

## Preflight — execute antes de tocar no código

Verifique estes itens antes de começar a implementação. Pare e exponha qualquer problema ao usuário em vez de adivinhar:

- **Verificação de branch**: `git status` e `git branch --show-current`. Se a branch atual for `main` ou `dev`, ou se houver mudanças não commitadas tocando arquivos fora do diretório do subprojeto-alvo (ex.: fora de `nestjs-project/` quando este é o alvo), pare e peça ao usuário para configurar a branch correta primeiro.
- **Prontidão do subprojeto**: o subprojeto-alvo existe e suas dependências estão instaladas (ex.: `nestjs-project/node_modules` presente). Caso contrário, peça ao usuário para configurá-lo primeiro.
- **Sanidade do plano**: o documento da fase tem a estrutura esperada (Step Implementations e Deliverables são obrigatórios; o Dependency Map é opcional — se ausente, a ordem será derivada do campo `Dependencies:` de cada SI). Se o documento parecer malformado ou incompleto, pare e reporte.
- **Verificação de retomada**: procure por um arquivo de progresso (`.progress.md` ao lado do documento da fase). Se encontrado, leia-o para determinar quais SIs já foram concluídas. Informe o usuário: "Encontrado progress file com X/Y SIs completos. Retomando a partir de SI-NN.Z." Se o arquivo de progresso estiver malformado ou inconsistente com o documento da fase, pare e reporte.

## Ordem de execução

Implemente as SIs na ordem definida pelo **Dependency Map** no documento da fase. Se o Dependency Map estiver ausente ou contradisser os campos `Dependencies:` das SIs, derive a ordem desses campos usando uma ordenação topológica — uma SI só pode começar quando todas as suas dependências estiverem completas (testes passando quando a SI tem uma seção Tests).

Nunca pule adiante. Nunca implemente duas SIs em paralelo na mesma execução. A garantia de que "a SI anterior está completa (testes passando quando a SI tem uma seção Tests) antes que a próxima comece" é o valor central que esta skill fornece; violá-la anula seu propósito.

## Montar a lista de tarefas das SIs — antes de entrar no loop por SI

Antes de implementar a primeira SI, você **DEVE** criar uma lista de tarefas persistente que contenha **uma tarefa por SI** na fase, na ordem em que serão executadas. Use a ferramenta `TaskCreate` (uma chamada por SI).

- Formato do assunto da tarefa: `SI-NN.X — <nome da SI>` (ex.: `SI-02.1 — HTTP Infrastructure Foundations`).
- Descrição da tarefa: um resumo de uma linha do que a SI entrega.
- activeForm da tarefa: o que você estará fazendo enquanto a SI estiver em andamento (ex.: `Implementing HTTP infrastructure`).
- Todas as tarefas começam como `pending`.

Esta lista é o plano visível que o usuário pode ver antes de qualquer código ser escrito. Ela espelha a sequência de SIs do documento da fase e serve como contrato de execução da sessão.

**Início do zero** (nenhum arquivo de progresso encontrado): após criar a lista de tarefas, crie o arquivo de progresso com todas as SIs como `pending`.

**Retomada** (arquivo de progresso encontrado): após criar a lista de tarefas, marque imediatamente como `completed` as tarefas das SIs já concluídas (com base no arquivo de progresso). O loop por SI pulará as SIs concluídas e começará a partir da primeira `pending`. Se todas as SIs já estiverem concluídas mas o `Status` do arquivo de progresso ainda for `in_progress`, pule o loop por SI e prossiga diretamente para a verificação final.

Durante o loop por SI:
- Mude a tarefa da SI atual para `in_progress` ao iniciar o passo 1 (Planejar a SI).
- Mude-a para `completed` no início do passo 6, **antes** de emitir o relatório de conclusão da SI e a pergunta "Seguir para SI-NN.X+1?". O `TaskUpdate` e a atualização do arquivo de progresso são as últimas chamadas de ferramenta permitidas antes do STOP obrigatório no modo padrão (no modo contínuo, o relatório de conclusão da SI é emitido e, em seguida, vem o `TaskUpdate → in_progress` da próxima SI).
- Nunca pule tarefas, nunca agrupe atualizações — o status de uma SI é alterado por vez.

**Não** agrupe múltiplas SIs em uma tarefa. **Não** adicione tarefas ad-hoc para ações técnicas individuais — essas vivem na memória de trabalho da SI (passo 1), não na lista de tarefas persistente.

## O loop por SI

Para cada SI **pending** (SIs concluídas de uma sessão anterior são puladas), execute estes passos em ordem. Não os agrupe; a saída de cada passo informa o próximo.

### 1. Planejar a SI

Releia a seção da SI por completo (Description, Technical actions, Tests, Dependencies, Acceptance criteria). Carregue as skills de boas práticas relevantes que correspondem aos artefatos que esta SI constrói (ex.: `nestjs-best-practices` para módulos/controllers/services, `typeorm` para entidades/migrations) — carregue apenas o que esta SI precisa, não todas as skills disponíveis. Mantenha um checklist interno curto para esta SI: um item por ação técnica; adicionalmente, quando a SI tiver uma seção Tests, um item por arquivo de teste mais um item "rodar testes". Isto é memória de trabalho para manter a SI no rumo — não um entregável formal.

### 2. Implementar as ações técnicas

Trabalhe nas ações técnicas em ordem. Mantenha-se no escopo — toque apenas nos arquivos exigidos por **esta** SI. Se você notar problemas não relacionados (código morto, formatação, oportunidades de refatoração), anote-os para o usuário, mas não aja sobre eles.

Quando a SI introduzir novas dependências, instale-as com as faixas exatas de versão listadas nas ações técnicas da SI.

Siga as convenções do subprojeto-alvo — leia arquivos vizinhos antes de criar novos, para que nomenclatura, estrutura e estilo permaneçam consistentes.

### 3. Escrever os testes

Se a SI não tiver uma seção Tests, pule este passo e os passos 4–5, e vá direto para o passo 6 (pausa). Caso contrário, continue abaixo.

Crie os arquivos de teste listados na seção Tests da SI. Use a skill de guia de testes como referência de como estruturar cada camada. Cada teste deve verificar algo específico que a SI introduz — não escreva testes placeholder.

Cubra os Acceptance Criteria da SI. Todo AC pertencente a esta SI deve ser observável a partir de pelo menos um dos testes desta SI (o mapeamento de AC para teste nem sempre é 1:1, mas nenhum AC deve ser não-testável). Nota: SIs sem artefatos testáveis (SIs de infraestrutura cujo comportamento é exercitado pelos testes de outras SIs, SIs de pura configuração, ou similares) podem legitimamente não ter uma seção Tests — o ramo "pular o passo 3" cobre todos esses casos.

### 4. Rodar os testes desta SI

Rode **apenas** os arquivos de teste listados na seção Tests da SI — não a suíte completa.

### 5. Lidar com falhas de teste (até 3 tentativas de correção)

Se os testes passarem na primeira execução, prossiga para o passo 6 (pausa).

Se os testes falharem, entre no **loop de correção**: leia a saída da falha, diagnostique a causa raiz, aplique uma correção focada, rode novamente os mesmos testes. Faça isso no máximo **3 vezes**. Conte as tentativas deliberadamente — não perca a contagem nem entre em loop indefinidamente.

Disciplina do loop de correção:
- **Leia o erro.** Não tente novamente às cegas. Se a mesma correção for aplicada duas vezes, é sinal de que o diagnóstico está errado.
- **Corrija a causa raiz.** Não enfraqueça os testes para fazê-los passar. Não adicione skips, `.only` ou `xit`. Não capture e engula erros apenas para escondê-los.
- **Mantenha-se no escopo.** Se a falha revelar um problema no código de uma SI anterior, pare — isso é um sinal para escalar, não para editar silenciosamente uma SI concluída.
- **Sem atalhos.** Nunca desabilite hooks nem contorne verificações de segurança.

Após 3 tentativas de correção malsucedidas, **pare**. Reporte ao usuário:
- Qual SI está travada.
- A saída atual da falha de teste (concisa).
- Sua hipótese sobre a causa raiz.
- O que você tentou.

Aguarde a orientação do usuário. Não prossiga para a próxima SI até que o usuário o desbloqueie.

### 6. Pausar para confirmação — PARE antes da próxima SI

Este passo é uma **parada rígida**. Após concluir uma SI, você **NÃO DEVE** iniciar a próxima SI sem a aprovação explícita do usuário (dada por SI no modo padrão, ou antecipadamente quando o usuário solicitou o modo contínuo).

- **Modo padrão (pausa — este é o padrão)**: Primeiro, faça uma chamada `TaskUpdate` marcando a tarefa da SI atual como `completed`, então atualize o arquivo de progresso (marque a SI como `completed`, registre os resultados dos testes e quaisquer observações fora de escopo anotadas durante esta SI) — estas são as últimas chamadas de ferramenta permitidas neste passo. Em seguida, emita o relatório de conclusão da SI (id da SI, nome, testes passando — ou `no tests` se a SI não tinha uma seção Tests) e emita exatamente esta pergunta como a linha final da sua mensagem: **"Seguir para SI-NN.X+1?"** (substitua pelo id da próxima SI). Então **PARE**. Não chame nenhuma outra ferramenta. Não comece a ler arquivos para a próxima SI. Não atualize a tarefa da próxima SI para `in_progress`. Aguarde a resposta do usuário em um novo turno antes de fazer qualquer outra coisa.
- **Modo contínuo** (apenas quando o usuário **explicitamente** o solicitou no início da sessão com frases como "execute tudo", "autopilot", "não pause entre as SIs" ou "rode tudo de uma vez"): Ainda execute o `TaskUpdate → completed` e a atualização do arquivo de progresso, e emita o relatório de conclusão da SI (id da SI, nome, testes passando — ou `no tests` se a SI não tinha uma seção Tests), mas **pule** a pergunta "Seguir para SI-NN.X+1?" e o STOP. Então prossiga diretamente para o passo 1 da próxima SI. Se você não tiver certeza se o modo contínuo foi solicitado, assuma o modo padrão e pause.
- **Última SI da fase**: Ainda execute o `TaskUpdate → completed` e a atualização do arquivo de progresso (como nos outros modos); o relatório de conclusão da SI é incorporado ao relatório de Conclusão em nível de fase (veja a seção abaixo), portanto pule o relatório por SI, a pergunta e o STOP, e vá direto para a verificação final.

Violar esta parada é o modo de falha mais comum desta skill. Trate "Seguir para SI-NN.X+1?" como um terminador, não como uma pergunta retórica.

## Verificação final — após todas as SIs concluídas

Quando toda SI da fase tiver sido implementada e testada, rode as verificações em nível de fase definidas no checklist de **Deliverables** do plano. Estas tipicamente incluem:

1. **Suíte de testes completa**: Rode todo comando de teste listado nos Deliverables do plano (tipicamente um para testes unitários/de integração e, quando aplicável, um separado para testes E2E). O objetivo é exercitar todos os testes da fase juntos, não apenas os testes de uma única SI.
2. **Type-check**: Rode o comando de type-check definido nos Deliverables do plano (ex.: `npx tsc --noEmit` para projetos TypeScript).
3. **Build do projeto**: Rode o comando de build definido no projeto (ex.: `npm run build`) para verificar que o código compila e empacota corretamente.

Verifique quaisquer entregáveis adicionais listados no plano (migrations, atualizações de documentação, seed data, arquivos de configuração). Esses resultados são apresentados no **relatório de Conclusão** (veja a seção abaixo).

Se a fase abrange múltiplos subprojetos, o checklist de Deliverables do plano listará essas verificações por subprojeto (ex.: `All SI tests pass in nestjs-project` e `All SI tests pass in nextjs-project`) — rode os comandos de cada subprojeto independentemente, na ordem implícita pelo checklist.

Se qualquer verificação final falhar, aplique a mesma disciplina do loop de correção do passo 5: até 3 tentativas focadas de correção no total (compartilhadas entre todas as verificações que falham, não 3 por verificação), rodando novamente as verificações afetadas após cada tentativa. Se ainda falhar após 3 tentativas, pare e reporte ao usuário.

## Relatório de Conclusão

Quando a fase estiver totalmente concluída, leia o arquivo de progresso e gere o relatório:
- Resultados de cada verificação de entregável (da verificação final — a única informação nova neste ponto).
- Observações fora de escopo agregadas do arquivo de progresso (como uma lista de follow-ups para o usuário, não como coisas sobre as quais agir).

Marque o `Status` do arquivo de progresso como `completed`. Operações de git (add, commit, push, PR) estão fora do escopo — o usuário é o responsável pelo controle de versão.

## Regras

- O plano da fase é o contrato. Não adicione SIs, não remova SIs nem mude os limites de SIs no meio da execução. Se o plano estiver errado, pare e peça ao usuário para revisá-lo via `plan-phase`.
- Antes da primeira SI, crie a lista de tarefas das SIs (um `TaskCreate` por SI, em ordem) para que o usuário veja o plano completo. Mude o status de cada tarefa exatamente nos limites definidos no passo 1 (`in_progress`) e no passo 6 (`completed`).
- Respeite a ordem de dependências — nunca implemente uma SI cujas dependências ainda não estão completas (testes passando quando a SI tem uma seção Tests).
- Uma SI por vez. Sem implementação paralela dentro da mesma execução de fase.
- Rode apenas os próprios testes da SI durante o loop. Reserve a suíte completa para a verificação final.
- Nunca enfraqueça os testes para fazê-los passar. Nunca contorne hooks.
- Mantenha-se dentro do escopo da SI atual — anote problemas não relacionados, não aja sobre eles.
- Após cada SI (exceto a última) no modo padrão, **PARE após emitir "Seguir para SI-NN.X+1?"** e aguarde a aprovação do usuário antes de qualquer outra chamada de ferramenta. O modo contínuo se aplica apenas quando o usuário o solicitou explicitamente no início da sessão.
- Pare e pergunte quando o loop de correção esgotar suas 3 tentativas, quando uma dependência estiver faltando, ou quando o plano conflitar com a realidade.
