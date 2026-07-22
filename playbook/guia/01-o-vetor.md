# 01 — O vetor: código gerado por IA + dependência sem revisão

Pequenas e médias empresas raramente têm um time de AppSec dedicado. Quando
precisam de um portal de chamados, um CRM interno ou qualquer sistema sob
medida, terceirizam para uma dev shop pequena — muitas vezes de dois ou três
desenvolvedores, sem revisor de segurança, sob prazo apertado. Nesse contexto,
o caminho de menor resistência é deixar uma IA gerar boa parte do código e da
lista de dependências, e seguir para produção sem uma revisão de segurança
estruturada. É exatamente esse cenário que o **Aurora Chamados** simula: uma
aplicação que a fictícia Aurora Dev entregou e hospeda para um cliente.

As nove vulnerabilidades plantadas no app não são falhas aleatórias — são
**evidência concreta** do padrão. A tabela-espinha no `README.md` deste
playbook lista cada uma delas, sua origem, o controle que a preveniria antes
do deploy e a detecção em runtime caso escape; não vamos repeti-la aqui.

O que amarra essas nove linhas é uma divisão em dois grupos. As quatro
primeiras — SQL injection, IDOR, controle de acesso quebrado, escalonamento de
privilégio, command injection, SSRF e autenticação fraca — são **código
inseguro que a própria IA emite** quando ninguém revisa o resultado: query por
concatenação de string, ausência de checagem de dono ou papel, `exec` com
input do usuário, `baseURL` de HTTP client repassável, hash fraco e JWT sem
`algorithms` fixado são exatamente os atalhos que um assistente de código tende
a sugerir quando o prompt pede "faça funcionar" sem pedir "faça seguro". A
última — a dependência `express-audit-log`, um pacote com nome plausível de
observabilidade, mas na verdade um backdoor slopsquattado — é o segundo modo
de falha: **dependência que a IA recomenda (ou que alguém copia de uma
sugestão) e ninguém audita antes de instalar**. É o contraste didático da
tabela: as quatro primeiras têm CVE conhecido e caem para o Trivy (SCA); a
última não tem CVE nenhum — só FIM e detecção de rede em runtime a pegam.

Esse padrão não é hipotético. Relatórios como o Verizon DBIR e o IBM Cost of a
Data Breach vêm registrando ano após ano que aplicações web e cadeia de
dependências figuram entre os vetores de comprometimento mais explorados —
consistente com o que este laboratório planta de propósito para ser
encontrado.
