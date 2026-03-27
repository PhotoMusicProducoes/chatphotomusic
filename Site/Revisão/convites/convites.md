DIAGRAMA COMPLETO - includes/convites/class-photomusic-convites.php

PhotoMusic_Convites
   ├── init()
   │       └── (reservado para futuras telas e funcionalidades)
   │
   ├── create_convite($id_evento, $dados)
   │       ├── 1) Validar evento
   │       │       ├── get_event($id_evento)
   │       │       ├── SE não existe → erro
   │       │       └── SE status_evento = desativado → erro
   │       │
   │       ├── 2) Validar serviço
   │       │       ├── id_servico obrigatório
   │       │       ├── get_service($id_servico)
   │       │       ├── SE serviço não pertence ao evento → erro
   │       │       └── SE serviço desativado → erro
   │       │
   │       ├── 3) Gerar token seguro
   │       │       └── PhotoMusic_Token_Generator::generate_convite_token()
   │       │
   │       ├── 4) Criar registro em pm_convites
   │       │       ├── id_evento
   │       │       ├── token_convite
   │       │       ├── telefone
   │       │       ├── email
   │       │       ├── nome_convidado
   │       │       ├── canal_origem
   │       │       ├── idioma_preferido
   │       │       └── criado_em
   │       │
   │       ├── 5) Criar registro em pm_acessos_galeria
   │       │       ├── id_evento
   │       │       ├── id_servico
   │       │       ├── telefone
   │       │       ├── token_acesso = token_convite
   │       │       ├── device_hash = null
   │       │       ├── acessos_hoje = 0
   │       │       ├── acessos_total = 0
   │       │       └── criado_em
   │       │
   │       ├── 6) Gerar link final
   │       │       └── /galeria/{slug_servico}/?token={token}
   │       │
   │       ├── 7) Enviar WhatsApp automaticamente
   │       │       ├── template = get_option('pm_msg_convite')
   │       │       ├── mensagem = build_message(template, variáveis)
   │       │       └── WhatsApp::send(telefone, mensagem, metadata)
   │       │
   │       └── 8) Retornar:
   │               token
   │               link
   │               id_convite


MAPA DAS TABELAS USADAS
pm_convites
pm_acessos_galeria
pm_eventos          (via PhotoMusic_Events)
pm_servicos         (via PhotoMusic_Services)


DESCRIÇÃO OFICIAL — PhotoMusic_Convites
Gerencia a criação de convites individuais para acesso à galeria e serviços do evento.
Valida evento e serviço, gera token seguro, cria registros em pm_convites e pm_acessos_galeria, monta o link final e envia automaticamente a mensagem via WhatsApp usando o template configurado.
É a camada central que conecta evento → serviço → convite → acesso → WhatsApp.

