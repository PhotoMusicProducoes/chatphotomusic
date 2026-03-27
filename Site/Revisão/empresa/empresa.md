DIAGRAMA COMPLETO — includes/empresa/class-photomusic-empresa.php

PhotoMusic_Empresa
   ├── init()
   │       ├── add_action('admin_menu', menu)
   │       └── add_action('admin_init', register_settings)
   │
   ├── menu()
   │       └── adiciona submenu:
   │           PhotoMusic → Dados da Empresa
   │
   ├── register_settings()
   │       └── register_setting('photomusic_empresa_group', OPTION_KEY, sanitize)
   │
   ├── sanitize($input)
   │       ├── sanitiza nome_fantasia
   │       ├── sanitiza razao_social
   │       ├── sanitiza cnpj
   │       ├── sanitiza telefone
   │       ├── sanitiza email
   │       ├── sanitiza site
   │       ├── sanitiza endereco
   │       ├── sanitiza logo
   │       └── return dados limpos
   │
   ├── get()
   │       └── return get_option(OPTION_KEY)
   │
   └── render_page()
           ├── carrega dados via get()
           ├── exibe formulário:
           │       nome_fantasia
           │       razao_social
           │       cnpj
           │       telefone
           │       email
           │       site
           │       endereco
           │       logo (URL)
           └── submit_button()


MAPA DAS TABELAS USADAS
A classe não usa nenhuma tabela personalizada


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Empresa
Responsável por gerenciar todas as informações institucionais da empresa dentro do PhotoMusic Pro.  
Fornece um painel administrativo onde o gestor pode configurar dados como razão social, CNPJ, endereço, telefone, e-mail, site e logo oficial.

Essas informações são utilizadas automaticamente em:

geração do PDF do contrato

cabeçalho e rodapé do documento

cláusulas dinâmicas

assinatura da empresa

validação pública via QR Code

É o ponto central de configuração institucional do módulo de contratos.