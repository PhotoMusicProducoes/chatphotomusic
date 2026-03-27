DIAGRAMA COMPLETO — includes/galeria/class-photomusic-galeria.php

PhotoMusic_Galeria
   ├── init()
   │       ├── add_shortcode('photomusic_galeria')
   │       ├── add_action('init', register_routes)
   │       ├── add_filter('query_vars', register_query_vars)
   │       └── add_action('template_redirect', handle_route)
   │
   ├── register_routes()
   │       └── cria rota amigável:
   │           /galeria/{evento_slug}/{servico_slug}/
   │
   ├── register_query_vars()
   │       ├── pm_galeria
   │       ├── evento_slug
   │       └── servico_slug
   │
   ├── handle_route()
   │       ├── verifica pm_galeria = 1
   │       ├── carrega controller-galeria.php
   │       └── delega para PhotoMusic_Galeria_Controller::handle_request()
   │
   └── render_galeria_shortcode()
           ├── valida token
           ├── busca acesso em pm_acessos_galeria
           ├── valida dispositivo (device_hash)
           ├── aplica limite diário de acessos
           ├── atualiza contagem
           └── exibe placeholder da galeria


MAPA DE DEPENDÊNCIAS
Depende de:
PhotoMusic_Galeria_Controller
$wpdb
Tabela: wp_pm_acessos_galeria
Constante PHOTOMUSIC_PRO_PATH

Usa:
add_rewrite_rule()
query_vars
template_redirect
sanitize_text_field()
hash('sha256')
current_time()
wpdb->get_row()
wpdb->update()

DESCRIÇÃO OFICIAL
Gerencia o sistema de rotas amigáveis e o acesso inicial à galeria do PhotoMusic Pro.
Define a URL pública /galeria/{evento}/{servico}/, registra variáveis de rota, delega o processamento ao controlador da galeria e mantém compatibilidade com o shortcode legado baseado em token.
Inclui validação de dispositivo, limite diário de acessos e controle de segurança para acessos via token.