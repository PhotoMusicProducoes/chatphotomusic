Sistema PhotoMusic Pro

photomusic-pro/
├── photomusic-pro.php
├── .htaccess
│
├── includes/
│   ├── admin/
│   │   ├── views/
│   │   │   └── evento-operador-view.php
│   │   ├── class-photomusic-ideias-futuras.php
│   │   ├── class-photomusic-projetos.php
│   │   └── class-photomusic-roadmap-menu.php
│   │
│   ├── contratante/
│   │   ├── class-photomusic-aceites.php
│   │   ├── class-photomusic-contratante.php
│   │   ├── class-photomusic-painel-contratante.php
│   │   ├── class-photomusic-permissoes-operador.php
│   │   └── class-photomusic-termo-contratante.php
│   │
│   ├── contratos/
│   │   ├── .htaccess
│   │   ├── class-photomusic-assinatura-admin.php
│   │   ├── class-photomusic-clausulas.php
│   │   ├── class-photomusic-contratos-actions.php
│   │   ├── class-photomusic-contratos-edit.php
│   │   ├── class-photomusic-contratos-email.php
│   │   ├── class-photomusic-contratos-list.php
│   │   ├── class-photomusic-contratos-logs.php
│   │   ├── class-photomusic-contratos-pdf.php
│   │   ├── class-photomusic-contratos-permissoes.php
│   │   ├── class-photomusic-contratos-route.php
│   │   ├── class-photomusic-contratos-shortcode.php
│   │   ├── class-photomusic-contratos-view.php
│   │   ├── class-photomusic-contratos-whatsapp.php
│   │   └── class-photomusic-contratos.php
│   │
│   ├── convites/
│   │   └── class-photomusic-convites.php
│   │
│   ├── core/
│   │   ├── .htaccess
│   │   ├── class-photomusic-access-rules.php
│   │   ├── class-photomusic-admin-menu.php
│   │   ├── class-photomusic-agenda.php
│   │   ├── class-photomusic-config.php
│   │   ├── class-photomusic-contratantes.php
│   │   ├── class-photomusic-events-core.php
│   │   ├── class-photomusic-events.php
│   │   ├── class-photomusic-financeiro.php
│   │   ├── class-photomusic-helpers.php
│   │   ├── class-photomusic-installer.php
│   │   ├── class-photomusic-logs.php
│   │   ├── class-photomusic-token-generator.php
│   │   └── class-photomusic-users.php
│   │
│   ├── empresa/
│   │   ├── class-photomusic-empresa.php
│   │   ├── class-photomusic-helpers-representantes.php
│   │   └── class-photomusic-representantes.php
│   │
│   ├── galeria/
│   │   ├── .htaccess
│   │   ├── templates/
│   │   │   └── galeria.php
│   │   ├── class-photomusic-aceite-endpoint.php
│   │   ├── class-photomusic-aceite-evento.php
│   │   ├── class-photomusic-controller-galeria.php
│   │   ├── class-photomusic-file-endpoint.php
│   │   ├── class-photomusic-galeria-routes.php
│   │   ├── class-photomusic-galeria.php
│   │   └── class-photomusic-gallery-endpoint.php
│   │
│   ├── security/
│   │   └── .htaccess
│   │
│   ├── servicos/
│   │   ├── class-photomusic-itens.php
│   │   ├── class-photomusic-pagamentos.php
│   │   └── class-photomusic-servicos.php
│   │
│   ├── stats/
│   │   └── class-photomusic-stats.php
│   │
│   └── whatsapp/
│       ├── class-photomusic-whatsapp.php
│       └── class-photomusic-whatsapp-settings.php
└── libs/
    └── tcpdf/             
        ├── tcpdf.php
        ├── tcpdf_autoconfig.php
        ├── config/
        ├── include/
        └── fonts/

photomusic-pro.php
.htaccess                               Protege Raiz do plugin — bloqueia acesso direto a qualquer arquivo
pdf-style.css
qrlib.php

Descrualção das Classes
admin/
class-photomusic-ideias-futuras.php     Sistema interno para registrar, priorizar e transformar ideias em projetos  
                                        dentro do PhotoMusic Pro, com controle de acesso, histórico e acompanhamento de execução.
