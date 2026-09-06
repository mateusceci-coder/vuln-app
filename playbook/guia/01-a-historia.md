# 1. A história — por que este laboratório existe

## A Aurora Dev

A **Aurora Dev** é uma consultoria de desenvolvimento fictícia, do tamanho que
existe aos milhares em qualquer país: duas ou três pessoas, sem um cargo
dedicado a segurança, cuidando ao mesmo tempo de código, banco de dados,
servidor e suporte ao cliente. Um cliente também fictício, a **Planalto
Distribuidora Ltda**, contrata a Aurora Dev para construir um portal de
chamados — um sistema simples de abertura e acompanhamento de tickets de
suporte, batizado de **Aurora Chamados**.

O prazo é curto, como quase sempre é. Para dar conta, a equipe se apoia
pesadamente em um assistente de IA para gerar boa parte do código: rotas de
login, consultas ao banco, upload de anexo, exportação de PDF. O assistente
entrega algo que funciona — os chamados abrem, o login autentica, o PDF sai —
e funcionar, sob pressão de prazo, costuma ser onde a revisão para. Ninguém
audita a lista de dependências instaladas nem lê com atenção o código gerado
procurando por padrões inseguros. O produto vai para homologação, o cliente
aprova, e por algum tempo tudo parece bem.

É exatamente esse ponto — o momento em que "funciona" foi confundido com
"está pronto" — que este laboratório recria e coloca sob um microscópio.

## Por que esse cenário não é exagero

Nada aqui é hipotético. Os números por trás do enredo são reais:

- O **Data Breach Investigations Report** da Verizon (2023) constatou que
  **74% das violações de dados analisadas envolveram o elemento humano** —
  erro, negligência ou uso indevido de credenciais.
- O **Cost of a Data Breach Report** da IBM (2023) mediu em **204 dias** o
  tempo médio para uma organização apenas *perceber* que tinha sido
  comprometida.
- No Brasil, o **CERT.br** registra crescimento consistente de incidentes
  reportados ano a ano, com destaque para força bruta e exploração de
  vulnerabilidades em serviços expostos — os mesmos vetores deste laboratório.
- Mais de **70% dos desenvolvedores** já usam ou planejam usar IA generativa
  no dia a dia, segundo o Stack Overflow Developer Survey (2023). Isso não
  seria um problema se o código gerado fosse seguro por padrão — mas não é:
  Pearce et al. (2022), em *"Asleep at the Keyboard?"*, encontraram
  vulnerabilidades em cerca de **40% dos trechos de código de segurança**
  gerados pelo GitHub Copilot; Khoury et al. (2023) observaram o mesmo padrão
  em código gerado por ChatGPT.
- Pequenas e médias empresas não são um público de nicho: segundo o Sebrae
  (2023), são **mais de 99% dos estabelecimentos brasileiros** e respondem por
  cerca de **70% dos empregos formais** no país — e, no Brasil, estão sujeitas
  à mesma Lei Geral de Proteção de Dados (LGPD, 2018) que qualquer grande
  corporação, independentemente do tamanho do time de TI.

Ou seja: o padrão "time pequeno, prazo curto, código de IA sem revisão,
dependência instalada sem auditoria" não é uma escolha ruim de um
desenvolvedor descuidado — é o cenário estatisticamente mais provável para a
maioria das empresas que constroem software hoje. O Aurora Chamados foi
construído deliberadamente dentro desse padrão, com vulnerabilidades reais e
conhecidas plantadas de propósito, para que pudessem ser estudadas em vez de
apenas sofridas.

## O que este laboratório demonstra

Este playbook segue um arco em três movimentos, cada um coberto num guia
próprio:

1. **Como um ataque acontece de verdade** (guia 3). Meses depois do deploy, a
   Planalto contrata uma empresa de segurança ofensiva para testar o portal.
   O resultado do teste é o coração deste playbook: uma cadeia real de
   exploração, do zero até o controle total do servidor.
2. **Como cada falha poderia ter sido evitada no código** (guias 2 e 3). Toda
   vulnerabilidade explorada tem uma correção conhecida e simples — não é
   preciso reinventar nada, só aplicar prática básica de desenvolvimento
   seguro *antes* de ir para produção.
3. **Como ferramentas de defesa ajudam quando o código ainda não foi
   corrigido** (guia 4). Na vida real, corrigir tudo de uma vez raramente é
   possível — sobra código vulnerável em produção enquanto as correções são
   priorizadas. É aí que entram camadas de detecção e bloqueio: elas não
   resolvem a causa raiz, mas dão visibilidade e, em vários casos, chegam a
   barrar o ataque em trânsito.

Nenhuma dessas três partes substitui a outra. Um firewall bem configurado não
compensa uma consulta SQL montada por concatenação de string; e saber qual é
a consulta correta não adianta nada se ninguém a implementar. O objetivo deste
laboratório é mostrar as três pontas juntas, na mesma aplicação, com evidência
real de cada uma.

## O elenco (fictício)

| Quem | Papel na história |
| --- | --- |
| **Aurora Dev** | A dev shop que constrói e hospeda o Aurora Chamados para o cliente. |
| **Planalto Distribuidora Ltda** | A empresa cliente, contratante do portal e, depois, do teste de intrusão. |
| **Vetor Zero Segurança Ofensiva** | A empresa contratada pela Planalto para o teste de intrusão (guia 3). |
| **Aurora Chamados** | O produto: um portal de abertura e acompanhamento de chamados de suporte. |

Todos os nomes acima são fictícios. Tudo o que os guias 2, 3 e 4 descrevem
sobre vulnerabilidades, exploração e detecção, porém, é **real** — reproduzido
e comprovado contra uma instância viva deste mesmo repositório.

## Como seguir a partir daqui

- [**Guia 2 — Tipos de vulnerabilidade**](02-vulnerabilidades.md) explica, em
  linguagem simples, os *tipos* de vulnerabilidade que aparecem nesta
  história — útil se algum termo como "IDOR" ou "command injection" ainda
  não for familiar.
- [**Guia 3 — O teste de intrusão**](03-pentest.md) conta a história do
  teste de intrusão: o que foi encontrado e como cada achado poderia ter
  sido evitado.
- [**Guia 4 — A defesa**](04-defesa.md) conta o que aconteceu depois: a
  camada de detecção que a Aurora Dev colocou de pé para vigiar a aplicação
  enquanto as correções não saem do papel.

Quem quiser o nível técnico completo — payloads, evidências, linhas de
código exatas — encontra em [`README.md`](../../README.md) (catálogo de
vulnerabilidades), [`pentest-report/`](../../pentest-report/) e
[`deteccao-report/`](../../deteccao-report/) na raiz do repositório. Este
playbook é o caminho de entrada; aqueles documentos são a referência.
