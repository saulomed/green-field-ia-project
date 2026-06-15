---
name: research
description: "Pesquisa opções técnicas e gera um documento de decisões para uma fase do projeto. Use sempre que o usuário precisar explorar alternativas, entender trade-offs ou definir caminhos técnicos antes de planejar uma fase — incluindo variações como 'pesquisar opções para a fase X', 'quais tecnologias usar na fase', 'trade-offs da fase', 'decisões técnicas da fase', 'pesquisar a fase', ou qualquer menção a explorar alternativas antes do planejamento."
disable-model-invocation: true
---

# Research

Pesquisa opções técnicas e gera um documento estruturado de decisões para uma fase do projeto. Esse documento fica entre o plano geral e o plano de implementação — identifica decisões que precisam ser tomadas, apresenta alternativas com trade-offs e recomenda um caminho. O usuário revisa, decide, e o resultado alimenta a skill `plan-phase`.

## Contexto — leia antes de gerar

1. **`docs/project-plan.md`** — plano geral do projeto. Contém a descrição da fase, suas capacidades e a stack definida.
2. **`docs/decisions/`** — fonte canônica de decisões técnicas de fases anteriores. São restrições fixas — não reabra decisões já tomadas.
3. **`docs/phases/`** — fases já planejadas. Leia apenas como referência de formato e consistência de nomenclatura, não como fonte de decisões técnicas.

## Quando esta skill é necessária

Nem toda fase precisa de pesquisa. Use este checklist:

- A fase envolve **escolhas de lib, framework ou serviço** com alternativas reais? (ex.: bcrypt vs argon2, JWT vs sessão)
- Existem **padrões de implementação concorrentes** com trade-offs relevantes? (ex.: rotação de refresh token vs blacklist)
- A fase tem **requisitos não-funcionais** que impactam escolhas técnicas? (ex.: upload de 10GB → chunked vs streaming vs tus)
- Há uma **dúvida real** sobre qual caminho seguir?

Se a resposta for não para todos, pule a pesquisa e vá direto para `plan-phase`. O usuário (o profissional que usa o agente) deve então fornecer as decisões técnicas diretamente junto à requisição de planejamento.

## Como identificar decisões técnicas

Leia cada capacidade da fase em project-plan.md e pergunte: "existe mais de uma forma razoável de implementar isso com a stack do projeto?" Se sim, é uma decisão técnica.

Decisões técnicas aparecem em categorias recorrentes:

- **Estratégia:** como abordar o problema (ex.: auth stateless vs stateful)
- **Lib/Serviço:** qual ferramenta usar (ex.: Passport.js vs implementação manual)
- **Padrão:** qual padrão seguir (ex.: rotação de refresh token vs blacklist)
- **Armazenamento:** onde e como persistir dados (ex.: token em cookie vs localStorage)
- **Limites e políticas:** valores e regras técnicas de negócio (ex.: expiração de token, rate limit, tamanho máximo)

Ignore decisões já tomadas em project-plan.md ou em fases anteriores. Ignore também decisões triviais que têm resposta óbvia no contexto da stack.

## Como pesquisar opções

Para cada decisão identificada:

1. **Verifique as versões instaladas no projeto primeiro.** Identifique qual projeto do monorepo está em escopo (ex.: nestjs-project, nextjs-project ou outro) e verifique seu `package.json` / `package-lock.json` para ver as versões já instaladas. Isso restringe quais versões de documentação buscar e quais alternativas são realmente compatíveis com a stack existente.
2. **Pesquise dentro do contexto da stack.** Para cada opção avaliada, use o MCP Context7 para buscar documentação das versões compatíveis com as dependências instaladas no projeto. Isso fornece detalhes precisos de API, compatibilidade de versões e limitações conhecidas — melhor do que depender de dados de treinamento ou versões mais recentes.
3. **Busque informações atualizadas sobre alternativas.** Use busca na web e Context7 para consultar documentação atual de libs, frameworks e padrões concorrentes. Versões mudam, libs são descontinuadas, novas opções surgem.
4. **Priorize fontes primárias.** Documentação oficial, RFCs, repositórios das libs. Evite posts de blog genéricos como fonte primária.
5. **Seja honesto sobre trade-offs.** Não force uma recomendação. Se duas opções são equivalentes no contexto da sua stack e restrições, diga isso.

## Estrutura do output

```markdown
# Decisões Técnicas — Fase NN: [Nome]

> **Fase:** [Nome da fase]
> **Status:** Pendente | Decidido
> **Data:** [YYYY-MM-DD]

---

## DT-01: [Nome da decisão]

**Contexto:** Por que esta decisão precisa ser tomada. Qual capacidade da fase depende dela.

**Opções:**

### Opção A: [Nome]
- Como funciona (2-3 frases)
- **Prós:** vantagens concretas
- **Contras:** desvantagens concretas

### Opção B: [Nome]
- Como funciona (2-3 frases)
- **Prós:** vantagens concretas
- **Contras:** desvantagens concretas

### Opção C: [Nome] _(se aplicável)_
- Como funciona (2-3 frases)
- **Prós:** vantagens concretas
- **Contras:** desvantagens concretas

**Recomendação:** [Opção recomendada] — justificativa em uma frase considerando a stack e o contexto do projeto.

**Decisão:** _[a ser preenchido pelo usuário]_

---

(repetir para cada decisão)

## Resumo das Decisões

| ID | Decisão | Recomendação | Escolha |
|----|---------|--------------|---------|
| DT-01 | [Nome] | [Opção recomendada] | _[pendente]_ |
| DT-02 | [Nome] | [Opção recomendada] | _[pendente]_ |
```

## Como escrever recomendações

A recomendação é uma sugestão, não uma decisão. Ela deve:

- Ser justificada pelo contexto do projeto, não por preferência genérica.
- Considerar o que já foi decidido em fases anteriores.
- Ser explícita sobre o que se ganha e o que se perde.
- Admitir quando não há diferença significativa entre as opções.

Recomendações ruins: "JWT é mais moderno." "Todo mundo usa bcrypt."
Recomendações boas: "JWT + refresh no DB viabiliza rotação (RFC 9700) sem adicionar Redis como dependência de auth, já que o PostgreSQL já está na stack."

## Regras

- Apresente entre 2 e 4 opções por decisão. Menos de 2 não é uma decisão. Mais de 4 é ruído.
- Não inclua opções claramente inadequadas para a stack ou escopo do projeto.
- Não tome decisões pelo usuário. Recomende, mas deixe o campo "Decisão" para ele preencher.
- Não entre em detalhes de implementação. Isso é trabalho da `plan-phase`.
- Se uma decisão depende de outra (ex.: escolha de armazenamento do token depende da estratégia de auth), indique a dependência.
- Mantenha cada opção concisa. Se a explicação de uma opção ultrapassar 5-6 linhas, está detalhada demais para este documento.

## Output

Salve em: `docs/decisions/technical-decisions-phase-NN-[name-slug].md`

Exemplo: `docs/decisions/technical-decisions-phase-02-auth.md`

Após o usuário preencher as decisões, este documento serve como input para a skill `plan-phase`.