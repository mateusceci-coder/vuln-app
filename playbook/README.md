# Playbook — Aurora Chamados

Um guia de aprendizado construído em cima de um exercício ofensivo e
defensivo real: uma aplicação web deliberadamente vulnerável (**Aurora
Chamados**), um teste de intrusão de verdade contra ela, e uma camada de
detecção montada em resposta. Tudo isso dentro de uma história fictícia — uma
dev shop, um cliente, uma empresa de segurança contratada — que serve só de
moldura para os fatos técnicos, que são reais.

**Para quem é este playbook.** Para quem está começando em desenvolvimento
web e/ou cibersegurança e quer entender, de ponta a ponta e sem jargão
desnecessário, como um sistema real acaba comprometido e o que existe para
evitar ou conter isso — tanto no código quanto na infraestrutura ao redor
dele.

**O que este playbook não é.** Não corrige nada no código do laboratório: o
app-alvo (`backend/`, `frontend/`) continua, de propósito, vulnerável — é
material vivo de estudo. Também não é o documento técnico de referência:
onde este playbook simplifica para ensinar, os relatórios linkados em cada
guia trazem o achado completo, com evidência e trecho de código exato.

## Como ler

Os quatro guias em [`guia/`](guia/) seguem uma ordem — cada um assume o
anterior:

1. [**A história**](guia/01-a-historia.md) — o cenário fictício e por que
   ele é baseado em um padrão real e bem documentado de como pequenas
   empresas acabam comprometidas.
2. [**Tipos de vulnerabilidade**](guia/02-vulnerabilidades.md) — glossário
   didático: o que é SQL injection, IDOR, autenticação fraca, dependência
   maliciosa, entre outras, antes de ver onde cada uma aparece.
3. [**O teste de intrusão**](guia/03-pentest.md) — o que foi encontrado, como
   os achados se encadeiam do zero até o controle total do servidor, e como
   cada um poderia ter sido evitado no código.
4. [**A defesa**](guia/04-defesa.md) — o que aconteceu depois do teste:
   OPNsense, Suricata e Wazuh explicados em linguagem simples, e quanto da
   exploração documentada no guia 3 esses controles conseguem hoje detectar
   ou bloquear.

## Quer profundidade técnica?

Este playbook aponta, ao longo do texto, para os documentos que sustentam
cada afirmação:

| Documento                                         | Conteúdo                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| [`README.md`](../README.md) (raiz do repositório) | Catálogo completo de vulnerabilidades, com exemplos de exploração         |
| [`pentest-report/`](../pentest-report/)           | Relatório de teste de intrusão completo, achado a achado, com evidência   |
| [`deteccao-report/`](../deteccao-report/)         | Relatório de validação de detecção, com evidência visual de cada controle |

> ⚠️ Todo exemplo de exploração citado nos documentos acima existe apenas
> para este laboratório isolado. Não repita esses passos contra sistemas que
> você não tem autorização explícita para testar.
