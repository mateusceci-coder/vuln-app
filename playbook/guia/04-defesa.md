# 4. A defesa — detectar e conter enquanto o código não é corrigido

## Por que detectar antes de corrigir

Treze vulnerabilidades não se corrigem da noite para o dia — algumas são uma
troca de configuração de minutos, outras exigem mudar a lógica de uma rota
com cuidado para não quebrar nada. Na vida real, esse trabalho é priorizado
e leva tempo, e durante esse tempo a aplicação continua no ar. A pergunta que
guia este capítulo é a que a Aurora Dev se fez depois do
[relatório de pentest](03-pentest.md) (guia 3): **enquanto o código ainda não
foi corrigido, dá para pelo menos enxergar — ou até barrar — o ataque
acontecendo?**

A resposta é sim, parcialmente, e este guia mostra exatamente até onde. É
importante deixar claro desde já o que este capítulo **não é**: nenhuma
ferramenta de detecção corrige uma consulta SQL malformada ou remove um
backdoor do código. Detecção é uma segunda linha de defesa — ajuda a ganhar
tempo e visibilidade, não substitui a correção que o guia 3 recomenda.

## O que mudou na rede

Antes da fase de defesa, a aplicação simplesmente existia numa rede — sem
nenhuma inspeção do tráfego que entrava ou saía. A primeira mudança não foi
de código nenhum, foi de **topologia**: a aplicação foi movida para um
segmento de rede próprio e isolado (uma "DMZ"), posicionado atrás de um
firewall com inspeção de tráfego embutida. Na prática, isso significa que
todo tráfego destinado à aplicação passa **obrigatoriamente** por essa camada
de inspeção antes de chegar a ela — não é mais possível simplesmente
contornar o ponto de observação.

Uma curiosidade de infraestrutura deste laboratório específico, para quem for
ler os relatórios completos: a máquina de ataque e a aplicação se conectam
através de dois níveis de tradução de endereço (NAT) em sequência, por causa
de uma limitação de rede Wi-Fi do ambiente físico usado. Isso faz os alertas
mostrarem um endereço de origem "interno" do ambiente de virtualização, em
vez do endereço real do atacante — atrapalha a leitura de log de quem atacou,
mas não muda se o ataque foi detectado ou não.

## As ferramentas, explicadas

Três peças compõem a camada de defesa:

- **OPNsense** — um roteador/firewall de código aberto. É o portão de
  entrada: todo tráfego de fora em direção à aplicação passa por ele antes de
  chegar à DMZ. Sozinho, um firewall tradicional só decide "essa porta pode
  ou não pode" — a parte inteligente vem da peça seguinte, que roda dentro
  dele.
- **Suricata** — um sistema de detecção (e, quando configurado para isso, de
  bloqueio) de intrusão de rede, rodando dentro do OPNsense. Ele inspeciona o
  **conteúdo** do tráfego que passa, não só a porta, comparando cada
  requisição contra um conjunto de assinaturas — padrões conhecidos de
  ataque. Pode operar de dois jeitos: modo **alerta** (só avisa que viu algo
  suspeito, deixa passar) ou modo **IPS/inline** (descarta a requisição antes
  que ela chegue à aplicação). Neste laboratório, seis assinaturas
  personalizadas foram criadas especificamente para os vetores do pentest —
  cinco delas foram promovidas de alerta para bloqueio ativo depois de
  validadas.
- **Wazuh** — um agente instalado diretamente na máquina da aplicação
  (diferente do Suricata, que olha só o tráfego de rede). Ele observa o que
  acontece **dentro** do sistema: se um arquivo sensível foi alterado
  (integridade de arquivo), se um processo suspeito foi executado (auditoria
  de processo, via o subsistema de auditoria do próprio Linux) e o que o log
  da própria aplicação está registrando. Tudo isso é enviado para um painel
  central, que também recebe os alertas do Suricata — um único lugar para
  correlacionar rede e host.

