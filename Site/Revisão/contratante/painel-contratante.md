DIAGRAMA COMPLETO — includes/contratante/class-photomusic-painel-contratante.php

PhotoMusic_Painel_Contratante
   ├── init()
   │     ├── add_shortcode('painel_contratante', render_painel)
   │     ├── add_action('init', processar_envio_whatsapp)
   │     ├── add_action('init', processar_envio_whatsapp_servico)
   │     └── add_action('init', processar_export_csv_aceites)
   │
   ├── render_painel()
   │     ├── valida evento e login do contratante
   │     ├── carrega evento, serviços, stats, aceites
   │     ├── monta export_url com nonce
   │     ├── exibe:
   │     │     ├── header do painel + botão WhatsApp
   │     │     ├── status do termo
   │     │     ├── visão geral de acessos
   │     │     ├── tabela de aceites únicos
   │     │     └── lista de serviços + ações (abrir, copiar, enviar WhatsApp)
   │     └── retorna buffer HTML
   │
   ├── processar_envio_whatsapp()
   │     ├── valida POST + nonce
   │     ├── chama enviar_whatsapp_contratante()
   │     ├── trata WP_Error
   │     └── redireciona com ok/erro
   │
   ├── processar_envio_whatsapp_servico()
   │     ├── valida POST + nonce
   │     ├── chama enviar_whatsapp_servico()
   │     ├── trata WP_Error
   │     └── redireciona com ok/erro
   │
   ├── enviar_whatsapp_contratante(id_evento)
   │     ├── carrega evento
   │     ├── valida telefone
   │     ├── carrega template pm_msg_contratante
   │     ├── monta link painel
   │     ├── monta mensagem via PhotoMusic_WhatsApp::build_message()
   │     └── envia via PhotoMusic_WhatsApp::send()
   │
   ├── enviar_whatsapp_servico(id_evento, id_servico)
   │     ├── carrega evento e serviço
   │     ├── valida vínculo serviço/evento
   │     ├── valida telefone
   │     ├── carrega template pm_msg_convite (ou default)
   │     ├── monta link da galeria
   │     ├── monta mensagem via PhotoMusic_WhatsApp::build_message()
   │     └── envia via PhotoMusic_WhatsApp::send()
   │
   └── processar_export_csv_aceites()
         ├── valida GET, evento, login e nonce
         ├── consulta aceites únicos no banco
         ├── envia headers CSV
         ├── escreve cabeçalho
         ├── escreve linhas com dados dos aceites
         └── exit


MAPA DE DEPENDÊNCIAS
Depende de:
PhotoMusic_Contratante::is_logged_in()
PhotoMusic_Events::get_event()
PhotoMusic_Services::get_services_by_event()
PhotoMusic_Services::get_service()
PhotoMusic_Termo_Contratante::contratante_aceitou() (opcional)
PhotoMusic_Stats::get_event_stats() (opcional)
PhotoMusic_WhatsApp::build_message()
PhotoMusic_WhatsApp::send()
$wpdb e tabela {$wpdb->prefix}pm_aceites

Usa:
Shortcode [painel_contratante]
add_action('init', ...)
wp_nonce_field, wp_verify_nonce
wp_redirect, home_url, add_query_arg
esc_html, esc_attr, esc_url, esc_js
WP_Error
header() + fputcsv() para export CSV

DESCRIÇÃO OFICIAL
Gerencia todo o painel do contratante no PhotoMusic Pro.
Exibe estatísticas de acessos, lista de aceites únicos, serviços do evento e ações rápidas como abrir galeria, copiar link e enviar links via WhatsApp (painel e galeria por serviço).
Permite exportar os aceites em CSV com validação de login e nonce, garantindo segurança.
Integra com eventos, serviços, stats, WhatsApp e o módulo de aceites, oferecendo uma visão completa e operacional do evento para o contratante.