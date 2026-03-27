DIAGRAMA COMPLETO - includes/contratos/class-photomusic-permissoes-operador.php

PhotoMusic_Permissoes_Operador
   ├── init()
   │       ├── add_action('admin_menu', menu)
   │       └── add_action('admin_post_pm_salvar_permissoes', salvar)
   │
   ├── menu()
   │       └── adiciona submenu:
   │           PhotoMusic → Permissões do Operador
   │
   ├── get_permissoes(user_id)
   │       └── retorna array:
   │           - pm_criar_contratos
   │           - pm_editar_contratos
   │           - pm_enviar_para_assinatura
   │           - pm_cancelar_contratos
   │           - pm_ver_financeiro
   │           - pm_assinar_contratos (representante legal)
   │
   ├── salvar()
   │       ├── valida permissão (manage_options)
   │       ├── valida nonce
   │       ├── user_id = POST
   │       ├── salva metas:
   │       │       pm_criar_contratos
   │       │       pm_editar_contratos
   │       │       pm_enviar_para_assinatura
   │       │       pm_cancelar_contratos
   │       │       pm_ver_financeiro
   │       │       pm_assinar_contratos
   │       └── redirect com msg=salvo
   │
   └── render_page()
           ├── lista usuários do sistema
           ├── formulário de permissões:
           │       - criar contratos
           │       - editar contratos
           │       - enviar para assinatura interna
           │       - cancelar contratos
           │       - visualizar financeiro
           │       - assinar contratos (representante legal)
           └── submit_button()


MAPA DAS TABELAS USADAS
✔ wp_users
ID
display_name
user_email

✔ wp_usermeta

Metas usadas:
pm_criar_contratos
pm_editar_contratos
pm_enviar_para_assinatura
pm_cancelar_contratos
pm_ver_financeiro
pm_assinar_contratos


DESCRIÇÃO OFICIAL — PhotoMusic_Permissoes_Operador
Gerencia as permissões administrativas dos operadores do PhotoMusic Pro.
Permite definir, por usuário, quais ações ele pode executar dentro do módulo de contratos, como criar, editar, enviar para assinatura interna, cancelar contratos, visualizar financeiro e assinar contratos como representante legal.
Centraliza o controle de acesso e garante que cada operador tenha apenas as permissões necessárias para sua função.