class-photomusic-projetos               Sistema interno para gerenciar projetos derivados de ideias, permitindo 
                                        acompanhar progresso, responsáveis, status e execução dentro do PhotoMusic Pro.                                        
class-photomusic-roadmap-menu.php       Página interna que exibe o roadmap do sistema a partir de um arquivo Markdown
admin/views/
evento-operador-view.php                View do operador para gerenciar serviços, financeiro e contrato do evento.

core/
Arquivo	                                Descrição
.htaccess                               Protege Logs, tokens e regras de acesso
class-photomusic-installer.php	        Cria toda a infraestrutura do banco de dados e permissões. É a base estrutural do sistema.
class-photomusic-events-core.php	    Núcleo de dados dos eventos. Carrega evento completo, histórico, mensagens, serviços e contratante.
class-photomusic-events.php	            Controlador administrativo dos eventos no painel WP. CRUD + interface.
class-photomusic-financeiro.php	        Módulo financeiro central. Registra entradas/saídas e gera resumo financeiro do evento.
class-photomusic-contratantes.php	    Cadastro de contratantes PF/PJ. Criação, atualização e consulta.
class-photomusic-users.php	            Autenticação e autorização. Verifica permissões e acesso do contratante.
class-photomusic-access-rules.php	    Regras de acesso de convidados (token, IP, dispositivo, limite diário, auditoria).
class-photomusic-token-generator.php	Gerador de tokens seguros (curtos, médios, longos, prefixados, expiráveis).
class-photomusic-logs.php	            Sistema de auditoria. Registra logs com IP, navegador, dispositivo e user agent.
class-photomusic-helpers.php	        Funções utilitárias (slug, telefone, hash de dispositivo, debug, SHA256).
class-photomusic-admin-menu.php	        Gerencia menus e submenus do painel WP. Renderiza telas de contratos, eventos, operador, logs e configurações.
class-photomusic-config.php             Painel de configurações do PhotoMusic Pro. Permite vincular a página de    
                                        assinatura de contrato à rota /contrato/{token}/,
                                        com select de páginas, validação de nonce e exibição da URL configurada.
class-photomusic-agenda.php             Calendário mensal de eventos da empresa com indicação
                                        visual de status de contrato, alertas de conflito de
                                        data, resumo do mês e lista detalhada com links diretos.                                                      

contratante/
class-photomusic-contratante.php        Controla o login do contratante, sessão, acesso ao painel e envio do link via 
                                        WhatsApp.
class-photomusic-painel-contratante.php Gerencia o painel do contratante: estatísticas, aceites, serviços, envio de 
                                        links via WhatsApp e exportação de aceites em CSV com acesso seguro.
class-photomusic-termo-contratante.php  Gerencia o termo de responsabilidade do contratante: exibição, aceite com
                                        auditoria (IP, dispositivo, navegador) e bloqueio de acesso até a concordância.
class-photomusic-aceites.php            Registra aceites de convidados via API REST, garantindo 1 aceite por evento por 
                                        pessoa, com auditoria completa (IP, dispositivo, navegador) e relatório por evento.
class-photomusic-permissoes-operador.php Controla as permissões dos operadores: criar, editar, enviar, cancelar, 
                                        assinar contratos e acessar o financeiro.


contratos/
Arquivo	      '                         Descrição 
.htaccess                               Protege PDFs gerados, QR Codes e templates internos
class-photomusic-clausulas.php	        Gerencia cláusulas contratuais (criação, edição, filtros por tags e 
                                        categoria). Base da geração automática de contratos.
class-photomusic-contratos.php	        Classe central de contratos: cria, atualiza, assina, registra logs, salva PDF, 
                                        altera status e gera hash, com permissões aplicadas em todas as ações críticas.
class-photomusic-contratos-pdf.php	    Gera o PDF final do contrato com layout profissional, QR Code local, 
                                        assinaturas e hash, salvando o arquivo no servidor e registrando sua URL pública no banco.
class-photomusic-contratos-route.php    Rota pública /contrato/{token}. Carrega a página do Elementor para exibir o 
                                        contrato ao cliente.
class-photomusic-contratos-shortcode.php  Exibe o contrato publicamente via shortcode e processa a assinatura do 
                                        contratante, atualizando status, logs e gerando o PDF final.
