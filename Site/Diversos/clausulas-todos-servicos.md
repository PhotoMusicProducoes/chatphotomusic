# CLÁUSULAS PARA CADASTRO — PHOTOMUSIC PRO
Siga a ordem dos campos do formulário para cada cláusula.
Cole o TEXTO no editor Visual do campo "Texto da Cláusula".

NOVA SINTAXE DE BLOCOS CONDICIONAIS:
  {if:tag}          texto aparece só se o serviço tiver essa tag   {/if:tag}
  {if:tag1|tag2}    aparece se tiver tag1 OU tag2                  {/if:tag1|tag2}
  {ifnot:tag}       aparece só se NÃO tiver essa tag               {/ifnot:tag}

TAGS DISPONÍVEIS:
  foto-cabine-premium | foto-cabine-gold | foto-cabine-tirinha
  totem-premium | totem-gold | totem-tirinha
  plataforma-360 | som-dj | fotografia
  foto-lembranca | foto-paparazzi | guestbook
  aniversario | casamento | formatura | corporativo | bodas
=================================================================


=================================================================
CLÁUSULAS — TOTAL: 12  (de 25 anteriores → menos 13)
Resultado da consolidação com blocos condicionais
=================================================================


---
Título:    DO OBJETO DO CONTRATO
Ordem:     1
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

O presente contrato tem como objeto principal {lista_servicos}, conforme combinado entre as partes.

Para evento a ser realizado na data de <strong>{data_evento}</strong>, das <strong>{horario_inicio}</strong> às <strong>{horario_fim}</strong> horas, no <strong>{local_evento}</strong>.

Contato do Salão: {contato_salao}
{ifnot:corporativo}
Cerimonialista: {contato_cerimonialista}
{/ifnot:corporativo}
{if:corporativo}
Responsável pelo Evento: {contato_responsavel}
{/if:corporativo}


---
Título:    DAS OBRIGAÇÕES DA CONTRATADA
Ordem:     2
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

A <strong>CONTRATADA</strong> compromete-se a chegar ao local do evento com antecedência, a fim de arrumar os equipamentos para o início do evento.

{if:foto-cabine-premium|foto-cabine-gold}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes e imprimir durante o evento as fotografias em papel fotográfico tamanho 10 x 15 cm ou 5 x 15 cm, com gramatura de 260g, na quantidade acima especificada.
{/if:foto-cabine-premium|foto-cabine-gold}

{if:foto-cabine-tirinha}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes e imprimir durante o evento as fotografias em papel fotográfico tamanho 5 x 15 cm, com gramatura de 260g, na quantidade acima especificada.
{/if:foto-cabine-tirinha}

{if:totem-premium|totem-gold}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes e imprimir durante o evento as fotografias em papel fotográfico tamanho 10 x 15 cm ou 5 x 15 cm, com gramatura de 260g, na quantidade acima especificada.
{/if:totem-premium|totem-gold}

{if:totem-tirinha}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes e imprimir durante o evento as fotografias em papel fotográfico tamanho 5 x 15 cm, com gramatura de 260g, na quantidade acima especificada.
{/if:totem-tirinha}

{if:plataforma-360}
A <strong>CONTRATADA</strong> se obriga a filmar os participantes com giro de 360° durante o evento e disponibilizar o vídeo através de QR Code. Ficará sob responsabilidade da <strong>CONTRATADA</strong> disponibilizar o QR Code para que os participantes tenham acesso aos vídeos produzidos no evento, salvo algum motivo de força maior.
{/if:plataforma-360}

{if:fotografia}
As fotos do serviço de cobertura fotográfica serão enviadas via link OneDrive.com ou Google Drive.com, no prazo de até <strong>10 dias úteis</strong> após o evento, em alta resolução (somente em formato JPG). Todas as fotos passarão por um processo de edição.
<strong>Outro horário, que não seja o acordado neste contrato, será cobrado a taxa de R$200,00. O mesmo deverá consultar a disponibilidade da Contratada.</strong>
{/if:fotografia}

{if:foto-paparazzi}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes durante o evento e aplicar uma moldura personalizada no tamanho 1080 x 1080 pixels. Ficará sob responsabilidade da <strong>CONTRATADA</strong> a entrega de todo o material aos participantes durante o evento, salvo algum motivo de força maior.
{/if:foto-paparazzi}

