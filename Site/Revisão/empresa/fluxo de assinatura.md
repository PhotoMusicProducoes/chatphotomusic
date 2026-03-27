DIAGRAMA COMPLETO — Fluxo Interno de Assinatura da Empresa

FLUXO INTERNO DE ASSINATURA DA EMPRESA
PhotoMusic_Contratos (painel admin)
   ├── Operador cria contrato
   │       └── status = rascunho
   │
   ├── Operador revisa e preenche dados
   │       └── pode editar tudo
   │
   ├── Operador clica "Enviar para assinatura interna"
   │       ├── update_status('aguardando_assinatura_admin')
   │       ├── registrar log
   │       └── registrar histórico do evento
   │
   ├── Representante legal acessa o contrato no admin
   │       ├── botão "Assinar como Empresa"
   │       └── somente usuários com meta pm_assinar_contratos = 1
   │
   ├── Representante clica "Assinar como Empresa"
   │       ├── valida nonce
   │       ├── valida permissão
   │       ├── contrato = get(id)
   │       ├── SE status != aguardando_assinatura_admin → erro
   │       ├── SE representante não autorizado → erro
   │       │
   │       ├── registrar assinatura:
   │       │       assinatura_admin_nome
   │       │       assinatura_admin_id
   │       │       assinatura_admin_data
   │       │       assinatura_admin_ip
   │       │       assinatura_admin_useragent
   │       │
   │       ├── update_status('assinado_admin')
   │       ├── registrar log
   │       ├── registrar histórico do evento
   │       │
   │       ├── gerar PDF pré-assinado (opcional)
   │       └── redirect com msg=empresa_assinou
   │
   ├── Sistema muda automaticamente para:
   │       status = aguardando_assinatura_contratante
   │
   └── Cliente recebe link público para assinar


VISÃO EM CAMADAS (Arquitetura)
Camada Admin (Operador)
   ├── cria contrato
   ├── edita contrato
   └── envia para assinatura interna

Camada Admin (Representante Legal)
   ├── visualiza contrato
   ├── valida dados
   └── assina como empresa

Camada Sistema
   ├── atualiza status
   ├── registra logs
   ├── registra histórico
   ├── gera PDF
   └── libera contrato para cliente

Camada Pública (Cliente)
   └── assina contrato via token

EVENTOS E STATUS ENVOLVIDOS
Status do contrato
rascunho
aguardando_assinatura_admin
assinado_admin
aguardando_assinatura_contratante
assinado
cancelado

Status do evento (PhotoMusic_Events)
contrato_em_validacao
contrato_assinado_empresa
contrato_assinado

Logs
contrato enviado para assinatura interna
contrato assinado pela empresa
IP e user agent do representante
hash atualizado
PDF gerado

OBJETOS E CLASSES ENVOLVIDAS
PhotoMusic_Contratos
   ├── update_status()
   ├── registrar_assinatura_admin()
   ├── get()
   └── get_by_token()

PhotoMusic_Representantes
   ├── CRUD de representantes
   └── permissões

PhotoMusic_Helpers_Representantes
   ├── get_representante_padrao()
   ├── get_dados()
   └── usuario_pode_assinar()

PhotoMusic_Contratos_PDF
   └── gerar_pdf()

PhotoMusic_Logs
   └── add()

PhotoMusic_Event_History
   └── add()


FLUXO RESUMIDO (para documentação)
1. Operador cria contrato → rascunho
2. Operador envia para assinatura interna → aguardando_assinatura_admin
3. Representante legal assina → assinado_admin
4. Sistema libera para cliente → aguardando_assinatura_contratante
5. Cliente assina → assinado
6. PDF final gerado



