VISÃO DE PRODUTO — PhotoMusic Pro
Empresa: PhotoMusic Produções
Segmento: Fotografia de Eventos, Foto Cabine, Plataforma 360°, Totem Fotográfico,
          Foto Lembrança, Foto Paparazzi Digital, Som e DJ
Referência de mercado: empresa mais bem avaliada no Google do Brasil no segmento
=================================================================


=================================================================
FASE 1 — SISTEMA ATUAL (em finalização)
=================================================================
O que está sendo concluído agora para subir ao ar:

Gestão de eventos
   └── CRUD completo de eventos PF e PJ

Contratantes externos
   └── Acesso por token (sem senha)
   └── Termo de aceite por dispositivo
   └── Painel de acompanhamento

Contratos digitais
   └── Geração automática
   └── Assinatura digital com hash
   └── PDF com QR Code
   └── Envio por WhatsApp e e-mail

Galeria protegida
   └── Acesso por token (convidados — somente mobile)
   └── Aceite de termo por convidado
   └── Limite diário de acessos

Sistema de convites
   └── Token seguro por convidado
   └── Envio automático via WhatsApp

Sistema de permissões
   └── photomusic_admin
   └── photomusic_user (operador)
   └── Permissões granulares por ação

Módulo financeiro base
   └── Registro de entradas e saídas por evento
   └── Resumo financeiro do evento

Sistema de logs e auditoria
   └── Registro completo de acessos e ações

Módulo de serviços
   └── Catálogo de serviços, subtipos, pacotes e regras

Módulo de empresa e representantes
   └── Dados institucionais para PDF e cláusulas
   └── Representantes legais para assinatura

WhatsApp integrado
   └── Envio de links, contratos e PDFs via Z-API


=================================================================
FASE 2 — AGENDA DA EMPRESA (Implementada na fase 1)
=================================================================
Prioridade: ALTA — deve entrar logo após a Fase 1 estar rodando

Justificativa:
O sistema já gera contratos e eventos. A agenda é a visualização
natural desses dados. Sem ela, o admin não tem visão do mês.

O que a agenda deve exibir:
   ├── Todos os eventos do mês com data, local e serviços
   ├── Status de cada evento (ativo, contrato assinado, pendente)
   ├── Conflitos de datas (dois eventos no mesmo dia)
   ├── Alertas de eventos sem contrato assinado
   ├── Alertas de pagamentos pendentes próximos à data
   ├── Visão mensal, semanal e por serviço
   └── Exportação para Google Calendar (futuro)

Integração com módulos existentes:
   ├── pm_eventos → fonte de dados principal
   ├── pm_contratos → exibir status do contrato no evento
   └── pm_financeiro_movimentos → exibir status de pagamento

Implementação sugerida:
   └── class-photomusic-agenda.php
   └── Submenu em PhotoMusic → Agenda
   └── Visualização em grade mensal (HTML/CSS puro, sem JS externo)


=================================================================
FASE 3 — SISTEMA FINANCEIRO PROFISSIONAL
=================================================================
Prioridade: ALTA — resolve o maior problema atual da empresa

Objetivo:
Separar completamente as finanças da empresa das finanças pessoais,
profissionalizar o controle financeiro e dar visibilidade total
sobre a saúde financeira da empresa.

Módulo 3.1 — Controle de recebimentos de clientes
   ├── Registrar parcelas de contratos (2x, 3x no pix etc.)
   ├── Vincular cada parcela a um evento e contrato
   ├── Status de cada parcela: pendente / pago / atrasado
   ├── Alertas automáticos via WhatsApp:
   │       ├── 5 dias antes do vencimento → lembrete ao cliente
   │       ├── 1 dia antes → segundo aviso
   │       ├── No dia → aviso final
   │       └── Após o dia → notificação de atraso
   ├── Operador e admin confirmam recebimento no sistema
   ├── Registro de método: pix, cartão, dinheiro, boleto
   └── Para cartão: aguardar confirmação manual (integração futura)

Módulo 3.2 — Controle de despesas da empresa
   ├── Categorias de despesa:
   │       ├── Colaboradores (cachê, diária, transporte)
   │       ├── Logística (estacionamento, combustível, pedágio)
   │       ├── Insumos (papel, envelope, tinta, consumíveis)
   │       ├── Equipamentos (compra, manutenção, atualização)
   │       ├── Veículo (manutenção, seguro, financiamento)
   │       ├── Impostos e taxas (MEI, DAS, ISS, taxas bancárias)
   │       ├── Marketing (anúncios, materiais, site)
   │       ├── Assinaturas (sistemas, apps, ferramentas)
   │       └── Outros
   ├── Vincular despesa a evento (custo operacional do evento)
   ├── Vincular despesa a categoria geral (custo fixo da empresa)
   └── Relatório de margem por evento (receita - despesas do evento)