{if:foto-lembranca}
A <strong>CONTRATADA</strong> se obriga a fotografar os participantes e imprimir durante o evento as fotografias em papel fotográfico tamanho 10 x 15 cm, com gramatura de 260g, na quantidade contratada. Ficará sob responsabilidade da <strong>CONTRATADA</strong> a entrega de todo o material contratado, salvo algum motivo de força maior.
{/if:foto-lembranca}

{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha}
Ficará sob responsabilidade da <strong>CONTRATADA</strong> a entrega de todo o material contratado aos participantes durante o evento, salvo algum motivo de força maior.
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha}

{if:som-dj}
A <strong>CONTRATADA</strong> fornecerá o seguinte brinde:
<ul><li>Iluminação, Laser e Máquina de Fumaça.</li></ul>
Haverá tolerância de no máximo 20 (vinte) minutos de atraso para a realização dos serviços. Não sendo respeitado o tempo de tolerância, ficará a escolha da <strong>CONTRATADA</strong> o cancelamento do serviço ou a espera condicionada ao pagamento de 10% (dez por cento) sobre o valor contratado a cada 30 (trinta) minutos de atraso.
<strong>Outro horário, que não seja o acordado neste contrato, será cobrado a taxa de R$100,00. O mesmo deverá consultar a disponibilidade da Contratada.</strong>
{/if:som-dj}

Fazem parte ainda os seguintes serviços <strong>GRATUITOS</strong>:
<ul>
<li>Frete;</li>
{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360}
<li>Mini Camarim Maluco;</li>
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360}
{if:plataforma-360}
<li>Iluminação, Laser e Máquina de Fumaça;</li>
<li>Foto Paparazzi Digital.</li>
{/if:plataforma-360}
{if:foto-lembranca}
<li>Fotos digitais disponibilizadas via OneDrive.com.</li>
{/if:foto-lembranca}
</ul>

{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha}
<strong>As placas e acessórios do camarim são exclusivamente para os convidados serem fotografados dentro da Cabine. Caso os convidados utilizem pela festa e joguem no chão serão guardados.</strong>
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha}

{if:totem-premium|totem-gold|totem-tirinha}
<strong>As placas e acessórios do camarim são exclusivamente para os convidados serem fotografados no Totem Fotográfico. Caso os convidados utilizem pela festa e joguem no chão serão guardados.</strong>
{/if:totem-premium|totem-gold|totem-tirinha}

{if:plataforma-360}
<strong>As placas e acessórios do camarim são exclusivamente para os convidados serem filmados na Plataforma 360°. Caso os convidados utilizem pela festa e joguem no chão serão guardados.</strong>
{/if:plataforma-360}

{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}
Todas as fotos {if:plataforma-360}e vídeos {/if:plataforma-360}serão divulgadas em nosso site (https://photomusic.com.br/portfolio/).
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}

---
Título:    DAS OBRIGAÇÕES DO CONTRATANTE
Ordem:     3
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

Ficarão sob responsabilidade do <strong>CONTRATANTE</strong> os auxílios necessários para execução dos trabalhos, tais como:

<ul>
<li>Informar ao responsável do estabelecimento onde ocorrerá o evento sobre a contratação de nosso serviço, para que se reserve o local onde será montada nossa estrutura (em local coberto e iluminado, com fonte de energia elétrica).</li>
<li>Preparação de local seguro e adequado à montagem e funcionamento dos equipamentos. <u>Somente local coberto!</u></li>
<li>Reservar duas cadeiras para acomodar a equipe PhotoMusic.</li>
{if:som-dj}
<li>Uma cadeira para acomodar o DJ.</li>
<li>Escolha dos ritmos que serão tocados pelo DJ durante o evento.</li>
{/if:som-dj}
{if:foto-lembranca}
<li>Escolha do tema (moldura) e texto a ser impresso nas fotos.</li>
<li>Entrega e distribuição de vale-fotos aos convidados.</li>
<li>Reservar duas mesas para os equipamentos de impressão.</li>
{/if:foto-lembranca}
<li>Organização dos participantes.</li>
</ul>

Será responsabilidade do <strong>CONTRATANTE</strong> <u>o pagamento de estacionamento</u> e/ou ingressos, no caso de eventos realizados em clubes, centros de exposição, pontos turísticos ou quaisquer locais que cobrem estacionamento em seu interior e/ou ingressos.

