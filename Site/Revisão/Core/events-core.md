PhotoMusic_Events_Core
   ├── __construct()
   │       ├── define $this->tbl_eventos
   │       ├── define $this->tbl_history
   │       ├── define $this->tbl_messages
   │       ├── define $this->tbl_contratantes
   │       └── define $this->tbl_contratos
   │
   ├── get_evento_completo()
   │       ├── valida id_evento
   │       ├── SELECT * FROM pm_eventos WHERE id = ?
   │       ├── SE evento tem id_contratante:
   │       │       └── SELECT * FROM pm_contratantes WHERE id = ?
   │       ├── SENÃO:
   │       │       ├── SELECT id_contratante FROM pm_contratos WHERE id_evento = ?
   │       │       └── SELECT * FROM pm_contratantes WHERE id = ?
   │       ├── SE classe PhotoMusic_Servicos existe:
   │       │       └── servicos = PhotoMusic_Servicos::get_evento_servicos()
   │       ├── historico = listar_historico()
   │       ├── mensagens = listar_mensagens()
   │       └── retorna array completo:
   │               evento + contratante + servicos + historico + mensagens
   │
   ├── update_status()
   │       ├── valida id_evento
   │       ├── sanitiza status
   │       ├── UPDATE pm_eventos SET status_evento = ?, atualizado_em = now()
   │       ├── registrar_historico("Status atualizado para: X")
   │       └── return true
   │
   ├── registrar_historico()
   │       ├── valida id_evento
   │       ├── usuario_id = get_current_user_id()
   │       ├── INSERT INTO pm_event_history:
   │       │       id_evento
   │       │       acao
   │       │       detalhes
   │       │       usuario_id
   │       │       criado_em
   │       └── fim
   │
   ├── listar_historico()
   │       ├── valida id_evento
   │       ├── SELECT * FROM pm_event_history
   │       │       WHERE id_evento = ?
   │       │       ORDER BY criado_em DESC, id DESC
   │       └── retorna array
   │
   ├── registrar_mensagem()
   │       ├── valida id_evento
   │       ├── INSERT INTO pm_event_messages:
   │       │       id_evento
   │       │       id_servico (opcional)
   │       │       chat_id
   │       │       direction
   │       │       tipo
   │       │       mensagem
   │       │       enviado_em
   │       └── fim
   │
   └── listar_mensagens()
           ├── valida id_evento
           ├── SELECT * FROM pm_event_messages
           │       WHERE id_evento = ?
           │       ORDER BY enviado_em DESC, id DESC
           └── retorna array

$this->tbl_eventos        → pm_eventos
$this->tbl_history        → pm_event_history
$this->tbl_messages       → pm_event_messages
$this->tbl_contratantes   → pm_contratantes
$this->tbl_contratos      → pm_contratos


DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Events_Core
Núcleo de dados do módulo de eventos.  
Carrega o evento completo (evento + contratante + serviços + histórico + mensagens).
Atualiza status, registra histórico, registra mensagens e fornece acesso centralizado aos dados do evento.
É a camada de integração entre eventos, serviços, contratantes, contratos, WhatsApp e financeiro.