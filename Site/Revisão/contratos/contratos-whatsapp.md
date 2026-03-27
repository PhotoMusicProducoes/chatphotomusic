DIAGRAMA COMPLETO — includes/contratos/class-photomusic-contratos-whatsapp.php

PhotoMusic_Contratos_WhatsApp
   ├── init()
   │       ├── add_action('photomusic_contrato_enviado', enviar_para_contratante)
   │       ├── add_action('photomusic_contrato_assinado_contratante', notificar_admin)
   │       └── add_action('photomusic_contrato_finalizado', enviar_pdf_final)
   │
   ├── enviar_para_contratante(contrato, link_publico)
   │       ├── valida telefone
   │       ├── template = pm_msg_convite
   │       ├── mensagem = build_message()
   │       ├── PhotoMusic_WhatsApp::send()
   │       └── registrar log
   │
   ├── notificar_admin(contrato, link_publico)
   │       ├── telefone_admin = get_option()
   │       ├── mensagem = texto fixo
   │       ├── PhotoMusic_WhatsApp::send()
   │       └── registrar log
   │
   ├── enviar_pdf_final(contrato, pdf_url)
   │       ├── valida telefone
   │       ├── mensagem = texto fixo
   │       ├── PhotoMusic_WhatsApp::send_pdf_zapi()
   │       └── registrar log
   │
   └── gerar_link(telefone, mensagem)
           └── retorna link wa.me formatado


MAPA DAS TABELAS USADAS
A classe não acessa tabelas diretamente, mas usa:
pm_contratos_logs via: PhotoMusic_Contratos_Logs::registrar()

E depende de:
pm_contratos
pm_eventos

MAPA DAS INTEGRAÇÕES
Integra com o módulo de WhatsApp:
PhotoMusic_WhatsApp::send()
PhotoMusic_WhatsApp::send_pdf_zapi()
PhotoMusic_WhatsApp::build_message()

Integra com o módulo de contratos:
PhotoMusic_Contratos
PhotoMusic_Contratos_PDF
PhotoMusic_Contratos_Logs

Integra com o módulo de eventos:
photomusic_contrato_enviado
photomusic_contrato_assinado_contratante
photomusic_contrato_finalizado

DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_WhatsApp
Gerencia toda a comunicação via WhatsApp relacionada aos contratos.
Envia automaticamente o link do contrato para o contratante, notifica o administrador quando o cliente assina e envia o PDF final via Z-API.
Utiliza a infraestrutura do módulo WhatsApp do PhotoMusic Pro, incluindo DSLBoot, LumaBoot, API Genérica e Z-API.
Registra logs detalhados de cada envio e permite gerar links manuais para botões no painel administrativo.