O <strong>CONTRATANTE</strong> deverá efetuar corretamente os pagamentos à <strong>CONTRATADA</strong>, conforme cláusula de Preço e Forma de Pagamento.


---
Título:    DO GUEST BOOK
Ordem:     4
Tipo:      Geral
Categoria: Ambos
Tags:      guestbook
Ativa:     ✅
---
Texto:

Faz parte deste contrato o fornecimento de um <strong>Guest Book</strong> de 30 x 40 cm com 30 páginas, a ser utilizado como livro de assinaturas, onde os convidados poderão colar uma cópia de foto e deixar uma dedicatória ao(à) aniversariante/casal.


---
Título:    DA EXECUÇÃO DOS SERVIÇOS
Ordem:     5
Tipo:      Serviço
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

{if:foto-cabine-premium}
Na cabine, até 6 convidados escolhem o tamanho da foto — foto retrato 10 x 15 cm ou foto tirinha 5 x 15 cm — e iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 10 x 15 (até 4 cópias) ou 5 x 15 Tirinha (até 6 cópias). No interior da cabine os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao saírem da cabine. <strong>Entrada das crianças na cabine, somente com o responsável.</strong>
{/if:foto-cabine-premium}

{if:foto-cabine-gold}
Na cabine, até 6 convidados escolhem o tamanho da foto — foto retrato 10 x 15 cm ou foto tirinha 5 x 15 cm — e iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 10 x 15 (1 cópia) ou 5 x 15 Tirinha (2 cópias). No interior da cabine os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao saírem da cabine. <strong>Entrada das crianças na cabine, somente com o responsável.</strong>
{/if:foto-cabine-gold}

{if:foto-cabine-tirinha}
Na cabine, até 4 convidados iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 5 x 15 Tirinha (até 4 cópias). No interior da cabine os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao saírem da cabine. <strong>Entrada das crianças na cabine, somente com o responsável.</strong>
{/if:foto-cabine-tirinha}

{if:totem-premium}
No Totem Fotográfico, até 6 convidados escolhem o tamanho da foto — foto retrato 10 x 15 cm ou foto tirinha 5 x 15 cm — e iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 10 x 15 (até 4 cópias) ou 5 x 15 Tirinha (até 6 cópias). Na frente do Totem os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao encerrarem a sessão. <strong>As crianças serão fotografadas no Totem somente com o responsável.</strong>
{/if:totem-premium}

{if:totem-gold}
No Totem Fotográfico, até 6 convidados escolhem o tamanho da foto — foto retrato 10 x 15 cm ou foto tirinha 5 x 15 cm — e iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 10 x 15 (1 cópia) ou 5 x 15 Tirinha (2 cópias). Na frente do Totem os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao encerrarem a sessão. <strong>As crianças serão fotografadas no Totem somente com o responsável.</strong>
{/if:totem-gold}

{if:totem-tirinha}
No Totem Fotográfico, até 4 convidados iniciam uma sequência de 4 fotos com poses diferentes. As fotos serão reveladas em uma única moldura personalizada no tamanho 5 x 15 Tirinha (até 4 cópias). Na frente do Totem os convidados fazem todo o processo através de um monitor touch screen. As fotos são reveladas em equipamento profissional de alta qualidade, sendo entregues aos convidados ao encerrarem a sessão. <strong>As crianças serão fotografadas no Totem somente com o responsável.</strong>
{/if:totem-tirinha}

{if:plataforma-360}
Na Plataforma Giro 360°, até 4 convidados iniciam uma sequência de 2 fotos (Foto Paparazzi Digital) e em seguida fazem a filmagem com giro 360° com muita animação e diversão. Após descerem da Plataforma, serão disponibilizados a foto digital personalizada e o vídeo 360° com a música escolhida pela organização do evento para download, através da leitura do QR Code, onde receberão o link diretamente no celular. <strong>Entrada das crianças na Plataforma somente com o responsável.</strong>
{/if:plataforma-360}

{if:fotografia}
O serviço de cobertura fotográfica é executado por um fotógrafo profissional durante o período contratado, registrando os melhores momentos do evento. As fotografias serão editadas e entregues via link OneDrive.com dentro do prazo estabelecido.
{/if:fotografia}

