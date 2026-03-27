DIAGRAMA COMPLETO — includes/contratos/class-photomusic-contratos-view.php

PhotoMusic_Contratos_View
   ├── render()
   │       ├── valida GET[token]
   │       │       └── SE não existir → wp_die("Token inválido")
   │       │
   │       ├── contrato = PhotoMusic_Contratos::get_by_token(token)
   │       │       └── SE não existir → wp_die("Contrato não encontrado")
   │       │
   │       ├── exibe título:
   │       │       "Contrato #ID"
   │       │
   │       ├── exibe status do contrato
   │       │
   │       ├── exibe conteúdo HTML:
   │       │       wp_kses_post(conteudo)
   │       │
   │       ├── SE status == aguardando_assinatura_contratante
   │       │       ├── FORMULÁRIO DE ASSINATURA
   │       │       │       ├── nonce: pm_assinar_contratante
   │       │       │       ├── hidden: action = pm_assinar_contratante
   │       │       │       ├── hidden: contrato_id
   │       │       │       ├── campo: nome completo
   │       │       │       └── botão: Assinar Contrato
   │       │
   │       ├── SE status == assinado OU assinado_contratante
   │       │       └── mensagem: "Este contrato já foi assinado."
   │       │
   │       └── fim do render()


MAPA DAS AÇÕES admin-post USADAS
pm_assinar_contratante


DESCRIÇÃO OFICIAL — PhotoMusic_Contratos_View
Classe responsável por exibir a visualização pública do contrato, acessada via token único.
Mostra o conteúdo completo do contrato, o status atual e, quando aplicável, exibe o formulário de assinatura do contratante.
Valida o token, carrega o contrato correspondente e garante que apenas contratos pendentes de assinatura possam ser assinados.
É a interface pública do módulo de contratos, usada pelo cliente final.