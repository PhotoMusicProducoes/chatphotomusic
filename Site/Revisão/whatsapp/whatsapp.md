DIAGRAMA COMPLETO — class-photomusic-whatsapp.php

PhotoMusic_WhatsApp
   ├── send()
   │       ├── sanitiza telefone e mensagem
   │       ├── escolhe provedor
   │       ├── envia via método correspondente
   │       └── registra log
   │
   ├── send_dslboot()
   ├── send_lumaboot()
   ├── send_generic_api()
   │       └── wp_remote_post()
   │
   ├── handle_response()
   │       ├── trata WP_Error
   │       ├── valida HTTP code
   │       └── retorna sucesso ou erro
   │
   ├── build_message()
   │       └── substitui {variaveis} no template
   │
   └── send_pdf_zapi()
           ├── valida telefone
           ├── valida URL
           ├── monta payload
           ├── envia documento
           └── retorna resposta

MAPA DAS TABELAS USADAS
pm_logs  → registra envios de WhatsApp


DESCRIÇÃO OFICIAL — PhotoMusic_WhatsApp
Gerencia todos os envios de mensagens via WhatsApp no PhotoMusic Pro.
Suporta múltiplos provedores (DSLBoot, LumaBoot, API Genérica e Z-API), padroniza requisições, trata respostas, registra logs e permite envio de PDFs e mensagens personalizadas com variáveis dinâmicas.
É a camada central de comunicação automática do sistema.

