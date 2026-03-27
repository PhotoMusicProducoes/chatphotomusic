DIAGRAMA COMPLETO — includes/contratante/class-photomusic-aceites.php

PhotoMusic_Aceites
   ├── init()
   │     └── add_action('rest_api_init', register_routes)
   │
   ├── register_routes()
   │     └── register_rest_route('photomusic/v1', '/aceite', POST → handle_aceite, permission_callback = true)
   │
   ├── handle_aceite($request)
   │     ├── lê JSON (tokenConvite, nome, telefone, email, idioma, pais, estado, cidade)
   │     ├── valida token
   │     ├── busca convite em wp_pm_convites
   │     ├── carrega evento (PhotoMusic_Events::get_event)
   │     ├── bloqueia evento desativado
   │     ├── busca acesso em wp_pm_acessos_galeria (id_servico)
   │     ├── monta dados do aceite (nome, telefone, email, idioma)
   │     ├── coleta IP e user agent
   │     ├── detecta navegador, SO e dispositivo
   │     ├── verifica aceite existente em wp_pm_aceites por:
   │     │       ├── id_evento
   │     │       ├── telefone OU email OU id_convite
   │     ├── SE existir:
   │     │       ├── atualiza IP, navegador, SO, dispositivo, user_agent, idioma, atualizado_em
   │     │       ├── registra log "Aceite já existia..."
   │     │       └── retorna sucesso com reutilizado = true
   │     ├── SENÃO:
   │     │       ├── insere novo registro em wp_pm_aceites
   │     │       ├── registra log "Aceite registrado via API."
   │     │       └── retorna sucesso com id_aceite
   │
   ├── detect_browser(ua)
   │     └── Chrome | Firefox | Safari | Edge | Desconhecido
   │
   ├── detect_os(ua)
   │     └── Windows | MacOS | Android | iOS | Desconhecido
   │
   ├── detect_device(ua)
   │     └── iPhone | iPad | Android | Desktop
   │
   └── render_relatorio()
         ├── lista eventos em wp_pm_eventos
         ├── para cada evento:
         │     ├── busca aceites únicos (GROUP BY telefone, email) em wp_pm_aceites
         │     ├── exibe tabela HTML com nome, telefone, email, IP, dispositivo, navegador, aceite_em
         └── saída HTML para uso no admin


MAPA DAS TABELAS USADAS
wp_pm_convites
    Localiza o convite pelo token_convite.
    Campos usados: id, id_evento, nome_convidado, telefone, email, idioma_preferido, canal_origem.

wp_pm_eventos
    Carrega dados básicos do evento para validação e relatório.
    Campos usados: id, motivo_evento, data_evento, status_evento.

wp_pm_acessos_galeria
    Relaciona token de acesso à galeria com o serviço.
    Campos usados: token_acesso, id_servico.

wp_pm_aceites
    Registro central de aceites de convidados.
    Campos usados:
        id, id_convite, id_evento, id_servico, id_termos_versao
        nome, telefone, email
        ip, pais, estado, cidade
        navegador, sistema_operacional, dispositivo, user_agent
        idioma_navegador, canal_origem
        aceite_em, status_envio, criado_em, atualizado_em

DESCRIÇÃO OFICIAL
Centraliza o registro de aceites de convidados no PhotoMusic Pro via API REST.
Recebe o aceite a partir do token do convite, valida evento e status, identifica o serviço relacionado, coleta dados de contexto (IP, navegador, SO, dispositivo, idioma, localização) e garante a regra de um aceite por evento por pessoa (telefone/email/id_convite).
Atualiza aceites existentes com novos metadados ou cria novos registros, registrando logs de auditoria.
Inclui um relatório HTML interno que lista aceites únicos por evento, facilitando análise e conformidade com LGPD.