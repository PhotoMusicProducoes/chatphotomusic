DIAGRAMA COMPLETO — includes/contratos/class-photomusic-contratos-list.php

PhotoMusic_Contratos_List
   ├── render()
   │       ├── contratos = PhotoMusic_Contratos::get_all()
   │       │
   │       ├── <h1>Contratos</h1>
   │       │
   │       ├── BOTÃO: Novo Contrato
   │       │       ├── apply_filters('photomusic_contratos_show_btn_criar')
   │       │       └── link: admin.php?page=photomusic_contratos&action=novo
   │       │
   │       ├── TABELA (HTML)
   │       │       ├── COLUNAS:
   │       │       │       ID
   │       │       │       Evento
   │       │       │       Cliente
   │       │       │       Status
   │       │       │       Ações
   │       │
   │       ├── LOOP contratos:
   │       │       ├── linha: id, evento_nome, cliente_nome, status_contrato
   │       │       │
   │       │       ├── AÇÕES POR LINHA:
   │       │       │
   │       │       ├── BOTÃO: Editar
   │       │       │       ├── apply_filters('photomusic_contratos_show_btn_editar')
   │       │       │       └── link: admin.php?page=photomusic_contratos&action=editar&id=ID
   │       │       │
   │       │       ├── BOTÃO: Enviar para Assinatura Interna
   │       │       │       ├── SE status == rascunho
   │       │       │       ├── apply_filters('photomusic_contratos_show_btn_enviar')
   │       │       │       └── admin-post.php?action=pm_enviar_assinatura&contrato_id=ID
   │       │       │
   │       │       ├── BOTÃO: Cancelar
   │       │       │       ├── SE status != assinado
   │       │       │       ├── apply_filters('photomusic_contratos_show_btn_cancelar')
   │       │       │       └── admin-post.php?action=pm_cancelar_contrato&contrato_id=ID
   │       │       │
   │       │       ├── BOTÃO: Assinar como Empresa
   │       │       │       ├── SE status == aguardando_assinatura_admin
   │       │       │       ├── apply_filters('photomusic_contratos_show_btn_assinar')
   │       │       │       └── admin-post.php?action=pm_assinar_empresa&contrato_id=ID
   │       │       │
   │       │       └── (todos os links usam wp_nonce_url)
   │       │
   │       └── fim do render()



O que este diagrama representa?
Ele mostra exatamente onde e como os filtros de permissão entram na UI da listagem:

✔ photomusic_contratos_show_btn_criar
Controla o botão Novo Contrato

✔ photomusic_contratos_show_btn_editar
Controla o botão Editar

✔ photomusic_contratos_show_btn_enviar
Controla o botão Enviar para Assinatura Interna

✔ photomusic_contratos_show_btn_cancelar
Controla o botão Cancelar

✔ photomusic_contratos_show_btn_assinar
Controla o botão Assinar como Empresa

Todos esses filtros são processados pela classe
PhotoMusic_Contratos_Permissoes

MAPA DAS FUNÇÕES EXTERNAS USADAS
PhotoMusic_Contratos::get_all()
apply_filters()
admin_url()
wp_nonce_url()
esc_html()

MAPA DAS PERMISSÕES USADAS AQUI
pm_criar_contratos
pm_editar_contratos
pm_enviar_para_assinatura
pm_cancelar_contratos
pm_assinar_contratos

MAPA DAS PERMISSÕES USADAS (via filtros)
photomusic_contratos_show_btn_criar
photomusic_contratos_show_btn_editar
photomusic_contratos_show_btn_enviar
photomusic_contratos_show_btn_cancelar
photomusic_contratos_show_btn_assinar


DESCRIÇÃO OFICIAL — Integração UI da Listagem
Classe responsável por exibir a listagem de contratos no painel administrativo do PhotoMusic Pro.
Mostra todos os contratos cadastrados, incluindo evento, cliente, status e ações disponíveis.
Os botões exibidos (criar, editar, enviar para assinatura, cancelar, assinar como empresa) são controlados por permissões via filtros, garantindo que cada usuário veja apenas o que tem autorização para executar.
A listagem é construída em HTML puro, seguindo o padrão visual do WordPress.

