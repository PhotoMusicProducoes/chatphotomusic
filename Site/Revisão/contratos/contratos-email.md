DIAGRAMA COMPLETO — class-photomusic-contratos-email.php

PhotoMusic_Contratos_Email
   ├── init()
   │       ├── add_action('photomusic_contrato_enviado', enviar_para_cliente)
   │       ├── add_action('photomusic_contrato_assinado_contratante', enviar_para_admin)
   │       └── add_action('photomusic_contrato_finalizado', enviar_pdf_final)
   │
   ├── enviar_para_cliente(contrato, link_publico)
   │       ├── valida email
   │       ├── monta template_email_cliente()
   │       ├── wp_mail()
   │       └── registrar log
   │
   ├── enviar_para_admin(contrato, link_publico)
   │       ├── email_admin = get_option('admin_email')
   │       ├── monta template_email_admin()
   │       ├── wp_mail()
   │       └── registrar log
   │
   ├── enviar_pdf_final(contrato, pdf_url)
   │       ├── valida email
   │       ├── monta template_email_pdf()
   │       ├── anexo = arquivo físico do PDF
   │       ├── wp_mail() com ou sem anexo
   │       └── registrar log
   │
   ├── template_email_cliente()
   ├── template_email_admin()
   └── template_email_pdf()


MAPA DAS TABELAS USADAS
A classe não acessa tabelas diretamente, mas registra logs em:
pm_contratos_logs
E depende de:
pm_contratos


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_Email
Gerencia todo o fluxo de comunicação por e-mail do módulo de contratos.
Envia o contrato para o cliente assinar, notifica o administrador quando o cliente assina e envia o PDF final após a conclusão do processo.
Inclui templates HTML, suporte a anexos, integração com logs e gatilhos automáticos via hooks internos do plugin.