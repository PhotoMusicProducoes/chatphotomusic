DIAGRAMA COMPLETO - includes/core/class-photomusic-logs.php

PhotoMusic_Logs
   ├── init()
   │       └── (reservado para futura tela de logs no admin)
   │
   ├── add($tipo, $id_evento, $id_servico, $id_convite, $id_aceite, $mensagem)
   │       ├── table = pm_logs_sistema
   │       ├── ip = REMOTE_ADDR
   │       ├── ua = HTTP_USER_AGENT
   │       ├── navegador  = detect_browser(ua)
   │       ├── dispositivo = detect_device(ua)
   │       │
   │       ├── INSERT INTO pm_logs_sistema:
   │       │       tipo
   │       │       id_evento
   │       │       id_servico
   │       │       id_convite
   │       │       id_aceite
   │       │       mensagem
   │       │       ip
   │       │       navegador
   │       │       dispositivo
   │       │       user_agent
   │       │       criado_em = now()
   │       └── fim
   │
   ├── get_by_event($id_evento)
   │       ├── SELECT * FROM pm_logs_sistema
   │       │       WHERE id_evento = ?
   │       │       ORDER BY criado_em DESC
   │       └── retorna array de objetos
   │
   ├── get_by_service($id_servico)
   │       ├── SELECT * FROM pm_logs_sistema
   │       │       WHERE id_servico = ?
   │       │       ORDER BY criado_em DESC
   │       └── retorna array de objetos
   │
   ├── get_by_type($tipo)
   │       ├── SELECT * FROM pm_logs_sistema
   │       │       WHERE tipo = ?
   │       │       ORDER BY criado_em DESC
   │       └── retorna array de objetos
   │
   ├── detect_browser($ua)
   │       ├── contém 'Chrome'  → return 'Chrome'
   │       ├── contém 'Firefox' → return 'Firefox'
   │       ├── contém 'Safari'  → return 'Safari'
   │       ├── contém 'Edge'    → return 'Edge'
   │       └── return 'Desconhecido'
   │
   └── detect_device($ua)
           ├── contém 'iPhone'  → return 'iPhone'
           ├── contém 'iPad'    → return 'iPad'
           ├── contém 'Android' → return 'Android'
           └── return 'Desktop'


MAPA DAS TABELAS USADAS
pm_logs_sistema


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Logs
Sistema central de auditoria do PhotoMusic Pro.  
Registra ações críticas do sistema, incluindo eventos, serviços, convites, acessos e operações internas.
Armazena IP, navegador, dispositivo, user agent e mensagem detalhada, permitindo rastrear qualquer ação realizada no sistema.
Fornece métodos para consultar logs por evento, serviço ou tipo, servindo como base para auditoria, segurança e diagnóstico.