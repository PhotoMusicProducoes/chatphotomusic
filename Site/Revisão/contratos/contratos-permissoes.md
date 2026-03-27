DIAGRAMA COMPLETO - includes/contratos/class-photomusic-contratos-permissoes.php

PhotoMusic_Contratos_Permissoes
   ├── init()
   │       ├── add_action('admin_post_pm_criar_contrato', validar_criar)
   │       ├── add_action('admin_post_pm_editar_contrato', validar_editar)
   │       ├── add_action('admin_post_pm_enviar_assinatura', validar_enviar)
   │       ├── add_action('admin_post_pm_cancelar_contrato', validar_cancelar)
   │       │
   │       ├── add_filter('photomusic_contratos_show_btn_criar',    pode_criar)
   │       ├── add_filter('photomusic_contratos_show_btn_editar',   pode_editar)
   │       ├── add_filter('photomusic_contratos_show_btn_enviar',   pode_enviar)
   │       ├── add_filter('photomusic_contratos_show_btn_cancelar', pode_cancelar)
   │       └── add_filter('photomusic_contratos_show_btn_assinar',  pode_assinar)
   │
   ├── PERMISSÕES (UI)
   │       ├── pode_criar()
   │       │       └── retorna pm_criar_contratos == 1
   │       ├── pode_editar()
   │       │       └── retorna pm_editar_contratos == 1
   │       ├── pode_enviar()
   │       │       └── retorna pm_enviar_para_assinatura == 1
   │       ├── pode_cancelar()
   │       │       └── retorna pm_cancelar_contratos == 1
   │       └── pode_assinar()
   │               └── retorna pm_assinar_contratos == 1
   │
   ├── VALIDAÇÕES (BACKEND)
   │       ├── validar_criar()
   │       │       └── SE !pode_criar → wp_die()
   │       ├── validar_editar()
   │       │       └── SE !pode_editar → wp_die()
   │       ├── validar_enviar()
   │       │       └── SE !pode_enviar → wp_die()
   │       └── validar_cancelar()
   │               └── SE !pode_cancelar → wp_die()
   │
   └── VALIDAÇÃO DE STATUS (SEGURANÇA EXTRA)
           ├── validar_status_para_edicao(contrato)
           │       ├── SE status != rascunho → erro
           │       └── SE !pode_editar → erro
           │
           ├── validar_status_para_envio(contrato)
           │       ├── SE status != rascunho → erro
           │       └── SE !pode_enviar → erro
           │
           └── validar_status_para_cancelar(contrato)
                   ├── SE status == assinado → erro
                   └── SE !pode_cancelar → erro


MAPA DAS TABELAS USADAS
wp_usermeta

Metas de permissão
pm_criar_contratos
pm_editar_contratos
pm_enviar_para_assinatura
pm_cancelar_contratos
pm_ver_financeiro
pm_assinar_contratos


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_Permissoes
Classe responsável por centralizar toda a lógica de permissões do módulo de contratos.
Controla quem pode criar, editar, enviar para assinatura interna, cancelar contratos e assinar como empresa.
Integra-se tanto à interface (UI) quanto ao backend (admin-post), garantindo segurança total e evitando que ações críticas sejam executadas por usuários sem permissão.
Também valida o status do contrato antes de permitir qualquer operação sensível.