{if:foto-paparazzi}
A Foto Paparazzi Digital é executada por um Fotógrafo volante no evento ou fixo em local preestabelecido pelo <strong>CONTRATANTE</strong>. Os convidados iniciam uma sequência de 2 fotos com poses diferentes. As fotos passam por edição automática com moldura personalizada alinhada ao tema e cores da festa. A entrega é pela leitura do QR Code, permitindo download imediato das imagens e GIFs animados. Caso se queira contratar mais uma hora, será cobrado o valor de <strong>R$ 300,00</strong> por hora adicional.
{/if:foto-paparazzi}

{if:foto-lembranca}
A <strong>CONTRATADA</strong> irá fotografar os participantes durante o período contratado e aplicar digitalmente uma moldura personalizada, imprimindo em papel fotográfico tamanho 10 x 15 cm e distribuindo aos participantes. O controle das fotos será através de <strong>vale-fotos</strong>, entregues no momento da fotografia. As fotos impressas serão entregues mediante apresentação do vale-foto. Caso sobrem vale-fotos ao término das atividades, esses não serão ressarcidos, podendo apenas ser usados para impressão de outras fotografias já existentes em nosso arquivo. Caso se queira contratar mais fotos, será cobrada a diferença do pacote de 100 fotos.
{/if:foto-lembranca}

Somente os funcionários da <strong>CONTRATADA</strong> poderão executar serviços técnicos a que se refere esta cláusula.

Os serviços aqui contratados <strong>não incluem</strong>:
<ul>
<li>Publicação de fotos adicionais em nosso Facebook ou site;</li>
<li>Problemas não ligados diretamente aos serviços da CONTRATADA.</li>
</ul>

{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha}
Caso se queira contratar mais uma hora de serviço, será cobrado o valor de <strong>R$ 400,00</strong> para cada hora adicional.
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha}

{if:plataforma-360}
Caso se queira contratar mais uma hora de Plataforma 360°, será cobrado o valor de <strong>R$ 300,00</strong> para cada hora adicional.
<strong>Outro horário, que não seja o acordado neste contrato, será cobrado a taxa de R$100,00. O mesmo deverá consultar a disponibilidade da Contratada.</strong>
{/if:plataforma-360}

{if:som-dj}
Caso se queira contratar mais uma hora de Som e DJ, será cobrado o valor de <strong>R$ 300,00</strong> por hora adicional.
{/if:som-dj}

{if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}
A <strong>CONTRATADA</strong> se reserva no direito de inserir na arte das fotografias {if:plataforma-360}e vídeos {/if:plataforma-360}a Página ou Instagram da empresa.
{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}


---
Título:    DA PENDÊNCIA
Ordem:     6
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

A <strong>CONTRATADA</strong> ficará no período contratado a contar da hora de início do serviço. {if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}Portanto é de responsabilidade do <strong>CONTRATANTE</strong> (ou responsável) organizar os participantes, para melhor execução do trabalho dentro do prazo estabelecido.{/if:foto-cabine-premium|foto-cabine-gold|foto-cabine-tirinha|totem-premium|totem-gold|totem-tirinha|plataforma-360|foto-lembranca|foto-paparazzi|fotografia}


---
Título:    DAS CONDIÇÕES — SOM E DJ
Ordem:     6
Tipo:      Geral
Categoria: Ambos
Tags:      som-dj
Ativa:     ✅
---
Texto:

A <strong>CONTRATADA</strong> se reserva no direito de tocar somente os ritmos escolhidos previamente pelo <strong>CONTRATANTE</strong>. Qualquer alteração durante o evento só será realizada com autorização do <strong>CONTRATANTE</strong>.


---
Título:    DO EVENTO — ANIVERSÁRIO
Ordem:     7
Tipo:      Geral
Categoria: Ambos
Tags:      aniversario
Ativa:     ✅
---
Texto:

<ul>
<li>Nome do(a) Aniversariante: <strong>{nome_aniversariante}</strong></li>
<li>Nome dos Pais: <strong>{nome_pais}</strong></li>
<li>Tema da Festa: <strong>{tema_festa}</strong></li>
<li>Cores da Festa: <strong>{cores_festa}</strong></li>
<li>Idade do(a) Aniversariante: <strong>{idade_aniversariante}</strong></li>
<li>Modelo da Foto: <strong>{modelo_foto}</strong></li>
</ul>


---
Título:    DO EVENTO — CASAMENTO
Ordem:     7
Tipo:      Geral
Categoria: Ambos
Tags:      casamento
Ativa:     ✅
---
Texto:

