DIAGRAMA COMPLETO — includes/galeria/class-photomusic-controller-galeria.php

PhotoMusic_Galeria_Controller
   ├── __construct()
   │       ├── carrega $wpdb
   │       ├── define tabela pm_eventos
   │       ├── define tabela pm_aceites_evento
   │       └── define tabela pm_devices
   │
   ├── handle_request()
   │       ├── lê evento_slug e token
   │       ├── valida token SHA256
   │       ├── busca evento por codigo_interno
   │       ├── valida aceite via hash SHA2(...)
   │       ├── valida device_hash
   │       ├── registrar_acesso()
   │       └── render_template()
   │
   ├── registrar_acesso(id_evento, id_aceite)
   │       ├── coleta IP e user_agent
   │       └── insere log em pm_logs
   │
   └── render_template(evento, aceite)
           ├── valida existência do template
           ├── prepara variáveis
           └── inclui galeria.php


MAPA DE DEPENDÊNCIAS
Depende de:
PhotoMusic_Helpers::is_valid_sha256()
PhotoMusic_Helpers::device_hash()
Tabelas:
    pm_eventos
    pm_aceites_evento
    pm_logs
    pm_devices (reservado para uso futuro)

Template:
    includes/galeria/templates/galeria.php

Usa:
get_query_var()
sanitize_text_field()
wp_die()
$wpdb->get_row()
$wpdb->insert()
file_exists()
include

DESCRIÇÃO OFICIAL — PhotoMusic_Galeria_Controller
Controlador principal da galeria protegida do PhotoMusic Pro.
Recebe requisições da rota amigável, valida token SHA256, valida evento, valida aceite, valida dispositivo, registra logs de acesso e carrega o template final da galeria.
É a camada de segurança mais importante da galeria, garantindo que apenas dispositivos autorizados e aceites válidos possam visualizar o conteúdo.