A combinação importa: o Suricata vê o que passa pelo cabo, o Wazuh vê o que
acontece depois que a requisição já chegou lá dentro. Um ataque que escapa da
assinatura de rede (por exemplo, uma variação do payload que o Suricata não
reconhece) ainda pode ser pego pelo comportamento que ele causa dentro do
host — e vice-versa.

## Como a validação foi feita

O método foi direto: repetir, contra o ambiente agora protegido, os mesmos
ataques já documentados no relatório de pentest — e, para cada um, checar se
o console de alertas de rede ou o painel de eventos de host reagiu antes de
seguir para o próximo teste.

## O resultado

Das 13 vulnerabilidades do [teste de intrusão](03-pentest.md) (guia 3):

| Situação hoje                                        | Quantos achados | Quais               |
| ---------------------------------------------------- | --------------- | ------------------- |
| 🔵 Detectado **e bloqueado** ativamente              | 5               | #1, #4, #6, #9, #10 |
| 🟢 Detectado (alerta confirmado, sem bloqueio ativo) | 3               | #2, #5, #11         |
| 🟠 Parcialmente coberto                              | 1               | #8                  |
| 🔴 Sem nenhuma detecção hoje                         | 2               | #3, #7              |
| ⚪ Não validado / fora do escopo de runtime          | 2               | #12, #13            |

Em resumo: **9 dos 13 achados têm hoje algum controle de detecção
confirmado**, e **5 desses 9 chegam a bloqueio ativo** — o tráfego malicioso é
descartado antes de chegar à aplicação, mesmo com a falha de código ainda
presente.

## O que isso ensina

- **Detecção por assinatura de rede é útil, mas burlável.** As regras do
  Suricata para SQL Injection e escalonamento de privilégio, por exemplo,
  reconhecem o payload exato já documentado — uma variação de espaçamento ou
  codificação escaparia sem deixar de explorar a mesma falha real. Vale como
  camada extra, nunca como o controle principal.
- **Detecção por comportamento no host enxerga o que a rede não vê.** A
  injeção de comando (#5) e o escape via socket do Docker (#11) foram
  detectados pelo Wazuh observando o **processo** executado no host, não o
  conteúdo da requisição de rede — e uma regra de correlação (5 ou mais
  chamados distintos acessados pela mesma sessão em 60 segundos) pegou o IDOR
  (#2) por padrão de uso, não por assinatura de ataque.
- **Só a detecção em runtime pega o que nenhum scanner jamais vai listar.**
  A dependência maliciosa (#8, [guia 2](02-vulnerabilidades.md) seção F) não tem CVE público — nenhuma
  checagem de vulnerabilidades conhecidas a encontraria. A integridade de
  arquivo do Wazuh sobre o diretório da dependência é, hoje, a única linha de
  defesa contra esse vetor específico — e mesmo essa está só parcialmente
  validada (o sinal de rede do backdoor ainda não foi testado).
- **A lacuna mais grave é uma regressão, não um esquecimento.** Um controle
  que detectava força bruta de login (#7) chegou a existir e não está mais em
  vigor. Como #4 e #8 já têm alguma cobertura, o #7 é hoje **o único dos três
  caminhos independentes para administrador ([guia 3](03-pentest.md)) sem
  nenhuma detecção** — a prioridade número um da próxima rodada.

## A moral da história

Nenhuma das cinco regras em bloqueio ativo corrigiu uma linha sequer do
código do Aurora Chamados — o backdoor ainda está lá, a consulta SQL ainda
concatena string, o segredo do token ainda é previsível. O que a camada de
defesa comprou foi **tempo e visibilidade**: 9 em 13 vetores já conhecidos
não passam mais despercebidos, e mais da metade deles nem chega a executar.
É uma rede de segurança genuína — mas continua sendo uma rede, não uma
correção. O guia 3 continua sendo o trabalho pendente.
