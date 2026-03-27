PhotoMusic_Representantes
   ├── init()
   │       ├── add_action('admin_menu', menu)
   │       └── add_action('admin_post_pm_salvar_representante', salvar)
   │       └── add_action('admin_post_pm_excluir_representante', excluir)
   │
   ├── menu()
   │       └── adiciona submenu:
   │           PhotoMusic → Representantes Legais
   │
   ├── get_all()
   │       └── retorna todos usuários com meta pm_representante_legal = 1
   │
   ├── salvar()
   │       ├── valida permissão
   │       ├── valida nonce
   │       ├── user_id = POST
   │       ├── cargo, cpf, telefone = POST
   │       ├── update_user_meta:
   │       │       pm_representante_legal = 1
   │       │       pm_representante_cargo
   │       │       pm_representante_cpf
   │       │       pm_representante_telefone
   │       │       pm_assinar_contratos = 1
   │       └── redirect com msg=salvo
   │
   ├── excluir()
   │       ├── valida permissão
   │       ├── valida nonce
   │       ├── user_id = GET
   │       ├── delete_user_meta:
   │       │       pm_representante_legal
   │       │       pm_representante_cargo
   │       │       pm_representante_cpf
   │       │       pm_representante_telefone
   │       │       pm_assinar_contratos
   │       └── redirect com msg=excluido
   │
   └── render_page()
           ├── lista representantes
           ├── formulário de cadastro
           ├── tabela de representantes
           └── ações (remover)


MAPA DAS TABELAS USADAS
✔ wp_users
ID
display_name
user_email

✔ wp_usermeta

Metas usadas:
pm_representante_legal = 1
pm_representante_cargo
pm_representante_cpf
pm_representante_telefone
pm_assinar_contratos = 1


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Representantes
Gerencia os representantes legais da empresa no PhotoMusic Pro.
Permite cadastrar usuários que possuem permissão para assinar contratos em nome da empresa, armazenando cargo, CPF e telefone.
Controla quem pode assinar contratos, integra com o módulo de contratos e garante que apenas usuários autorizados possam validar documentos oficiais.