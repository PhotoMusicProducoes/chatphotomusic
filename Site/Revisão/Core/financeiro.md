PhotoMusic_Financeiro
   ├── table()
   │       └── retorna nome da tabela pm_financeiro_movimentos
   │
   ├── registrar_movimento($data)
   │       ├── monta array $insert:
   │       │       tipo
   │       │       categoria
   │       │       subcategoria
   │       │       descricao
   │       │       valor
   │       │       data_movimento (ou hoje)
   │       │       data_registro (agora)
   │       │       origem
   │       │       id_evento
   │       │       id_servico
   │       │       id_fornecedor
   │       │       id_colaborador
   │       │       id_funcionario
   │       │       status
   │       │       forma_pagamento
   │       │       documento
   │       │       anexos (json)
   │       │       criado_por
   │       │       criado_em
   │       ├── INSERT INTO pm_financeiro_movimentos
   │       └── return insert_id
   │
   ├── get_movimentos_evento($id_evento)
   │       ├── SELECT * FROM pm_financeiro_movimentos
   │       │       WHERE id_evento = ?
   │       │       ORDER BY data_movimento ASC, id ASC
   │       └── retorna array de objetos
   │
   └── get_resumo_evento($id_evento)
           ├── SELECT SUM(valor) entradas
           │       FROM pm_financeiro_movimentos
           │       WHERE id_evento = ?
           │       AND tipo = 'entrada'
           │       AND status != 'cancelado'
           │
           ├── SELECT SUM(valor) saidas
           │       FROM pm_financeiro_movimentos
           │       WHERE id_evento = ?
           │       AND tipo = 'saida'
           │       AND status != 'cancelado'
           │
           └── retorna array:
                   entradas
                   saidas
                   saldo = entradas - saidas


MAPA DAS TABELAS USADAS
pm_financeiro_movimentos


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Financeiro
Camada central do módulo financeiro do PhotoMusic Pro.  
Registra entradas e saídas, vincula movimentações a eventos, serviços, fornecedores e colaboradores.
Permite consultar todos os movimentos de um evento e gerar um resumo financeiro completo (entradas, saídas e saldo).
É a base para relatórios, dashboards, pagamentos e integrações futuras.