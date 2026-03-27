DIAGRAMA COMPLETO - includes/contratos/class-photomusic-contratos.php

PhotoMusic_Contratos
   ├── get_table()
   │       └── retorna wp_prefix . pm_contratos
   │
   ├── get_logs_table()
   │       └── retorna wp_prefix . pm_contratos_logs
   │
   ├── $status_validos[]
   ├── $assinaturas_validas[]
   │
   ├── gerar_token_unico()
   │       ├── LOOP:
   │       │       token = random_bytes(16)
   │       │       SELECT COUNT(*) FROM pm_contratos WHERE token = token
   │       │       SE existe → gerar novamente
   │       └── return token único
   │
   ├── registrar_log(id_contrato, acao, detalhes)
   │       └── INSERT pm_contratos_logs:
   │               id_contrato
   │               acao
   │               detalhes
   │               ip
   │               user_agent
   │               criado_em
   │
   ├── criar_contrato_completo(id_evento, id_contratante, conteudo_html)
   │       ├── PERMISSÃO: pode_criar()
   │       ├── monta dados
   │       ├── INSERT pm_contratos
   │       ├── registrar_log('contrato_criado')
   │       └── return id
   │
   ├── criar_contrato_simplificado(id_evento, id_contratante)
   │       ├── PERMISSÃO: pode_criar()
   │       ├── monta dados
   │       ├── INSERT pm_contratos
   │       ├── registrar_log('contrato_criado_simplificado')
   │       └── return id
   │
   ├── get_by_token(token)
   ├── get(id)
   ├── get_by_event(id_evento)
   │
   ├── atualizar(id, dados)
   │       ├── PERMISSÃO: pode_editar()
   │       ├── dados['atualizado_em'] = now()
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('contrato_atualizado')
   │       └── return resultado
   │
   ├── registrar_assinatura_contratante(...)
   │       ├── hash = sha256(...)
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('assinatura_contratante')
   │       └── return resultado
   │
   ├── registrar_assinatura_admin(...)
   │       ├── PERMISSÃO: pode_assinar()
   │       ├── hash = sha256(...)
   │       ├── contrato = get(id)
   │       ├── SE tem assinatura_contratante → status = assinado
   │       ├── SENÃO → status = assinado_admin
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('assinatura_admin')
   │       └── return resultado
   │
   ├── marcar_assinatura_manual(id)
   │       ├── PERMISSÃO: pode_assinar()
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('assinatura_manual')
   │       └── return resultado
   │
   ├── marcar_assinatura_govbr(id)
   │       ├── PERMISSÃO: pode_assinar()
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('assinatura_govbr')
   │       └── return resultado
   │
   ├── salvar_pdf(id, caminho_pdf)
   │       ├── PERMISSÃO: pode_editar()
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('pdf_salvo')
   │       └── return resultado
   │
   ├── set_status(id, status)
   │       ├── SE status NÃO está em $status_validos → return false
   │       ├── PERMISSÕES POR STATUS:
   │       │       ├── status = cancelado → pode_cancelar()
   │       │       ├── status = aguardando_assinatura_admin → pode_enviar()
   │       │       ├── status = assinado → pode_assinar()
   │       ├── UPDATE pm_contratos
   │       ├── registrar_log('status_alterado')
   │       └── return resultado
   │
   ├── update_status(id, status)
   │       └── return set_status()
   │
   └── atualizar_hash_contrato(id)
           ├── contrato = get(id)
           ├── base = json_encode([
           │       id,
           │       id_evento,
           │       conteudo,
           │       assinatura_contratante_hash,
           │       assinatura_admin_hash,
           │       pdf_final
           │   ])
           ├── hash = sha256(base)
           ├── UPDATE pm_contratos SET hash_contrato = hash
           ├── registrar_log('hash_atualizado')
           └── return resultado


MAPA DAS TABELAS USADAS
pm_contratos
pm_contratos_logs


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos
Gerencia todo o ciclo de vida dos contratos do PhotoMusic Pro.
Cria contratos completos ou simplificados, controla assinaturas (cliente, admin, manual, Gov.br), registra logs detalhados, salva o PDF final, atualiza status e gera o hash de integridade.
Também permite buscar contratos por ID, token ou evento.
É o núcleo do módulo de contratos e integra diretamente com eventos, cláusulas, PDF e WhatsApp, agora com permissões internas aplicadas em todas as ações sensíveis.