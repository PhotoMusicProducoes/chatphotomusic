DIAGRAMA COMPLETO - includes/contratos/class-photomusic-clausulas.php

PhotoMusic_Clausulas
   ├── init()
   │       ├── add_action('admin_menu', register_menu)
   │       └── add_action('admin_init', handle_form_submit)
   │
   ├── register_menu()
   │       ├── SE !is_admin → return
   │       └── add_submenu_page(photomusic-clausulas → render_page)
   │
   ├── get_table()
   │       └── return wp_prefix . pm_clausulas
   │
   ├── get_clausulas($args)
   │       ├── monta WHERE:
   │       │       tipo?
   │       │       categoria?
   │       │       ativo?
   │       ├── ORDER BY ordem ASC, id DESC
   │       └── SELECT * FROM pm_clausulas
   │
   ├── get_clausula($id)
   │       └── SELECT * FROM pm_clausulas WHERE id = ?
   │
   ├── save_clausula($data)
   │       ├── monta $fields:
   │       │       titulo, tipo, categoria, tags, texto, ordem, ativo, updated_at
   │       ├── SE id > 0 → UPDATE
   │       ├── SENÃO:
   │       │       created_at = now()
   │       │       INSERT
   │       └── return id
   │
   ├── deactivate_clausula($id)
   │       └── UPDATE pm_clausulas SET ativo = 0
   │
   ├── handle_form_submit()
   │       ├── verifica action, permissão e nonce
   │       ├── SE save:
   │       │       save_clausula()
   │       │       Logs::add('clausula_save')
   │       │       redirect
   │       ├── SE deactivate:
   │       │       deactivate_clausula()
   │       │       Logs::add('clausula_deactivate')
   │       │       redirect
   │
   ├── render_page()
   │       ├── carrega edição (GET['edit'])
   │       ├── define arrays tipos[] e categorias[]
   │       ├── lista clausulas
   │       ├── renderiza formulário completo
   │       └── renderiza tabela de cláusulas cadastradas
   │
   ├── gerar_contrato_html($evento, $contratante, $servicos, $financeiro)
   │       ├── 1) Preparar TAGS
   │       │       tipo de evento
   │       │       slug dos serviços
   │       │       subtipo
   │       │       pacote
   │       │
   │       ├── 2) Buscar cláusulas por tags e categoria PF/PJ
   │       │       clausulas = buscar_por_tags($tags, categoria)
   │       │       ordenar por ordem ASC
   │       │
   │       ├── 3) Variáveis globais do contrato
   │       │       {nome_cliente}
   │       │       {documento_cliente}
   │       │       {email_cliente}
   │       │       {telefone_cliente}
   │       │       {endereco_cliente}
   │       │       {data_evento}
   │       │       {horario_evento}
   │       │       {local_evento}
   │       │       {horas_evento}
   │       │       {deslocamento}
   │       │       {deslocamento_valor}
   │       │       {desconto_manual}
   │       │       {valor_total_final}
   │
   │       ├── 4) Variáveis por serviço
   │       │       LOOP servicos:
   │       │           {servico_1_nome}
   │       │           {servico_1_subtipo}
   │       │           {servico_1_pacote}
   │       │           {servico_1_quantidade_fotos}
   │       │           {servico_1_horas}
   │       │           {servico_1_horas_minimas}
   │       │           {servico_1_horas_maximas}
   │       │           {servico_1_preco}
   │       │
   │       │       monta {lista_servicos} em HTML:
   │       │           <p><strong>Nome</strong> – Subtipo – Pacote – Fotos – Horas</p>
   │
   │       ├── 5) Substituir variáveis no texto das cláusulas
   │       │       texto = str_replace(vars, valores, c->texto)
   │       │       html += "<h3>Título</h3><p>Texto</p>"
   │
   │       └── 6) return "<div class='contrato-gerado'>HTML</div>"
   │
   └── buscar_por_tags($tags, $categoria)
           ├── sanitiza tags
           ├── monta condições FIND_IN_SET(tag, tags)
           ├── where_tags = OR entre todas as tags
           ├── where_categoria = categoria = X OR ambos
           ├── SELECT * FROM photomusic_clausulas
           │       WHERE ativo = 1
           │       AND categoria
           │       AND tags
           │       ORDER BY ordem ASC
           └── return array de cláusulas


MAPA DAS TABELAS USADAS
pm_clausulas
photomusic_clausulas   (usada em buscar_por_tags)


DESCRIÇÃO OFICIAL — PhotoMusic_Clausulas
Gerencia todas as cláusulas contratuais do PhotoMusic Pro.  
Permite criar, editar, desativar e organizar cláusulas por tipo, categoria (PF/PJ), tags e ordem.
Também filtra automaticamente as cláusulas relevantes para cada evento com base nos serviços contratados, tipo de cliente e variáveis dinâmicas.
É a base da geração automática de contratos personalizados.
