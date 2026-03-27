PhotoMusic_Permissoes_Operador
   ├── init()
   │     ├── add_action(admin_menu → menu)
   │     └── add_action(admin_post_pm_salvar_permissoes → salvar)
   │
   ├── menu()
   │     └── add_submenu_page('photomusic', 'Permissões do Operador')
   │
   ├── get_permissoes(user_id)
   │     └── retorna array com flags booleanas de permissões
   │
   ├── salvar()
   │     ├── valida permissão manage_options
   │     ├── valida nonce
   │     ├── sanitiza user_id
   │     ├── salva metas de permissão
   │     └── redireciona com msg=salvo
   │
   └── render_page()
         ├── lista usuários
         ├── seleciona usuário
         ├── exibe formulário de permissões
         └── salva via admin-post.php


MAPA DE DEPENDÊNCIAS
Depende de:
WordPress Admin Menu API
get_user_meta() / update_user_meta()
get_users()
admin-post.php
manage_options capability

Usa:
wp_nonce_field()
wp_verify_nonce()
wp_redirect()
selected(), checked()
submit_button()

DESCRIÇÃO OFICIAL
Gerencia todas as permissões administrativas dos operadores do PhotoMusic Pro.
Permite definir quem pode criar, editar, enviar, cancelar e assinar contratos, além de visualizar o financeiro.
As permissões são armazenadas em usermeta e aplicadas em todo o módulo de contratos.
Inclui painel administrativo completo para seleção de usuários e configuração granular de permissões.