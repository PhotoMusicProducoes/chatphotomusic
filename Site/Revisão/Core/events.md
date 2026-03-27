DIAGRAMA COMPLETO - includes/core/class-photomusic-events.php

PhotoMusic_Events
   ├── init()
   │       └── add_action('admin_menu', register_menu)
   │
   ├── register_menu()
   │       └── add_menu_page(
   │               título: PhotoMusic Eventos
   │               slug: photomusic-eventos
   │               permissão: pm_ver_eventos
   │               callback: render_eventos_page
   │               ícone: dashicons-camera
   │               posição: 26
   │           )
   │
   ├── render_eventos_page()
   │       ├── verifica permissão pm_ver_eventos
   │       ├── eventos = get_events()
   │       ├── imprime título e botão "Criar Novo Evento"
   │       ├── monta tabela:
   │       │       ├── ID
   │       │       ├── Motivo
   │       │       ├── Data
   │       │       ├── Contratante
   │       │       ├── Tipo
   │       │       ├── Status
   │       │       └── Ações:
   │       │               ├── Editar
   │       │               ├── Operador
   │       │               └── Contrato
   │       └── fim
   │
   ├── create_event($data)
   │       ├── valida tipo_evento (PF/PJ)
   │       ├── valida motivo_evento
   │       ├── cria contratante:
   │       │       ├── PF → PhotoMusic_Contratantes::create_pf()
   │       │       └── PJ → PhotoMusic_Contratantes::create_pj()
   │       ├── INSERT em pm_eventos:
   │       │       tipo_evento
   │       │       motivo_evento
   │       │       data_evento
   │       │       codigo_interno (generate_code EVT)
   │       │       id_contratante
   │       │       status_evento = ativo
   │       │       criado_por
   │       │       criado_em
   │       ├── id_evento = insert_id
   │       ├── criar contrato rascunho:
   │       │       PhotoMusic_Contratos::criar_contrato_simplificado()
   │       ├── registrar histórico:
   │       │       PhotoMusic_Events::registrar_historico("Evento criado.")
   │       └── return id_evento
   │
   ├── update_event($id_evento, $data)
   │       ├── valida id_evento
   │       ├── monta array $update:
   │       │       motivo_evento?
   │       │       data_evento?
   │       │       status_evento?
   │       ├── UPDATE pm_eventos SET ... atualizado_em = now()
   │       ├── SE existe contratante no $data:
   │       │       ├── carrega contratante
   │       │       ├── SE PF → update_pf()
   │       │       └── SE PJ → update_pj()
   │       ├── registrar histórico:
   │       │       PhotoMusic_Events::registrar_historico("Evento atualizado.")
   │       └── return true
   │
   ├── get_events($args)
   │       ├── monta WHERE dinâmico:
   │       │       status_evento?
   │       │       tipo_evento?
   │       ├── SELECT * FROM pm_eventos
   │       │       WHERE filtros
   │       │       ORDER BY data_evento DESC, id DESC
   │       └── retorna array de objetos
   │
   ├── update_status($id_evento, $status)
   │       ├── core = new PhotoMusic_Events_Core()
   │       └── return core->update_status()
   │
   └── registrar_historico($id_evento, $acao, $detalhes)
           ├── core = new PhotoMusic_Events_Core()
           └── return core->registrar_historico()


MAPA DAS TABELAS USADAS
pm_eventos
pm_contratantes
pm_contratos
pm_event_history   (via wrapper)
pm_event_messages  (via wrapper)

DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Events
Controlador administrativo dos eventos no painel WordPress.  
Exibe a listagem de eventos, cria novos eventos PF/PJ, atualiza dados, integra com contratantes, contratos e histórico.
Serve como camada de interface entre o administrador e o núcleo de eventos (PhotoMusic_Events_Core).
Não contém lógica de negócio pesada — apenas orquestra chamadas ao core e renderiza telas.

