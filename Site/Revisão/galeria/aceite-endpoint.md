DIAGRAMA COMPLETO — includes/galeria/class-photomusic-aceite-endpoint.php

PhotoMusic_Aceite_Endpoint
   ├── __construct()
   │       ├── carrega tabelas
   │       └── registra rota REST
   │
   ├── register_routes()
   │       └── POST /photomusic/v1/aceite
   │
   ├── handle_aceite(request)
   │       ├── sanitiza dados
   │       ├── valida evento
   │       ├── gera device_hash
   │       ├── registra device (pm_devices)
   │       ├── verifica aceite existente
   │       ├── insere novo aceite (pm_aceites_evento)
   │       ├── generate_token()
   │       └── retorna redirect
   │
   └── generate_token()
           └── hash SHA256(id_evento|id_aceite|timestamp|uuid)


MAPA DAS TABELAS USADAS
Tabela	            Uso
pm_eventos	        Validação do evento
pm_aceites_evento	Registro do aceite do convidado
pm_devices	        Registro do dispositivo (hash, IP, user agent)