DIAGRAMA COMPLETO — includes/galeria/class-photomusic-gallery-endpoint.php

PhotoMusic_Gallery_Endpoint
   ├── handle_request()
   │       ├── valida evento_slug e servico_slug
   │       ├── valida evento
   │       ├── valida serviço
   │       ├── carrega links do serviço
   │       ├── gera device_hash
   │       ├── verifica aceite único por evento
   │       ├── verifica limite diário por serviço
   │       └── render_galeria()
   │
   ├── generate_device_hash()
   │       └── hash(ua|ip)
   │
   ├── render_form_aceite()
   │       └── exibe formulário com nonce
   │
   └── render_galeria()
           └── exibe iframes protegidos


MAPA DAS TABELAS USADAS
Tabela	            Uso
pm_eventos	        Validação do evento
pm_servicos	        Validação do serviço e carregamento de links
pm_aceites_evento	Verifica aceite único por dispositivo
pm_acessos_galeria	Controle de limite diário por serviço

DESCRIÇÃO OFICIAL — PhotoMusic_Gallery_Endpoint
Endpoint avançado da galeria protegida do PhotoMusic Pro.
Valida evento e serviço via slug, carrega links configurados, gera hash único por dispositivo, verifica aceite único por evento, aplica limite diário de acessos por serviço e exibe a galeria protegida.
É responsável por controlar o fluxo completo de acesso seguro à galeria via rotas amigáveis.