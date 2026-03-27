DIAGRAMA COMPLETO - includes/core/class-photomusic-installer.php

PhotoMusic_Installer
   ├── activate()
   │       ├── create_tables()
   │       └── create_roles_and_caps()
   │
   ├── create_tables()   (private)
   │       ├── define nomes das tabelas:
   │       │       pm_eventos
   │       │       pm_event_services
   │       │       pm_acessos_galeria
   │       │       pm_aceite_contratante
   │       │       pm_termos_versoes
   │       │       pm_convites
   │       │       pm_aceites
   │       │       pm_logs_sistema
   │       │       pm_eventos_senhas
   │       │       pm_event_items
   │       │       pm_event_history
   │       │       pm_event_messages
   │       │       pm_contratantes
   │       │       pm_contratos
   │       │       pm_aceites_evento
   │       │       pm_acessos_evento
   │       │       pm_compartilhamentos
   │       │       pm_devices
   │       │       pm_evento_whatsapp_logs
   │       │       pm_servicos
   │       │       pm_servicos_subtipos
   │       │       pm_servicos_pacotes
   │       │       pm_servicos_regras
   │       │       pm_eventos_servicos
   │       │       pm_financeiro_movimentos
   │       │       pm_ideias_futuras          ← NOVA
   │       │       pm_projetos                ← NOVA
   │       │
   │       ├── monta SQL de cada tabela
   │       │       ├── $sql_eventos
   │       │       ├── $sql_event_services
   │       │       ├── $sql_acessos
   │       │       ├── $sql_aceite_contratante
   │       │       ├── $sql_termos
   │       │       ├── $sql_convites
   │       │       ├── $sql_aceites
   │       │       ├── $sql_logs
   │       │       ├── $sql_senhas
   │       │       ├── $sql_event_items
   │       │       ├── $sql_event_history
   │       │       ├── $sql_event_messages
   │       │       ├── $sql_contratantes
   │       │       ├── $sql_contratos
   │       │       ├── $sql_aceites_evento
   │       │       ├── $sql_acessos_evento
   │       │       ├── $sql_compartilhamentos
   │       │       ├── $sql_devices
   │       │       ├── $sql_whatsapp_logs
   │       │       ├── $sql_servicos
   │       │       ├── $sql_servicos_subtipos
   │       │       ├── $sql_servicos_pacotes
   │       │       ├── $sql_servicos_regras
   │       │       ├── $sql_eventos_servicos
   │       │       ├── (via create_table_financeiro) $sql_financeiro
   │       │       ├── $sql_ideias_futuras     ← NOVA
   │       │       └── $sql_projetos           ← NOVA
   │       │
   │       ├── create_table_financeiro()
   │       │       ├── monta SQL pm_financeiro_movimentos
   │       │       └── dbDelta($sql)
   │       │
   │       └── dbDelta() para cada tabela:
   │               pm_eventos
   │               pm_event_services
   │               pm_convites
   │               pm_aceites
   │               pm_acessos_galeria
   │               pm_eventos_senhas
   │               pm_logs_sistema
   │               pm_termos_versoes
   │               pm_aceite_contratante
   │               pm_event_items
   │               pm_event_history
   │               pm_event_messages
   │               pm_contratantes
   │               pm_contratos
   │               pm_aceites_evento
   │               pm_acessos_evento
   │               pm_compartilhamentos
   │               pm_devices
   │               pm_evento_whatsapp_logs
   │               pm_servicos
   │               pm_servicos_subtipos
   │               pm_servicos_pacotes
   │               pm_servicos_regras
   │               pm_eventos_servicos
   │               pm_financeiro_movimentos
   │               pm_ideias_futuras          ← NOVA
   │               pm_projetos                ← NOVA
   │
   ├── create_roles_and_caps()   (private)
   │       ├── add_role('photomusic_admin')
   │       ├── add_role('photomusic_user')
   │       ├── capabilities:
   │       │       pm_gerenciar_usuarios
   │       │       pm_ver_eventos
   │       │       pm_criar_eventos
   │       │       pm_editar_eventos
   │       │       pm_desativar_eventos
   │       │       pm_ver_dados_evento
   │       │       pm_gerar_pdf
   │       │       pm_gerar_excel
   │       │       pm_ver_logs
   │       │       pm_ver_contratos
   │       │       pm_criar_contratos
   │       │       pm_assinar_contratos
   │       │       pm_subir_contrato_assinado
   │       │       pm_cancelar_contratos
   │       │       photomusic_view_roadmap
   │       │       pm_ideias_view            ← NOVA
   │       │       pm_ideias_edit            ← NOVA
   │       │       pm_ideias_priorizar       ← NOVA
   │       │       pm_ideias_aprovar         ← NOVA
   │       │       pm_projetos_criar         ← NOVA
   │       │       pm_projetos_editar        ← NOVA
   │       │       pm_projetos_concluir      ← NOVA
   │       ├── atribui caps ao photomusic_admin
   │       ├── atribui caps ao photomusic_user
   │       └── adiciona photomusic_view_roadmap ao administrator
   │
   └── create_table_financeiro()
           ├── monta SQL pm_financeiro_movimentos
           └── dbDelta($sql)



MAPA DAS TABELAS CRIADAS PELO INSTALLER

pm_eventos
pm_event_services
pm_acessos_galeria
pm_aceite_contratante
pm_termos_versoes
pm_convites
pm_aceites
pm_logs_sistema
pm_eventos_senhas
pm_event_items
pm_event_history
pm_event_messages
pm_contratantes
pm_contratos
pm_aceites_evento
pm_acessos_evento
pm_compartilhamentos
pm_devices
pm_evento_whatsapp_logs
pm_servicos
pm_servicos_subtipos
pm_servicos_pacotes
pm_servicos_regras
pm_eventos_servicos
pm_financeiro_movimentos


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Installer
Responsável por criar toda a infraestrutura do banco de dados do PhotoMusic Pro.  
Na ativação do plugin, gera todas as tabelas necessárias para eventos, serviços, contratantes, contratos, convites, acessos, logs, WhatsApp, galeria e financeiro.
Também registra papéis e permissões internas do sistema.
É a base estrutural do plugin — sem ele, nenhum módulo funciona.