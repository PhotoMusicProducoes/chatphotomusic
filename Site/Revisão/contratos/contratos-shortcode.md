DIAGRAMA COMPLETO - includes/contratos/class-photomusic-contratos-shortcode.php

PhotoMusic_Contratos_Shortcode
   ├── init()
   │       ├── add_shortcode('photomusic_contrato', render_shortcode)
   │       └── add_action('init', processar_assinatura)
   │
   ├── processar_assinatura()
   │       ├── SE !pm_contrato_assinar → return
   │       ├── valida nonce
   │       ├── token = POST[token]
   │       ├── nome  = POST[nome_assinatura]
   │       ├── contrato = get_by_token(token)
   │       ├── SE não existe → wp_die()
   │
   │       ├── BLOQUEIOS:
   │       │       ├── SE contrato cancelado → erro
   │       │       ├── SE contrato simplificado → erro
   │       │       ├── SE empresa não assinou → erro
   │       │       ├── SE status != assinado_admin OU != aguardando_assinatura_contratante → erro
   │       │       ├── SE já assinado pelo cliente → redirect sucesso
   │
   │       ├── registrar_assinatura_contratante()
   │       ├── atualizar_hash_contrato()
   │
   │       ├── SE existir PhotoMusic_Event_History → registrar histórico
   │       ├── SE existir PhotoMusic_Logs → registrar log
   │
   │       ├── update_status('assinado')
   │       ├── SE existir PhotoMusic_Events → update_status(evento, 'contrato_assinado')
   │
   │       ├── contrato = get(id) // recarregar
   │       ├── SE existir PhotoMusic_Contratos_PDF → gerar_pdf(contrato)
   │
   │       ├── redirect ?assinatura=ok
   │       └── exit
   │
   ├── render_shortcode()
   │       ├── token = get_query_var('pm_contrato_token')
   │       ├── SE não tem token → "Token inválido"
   │       ├── contrato = get_by_token(token)
   │       ├── SE não existe → "Contrato não encontrado"
   │
   │       ├── BLOQUEIOS:
   │       │       ├── SE contrato cancelado → mensagem
   │       │       ├── SE contrato simplificado → mensagem
   │       │       ├── SE empresa não assinou → mensagem
   │       │       ├── SE status não permite assinatura → mensagem
   │       │       ├── SE já assinado → mensagem
   │       │       ├── SE assinatura=ok → mensagem sucesso
   │
   │       ├── ob_start()
   │       │       renderiza:
   │       │       - conteúdo do contrato
   │       │       - formulário de assinatura:
   │       │             nome
   │       │             checkbox de concordância
   │       │             nonce
   │       │             hidden token
   │       │             botão "Assinar"
   │       └── return buffer



MAPA DAS TABELAS USADAS
pm_contratos
pm_contratos_logs          (via PhotoMusic_Logs)
pm_eventos                 (via PhotoMusic_Events)
pm_logs_sistema            (via PhotoMusic_Logs)



DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_Shortcode
Controla toda a experiência de assinatura pública do contrato no PhotoMusic Pro.
Exibe o contrato via shortcode, processa a assinatura do contratante, registra logs, atualiza o status do contrato e do evento, gera o PDF final e recalcula o hash de integridade.
É o ponto de entrada público onde o cliente lê, confirma e assina o contrato com segurança, seguindo todas as validações necessárias.