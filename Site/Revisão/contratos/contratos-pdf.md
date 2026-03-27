DIAGRAMA COMPLETO - includes/contratos/class-photomusic-contratos-pdf.php

PhotoMusic_Contratos_PDF
   ├── gerar_pdf(contrato)
   │       ├── verifica se Dompdf existe
   │       │       └── SE não existir → wp_die("Biblioteca Dompdf não encontrada.")
   │       │
   │       ├── configura Options() do Dompdf
   │       ├── instancia Dompdf(options)
   │       │
   │       ├── html = template_pdf(contrato)
   │       │
   │       ├── carrega CSS externo:
   │       │       pdf-style.css
   │       │
   │       ├── dompdf->loadHtml('<style>CSS</style>' + html)
   │       ├── dompdf->setPaper('A4', 'portrait')
   │       ├── dompdf->render()
   │       │
   │       ├── upload_dir = wp_upload_dir()
   │       ├── cria diretório /uploads/contratos se não existir
   │       │
   │       ├── arquivo_fisico = /uploads/contratos/contrato-ID.pdf
   │       ├── file_put_contents(arquivo_fisico)
   │       │
   │       ├── url_publica = uploads_url/contratos/contrato-ID.pdf
   │       ├── PhotoMusic_Contratos::salvar_pdf(id, url_publica)
   │       │
   │       └── return url_publica
   │
   └── template_pdf(contrato)
           ├── link_publico = home_url('/contrato/' + token)
           │
           ├── require phpqrcode
           ├── qr_dir = /uploads/contratos/qrcodes
           ├── cria qr_dir se não existir
           ├── qr_file = qr-ID.png
           ├── QRcode::png(link_publico, qr_file)
           │
           ├── inicia buffer (ob_start)
           │
           ├── HTML DO PDF:
           │       ├── logo
           │       ├── título
           │       ├── conteúdo do contrato
           │       ├── assinatura contratante
           │       ├── assinatura admin
           │       ├── QR Code local
           │       ├── link público
           │       └── hash do contrato
           │
           └── return ob_get_clean()


MAPA DAS TABELAS USADAS
pm_contratos   (via PhotoMusic_Contratos::salvar_pdf)

MAPA DAS PERMISSÕES USADAS
A classe NÃO usa permissões diretamente.

A permissão para gerar PDF é controlada na classe principal:
PhotoMusic_Contratos::salvar_pdf()

Que exige:
pm_editar_contratos


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_PDF
Classe responsável por gerar o PDF final do contrato no módulo PhotoMusic Pro.
Utiliza a biblioteca Dompdf para renderizar o conteúdo HTML do contrato, aplicando um CSS externo dedicado para garantir um layout profissional.
O PDF inclui o conteúdo do contrato, assinaturas, hash de integridade e um QR Code gerado localmente via phpqrcode, garantindo segurança e independência de serviços externos.
Após a renderização, o arquivo é salvo no diretório /uploads/contratos e sua URL pública é registrada no banco de dados através de PhotoMusic_Contratos::salvar_pdf(), permitindo fácil compartilhamento e download.

