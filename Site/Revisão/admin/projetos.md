DIAGRAMAÇÃO DETALHADA - includes/admin/class-photomusic-projetos.php

PhotoMusic_Projetos
   ├── init()
   │       ├── add_action('admin_menu', register_menu)
   │       ├── add_action('admin_post_pm_salvar_projeto', handle_form)
   │       ├── add_action('admin_post_pm_concluir_projeto', handle_concluir)
   │       └── add_action('admin_post_pm_transformar_em_projeto', handle_transformar)
   │
   ├── register_menu()
   │       ├── verifica capability pm_ideias_view
   │       └── add_submenu_page(
   │               parent: photomusic-eventos,
   │               slug: photomusic-projetos,
   │               callback: render_page
   │           )
   │
   ├── render_page()
   │       ├── verifica capability pm_ideias_view
   │       ├── lê $_GET['acao'] (listar/editar)
   │       ├── lê $_GET['id'] (id do projeto)
   │       ├── se acao = editar:
   │       │       └── carrega projeto via $wpdb->get_row()
   │       ├── carrega lista de projetos via $wpdb->get_results()
   │       ├── renderiza tabela:
   │       │       ├── ID
   │       │       ├── Título
   │       │       ├── Status
   │       │       ├── Prioridade
   │       │       ├── Progresso
   │       │       ├── Responsável
   │       │       ├── Data início
   │       │       └── Ações (Editar / Concluir)
   │       ├── se usuário tiver pm_projetos_criar:
   │       │       └── renderiza formulário:
   │       │               ├── título
   │       │               ├── descrição
   │       │               ├── prioridade
   │       │               ├── status
   │       │               ├── responsável
   │       │               └── progresso
   │       └── imprime HTML completo
   │
   ├── handle_form()
   │       ├── verifica capability pm_projetos_criar
   │       ├── valida nonce
   │       ├── sanitiza POST:
   │       │       ├── titulo
   │       │       ├── descricao
   │       │       ├── prioridade
   │       │       ├── status
   │       │       ├── responsavel_id
   │       │       └── progresso
   │       ├── se id > 0:
   │       │       └── update tabela
   │       ├── se id = 0:
   │       │       └── insert tabela (data_criacao)
   │       └── redireciona para lista
   │
   ├── handle_concluir()
   │       ├── verifica capability pm_projetos_concluir
   │       ├── valida nonce
   │       ├── update:
   │       │       ├── status = concluído
   │       │       ├── progresso = 100
   │       │       └── data_conclusao = now
   │       └── redireciona para lista
   │
   ├── handle_transformar()
   │       ├── verifica capability pm_projetos_criar
   │       ├── valida nonce
   │       ├── lê ideia_id via $_GET['id']
   │       ├── carrega ideia via $wpdb->get_row()
   │       ├── cria novo projeto:
   │       │       ├── ideia_id
   │       │       ├── titulo
   │       │       ├── descricao
   │       │       ├── prioridade
   │       │       ├── status = planejado
   │       │       └── datas de criação/atualização
   │       ├── atualiza ideia:
   │       │       └── status = planejada
   │       └── redireciona para lista de projetos
   │
   └── get_user_name(user_id)
           ├── get_user_by('id', user_id)
           └── retorna display_name ou "—"



MAPA DAS TABELAS (IDEIAS + PROJETOS)
(versão final consolidada — pronto para documentação oficial)

📌 Tabela pm_ideias_futuras
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
📌 Tabela pm_projetos
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


DESCRIÇÃO OFICIAL — Módulo Projetos
O módulo Projetos é responsável por transformar ideias aprovadas em iniciativas formais dentro do PhotoMusic Pro.
Ele permite criar, editar, acompanhar e concluir projetos derivados de ideias internas, garantindo organização, rastreabilidade e evolução contínua do produto.

O módulo oferece:

criação de projetos a partir de ideias

definição de escopo, prioridade e responsável

acompanhamento de progresso

atualização de status (planejado, em andamento, pausado, concluído)

registro de datas importantes (início, previsão, conclusão)

histórico completo de execução

Esse módulo integra o pipeline de inovação do PhotoMusic Pro, garantindo que ideias evoluam para entregas reais de forma estruturada.