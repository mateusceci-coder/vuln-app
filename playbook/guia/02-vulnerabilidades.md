# 2. Tipos de vulnerabilidade — o essencial para começar

Antes de entrar no [relatório de teste de intrusão](03-pentest.md) (guia 3), vale conhecer os
tipos de falha que ele encontrou. Nenhum destes conceitos é exclusivo do
Aurora Chamados — são categorias clássicas, com décadas de literatura e
presença constante em rankings como o OWASP Top 10. Este guia explica cada
uma em linguagem simples: o que é, por que costuma acontecer e por que
importa. Nenhum exemplo abaixo é um passo a passo de ataque — para isso,
veja o [catálogo de vulnerabilidades](../../README.md) e o
[relatório de pentest](../../pentest-report/relatorio-pentest-aurora-chamados.md).

## A) Controle de acesso quebrado

"Controle de acesso" é a parte do sistema que decide **quem pode ver ou fazer
o quê**. Quando essa checagem falta ou está incompleta, qualquer pessoa
autenticada — às vezes nem isso — consegue agir fora do que deveria.

- **IDOR (Insecure Direct Object Reference).** Acontece quando um sistema usa
  um identificador simples (como `/chamados/7`) para buscar um registro, sem
  checar se quem está pedindo é dono daquele registro. Trocar o número na URL
  já basta para ver dados de outra pessoa. No Aurora Chamados, isso expõe
  dados pessoais (telefone, CPF) de clientes que nunca abriram aquele chamado.
- **Controle de acesso quebrado por papel.** Parecido com o IDOR, mas em vez
  de "é seu ou não é", a pergunta é "seu papel permite isso?". Um sistema com
  papéis de cliente/agente/administrador precisa checar o papel **a cada
  chamada, no servidor** — nunca confiar em uma tela que simplesmente não
  mostra o botão de admin para quem não é admin, porque nada impede alguém de
  chamar a mesma rota diretamente.
- **Escalonamento de privilégio.** A versão mais grave do item anterior:
  quando o próprio usuário consegue *se promover* — por exemplo, editando o
  próprio perfil e simplesmente enviando `"papel": "admin"` num campo que a
  tela normalmente não exibe, mas que a API aceita sem checar quem está
  perguntando.

**Por que acontece:** é fácil implementar a busca ou a edição "que funciona"
e esquecer da pergunta seguinte — "mas isso deveria estar disponível para
*esta* pessoa?". Um assistente de IA, ao gerar uma rota, tende a resolver o
problema literal ("busque o chamado pelo id") sem adicionar essa segunda
camada, a menos que o pedido explicitamente inclua "e verifique o dono".

## B) Injeção

"Injeção" é a família de falhas onde um dado que deveria ser só **texto** (um
nome, uma busca, um parâmetro) acaba sendo **interpretado como comando** por
algum sistema por trás da aplicação — banco de dados, sistema operacional,
etc. — porque o dado do usuário foi colado diretamente onde um comando é
montado, em vez de ser tratado como valor puro.

- **SQL Injection.** Quando a aplicação monta uma consulta ao banco colando
  o texto do usuário direto na string SQL:

  ```js
  // Inseguro: o texto do usuário vira parte do comando SQL
  db.query(`SELECT * FROM chamados WHERE titulo ILIKE '%${busca}%'`);
  ```

  Se `busca` puder conter aspas e palavras-chave SQL, quem pesquisa também
  pode reescrever a lógica da consulta — inclusive lendo tabelas inteiras que
  nada tinham a ver com a busca original. A correção é sempre a mesma:
  **consulta parametrizada**, onde o valor do usuário nunca é misturado ao
  texto do comando:

  ```js
  // Seguro: o valor é um parâmetro, nunca faz parte do comando
  db.query(`SELECT * FROM chamados WHERE titulo ILIKE $1`, [`%${busca}%`]);
  ```