class-photomusic-assinatura-admin.php   Controla a assinatura interna da empresa, validando permissões, registrando 
                                        assinatura e atualizando o status do contrato.
class-photomusic-permissoes-operador.php  Painel para configurar permissões dos operadores (criar, editar, enviar, 
                                        cancelar, assinar contratos e ver financeiro), usando metas do usuário.
class-photomusic-contratos-permissoes.php Middleware de permissões do módulo de contratos. Valida ações, controla 
                                        botões e protege o fluxo de status.
class-photomusic-contratos-list.php     Exibe a tabela de contratos no admin, com botões condicionados às permissões 
                                        do usuário.
class-photomusic-contratos-edit.php     Tela de edição do contrato, com botões condicionados ao status e às 
                                        permissões do usuário.
class-photomusic-contratos-view.php     Exibe o contrato via token e permite assinatura do contratante quando 
                                        aplicável
class-photomusic-contratos-actions.php  Processa todas as ações admin-post do módulo de contratos com validação de 
                                        permissão, status e segurança.
class-photomusic-contratos-logs.php       Registra e exibe logs detalhados de todas as ações realizadas em um contrato.
class-photomusic-contratos-email.php    Envia e-mails automáticos do contrato: envio para assinatura, notificação ao 
                                        admin e envio do PDF final.
class-photomusic-contratos-whatsapp.php Envia automaticamente mensagens de WhatsApp relacionadas ao contrato: link para 
                                        assinatura, notificação ao admin e PDF final via Z-API.

/convites
class-photomusic-convites.php           Cria convites com token seguro, registra acesso inicial e envia 
                                        automaticamente o link da galeria via WhatsApp.

/servicos
class-photomusic-servicos.php             Gerencia serviços, subtipos, pacotes, regras e serviços contratados do evento.
class-photomusic-pagamentos.php           CRUD completo de formas de pagamento usadas nos contratos.
class-photomusic-itens.php                CRUD completo de itens textuais usados nos contratos.

/empresa
class-photomusic-empresa.php              Gerencia os dados institucionais da empresa (razão social, CNPJ, endereço, logo etc.) usados no PDF e nas cláusulas do contrato. Armazena tudo em wp_options e fornece um painel administrativo para edição.
class-photomusic-representantes.php       Gerencia representantes legais que assinam contratos pela empresa, armazenando cargo, CPF, telefone e permissões em wp_usermeta.
class-photomusic-helpers-representantes.php  Helpers para obter dados dos representantes legais, validar permissões e fornecer informações para PDF e cláusulas.

/galeria
.htaccess                                   Protege Arquivos protegidos, tokens e endpoints de acesso
class-photomusic-galeria.php                Controla rotas amigáveis da galeria, valida acessos via token, aplica  
                                            limite diário e delega o carregamento ao controlador principal.            
class-photomusic-controller-galeria.php     Valida token, evento, aceite e dispositivo antes de exibir a galeria 
                                            protegida, registrando logs de acesso.
class-photomusic-gallery-endpoint.php       Endpoint da galeria protegida: valida evento, serviço, aceite e dispositivo 
                                            antes de exibir os links da galeria.
class-photomusic-file-endpoint.php          Entrega arquivos protegidos da galeria após validar token, evento, serviço  
                                            e dispositivo.
class-photomusic-aceite-endpoint.php        Registra aceite via API, gera token seguro e libera acesso à galeria 
                                            protegida.
class-photomusic-aceite-evento.php          Exibe formulário de aceite, registra dispositivo e gera token seguro para 
                                            acesso à galeria.
class-photomusic-galeria-routes.php         Define rotas amigáveis da galeria e direciona para o formulário de aceite 
                                            ou para a galeria protegida.
/galeria/templates
galeria.php                                 Template da galeria protegida com grid de fotos e modal de visualização.

/stats
class-photomusic-stats.php                  Fornece estatísticas de acessos por evento (convidados e contratante) para 
                                            dashboards e relatórios.

/whatsapp
class-photomusic-whatsapp-settings.php      Tela administrativa para configurar provedores e mensagens de WhatsApp
class-photomusic-whatsapp.php               Envia mensagens e PDFs via WhatsApp usando provedores configuráveis.

/security
.htaccess                                   Proteção interna geral das pastas do plugin