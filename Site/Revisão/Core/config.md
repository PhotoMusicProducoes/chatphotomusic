DIAGRAMA COMPLETO — includes/core/class-photomusic-config.php

PhotoMusic_Config
   ├── init()
   │       ├── add_action('admin_init', register_settings)
   │       └── add_action('admin_post_pm_salvar_config', salvar)
   │
   ├── register_settings()
   │       └── register_setting('pm_config_group')
   │               ├── opção: photomusic_contrato_page
   │               ├── type: integer
   │               ├── sanitize_callback: intval
   │               └── default: 0
   │
   ├── salvar()
   │       ├── valida permissão: manage_options
   │       ├── valida nonce: pm_salvar_config
   │       ├── page_id = intval(POST['photomusic_contrato_page'])
   │       ├── update_option('photomusic_contrato_page', page_id)
   │       └── redirect: admin.php?page=photomusic-config&saved=1
   │
   └── render_page()
           ├── valida permissão: manage_options
           ├── pagina_contrato_id = get_option('photomusic_contrato_page')
           ├── paginas = get_pages(publish)
           ├── pagina_salva = get_post(pagina_contrato_id)
           ├── url_publica  = get_permalink(pagina_salva)
           │
           ├── renderiza formulário:
           │       ├── nonce: pm_salvar_config
           │       ├── action: pm_salvar_config
           │       └── campo: Página de Assinatura de Contrato
           │               ├── select com todas as páginas publicadas
           │               ├── mostra título + ID de cada página
           │               ├── SE configurada:
           │               │       └── exibe URL pública com link
           │               └── SE não configurada:
           │                       └── exibe aviso de erro 404
           │
           └── renderiza tabela técnica (SE pagina_contrato_id > 0):
                   ├── Opção no banco: photomusic_contrato_page
                   ├── ID salvo
                   ├── Título da página
                   └── URL pública


MAPA DE OPÇÕES USADAS

Opção wp_options          Tipo       Descrição
photomusic_contrato_page  integer    ID da página WP que contém [photomusic_contrato]
                                     Usada por PhotoMusic_Contratos_Route::get_contrato_page_id()
                                     para redirecionar /contrato/{token}/ para a página correta


MAPA DE DEPENDÊNCIAS

Depende de:
manage_options             capability do WordPress para acesso ao painel
get_pages()                lista todas as páginas publicadas para o select
get_post()                 verifica se a página salva ainda existe
get_permalink()            monta a URL pública da página configurada
update_option()            salva o ID no banco
get_option()               lê o ID salvo
wp_nonce_field()           segurança do formulário
check_admin_referer()      valida o nonce no POST
admin_url('admin-post.php') destino do formulário

Conecta com:
PhotoMusic_Contratos_Route::get_contrato_page_id()
    └── usa get_option('photomusic_contrato_page') para carregar a
        página correta ao acessar /contrato/{token}/

PhotoMusic_Admin_Menu::register_submenus()
    └── o callback do submenu Configurações deve apontar para
        PhotoMusic_Config::render_page()


MAPA DE INTEGRAÇÃO NO SISTEMA

photomusic-pro.php
   ├── autoload: require_once .../core/class-photomusic-config.php
   └── init_modules: PhotoMusic_Config::init()

class-photomusic-admin-menu.php
   └── register_submenus()
           └── add_submenu_page(
                   slug: photomusic-config,
                   callback: [PhotoMusic_Config, 'render_page']  ← substituir
               )

class-photomusic-contratos-route.php
   └── get_contrato_page_id()
           └── return get_option('photomusic_contrato_page')     ← consome


FLUXO COMPLETO DA CONFIGURAÇÃO

Admin acessa PhotoMusic → Configurações
   ├── render_page() carrega todas as páginas publicadas
   ├── exibe select com título e ID de cada página
   ├── admin seleciona "Assinatura de Contrato"
   ├── clica em Salvar
   ├── salvar() valida nonce e permissão
   ├── update_option('photomusic_contrato_page', ID)
   └── redirect com ?saved=1
           └── render_page() exibe:
                   ├── ✅ mensagem de sucesso
                   ├── URL pública da página configurada
                   └── tabela técnica com ID, título e URL


MAPA DAS TABELAS USADAS
Nenhuma tabela personalizada.
Usa apenas wp_options (tabela nativa do WordPress) via get_option() e update_option().


DESCRIÇÃO OFICIAL — PhotoMusic_Config
Gerencia as configurações globais do plugin PhotoMusic Pro.
Permite que o administrador vincule a página WordPress que contém o shortcode [photomusic_contrato]
à rota pública /contrato/{token}/, garantindo que todos os links de assinatura gerados no PDF e
no WhatsApp redirecionem corretamente para a página de assinatura.
Exibe um select com todas as páginas publicadas do site, mostra a URL configurada e emite
aviso visual caso a configuração esteja ausente.
Também apresenta uma tabela técnica com o ID salvo, o título e a URL pública da página,
facilitando auditoria e diagnóstico.


DESCRIÇÃO REDUZIDA
Painel de configurações do PhotoMusic Pro.
Permite vincular a página de assinatura de contrato à rota /contrato/{token}/,
com select de páginas, validação de nonce e exibição da URL configurada.