- **Command Injection.** A mesma ideia, mas contra o sistema operacional em
  vez do banco: quando a aplicação monta um comando de shell colando dado do
  usuário — por exemplo, para gerar um arquivo com um nome escolhido pelo
  cliente. Um caractere especial de shell (`;`, `&&`, `` ` ``) rompe o
  comando pretendido e executa outro no lugar, com os mesmos privilégios do
  processo da aplicação. É geralmente **mais grave** que SQL Injection,
  porque o resultado não é "ler dados a mais": é rodar qualquer programa no
  servidor.

**Por que acontece:** concatenar string é a forma mais óbvia e "direta" de
montar uma consulta ou comando — é literalmente o que alguém pediria em
português ("monte uma busca com esse texto") e o que uma IA sem instrução
explícita de segurança tende a gerar primeiro.

## C) Autenticação fraca

Autenticação é o processo de provar quem você é (normalmente, login e senha)
e manter essa prova válida por um tempo (normalmente, um token). Várias
decisões pequenas, cada uma aparentemente inofensiva, se somam para
enfraquecer essa garantia:

- **Hash de senha fraco.** Senhas nunca devem ser guardadas em texto puro,
  mas também não basta "embaralhar" com qualquer função — algoritmos antigos
  como MD5 ou SHA1 são rápidos demais e podem ser quebrados por força bruta
  ou tabelas pré-computadas caso o banco vaze. O padrão atual é usar
  algoritmos feitos *de propósito* para serem lentos (Argon2, bcrypt).
- **Segredo de assinatura previsível.** Um token de sessão moderno (JWT) é
  assinado com uma chave secreta conhecida só pelo servidor. Se essa chave for
  um valor padrão hardcoded no código-fonte — especialmente em um projeto de
  código aberto — ela deixa de ser secreta, e qualquer pessoa pode assinar um
  token falso alegando ser administrador.
- **Verificação de token incompleta.** Bibliotecas de JWT permitem escolher
  quais algoritmos de assinatura aceitar. Não fixar essa lista explicitamente
  abre margem para truques de "confusão de algoritmo", onde um token
  manipulado é aceito por um caminho de verificação diferente do pretendido.
- **Sem limite de tentativas (rate limit).** Sem um freio no número de
  tentativas de login por IP ou conta, um atacante pode testar milhares de
  senhas por minuto — a única defesa vira a senha em si ser forte o
  suficiente para resistir sozinha, o que é pedir demais.

**Por que acontece:** cada um desses itens, isolado, parece um detalhe menor
("é só um valor padrão para desenvolvimento", "vou adicionar rate limit
depois"). O problema é que autenticação é o portão de entrada de tudo — um
descuido aqui anula qualquer cuidado tomado em outro lugar do sistema.

## D) Exposição de informação e artefatos esquecidos

Nem toda falha é uma "porta destrancada" — algumas são informação que nunca
deveria ter saído, ou uma porta que deveria ter sido removida antes da mudança
para produção.

- **Fingerprinting.** Endpoints de diagnóstico (versão da aplicação, lista de
  dependências) são úteis durante o desenvolvimento, mas se expostos
  publicamente entregam de bandeja ao atacante exatamente quais versões — e
  portanto quais vulnerabilidades conhecidas — tentar explorar primeiro.
- **Artefato esquecido em produção.** Páginas, painéis ou rotas criadas para
  uso interno da própria equipe (não do cliente) às vezes seguem para
  produção sem querer e sem nenhuma autenticação, porque "ninguém vai achar o
  caminho". Esconder uma rota (inclusive tentando bloqueá-la via
  `robots.txt`, pensado para buscadores, não para segurança) não é controle
  de acesso — é apenas adiar a descoberta.

**Por que acontece:** informação de diagnóstico e painéis internos costumam
ser criados sob a lógica de "isso é só para nós", sem o mesmo rigor aplicado
às telas voltadas ao cliente — e frequentemente sobrevivem ao deploy porque
ninguém tem a tarefa explícita de removê-los antes de ir para produção.

## E) Disponibilidade (negação de serviço)

Nem toda vulnerabilidade rouba dados — algumas apenas **derrubam** o serviço.
Um "DoS" (Denial of Service) explora um caso extremo ou malformado de entrada
que o código não trata corretamente, fazendo o processo travar ou
consumir todos os recursos disponíveis (memória, disco, CPU) até parar de
responder para todo mundo, não só para quem enviou a entrada.

**Por que acontece:** é comum testar um recurso (como upload de arquivo)
apenas com entradas "normais" — um arquivo de tamanho razoável, bem formado —
e nunca com entradas deliberadamente quebradas ou excessivas, que é
justamente o que um atacante tenta primeiro.

## F) Cadeia de suprimentos (dependências)

Praticamente nenhum projeto moderno escreve todo o próprio código do zero —
a maior parte vem de bibliotecas de terceiros (dependências). Isso é normal e
necessário, mas transfere risco: o código de terceiros roda com a mesma
confiança que o seu próprio.

- **Dependência com vulnerabilidade conhecida (CVE).** Bibliotecas têm bugs,
  como qualquer software, e às vezes esses bugs viram falhas de segurança
  catalogadas publicamente (um "CVE"). Ficar numa versão antiga depois que a
  correção já existe é uma escolha — deliberada ou por simples falta de
  processo de atualização.
- **Dependência maliciosa (slopsquatting/backdoor).** Mais grave e mais
  difícil de perceber: um pacote instalado que, além de fazer o que promete,
  contém código malicioso escondido — por exemplo, uma "porta dos fundos" de
  autenticação. "Slopsquatting" é quando esse pacote tem um nome plausível o
  bastante (parecido com uma biblioteca legítima de observabilidade, por
  exemplo) para ser sugerido ou aceito sem ninguém ler o código-fonte antes de
  instalar. Diferente de uma dependência com CVE, aqui **não existe alerta
  automático possível** — nenhuma ferramenta de checagem de vulnerabilidades
  conhecidas encontra um problema que nunca foi catalogado. Só observar o
  comportamento em produção (o guia 4 explica como) tem chance de pegar.

**Por que acontece:** confiar automaticamente no nome de um pacote é natural
— ninguém lê o código-fonte de cada uma das centenas de dependências de um
projeto típico. Um assistente de IA pode inclusive sugerir o nome de um
pacote pelo padrão do que "parece" a biblioteca certa, sem nenhuma garantia
de que ela realmente existe do jeito esperado ou é confiável.

## G) Configuração de infraestrutura

Nem toda vulnerabilidade mora no código da aplicação — algumas são decisões
de como o ambiente ao redor dela foi montado.

- **Privilégio concedido sem necessidade.** Dar a um processo mais acesso do
  que ele realmente usa "por via das dúvidas" ou pensando numa funcionalidade
  futura que nunca sai do papel. Se esse processo for comprometido por
  qualquer outra falha, o atacante herda todo o privilégio extra que nunca
  deveria ter sido concedido.
- **Credenciais de acesso a servidor fracas ou reaproveitadas.** O mesmo
  princípio da autenticação fraca (seção C), aplicado a quem administra a
  máquina, não a aplicação: senha fraca ou repetida em um acesso remoto ao
  servidor (SSH, por exemplo) é uma porta de entrada independente de qualquer
  bug de código.

**Por que acontece:** decisões de infraestrutura costumam ser feitas uma vez,
sob pressão de "fazer funcionar agora", e raramente são revisitadas depois —
diferente do código da aplicação, que ao menos passa por commits e, às
vezes, revisão.

---

Com esse vocabulário em mãos, o [guia 3](03-pentest.md) mostra exatamente
onde cada um desses tipos aparece no Aurora Chamados, e o
[guia 4](04-defesa.md) mostra o que consegue (e o que não consegue) detectar
cada um deles em produção.
