DIAGRAMA COMPLETO — class-photomusic-roadmap-menu.php

PhotoMusic_Roadmap_Menu
   ├── __construct()
   │       └── add_action('admin_menu', add_menu)
   │
   ├── add_menu()
   │       ├── verifica permissão photomusic_view_roadmap
   │       └── add_menu_page('photomusic-roadmap')
   │
   └── render_page()
           ├── valida permissão
           ├── monta caminho do arquivo
           ├── verifica existência
           ├── exibe conteúdo do markdown
           └── fallback: arquivo não encontrado

MAPA DE ARQUIVOS / DADOS USADOS

Recurso	                            Uso
PHOTOMUSIC_PRO_PATH	                Caminho base do plugin
docs/PhotoMusicBoot.md	            Arquivo de roadmap exibido na tela
Capability photomusic_view_roadmap	Permissão necessária para acessar a página