Módulo 3.3 — Controle de contas a pagar da empresa
   ├── Registrar parcelamentos (ex: impressora DNP)
   ├── Alertas automáticos internos:
   │       ├── 10 dias antes → aviso no painel
   │       ├── 5 dias antes → aviso + WhatsApp para admin
   │       └── No dia → alerta urgente
   ├── Status: pendente / pago / atrasado
   └── Histórico de pagamentos da empresa

Módulo 3.4 — Dashboard financeiro
   ├── Receita total do mês
   ├── Despesas totais do mês
   ├── Lucro líquido do mês
   ├── Receita prevista (eventos futuros com contrato)
   ├── Recebimentos pendentes
   ├── Contas a pagar pendentes
   ├── Gráfico mensal de receita x despesa
   └── Comparativo por período

Módulo 3.5 — Integração com plataformas de pagamento (futuro)
   ├── Pix automático (Mercado Pago, Asaas, PagSeguro)
   ├── Cartão de crédito
   ├── Boleto bancário
   ├── Link de pagamento gerado automaticamente no contrato
   └── Webhook para confirmação automática de pagamento

Implementação sugerida:
   ├── class-photomusic-financeiro-parcelas.php
   ├── class-photomusic-financeiro-despesas.php
   ├── class-photomusic-financeiro-contas-pagar.php
   ├── class-photomusic-financeiro-dashboard.php
   └── class-photomusic-financeiro-alertas.php (cron job WP)


=================================================================
FASE 4 — GERADOR DE ORÇAMENTOS
=================================================================
Prioridade: ALTA — elimina trabalho manual e profissionaliza a venda

O que o gerador deve fazer:
   ├── Receber dados do cliente (nome, evento, serviço, horas, etc.)
   ├── Aplicar regras de preço por serviço
   ├── Aplicar regras por horas contratadas
   ├── Aplicar regras por tipo de celebração
   ├── Aplicar regras por quantidade de convidados
   ├── Aplicar regras por dias de evento
   ├── Calcular deslocamento (km × valor/km)
   ├── Aplicar combos e descontos automáticos
   ├── Gerar PDF profissional com:
   │       ├── Apresentação da empresa
   │       ├── Fotos dos serviços
   │       ├── Tabela de preços e pacotes
   │       ├── Condições comerciais
   │       ├── Link de contratação
   │       └── QR Code de pagamento
   ├── Enviar automaticamente por WhatsApp e e-mail
   └── Registrar no histórico de orçamentos

Integração com ChatBot PhotoMusic Pro:
   ├── Quando cliente corporativo informa horas > 6 ou dias > 1,
   │   o chatbot envia os dados via API para o PhotoMusic Pro
   ├── O sistema gera o orçamento personalizado automaticamente
   └── Envia para o cliente sem intervenção manual

Templates de orçamento por serviço:
   ├── Foto Cabine (PF e PJ)
   ├── Plataforma 360°
   ├── Totem Fotográfico
   ├── Foto Lembrança Tradicional
   ├── Foto Lembrança Ultra Rápida
   ├── Foto Paparazzi Digital
   ├── Som e DJ
   └── Pacotes combinados

Endpoint de API:
   └── POST /wp-json/photomusic/v1/orcamento
           Recebe dados do cliente e retorna orçamento gerado


=================================================================
FASE 5 — APP PhotoMusicBoot
=================================================================
Prioridade: MÉDIA — app para operar os equipamentos nos eventos

Propósito:
Controlar todos os equipamentos de foto nos eventos de forma
integrada, com IA, impressão automática e galeria ao vivo.

Serviços controlados:
   ├── Foto Cabine
   ├── Totem Fotográfico
   ├── Plataforma 360°
   ├── Foto Paparazzi Digital
   ├── Foto Lembrança Tradicional
   ├── Foto Lembrança Ultra Rápida
   └── Túnel Infinito

Funcionalidades principais:
   ├── Captura automática e manual
   ├── Aplicação de molduras e templates
   ├── IA para:
   │       ├── Remoção e substituição de fundo
   │       ├── Roupas e fantasias geradas por IA
   │       └── Edição automática (cor, nitidez, pele)
   ├── Impressão automática (DNP, térmica, fotográfica)
   │       └── Tamanhos: 10x15, tirinha, 15x20
   ├── Upload automático para galeria do evento no PhotoMusic Pro
   ├── Modo offline com sync ao reconectar
   ├── Painel do operador no evento
   └── Painel do cliente (acesso ao vivo)

Integração com PhotoMusic Pro:
   ├── Autenticação via token do evento
   ├── Upload direto para a galeria do evento
   ├── Registro de estatísticas em tempo real
   └── Controle de dispositivos autorizados

Modelo de negócio do app:
   ├── Uso interno da PhotoMusic Produções (fase 1)
   └── Licenciamento para outras empresas (fase SaaS)


