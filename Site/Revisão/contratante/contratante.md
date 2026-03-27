PhotoMusic_Contratante
   ├── init()
   │       ├── add_shortcode(acesso_contratante)
   │       ├── add_action(processar_login)
   │       └── add_action(ensure_session)
   │
   ├── ensure_session()
   │
   ├── is_logged_in(id_evento)
   ├── set_logged_in(id_evento)
   ├── logout()
   │
   ├── render_acesso()
   │       ├── valida evento
   │       ├── valida status
   │       ├── valida termo
   │       ├── se logado → painel
   │       └── exibe formulário
   │
   ├── processar_login()
   │       ├── valida nonce
   │       ├── valida senha
   │       ├── valida evento
   │       ├── valida status
   │       ├── valida senha do evento
   │       ├── registra login
   │       ├── carrega serviços
   │       └── redireciona painel
   │
   └── enviar_whatsapp_contratante()
           ├── busca contratante
           ├── valida telefone
           ├── monta mensagem
           ├── PhotoMusic_WhatsApp::send()
           └── retorna resultado


MAPA DE DEPENDÊNCIAS
Depende de:
PhotoMusic_Events
PhotoMusic_Termo_Contratante
PhotoMusic_Services
PhotoMusic_Contratantes
PhotoMusic_Logs
PhotoMusic_WhatsApp

Usa:
sessão PHP
shortcode
hooks WP
redirecionamento WP
nonce WP

DESCRIÇÃO OFICIAL
Gerencia todo o fluxo de autenticação do contratante no PhotoMusic Pro.
Controla login por senha do evento, sessão, permissões, carregamento de serviços ativos e redirecionamento para o painel do contratante.
Integra com o módulo de termos obrigatórios, logs, eventos e WhatsApp, garantindo segurança e rastreabilidade completa.