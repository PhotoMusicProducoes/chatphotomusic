DIAGRAMA COMPLETO — includes/admin/class-photomusic-ideias-futuras.php

PhotoMusic_Ideias_Futuras
   ├── init()
   │       ├── add_action('admin_menu', register_menu)
   │       └── add_action('admin_post_pm_salvar_ideia', handle_form)
   │
   ├── register_menu()   (public static)
   │       ├── verifica capability pm_ideias_view
   │       └── add_submenu_page(
   │               parent: photomusic-eventos,
   │               slug: photomusic-ideias-futuras,
   │               callback: render_page
   │           )
   │
   ├── render_page()   (public static)
   │       ├── verifica capability pm_ideias_view
   │       ├── lê $_GET['acao'] (listar/editar)
   │       ├── lê $_GET['id'] (id da ideia)
   │       ├── se acao = editar:
   │       │       └── carrega ideia via $wpdb->get_row()
   │       ├── carrega lista de ideias via $wpdb->get_results()
   │       ├── renderiza tabela:
   │       │       ├── ID
   │       │       ├── Título
   │       │       ├── Categoria
   │       │       ├── Prioridade
   │       │       ├── Status
   │       │       ├── Autor
   │       │       ├── Data criação
   │       │       └── Ações:
   │       │               ├── Botão Editar (se pm_ideias_edit)
   │       │               └── Botão Transformar em Projeto (se pm_projetos_criar)   ← NOVO
   │       │
   │       ├── se usuário tiver pm_ideias_edit:
   │       │       └── renderiza formulário:
   │       │               ├── título
   │       │               ├── descrição
   │       │               ├── categoria
   │       │               ├── prioridade
   │       │               ├── status
   │       │               ├── sigilosa
   │       │               └── tags
   │       └── imprime HTML completo
   │
   ├── handle_form()   (public static)
   │       ├── verifica capability pm_ideias_edit
   │       ├── valida nonce
   │       ├── sanitiza POST:
   │       │       ├── titulo
   │       │       ├── descricao
   │       │       ├── categoria
   │       │       ├── prioridade
   │       │       ├── status
   │       │       ├── sigilosa
   │       │       └── tags
   │       ├── se id > 0:
   │       │       └── update tabela
   │       ├── se id = 0:
   │       │       └── insert tabela (autor_id + data_criacao)
   │       └── redireciona para lista
   │
   └── get_autor_nome(user_id)   (private static)
           ├── get_user_by('id', user_id)
           └── retorna display_name ou 'Desconhecido'



MAPA FINAL DAS TABELAS
📌 Tabela 1 — wp_pm_ideias_futuras
Armazena todas as ideias criadas.

Campo	Tipo	Descrição
id	bigint PK	Identificador
titulo	varchar(255)	Nome da ideia
descricao	longtext	Descrição detalhada
categoria	varchar(100)	app, ia, galeria, financeiro…
prioridade	tinyint	1–4
status	varchar(50)	rascunho, planejada, em_andamento, implementada, descartada
origem	varchar(100)	interno, cliente, operador
autor_id	bigint	user_id
sigilosa	tinyint	0/1
tags	text	lista de tags
data_criacao	datetime	criação
data_atualizacao	datetime	última edição
data_implementacao	datetime	quando concluída
📌 Tabela 2 — wp_pm_projetos
Armazena projetos derivados de ideias.

Campo	Tipo	Descrição
id	bigint PK	Identificador
ideia_id	bigint FK	Referência à ideia original
titulo	varchar(255)	Nome oficial do projeto
descricao	longtext	Escopo detalhado
prioridade	tinyint	1–4
status	varchar(50)	planejado, em_andamento, pausado, concluído
responsavel_id	bigint	user_id
progresso	tinyint	0–100%
tags	text	lista de tags
data_inicio	datetime	início
data_fim_prevista	datetime	previsão
data_conclusao	datetime	conclusão
data_criacao	datetime	criação
data_atualizacao	datetime	última edição

DESCRIÇÃO OFICIAL DO MÓDULO
O módulo Ideias Futuras é o sistema interno de inovação do PhotoMusic Pro.
Ele permite registrar, priorizar, refinar e acompanhar ideias de evolução do ecossistema PhotoMusic, transformando-as em projetos formais com escopo, responsáveis e progresso.

O módulo oferece:

registro de ideias com categorias, prioridade e sigilo

edição colaborativa e refinamento

sistema de priorização por usuários autorizados

aprovação por gestores

conversão da ideia em projeto  (integração com PhotoMusic_Projetos)

acompanhamento do projeto até sua implementação

histórico completo de evolução do produto

Esse módulo cria um pipeline profissional de inovação, garantindo que boas ideias sejam documentadas, priorizadas e executadas de forma organizada.


