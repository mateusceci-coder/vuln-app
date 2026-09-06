---
title: Relatório de Validação de Detecção e Resposta — Portal Aurora Chamados
classification: CONFIDENCIAL
---

# Relatório de Validação de Detecção e Resposta

## Portal de Chamados "Aurora Chamados" — em resposta ao Teste de Intrusão

|                              |                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cliente (destinatário)**   | Planalto Distribuidora Ltda                                                                                                                              |
| **Executado por**            | Aurora Dev — Operações & Segurança (equipe interna que hospeda a aplicação)                                                                              |
| **Tipo de engajamento**      | Validação de controles de detecção e resposta (IDS/IPS de perímetro + FIM/auditoria de host)                                                             |
| **Ambiente testado**         | Ambiente de homologação, atrás de um IDS/IPS de rede e um agente de host                                                                                  |
| **Janela de validação**      | 31 de agosto – 05 de setembro de 2026                                                                                                                    |
| **Data do relatório**        | 06 de setembro de 2026                                                                                                                                    |
| **Classificação**            | Confidencial — uso restrito ao destinatário                                                                                                              |

> **Aviso de laboratório.** A Planalto Distribuidora e a Aurora Dev são
> entidades fictícias. Este documento foi produzido no âmbito de um
> laboratório acadêmico de segurança ofensiva/defensiva (Projeto Integrador)
> sobre uma aplicação deliberadamente vulnerável. Ele documenta a fase de
> **defesa**: os controles de detecção e bloqueio implantados depois do teste
> de intrusão, e o que foi efetivamente validado contra tráfego real.

> **Nota sobre a evidência.** Os vereditos abaixo se baseiam em inspeção
> visual de 16 capturas de tela dos alertas e telas de detalhe geradas
> durante o replay dos ataques já documentados no teste de intrusão. Falta
> 1 captura (segunda imagem da seção "IDOR") — sinalizado explicitamente no
> achado correspondente, sem inferir conteúdo que não foi visto.

---

## Sumário

