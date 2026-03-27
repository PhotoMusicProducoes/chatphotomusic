DIAGRAMA COMPLETO - includes/core/class-photomusic-access-rules.php

PhotoMusic_Access_Rules
   ├── validate_guest_access($id_evento, $id_servico, $token, $device_hash)
   │       ├── define tabelas:
   │       │       pm_eventos
   │       │       pm_event_services
   │       │       pm_acessos_galeria
   │       │
   │       ├── 1) Validar evento
   │       │       ├── SELECT * FROM pm_eventos WHERE id = ?
   │       │       ├── SE não existe → WP_Error('evento_inexistente')
   │       │       ├── SE status_evento = desativado → WP_Error('evento_desativado')
   │       │
   │       ├── 2) Validar serviço
   │       │       ├── SELECT * FROM pm_event_services WHERE id = ? AND id_evento = ?
   │       │       ├── SE não existe → WP_Error('servico_inexistente')
   │       │       ├── SE status_servico = desativado → WP_Error('servico_desativado')
   │       │
   │       ├── 3) Carregar regras de acesso (JSON)
   │       │       ├── limite_diario
   │       │       ├── expira_com_evento
   │       │       ├── bloqueio_dispositivo
   │       │       ├── bloqueio_ip
   │       │       └── auditoria
   │       │
   │       ├── 4) Validar token
   │       │       ├── SELECT * FROM pm_acessos_galeria
   │       │       │       WHERE token_acesso = ?
   │       │       │       AND id_evento = ?
   │       │       │       AND id_servico = ?
   │       │       ├── SE não existe → WP_Error('token_invalido')
   │       │
   │       ├── 5) Validar expiração
   │       │       ├── SE expira_com_evento = true
   │       │       │       E evento.status_evento = desativado
   │       │       │       → WP_Error('evento_encerrado')
   │       │
   │       ├── 6) Validar dispositivo
   │       │       ├── SE bloqueio_dispositivo = true
   │       │       │       E device_hash != acesso.device_hash
   │       │       │       → WP_Error('dispositivo_bloqueado')
   │       │
   │       ├── 7) Validar limite diário
   │       │       ├── hoje = Y-m-d
   │       │       ├── SE ultimo_acesso != hoje:
   │       │       │       ├── zera acessos_hoje
   │       │       │       └── atualiza ultimo_acesso
   │       │       ├── SE acessos_hoje >= limite_diario
   │       │       │       → WP_Error('limite_diario')
   │       │
   │       ├── 8) Validar IP (opcional)
   │       │       ├── ip_atual = REMOTE_ADDR
   │       │       ├── SE bloqueio_ip = true
   │       │       │       E acesso.ip != ip_atual
   │       │       │       → WP_Error('ip_bloqueado')
   │       │
   │       ├── 9) Registrar auditoria e atualizar contadores
   │       │       ├── acessos_hoje++
   │       │       ├── acessos_total++
   │       │       ├── ultimo_acesso = hoje
   │       │       ├── SE bloqueio_ip → update ip
   │       │       ├── SE auditoria:
   │       │       │       navegador
   │       │       │       dispositivo = detect_device()
   │       │       │       user_agent
   │       │       ├── UPDATE pm_acessos_galeria SET ...
   │       │
   │       └── return true
   │
   └── detect_device()
           ├── lê HTTP_USER_AGENT
           ├── contém 'iPhone'   → return 'iPhone'
           ├── contém 'iPad'     → return 'iPad'
           ├── contém 'Android'  → return 'Android'
           ├── contém 'Windows'  → return 'Windows'
           ├── contém 'Mac'      → return 'Mac'
           └── return 'Desconhecido'


MAPA DAS TABELAS USADAS
pm_eventos
pm_event_services
pm_acessos_galeria


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Access_Rules
Responsável por validar o acesso de convidados aos serviços do evento (galeria, cabine, fotos, etc.).  
Implementa regras avançadas de segurança: token, dispositivo, IP, limite diário, expiração com o evento e auditoria completa.
É a camada que garante que cada convidado só acesse o conteúdo autorizado, no dispositivo correto e dentro das regras definidas pelo fotógrafo.