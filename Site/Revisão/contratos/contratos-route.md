DIAGRAMA COMPLETO - includes/contratos/class-photomusic-contratos-route.php

PhotoMusic_Contratos_Route
   ├── init()
   │       ├── add_action('init', add_rewrite_rule)
   │       ├── add_filter('query_vars', add_query_vars)
   │       └── add_action('template_redirect', handle_route)
   │
   ├── add_rewrite_rule()
   │       └── cria rota:
   │           /contrato/{token}
   │           → index.php?pm_contrato_token=$1
   │
   ├── add_query_vars($vars)
   │       ├── adiciona 'pm_contrato_token'
   │       └── return vars
   │
   ├── handle_route()
   │       ├── token = get_query_var('pm_contrato_token')
   │       ├── SE não tem token → return
   │       ├── page_id = get_contrato_page_id()
   │       ├── SE não configurado → wp_die()
   │       ├── echo render_page(page_id)
   │       └── exit
   │
   ├── get_contrato_page_id()
   │       └── return get_option('photomusic_contrato_page')
   │
   └── render_page($page_id)
           ├── força o WP a acreditar que a página atual é $page_id
           │       wp_query->post
           │       wp_query->posts
           │       wp_query->is_page = true
           │       wp_query->is_singular = true
           │       wp_query->is_404 = false
           ├── setup_postdata()
           ├── ob_start()
           ├── include get_page_template()
           └── return buffer


MAPA DAS TABELAS USADAS
Nenhuma tabela acessada diretamente.
A classe apenas:
- lê a opção: photomusic_contrato_page
- redireciona para uma página do Elementor


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_Route
Gerencia a rota pública de visualização de contratos no PhotoMusic Pro.
Registra a URL amigável /contrato/{token}, captura o token via rewrite rule e carrega automaticamente uma página do Elementor configurada para exibir o contrato.
É a ponte entre o contrato gerado no painel administrativo e a visualização pública para o cliente.