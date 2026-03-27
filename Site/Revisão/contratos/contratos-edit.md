DIAGRAMA COMPLETO — includes/contratos/class-photomusic-contratos-edit.php

PhotoMusic_Contratos_Edit
   ├── render()
   │       ├── valida parâmetro GET[id]
   │       │       └── SE não existir → wp_die("Contrato inválido")
   │       │
   │       ├── contrato = PhotoMusic_Contratos::get(id)
   │       │       └── SE não existir → wp_die("Contrato não encontrado")
   │       │
   │       ├── valida status + permissão
   │       │       └── PhotoMusic_Contratos_Permissoes::validar_status_para_edicao(contrato)
   │       │
   │       ├── exibe título:
   │       │       "Editar Contrato #ID"
   │       │
   │       ├── FORMULÁRIO (POST → admin-post.php)
   │       │       ├── nonce: pm_editar_contrato
   │       │       ├── hidden: action = pm_editar_contrato
   │       │       ├── hidden: contrato_id
   │       │
   │       │       ├── SEÇÃO: Informações do Evento
   │       │       │       ├── evento_nome
   │       │       │       └── evento_data
   │       │
   │       │       ├── SEÇÃO: Informações do Cliente
   │       │       │       ├── cliente_nome
   │       │       │       └── cliente_email
   │       │
   │       │       ├── SEÇÃO: Informações Financeiras
   │       │       │       └── valor_total
   │       │
   │       │       ├── BOTÃO: Salvar Alterações
   │       │       │       ├── aparece SE:
   │       │       │       │       apply_filters('photomusic_contratos_show_btn_editar')
   │       │       │       └── envia POST para pm_editar_contrato
   │       │
   │       ├── BOTÃO: Enviar para Assinatura Interna
   │       │       ├── aparece SE:
   │       │       │       status == rascunho
   │       │       │       apply_filters('photomusic_contratos_show_btn_enviar')
   │       │       └── admin-post.php?action=pm_enviar_assinatura
   │       │
   │       ├── BOTÃO: Cancelar Contrato
   │       │       ├── aparece SE:
   │       │       │       status != assinado
   │       │       │       apply_filters('photomusic_contratos_show_btn_cancelar')
   │       │       └── admin-post.php?action=pm_cancelar_contrato
   │       │
   │       └── BOTÃO: Assinar como Empresa
   │               ├── aparece SE:
   │               │       status == aguardando_assinatura_admin
   │               │       apply_filters('photomusic_contratos_show_btn_assinar')
   │               └── admin-post.php?action=pm_assinar_empresa



MAPA DAS PERMISSÕES USADAS
photomusic_contratos_show_btn_editar
photomusic_contratos_show_btn_enviar
photomusic_contratos_show_btn_cancelar
photomusic_contratos_show_btn_assinar

Esses filtros são conectados diretamente à classe:
PhotoMusic_Contratos_Permissoes

MAPA DAS AÇÕES admin-post USADAS
pm_editar_contrato
pm_enviar_assinatura
pm_cancelar_contrato
pm_assinar_empresa


DESCRIÇÃO OFICIAL — class-photomusic-contratos-edit.php
Gerencia a tela de edição de contratos no painel administrativo do PhotoMusic Pro.
Carrega o contrato, valida status e permissões e exibe um formulário com dados do evento, cliente e informações financeiras.
Os botões de ação — “Salvar alterações”, “Enviar para assinatura interna”, “Cancelar contrato” e “Assinar como empresa” — são exibidos dinamicamente conforme o status do contrato e as permissões do usuário.
Garante que apenas contratos em rascunho possam ser editados e que ações sensíveis só sejam executadas por usuários autorizados.