<ul>
<li>Nome dos Noivos: <strong>{nome_noivos}</strong></li>
<li>Cores da Festa: <strong>{cores_festa}</strong></li>
<li>Data do Casamento: <strong>{data_evento}</strong></li>
<li>Modelo da Foto: <strong>{modelo_foto}</strong></li>
</ul>


---
Título:    DO EVENTO — CORPORATIVO
Ordem:     7
Tipo:      Geral
Categoria: Ambos
Tags:      corporativo
Ativa:     ✅
---
Texto:

<ul>
<li>Nome da Empresa: <strong>{nome_empresa_evento}</strong></li>
<li>Nome dos Responsáveis pelo Evento: <strong>{responsaveis_evento}</strong></li>
<li>Tema: <strong>{tema_festa}</strong></li>
<li>Cores da Instituição: <strong>{cores_festa}</strong></li>
<li>Modelo da Foto: <strong>{modelo_foto}</strong></li>
</ul>


---
Título:    DA MUDANÇA DE DATA
Ordem:     8
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

O <strong>CONTRATANTE</strong> tem o direito de mudar a data do evento para uma data anterior ou posterior à descrita nesse contrato, caso haja disponibilidade em nossa agenda.

Se não houver a data pretendida disponível, se faz valer a rescisão contratual por parte do <strong>CONTRATANTE</strong>, como descrito na cláusula de Rescisão Contratual.


---
Título:    DO SINISTRO
Ordem:     9
Tipo:      Responsabilidade
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

Em casos de eventualidades de aspecto coletivo — como Epidemias e Pandemias, incidentes meteorológicos (ex: alagamentos) ou bloqueio de vias (ex: acidentes, tumultos) que não permitam a chegada de nossa equipe ou que gere grande atraso — ambas as partes têm o direito de cancelar o serviço sem ônus algum.

No caso de algum tipo de imprevisto que impeça as impressões durante o evento (ex.: defeito de equipamento, falta de tensão elétrica adequada, falta de local seguro e adequado à montagem e funcionamento dos equipamentos), as fotos serão entregues posteriormente.

A <strong>CONTRATADA</strong> não se responsabiliza por perdas ou danos ocorridos às fotos após a entrega aos participantes.


---
Título:    DA RESCISÃO CONTRATUAL
Ordem:     10
Tipo:      Cancelamento
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

Em caso de descumprimento da cláusula de Preço e Forma de Pagamento pelo(a) <strong>CONTRATANTE</strong>, a <strong>CONTRATADA</strong> poderá, a seu cargo, não cumprir com o serviço até que o(a) CONTRATANTE quite o débito.

Permanecendo o(a) <strong>CONTRATANTE</strong> em mora por prazo superior a 30 (trinta) dias, o contrato automaticamente se resolverá, sem prejuízo das medidas judiciais cabíveis para saldar a dívida.

No caso de resilição deste contrato por parte do(a) <strong>CONTRATANTE</strong>, o que deverá se dar por escrito no prazo de 30 dias que antecede ao evento, o pagamento referente ao agendamento da data não será devolvido pela <strong>CONTRATADA</strong>.

No caso do(a) <strong>CONTRATANTE</strong> já ter realizado o pagamento integral, ou superior a 50% (cinquenta por cento) do valor contratado, a <strong>CONTRATADA</strong> concederá o valor já pago como crédito para outro evento, respeitando o valor atual do serviço, assim como mesmo bairro do evento anterior.


---
Título:    DAS DISPOSIÇÕES GERAIS
Ordem:     11
Tipo:      Geral
Categoria: Ambos
Tags:      (deixar vazio)
Ativa:     ✅
---
Texto:

O(A) CONTRATANTE cede à <strong>CONTRATADA</strong>, gratuitamente, o direito ao uso de imagem do material objeto deste contrato, para fim único de divulgação de seu trabalho, em todos e qualquer meio de comunicação existente, tais como redes sociais, cartões, folders, etc.

Apesar de todo o cuidado dispensado aos equipamentos fotográficos, na eventualidade de falhas, bem como roubo/furto, que prejudique o evento em sua totalidade, ou por motivo de força maior, não seja possível a execução dos serviços contratados, a responsabilidade da <strong>CONTRATADA</strong> se limitará à devolução das importâncias já pagas, nada sendo devido a título indenizatório de qualquer natureza.

Qualquer alteração ou modificação que afete os termos, condições ou especificações deste contrato deverá ser efetuada por escrito com anuência de ambas as partes.