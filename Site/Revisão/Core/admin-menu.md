DIAGRAMA COMPLETO - includes/core/class-photomusic-admin-menu.php

PhotoMusic_Admin_Menu
   ├── init()
   │       └── add_action('admin_menu', register_submenus)
   │
   ├── register_submenus()
   │       ├── SE current_user_can('pm_ver_eventos'):
   │       │       └── add_submenu_page(
   │       │               parent = photomusic-eventos
   │       │               title = Contratos
   │       │               slug  = photomusic-contratos
   │       │               callback = render_contratos_page
   │       │           )
   │       │
   │       ├── add_submenu_page(null, Detalhes do Contrato, slug photomusic-contrato-detalhes)
   │       │       → render_contrato_detalhes_page
   │       │
   │       ├── add_submenu_page(null, Detalhes do Evento, slug photomusic-evento-detalhes)
   │       │       → render_evento_detalhes_page
   │       │
   │       ├── add_submenu_page(null, Operador do Evento, slug photomusic-evento-operador)
   │       │       → render_evento_operador_page
   │       │
   │       ├── SE can_create_event():
   │       │       └── add_submenu_page(Convites → render_convites_page)
   │       │
   │       ├── SE is_user():
   │       │       └── add_submenu_page(Aceites → render_aceites_page)
   │       │
   │       ├── SE can_view_logs():
   │       │       ├── add_submenu_page(Relatório de Aceites → PhotoMusic_Aceites::render_relatorio)
   │       │       └── add_submenu_page(Logs → render_logs_page)
   │       │
   │       └── SE is_admin():
   │               └── add_submenu_page(Configurações → render_config_page)
   │
   ├── render_contratos_page()
   │       ├── verifica permissão pm_ver_eventos
   │       ├── SELECT contratos + evento (JOIN)
   │       ├── monta tabela:
   │       │       ID
   │       │       Evento
   │       │       Data
   │       │       Status
   │       │       Assinaturas
   │       │       PDF
   │       │       Ações:
   │       │           Ver Contrato (público)
   │       │           Detalhes
   │       │           Ver Evento
   │       └── fim
   │
   ├── render_contrato_detalhes_page()
   │       ├── SE enviar_whatsapp:
   │       │       ├── carrega contrato
   │       │       ├── telefone = PhotoMusic_Events::get_contratante_telefone()
   │       │       ├── PhotoMusic_WhatsApp::send_pdf()
   │       │       └── redirect com whatsapp_ok
   │       │
   │       ├── SE regerar_pdf:
   │       │       ├── gerar_pdf()
   │       │       ├── registrar_log(pdf_regenerado)
   │       │       └── redirect com pdf_ok
   │       │
   │       ├── carrega contrato por ID
   │       ├── carrega evento via Events_Core
   │       ├── exibe:
   │       │       status
   │       │       token
   │       │       PDF (baixar, regerar, enviar WhatsApp)
   │       │       conteúdo do contrato
   │       │       iframe do PDF
   │       └── fim
   │
   ├── render_evento_detalhes_page()
   │       ├── verifica permissão
   │       ├── carrega evento via Events_Core::get_evento_completo()
   │       ├── exibe:
   │       │       ID
   │       │       Motivo
   │       │       Data
   │       │       Status
   │       ├── carrega contrato via PhotoMusic_Contratos::get_by_event()
   │       └── botão Ver Contrato
   │
   ├── render_evento_operador_page()
   │       ├── verifica permissão
   │       ├── carrega ID do evento
   │       ├── inclui arquivo:
   │       │       /admin/views/evento-operador-view.php
   │       └── fim
   │
   ├── enqueue_scripts($hook)
   │       ├── SE hook != photomusic_page_photomusic-evento-operador → return
   │       ├── wp_enqueue_script pm-operador-evento.js
   │       └── wp_localize_script(PM_OPERADOR):
   │               ajax_url
   │               nonce
   │
   └── add_action('admin_enqueue_scripts', enqueue_scripts)


MAPA DAS TABELAS USADAS
pm_contratos
pm_eventos


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Admin_Menu
Gerencia todos os menus e submenus administrativos do PhotoMusic Pro dentro do painel WordPress.  
Controla o acesso às telas de contratos, eventos, operador, convites, aceites, logs e configurações, exibindo cada item conforme as permissões do usuário.
Também renderiza páginas completas de detalhes de contrato, detalhes de evento e painel do operador, além de integrar com WhatsApp e PDF.
É a camada que organiza toda a navegação interna do sistema.