=================================================================
FASE 6 — APP PhotoMusicImagens
=================================================================
Prioridade: MÉDIA — ferramenta de criação de molduras

Propósito:
Criar, editar e gerenciar molduras para todos os serviços
do PhotoMusicBoot, substituindo ferramentas externas (Canva, PS).

Funcionalidades:
   ├── Editor visual de molduras (arrastar e soltar)
   ├── Biblioteca de elementos (logos, ícones, fontes)
   ├── Templates por tipo de celebração (aniversário, casamento, etc.)
   ├── Exportação nos formatos aceitos pelo PhotoMusicBoot
   ├── Sincronização automática com o PhotoMusicBoot
   ├── Versionamento (guardar histórico de molduras)
   └── Marketplace de molduras (futuro — comprar/vender designs)


=================================================================
FASE 7 — MODELO SaaS (vender acesso para outras empresas)
=================================================================
Prioridade: ESTRATÉGICA — o maior objetivo de longo prazo

Visão:
O PhotoMusic Pro se tornará o primeiro sistema de gestão
completo para empresas de eventos e foto cabine desenvolvido
no Brasil, por quem tem 14 anos de experiência no mercado.

Diferencial competitivo:
   ├── 100% em português com suporte brasileiro
   ├── Desenvolvido por quem usa o sistema no dia a dia
   ├── 14 anos de experiência no segmento
   ├── Integração nativa com WhatsApp (Z-API, Evolution)
   ├── Fluxo completo: orçamento → contrato → evento → galeria → financeiro
   ├── Sistema de foto (PhotoMusicBoot) integrado nativamente
   └── Suporte e atualizações contínuas

Concorrentes atuais:
   ├── dslrBooth (americano, sem suporte em português)
   ├── LumaBooth (americano, sem suporte em português)
   └── Adobe (corporativo, caro, genérico)

Público-alvo do SaaS:
   ├── Empresas de foto cabine
   ├── Empresas de totem fotográfico
   ├── Empresas de plataforma 360°
   ├── Fotógrafos de eventos
   ├── Agências de eventos
   ├── Produtoras de eventos
   └── Empresas de som e DJ

Modelo de assinatura (referência: Adobe, Microsoft):
   ├── Plano Starter — gestão básica de eventos e contratos
   ├── Plano Professional — + financeiro + orçamentos
   ├── Plano Business — + PhotoMusicBoot + múltiplos usuários
   └── Plano Enterprise — + API + white label + suporte dedicado

Potencial de mercado:
   ├── O mercado de eventos no Brasil é um dos maiores do mundo
   ├── Não existe sistema nacional completo e integrado
   ├── A demanda por digitalização de pequenas empresas cresce
   └── Com 14 anos de experiência, a PhotoMusic tem credibilidade
       para liderar esse mercado


=================================================================
ORDEM SUGERIDA DE DESENVOLVIMENTO
=================================================================

AGORA    → Subir Fase 1 (sistema atual) e testar em produção
PRÓXIMO  → Fase 2: Agenda da empresa (rápido de implementar,
            alto impacto no dia a dia)
DEPOIS   → Fase 3: Sistema financeiro profissional
            (resolve o problema mais urgente da empresa)
DEPOIS   → Fase 4: Gerador de orçamentos
            (elimina trabalho manual na venda)
FUTURO   → Fase 5: App PhotoMusicBoot
FUTURO   → Fase 6: App PhotoMusicImagens
FUTURO   → Fase 7: Modelo SaaS


=================================================================
RESPOSTA À PERGUNTA: "ESSA IDEIA VAI TRAZER LUCRO?"
=================================================================

Sim. Com convicção.

Motivos objetivos:

1. O problema é real e não resolvido no Brasil
   Todas as empresas de foto cabine, totem e plataforma 360°
   usam sistemas americanos sem suporte em português, sem
   integração com WhatsApp e sem adaptação ao mercado brasileiro
   (nota fiscal, PIX, MEI, LGPD).

2. A barreira de entrada é alta
   Construir um sistema como esse leva anos. A PhotoMusic já
   está construindo. Isso vira um ativo valioso.

3. O modelo SaaS gera receita recorrente
   Uma empresa com 50 clientes pagando R$300/mês = R$15.000/mês
   Com 200 clientes = R$60.000/mês
   Com 500 clientes = R$150.000/mês

4. A credibilidade já existe
   14 anos de mercado + melhor avaliada no Google do Brasil =
   autoridade para lançar um produto para o segmento.

5. O sistema resolve DOR real
   Finanças misturadas, orçamentos manuais, contratos em papel,
   galerias no Google Drive — tudo isso é dor que as empresas
   do segmento sentem todos os dias.

O risco está na execução, não na ideia.
A ideia é sólida. O mercado existe. A experiência está lá.
