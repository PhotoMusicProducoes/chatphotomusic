DIAGRAMA COMPLETO — includes/servicos/class-photomusic-itens.php

PhotoMusic_Itens
   ├── init()
   │       ├── add_action('admin_menu', register_menu)
   │       └── add_action('admin_init', handle_form_submit)
   │
   ├── register_menu()
   │       ├── verifica permissão via PhotoMusic_Users::is_admin()
   │       └── add_submenu_page('photomusic-eventos', 'Itens', ...)
   │
   ├── get_table()
   │       └── retorna nome da tabela pm_itens
   │
   ├── get_itens($args)
   │       ├── monta WHERE dinâmico
   │       ├── filtra por tipo (opcional)
   │       ├── filtra por ativo (opcional)
   │       └── SELECT * FROM pm_itens ORDER BY ordem ASC, id DESC
   │
   ├── get_item($id)
   │       └── SELECT * FROM pm_itens WHERE id = ?
   │
   ├── save_item($data)
   │       ├── sanitiza:
   │       │       titulo
   │       │       tipo
   │       │       descricao
   │       │       ordem
   │       │       ativo
   │       ├── se id > 0 → UPDATE pm_itens SET ...
   │       └── se id = 0 → INSERT INTO pm_itens (...)
   │
   ├── deactivate_item($id)
   │       └── UPDATE pm_itens SET ativo = 0, updated_at = NOW()
   │
   ├── handle_form_submit()
   │       ├── valida POST (pm_item_action)
   │       ├── valida permissão (pm_gerenciar_usuarios)
   │       ├── valida nonce (pm_item_nonce)
   │       ├── ação save:
   │       │       ├── monta array $data
   │       │       ├── save_item()
   │       │       └── registra log item_save
   │       ├── ação deactivate:
   │       │       ├── deactivate_item()
   │       │       └── registra log item_deactivate
   │       └── redireciona para admin.php?page=photomusic-itens
   │
   ├── render_page()
   │       ├── valida permissão
   │       ├── sanitiza tab
   │       ├── carrega item em edição (opcional)
   │       ├── define lista de tipos
   │       ├── carrega itens via get_itens()
   │       ├── renderiza abas:
   │       │       - Lista de Itens
   │       │       - Criar Novo Item
   │       │       - Editar Item (se houver)
   │       └── chama:
   │               render_list()
   │               render_form()
   │
   ├── render_list($itens, $tipos)
   │       ├── tabela com colunas:
   │       │       id
   │       │       título
   │       │       tipo
   │       │       ativo
   │       │       ordem
   │       ├── link Editar (tab=edit&edit=id)
   │       └── formulário de desativação com nonce + confirmação
   │
   └── render_form($editing, $tipos)
           ├── formulário de criação/edição
           ├── campos:
           │       título (text)
           │       tipo (select)
           │       descrição (textarea)
           │       ordem (number)
           │       ativo (checkbox)
           └── submit_button()



MAPA DAS TABELAS USADAS
pm_itens


DESCRIÇÃO OFICIAL — PhotoMusic_Itens
Gerencia todos os itens textuais utilizados nos contratos do PhotoMusic Pro.
Permite criar, editar, listar e desativar itens como cláusulas, condições, responsabilidades, direitos de imagem, logística, cancelamento e outros blocos de texto que compõem o contrato final.
É um CRUD administrativo completo, com controle de permissão, logs, sanitização e interface própria no painel.

Isso descreve perfeitamente o propósito da classe, porque:

Ela é um CRUD de itens textuais

Esses itens são usados na montagem dos contratos

Os tipos (geral, pagamento, logística, direitos de imagem etc.) confirmam isso

A classe não faz nada além de gerenciar esses textos