1. [Sumário executivo](#sumário-executivo)
2. [Ambiente e metodologia](#ambiente-e-metodologia)
3. [Arquitetura de detecção implantada](#arquitetura-de-detecção-implantada)
4. [Matriz de cobertura de detecção](#matriz-de-cobertura-de-detecção)
5. [Resultados detalhados por achado](#resultados-detalhados-por-achado)
6. [Gaps e limitações](#gaps-e-limitações)
7. [Recomendações](#recomendações)
8. [Apêndice A — Regras Suricata implantadas](#apêndice-a--regras-suricata-implantadas)
9. [Apêndice B — Configuração Wazuh implantada](#apêndice-b--configuração-wazuh-implantada)
10. [Apêndice C — Ferramentas e componentes](#apêndice-c--ferramentas-e-componentes)

---

## Sumário executivo

Em resposta ao teste de intrusão (13 achados exploráveis, 6 críticos), a
Aurora Dev implantou uma camada de detecção e resposta em torno do ambiente
de homologação — sem, ainda, corrigir o código-fonte dos achados. O objetivo
desta rodada foi responder a uma pergunta específica: **dos vetores já
comprovadamente exploráveis, quantos a nova camada de monitoramento consegue
enxergar ou bloquear hoje, mesmo enquanto o código continua vulnerável?**

A arquitetura implantada tem duas pernas: um **IDS/IPS de rede** no
perímetro (seis assinaturas custom mapeadas 1:1 a achados específicos) e um
**agente de host** na própria aplicação (integridade de arquivo, auditoria
de execução de processo, e leitura do log da aplicação).

**Resultado agregado — dos 13 achados do teste de intrusão:**

| Veredito                                                    | Qtd | Achados                |
| ------------------------------------------------------------- | --- | ----------------------- |
| 🔵 Detectado **e bloqueado** (bloqueio ativo confirmado)      | 5   | #1, #4, #6, #9, #10     |
| 🟢 Detectado (alerta/regra confirmada disparando, sem bloqueio ativo) | 3 | #2, #5, #11          |
| 🟠 Parcialmente coberto (uma de duas frentes confirmada)       | 1   | #8                      |
| 🔴 Sem nenhum controle de detecção hoje                       | 2   | #3, #7                  |
| ⚪ Não validado / fora de escopo runtime                       | 2   | #12, #13                |

Em números simples: **9 dos 13 achados têm hoje evidência visual confirmada
de que um controle de detecção disparou**, e **5 desses 9 chegaram a
bloqueio ativo** (as cinco assinaturas de rede correspondentes foram
promovidas de modo alerta-só para bloqueio, e a mesma evidência confirma a
ação de bloqueio de fato ocorrendo para todas). Apenas **2 achados seguem
sem nenhum controle de detecção** (#3, #7) — o #7 (autenticação
fraca/força bruta) é uma **regressão**: um controle que chegou a existir
para esse vetor não está mais em vigor.

Uma regra de detecção não documentada previamente foi identificada durante
esta validação: uma correlação por frequência no host que cobre o achado #2
(IDOR), disparando quando a mesma sessão acessa 5 ou mais chamados distintos
em 60 segundos.

---

## Ambiente e metodologia

**VMs envolvidas:** a aplicação (Aurora Chamados), um firewall/roteador com
IDS/IPS de rede inline entre a origem do ataque e a aplicação, uma máquina
atacante isolada em rede própria, e um agente de host/SIEM dedicado
recebendo eventos da aplicação.

**Principais mudanças de rede desde o teste de intrusão original:** a
aplicação foi movida para um segmento de rede próprio (DMZ), atrás do
firewall com IDS/IPS — todo tráfego de/para a aplicação agora passa
obrigatoriamente por essa camada de inspeção antes de chegar a ela. O
caminho de rede entre a máquina atacante e a aplicação passa por dois
níveis de NAT em sequência, o que faz o IDS/IPS enxergar o tráfego de
ataque como vindo de um endereço interno do ambiente de virtualização, não
do endereço real da máquina atacante — relevante para leitura de logs, não
para a eficácia da detecção em si (o tráfego malicioso ainda chega de uma
origem única e consistente).

**O que foi testado.** Replay dos payloads já documentados no teste de
intrusão contra a instância viva, agora atrás da nova camada de detecção:
para cada vetor, disparar o ataque e conferir o console de alertas de rede
ou o painel de eventos de host antes de seguir para o próximo teste.

**Limitações de metodologia:**

- **NAT duplo mascara o IP de origem no IDS/IPS de rede.** Confirmado nas
  capturas: os alertas de rede mostram um endereço interno do ambiente de
  virtualização como origem, não o IP real da máquina atacante. Para um
  único atacante (o caso deste laboratório), isso não compromete a detecção
  por conteúdo/volume, só a atribuição de "IP real bloqueado".
- **Endereço-alvo inconsistente em duas seções de evidência ("docker sock"
  e "IDOR").** Os comandos ali usam um endereço fora da faixa da DMZ
  monitorada pelo IDS/IPS de rede — se esse tráfego não passou pelo caminho
  de rede inspecionado, o IDS/IPS de rede não teria visibilidade sobre ele.
  A detecção confirmada para os achados #2, #5 e #11, porém, vem
  inteiramente do agente de host (integridade de arquivo, auditoria de
  processo e log de aplicação) — um mecanismo que observa a aplicação
  diretamente, independente de qual caminho de rede levou a requisição até
  ela. Ainda assim, recomenda-se confirmar a origem real desses testes.
- **Tempo até detecção por requisição individual não instrumentado.**
  Nenhuma captura correlaciona o timestamp exato do disparo do ataque com o
  timestamp do alerta para o mesmo evento individual. O que é possível
  afirmar, a partir dos timestamps visíveis nas próprias telas de alerta: a
  promoção das cinco assinaturas de rede de alerta-só para bloqueio ativo
  ocorreu toda no mesmo dia, numa janela concentrada de cerca de 21 minutos.

---

## Arquitetura de detecção implantada

| Etapa | Componente                          | O que acontece                                                        |
| ----- | -------------------------------------- | -------------------------------------------------------------------------- |
| 1     | Máquina atacante                       | Origem do tráfego de ataque, em rede isolada                               |
| 2     | → NAT (1º nível)                       | Primeiro hop de NAT até o firewall                                         |
| 3     | → Firewall / borda                     | Redireciona o tráfego para o segmento de rede da aplicação (DMZ)           |
| 4     | → **IDS/IPS de rede** (inline na DMZ)  | Alerta-só ou, para regras já promovidas, descarta o tráfego malicioso      |
| 5     | → Aplicação Aurora Chamados (DMZ)      | Recebe a requisição (permitida ou já bloqueada na etapa 4)                 |
| 6     | → Agente de host                       | Integridade de arquivo + auditoria de processo + log da aplicação → envia para o console central |
| 7     | → **Console central (SIEM)**           | Correlaciona eventos do host **e** os alertas do IDS/IPS de rede           |

Duas pernas, cobrindo camadas diferentes:

1. **Rede/perímetro.** Seis assinaturas custom, 1:1 com vetores específicos
   do teste de intrusão. Cinco delas confirmadas nesta revisão já em modo
   de bloqueio ativo. Detalhe completo no [Apêndice
   A](#apêndice-a--regras-suricata-implantadas).
2. **Host.** Três fontes de dado confirmadas em uso: integridade de arquivo
   sobre os diretórios onde uma dependência maliciosa vive, auditoria de
   execução de processo, e leitura do log da própria aplicação com uma
   regra de correlação por frequência para IDOR (achado #2). Detalhe
   completo no [Apêndice B](#apêndice-b--configuração-wazuh-implantada).

Nenhuma das duas pernas corrige a vulnerabilidade subjacente — ambas são
controles **detectivos** (e, para as cinco regras de rede promovidas,
**preventivos** em runtime).

---

## Matriz de cobertura de detecção

| #   | Achado                                          | Severidade | Controle confirmado                                        | Evidência                                            | Veredito                                            |
| --- | ------------------------------------------------- | ---------- | -------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| 1   | SQL Injection na busca de chamados                | 🟠 Alta    | Assinatura de rede — alerta e depois bloqueio                  | `01_sqli_ataque_curl.png`, `01_sqli_alerta_sid1000003.png` | 🔵 Detectado e bloqueado (regra ruidosa/burlável, ver ressalva) |
| 2   | IDOR — `GET /api/chamados/:id`                    | 🟡 Média   | Correlação por frequência no host (log de aplicação)            | `02_wazuh_idor_detalhe_rule100121.png`               | 🟢 Detectado — regra identificada só nesta revisão; falta a 2ª captura (lista) |
| 3   | Controle de acesso quebrado — `/usuarios/:id`     | 🟡 Média   | Nenhum confirmado                                                | —                                                          | 🔴 Sem controle de detecção                           |
| 4   | Escalonamento de privilégio (`PATCH` papel)       | 🟠 Alta    | Assinatura de rede — alerta e depois bloqueio                   | `04_escalonamento_ataque_patch.png`, `04_escalonamento_alerta_sid1000005.png` | 🔵 Detectado e bloqueado             |
| 5   | Injeção de comando no exportador de PDF           | 🔴 Crítica | Auditoria de execução de processo no host                       | `05_11_wazuh_rce_lista_rule100110.png`, `05_11_wazuh_rce_detalhe_runc.png` | 🟢 Detectado (captura o elo do runtime de container na cadeia, não o shell injetado isoladamente) |
| 6   | DoS no upload de anexos                           | 🟡 Média   | Assinatura de rede — alerta e depois bloqueio                   | `06_multer_ataque_502.png`, `06_multer_alerta_sid1000007.png` | 🔵 Detectado e bloqueado — bloqueio ativo agora também previne o crash |
| 7   | Autenticação fraca / força bruta                  | 🔴 Crítica | Nenhum hoje                                                       | —                                                          | 🔴 Sem controle — **regressão**                       |
| 8   | Backdoor em dependência instalada                 | 🔴 Crítica | Beacon de rede (não testado) + integridade de arquivo (confirmado) | `08_wazuh_fim_lista.png`, `08_wazuh_fim_detalhe_t1565.png` | 🟠 Parcial — integridade confirmada, beacon de rede sem evidência |
| 9   | Painel interno esquecido                          | 🟠 Alta    | Assinatura de rede — alerta e depois bloqueio                   | `09_painelinterno_ataque_equipe.png`, `09_painelinterno_alerta_sid1000004.png`, `ips_bloqueadas_lista_5sids.png` | 🔵 Detectado e bloqueado             |
| 10  | Fingerprinting de versão                          | 🟡 Média   | Assinatura de rede — alerta e depois bloqueio                   | `10_fingerprint_ataque_version.png`, `10_fingerprint_alerta_sid1000006.png` | 🔵 Detectado e bloqueado             |
| 11  | Socket do Docker montado — escape de container    | 🔴 Crítica | Mesmo mecanismo de auditoria de processo do achado #5             | Mesmas capturas do achado #5                              | 🟢 Detectado — mesma ressalva de camada capturada do #5 |
| 12  | Credenciais SSH fracas                            | 🔴 Crítica | Regra genérica de força bruta, não aplicada                      | —                                                          | ⚪ Não validado                                       |
| 13  | Dependências com CVE conhecido                    | 🔴 Crítica | Fora do escopo de detecção em runtime                            | —                                                          | ⚪ Fora de escopo aqui                                |

**Tempo até detecção por requisição individual:** ainda não instrumentado.
O que a evidência confirma sobre tempo: a promoção de alerta-só para
bloqueio das cinco regras de rede (#1, #4, #6, #9, #10) foi concluída em
cerca de 21 minutos, no mesmo dia.

---

## Resultados detalhados por achado

Ordenados por veredito (melhor cobertura primeiro), não por severidade.

### #1 — SQL Injection na busca de chamados → Detectado e bloqueado

**Controle:** assinatura de rede que casa `UNION SELECT` / `OR 1=1` na
query string da rota de busca de chamados.

**Evidência.** Ataque replicado com `busca=%27) OR 1=1 -- `, retornando
todos os chamados da base (bypass total do filtro de busca):

![Ataque SQLi via curl, retornando todos os chamados](evidence/01_sqli_ataque_curl.png)

Alerta correspondente, disparado no momento da requisição:

![Alerta de rede — SQLi](evidence/01_sqli_alerta_sid1000003.png)

A mesma assinatura aparece confirmada em modo de bloqueio ativo um dia
depois — ver captura consolidada no achado #9.

**Veredito.** 🔵 Detectado em modo alerta **e confirmado em bloqueio ativo**
um dia depois. **Ressalva:** esta é uma assinatura de payload best-effort —
variações com comentário inline, espaçamento não padrão, ou operadores
equivalentes escapam da regra sem deixar de explorar a vulnerabilidade
real. O controle real continua sendo a query parametrizada; esta regra é
defesa em profundidade, não proteção — mesmo agora bloqueando o payload
exato documentado.

---

### #4 — Escalonamento de privilégio via `PATCH /api/usuarios/:id` → Detectado e bloqueado

**Controle:** assinatura de rede que casa a string `papel` em qualquer
lugar do corpo de um `PATCH` para a rota de usuários.

**Evidência.** Cadeia completa replicada: `PATCH` alterando o próprio papel
para `admin`, seguido de novo login (retornando token já com o papel
elevado) e listagem completa de usuários com esse token:

![Ataque de escalonamento — PATCH papel=admin e listagem confirmando](evidence/04_escalonamento_ataque_patch.png)

Alerta correspondente:

![Alerta de rede — escalonamento de privilégio](evidence/04_escalonamento_alerta_sid1000005.png)

Confirmado em bloqueio ativo pouco depois.

**Veredito.** 🔵 Detectado e bloqueado. **Ressalva:** a regra não interpreta
JSON de verdade — um nome de campo diferente do literal `papel`, ou um
corpo serializado de forma não padrão, escaparia sem alterar o resultado da
exploração.

---

### #6 — Negação de serviço no upload de anexos → Detectado e bloqueado

**Controle:** assinatura de rede que casa um nome de arquivo vazio literal
no corpo de um upload de anexo.

**Evidência.** Corpo multipart malformado (nome de arquivo vazio, sem
boundary de fechamento) enviado contra a rota de upload, resultando em
`502 Bad Gateway` (o processo do backend caiu):

![Ataque DoS — corpo malformado e 502 Bad Gateway](evidence/06_multer_ataque_502.png)

Alerta correspondente:

![Alerta de rede — DoS no upload](evidence/06_multer_alerta_sid1000007.png)

Confirmado em bloqueio ativo — a mais recente das cinco promoções.

**Veredito.** 🔵 Detectado e bloqueado. Isto muda a leitura deste achado:
**enquanto a regra estava só em modo alerta, a detecção não evitava o
impacto** (o processo caía mesmo assim). **Com a regra em bloqueio ativo
confirmado**, o payload exato deste PoC agora é descartado antes de chegar
à aplicação, neutralizando esta variante específica do DoS na camada de
rede — sem corrigir a causa raiz. **Ressalva:** casa apenas a assinatura
exata do PoC; outras variações do mesmo tipo de bug continuam não
cobertas.

---

### #9 — Painel interno esquecido → Detectado e bloqueado

**Controle:** assinatura de rede que casa qualquer acesso à rota do painel
interno esquecido, sem exceção (menor risco de falso positivo do
conjunto).

**Evidência.** Requisição não autenticada contra a rota, retornando as
credenciais internas vazadas:

![Ataque — acesso ao painel interno retornando credenciais vazadas](evidence/09_painelinterno_ataque_equipe.png)

Alerta correspondente:

![Alerta de rede — painel interno](evidence/09_painelinterno_alerta_sid1000004.png)

Confirmação definitiva do bloqueio ativo — a lista de alertas bloqueados
mostra **as cinco regras custom simultaneamente** em ação de bloqueio,
concentradas numa janela de cerca de 21 minutos:

![Lista de alertas bloqueados — 5 assinaturas em modo de bloqueio](evidence/ips_bloqueadas_lista_5sids.png)

**Veredito.** 🔵 Detectado em modo alerta e, depois, promovido a bloqueio
ativo — o vetor foi neutralizado na camada de rede, mesmo sem a rota ter
sido removida do código ainda. Esta captura confirma que são as cinco
regras em bloqueio, não apenas uma.

---

### #10 — Fingerprinting de versão → Detectado e bloqueado

**Controle:** assinatura de rede que casa qualquer acesso ao endpoint de
versão/dependências.

**Evidência.** Requisição retornando nome/versão/dependências completas do
backend, incluindo o rastro de uma dependência instalada localmente fora
do registro público:

![Ataque — endpoint de versão expondo dependências](evidence/10_fingerprint_ataque_version.png)

Alerta correspondente:

![Alerta de rede — fingerprinting de versão](evidence/10_fingerprint_alerta_sid1000006.png)

Confirmado em bloqueio ativo.

**Veredito.** 🔵 Detectado e bloqueado. Risco de falso positivo baixo (mesma
categoria do achado #9): não há motivo para tráfego legítimo bater nessa
rota vindo de fora.

---

### #2 — IDOR (`GET /api/chamados/:id`) → Detectado

**Controle:** correlação por frequência sobre o log da própria aplicação,
disparando quando 5 ou mais chamados distintos são acessados pela mesma
sessão em uma janela de 60 segundos.

**Evidência.** Documento de detalhe mostrando a regra disparando, com a
janela de requisições anteriores que, somadas à requisição corrente,
completou o gatilho:

![Detalhe — regra de correlação disparando para IDOR](evidence/02_wazuh_idor_detalhe_rule100121.png)

**Achado novo desta revisão.** Este controle não estava identificado em
nenhuma avaliação anterior deste vetor — a inspeção visual desta rodada
confirma que ele existe e funciona.

**Veredito.** 🟢 Detectado. **Gap residual:** falta a segunda captura desta
seção (provavelmente uma visão de lista equivalente à do achado #5/#11,
mostrando múltiplos disparos ao longo do tempo). Como a detecção é por
host/aplicação (não por rede), a ambiguidade de endereço mencionada na
metodologia não invalida este resultado.

---

### #5 — Injeção de comando no exportador de PDF → Detectado

**Controle:** auditoria de execução de processo no host — captura qualquer
processo filho gerado pela chamada de shell vulnerável.

**Evidência.** Console de eventos mostrando múltiplos disparos de uma
regra de "processo suspeito derivado do backend (possível command
injection RCE)", intercalados com ruído de auditoria de rotina não
relacionado:

![Lista — múltiplos disparos da regra de RCE](evidence/05_11_wazuh_rce_lista_rule100110.png)

Abrindo um dos eventos dessa lista, o detalhe mostra o processo capturado:
uma invocação de baixo nível consistente com o runtime de container
iniciando um novo container por baixo de um comando `docker run`:

![Detalhe — execução de processo capturada pela auditoria](evidence/05_11_wazuh_rce_detalhe_runc.png)

**Veredito.** 🟢 Detectado. **Ressalva sobre qual elo da cadeia foi
capturado:** não há, nesta rodada, uma captura isolada do comando inicial
injetado — o que a tela de detalhe mostra é a chamada subsequente do
runtime de container. Isso ainda confirma que a cadeia de execução de
comando disparou a regra — só não isola qual comando específico gerou
aquele evento em particular.

---

### #11 — Socket do Docker montado → escape de container → Detectado

**Controle:** o mesmo mecanismo de auditoria de processo do achado #5 —
caminho de exploração idêntico (execução de comando via exportador de PDF
→ container privilegiado via socket montado).

**Evidência.** Comando exato documentado na evidência original: login,
seguido de injeção no exportador de PDF instalando um cliente Docker e
executando um container privilegiado com acesso de leitura/escrita ao
sistema de arquivos do host. As mesmas capturas do achado #5 acima (lista +
detalhe) são a evidência de detecção para este achado — a cadeia de
exploração é uma só.

**Veredito.** 🟢 Detectado. A captura de detalhe do achado #5 é evidência
direta de que a etapa de escape via socket do Docker — que é exatamente uma
invocação de baixo nível por baixo do comando privilegiado — gerou um
evento capturado pela auditoria de processo.

---

### #8 — Backdoor em dependência instalada → Parcialmente coberto

**Controles:** dois, cobrindo ângulos diferentes do mesmo achado:

- Beacon de rede de saída disparado ao carregar o módulo malicioso. **Não
  testado nesta rodada.**
- Integridade de arquivo sobre o diretório onde a dependência maliciosa
  vive. **Confirmado.**

**Evidência.** Console de integridade de arquivo mostrando 10 disparos de
"checksum de integridade alterado" sobre o arquivo da dependência,
resultado de um teste controlado de alteração desse arquivo:

![Lista — checksum alterado na dependência maliciosa](evidence/08_wazuh_fim_lista.png)

Detalhe de um dos eventos, com o horário de modificação exato e a técnica
MITRE associada (manipulação de dado armazenado):

![Detalhe — mtime alterado, técnica MITRE associada](evidence/08_wazuh_fim_detalhe_t1565.png)

**Veredito.** 🟠 Parcial. O vetor de **integridade de arquivo** está
confirmado com detalhe completo. O teste em si foi uma alteração
controlada do arquivo (prova de que o controle reage a qualquer alteração
no diretório) — não a instalação real de uma versão diferente do backdoor.
O vetor de **beacon de rede** (a telemetria de saída do próprio pacote
malicioso, comportamento mais diagnóstico deste achado especificamente)
permanece sem nenhuma evidência de validação nesta rodada.

---

### #3 — Controle de acesso quebrado (`GET /api/usuarios/:id`) → Sem controle de detecção

Nenhuma evidência cobre este achado especificamente entre as 16 capturas
revisadas. Sem assinatura de rede dedicada e sem regra de host
identificada. **Veredito:** 🔴 Sem controle de detecção.

---

### #7 — Autenticação fraca / força bruta → Sem controle de detecção (regressão)

**Controle:** nenhum hoje. Um controle que cobriria este vetor (detecção
de N falhas de login pelo mesmo IP/conta em uma janela de tempo) chegou a
existir, mas não está mais em vigor na configuração atual.

**Evidência.** Nenhuma nas 16 capturas revisadas.

**Veredito.** 🔴 Sem controle de detecção. Isto é uma **regressão**, não
apenas uma lacuna nunca fechada — o controle existiu e saiu de vigor sem
substituto. Dado que este é um dos três achados críticos que sozinhos
levam a administrador (junto com #4 e #8), e que #4 e (parcialmente) #8 já
têm controle confirmado nesta revisão, o #7 passa a ser **o único dos três
caminhos para administrador sem nenhuma detecção hoje** — a lacuna de
maior prioridade deste relatório.

---

### #12 — Credenciais SSH fracas → Não validado

Ambiguidade não resolvida sobre qual host foi originalmente alvo do teste
de força bruta de SSH — sem isso, o teste não foi repetido contra o
ambiente atual. **Veredito:** ⚪ Não validado.

---

### #13 — Dependências com CVE conhecido → Fora de escopo deste relatório

Achado de composição de software (shift-left) — por definição, não é um
vetor de detecção em runtime. Nenhuma ação necessária neste relatório.

---

## Gaps e limitações

1. **Regressão em #7 (auth fraca / brute force) — maior prioridade.** Um
   controle que cobriria este vetor não está mais em vigor. Com #4 e #8
   (parcialmente) já cobertos, este passa a ser o único dos três caminhos
   independentes para administrador sem nenhuma detecção.
2. **Regra de correlação para IDOR (achado #2) não estava documentada em
   nenhuma avaliação anterior** — só existe como configuração de fato no
   ambiente vivo, confirmada por esta captura.
3. **Achados #5 e #11 confirmados, mas no elo do runtime de container, não
   no comando injetado isoladamente.** Não há captura rotulada mostrando a
   reação ao comando inicial injetado — apenas ao processo subsequente.
   Suficiente para confirmar detecção da cadeia como um todo, insuficiente
   para atribuir a qual comando exato.
4. **Beacon de rede da dependência maliciosa sem qualquer validação.**
   Configurado, mas nunca exercitado nem em modo alerta.
5. **Duas assinaturas de rede (SQLi e escalonamento) são burláveis** por
   encoding/variação de payload. Continua valendo mesmo com as regras
   agora em bloqueio: um payload equivalente que escape da assinatura não
   seria bloqueado.
6. **Endereço de teste inconsistente** em duas seções de evidência — ver
   Limitações de metodologia. Não invalida a detecção por host confirmada,
   mas impede afirmar cobertura de rede para esses dois testes
   especificamente.
7. **1 de 17 capturas de evidência não recuperada** nesta revisão — a
   segunda imagem da seção "IDOR".
8. **Nenhum "tempo até detecção" por requisição individual medido** — só a
   janela de cerca de 21 minutos da promoção das cinco regras de rede é
   conhecida.
9. **SSH (#12) segue bloqueado** pela ambiguidade de host já registrada.

---

## Recomendações

| Prioridade  | Ação                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Imediata    | Recriar detecção de força bruta de login (#7) — única regressão sem nenhuma detecção entre os três caminhos independentes para admin. |
| Imediata    | Documentar formalmente a regra de correlação para IDOR (#2) — hoje só existe no ambiente vivo. |
| Curto prazo | Validar isoladamente o beacon de rede da dependência maliciosa (#8) — reiniciar a aplicação com o pacote presente e observar o tráfego de saída. |
| Curto prazo | Recuperar a captura faltante da seção "IDOR" (2ª imagem). |
| Curto prazo | Confirmar a origem real de rede dos testes com endereço inconsistente (achados #2, #5, #11) — se não passaram pelo caminho de rede monitorado, considerar refazer para também obter cobertura de rede, além da já confirmada no host. |
| Médio prazo | Resolver a ambiguidade de host do achado #12 e validar a regra de SSH. |
| Médio prazo | Implantar controle de detecção para #3 (controle de acesso quebrado) — hoje sem cobertura nenhuma. |
| Contínuo    | Medir e registrar tempo até detecção por requisição individual. |
| Contínuo    | Atualizar o status de cada achado no inventário de vulnerabilidades: #11 de "explorado" para "detectado"; #1, #4, #6, #9, #10 para refletir bloqueio ativo, não só detecção. |
| Contínuo    | Reconstruir a camada de regras customizadas (rede + host), com runbooks de validação e notas de honestidade sobre os limites de cada assinatura, incluindo a regra de correlação de IDOR e a leitura de log de aplicação — hoje ausentes de qualquer documentação. |

---

## Apêndice A — Regras Suricata implantadas

Seis assinaturas de rede customizadas, criadas especificamente para os
vetores deste laboratório. Range local `1000000+`; SID `1000002`
reservado/pulado.

| SID     | Mensagem                                                          | Achado associado | MITRE ATT&CK | Status confirmado nesta revisão |
| ------- | ------------------------------------------------------------------ | ----------------- | ------------- | ---------------------------------- |
| 1000001 | Beacon C2 da dependência maliciosa (slopsquat)                    | #8                | T1071         | Não testado (nem alerta, nem bloqueio) |
| 1000003 | Payload de SQLi na busca de chamados (ruidoso)                    | #1                | T1190         | Alerta e bloqueio confirmados      |
| 1000004 | Acesso ao painel interno esquecido                                | #9                | T1552.001     | Alerta e bloqueio confirmados      |
| 1000005 | Escalonamento de privilégio — PATCH usuários com papel no corpo   | #4                | T1078         | Alerta e bloqueio confirmados      |
| 1000006 | Fingerprinting de versão sem autenticação                         | #10               | T1592.002     | Alerta e bloqueio confirmados      |
| 1000007 | DoS no upload de anexos — nome de arquivo vazio                   | #6                | T1499         | Alerta e bloqueio confirmados      |

Cinco das seis regras (todas exceto o beacon `1000001`) estão hoje em modo
de bloqueio ativo, confirmado pela captura consolidada de alertas
bloqueados (`ips_bloqueadas_lista_5sids.png`).

---

## Apêndice B — Configuração Wazuh implantada

Três fontes de dado confirmadas em uso no agente de host.

| Mecanismo                            | Configuração                                                                              | Achado associado | Observação                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------ |
| Integridade de arquivo                | Monitoramento em tempo real sobre o diretório da dependência maliciosa; regra padrão de checksum | #8 (backdoor)     | Documentado                                |
| Auditoria de execução de processo     | Leitura de log de auditoria do kernel; regra custom de nível alto para processos suspeitos derivados do backend | #5, #11 (RCE / escape) | Documentado                                |
| Leitura de log da aplicação            | Regra custom de correlação por frequência — ≥5 acessos distintos a chamados em 60s          | #2 (IDOR)          | **Não documentada** em nenhuma avaliação anterior |

Agente instalado na VM da aplicação; console central correlaciona também
os alertas do IDS/IPS de rede.

---

## Apêndice C — Ferramentas e componentes

| Componente               | Papel                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| Firewall / IDS-IPS de rede  | Inspeção e bloqueio inline de tráfego malicioso na borda da DMZ               |
| Agente de host / SIEM       | Integridade de arquivo, auditoria de processo e correlação de log de aplicação |
| Auditoria do kernel (host)  | Captura de execução de processo consumida pelo agente de host                 |
| `curl` / `jq`               | Replay dos payloads do teste de intrusão durante a validação                  |
| Máquina atacante            | Origem dos testes de ataque replicados                                        |

---

_Fim do relatório. Evidência visual completa em `evidence/` (16 capturas)._
