DIAGRAMA COMPLETO — includes/servicos/class-photomusic-pagamentos.php

PhotoMusic_Pagamentos
   ├── init()
   │       ├── add_action('admin_menu', register_menu)
   │       └── add_action('admin_init', handle_form_submit)
   │
   ├── register_menu()
   │       ├── verifica permissão via PhotoMusic_Users::is_admin()
   │       └── add_submenu_page('photomusic-eventos', 'Pagamentos', ...)
   │
   ├── get_table()
   │       └── retorna pm_pagamentos
   │
   ├── get_pagamentos($args)
   │       ├── sanitiza args
   │       ├── filtra por tipo
   │       ├── filtra por ativo
   │       └── SELECT * FROM pm_pagamentos ORDER BY ordem, titulo
   │
   ├── get_pagamento($id)
   │       └── SELECT * FROM pm_pagamentos WHERE id = ?
   │
   ├── save_pagamento($data)
   │       ├── sanitiza todos os campos
   │       ├── valida tipo contra lista oficial
   │       ├── valida parcelas >= 1
   │       ├── valida juros >= 0
   │       ├── valida multa >= 0
   │       ├── limita vencimento (500 chars)
   │       ├── limita descrição (5000 chars)
   │       ├── UPDATE se id > 0
   │       └── INSERT se id = 0
   │
   ├── deactivate_pagamento($id)
   │       └── UPDATE pm_pagamentos SET ativo = 0
   │
   ├── handle_form_submit()
   │       ├── valida POST
   │       ├── valida permissão
   │       ├── valida nonce
   │       ├── ação save → save_pagamento()
   │       ├── registra log pagamento_save
   │       ├── ação deactivate → deactivate_pagamento()
   │       └── registra log pagamento_deactivate
   │
   ├── render_page()
   │       ├── valida permissão
   │       ├── sanitiza tab
   │       ├── carrega pagamento em edição
   │       ├── define lista de tipos
   │       ├── carrega pagamentos
   │       ├── renderiza abas
   │       └── chama render_list() ou render_form()
   │
   ├── render_list($pagamentos, $tipos)
   │       ├── tabela com:
   │       │       id, título, tipo, parcelas, ativo, ordem
   │       ├── link Editar
   │       └── formulário de desativação
   │
   └── render_form($editing, $tipos)
           ├── formulário de criação/edição
           ├── campos:
           │       título, tipo, parcelas, juros, multa,
           │       vencimento, descrição, ordem, ativo
           └── submit_button()


MAPA DAS TABELAS USADAS

Tabela	                Uso
pm_pagamentos

DESCRIÇÃO OFICIAL — PhotoMusic_Pagamentos
Gerencia todas as formas de pagamento utilizadas nos contratos do PhotoMusic Pro.
Permite criar, editar, listar e desativar métodos como pagamento à vista, parcelado, entrada + parcelas, sinal e modelos personalizados.
Controla juros, multa, vencimento, descrição e ordem de exibição, garantindo consistência e padronização nos contratos..