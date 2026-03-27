PhotoMusic_Assinatura_Admin
   ├── init()
   │       └── add_action('admin_post_pm_assinar_empresa', processar_assinatura)
   │
   ├── processar_assinatura()
   │       ├── valida permissão:
   │       │       SE !current_user_can('pm_assinar_contratos') → erro
   │       │
   │       ├── valida nonce (pm_assinar_empresa)
   │       │
   │       ├── contrato_id = GET[contrato_id]
   │       ├── user_id = get_current_user_id()
   │       ├── contrato = PhotoMusic_Contratos::get(contrato_id)
   │       ├── SE contrato não existe → erro
   │
   │       ├── BLOQUEIOS DE SEGURANÇA
   │       │       ├── SE status != aguardando_assinatura_admin → erro
   │       │       ├── SE !usuario_pode_assinar(user_id) → erro
   │
   │       ├── registrar assinatura:
   │       │       assinatura_admin_nome
   │       │       assinatura_admin_id
   │       │       assinatura_admin_data
   │       │       assinatura_admin_ip
   │       │       assinatura_admin_useragent
   │
   │       ├── update_status('assinado_admin')
   │
   │       ├── SE existir PhotoMusic_Event_History:
   │       │       registrar histórico "contrato_assinado_empresa"
   │
   │       ├── SE existir PhotoMusic_Logs:
   │       │       registrar log "contrato_assinado_empresa"
   │
   │       ├── SE existir PhotoMusic_Contratos_PDF:
   │       │       gerar_pdf(contrato_atualizado)
   │
   │       ├── redirect admin.php?page=photomusic_contratos&msg=empresa_assinou
   │       └── exit

MAPA DAS TABELAS USADAS
✔ pm_contratos
Para registrar:
assinatura_admin_nome
assinatura_admin_id
assinatura_admin_data
assinatura_admin_ip
assinatura_admin_useragent
status_contrato

✔ pm_eventos (via PhotoMusic_Event_History)
Para registrar histórico do evento.

✔ pm_logs_sistema (via PhotoMusic_Logs)
Para registrar logs administrativos.

✔ wp_users e wp_usermeta

Para validar:
permissão pm_assinar_contratos
dados do representante legal

DESCRIÇÃO OFICIAL — PhotoMusic_Assinatura_Admin
Gerencia todo o fluxo interno de assinatura da empresa no PhotoMusic Pro.
Permite que representantes legais autorizados assinem contratos diretamente pelo painel administrativo, registrando dados como nome, IP, data, user agent e atualizando o status do contrato para assinado_admin.
Também registra logs, histórico do evento e gera o PDF pré-assinado.
É o módulo responsável por validar juridicamente a assinatura da empresa antes de liberar o contrato para o cliente.

