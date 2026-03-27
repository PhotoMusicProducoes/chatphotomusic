DIAGRAMA COMPLETO — includes/contratos/class-photomusic-contratos-logs.php

PhotoMusic_Contratos_Logs
   ├── registrar(contrato_id, acao, dados_extra)
   │       ├── pega usuário atual
   │       ├── coleta IP e user agent
   │       ├── monta array de log
   │       ├── insere em pm_contratos_logs
   │       └── fim
   │
   ├── listar(contrato_id)
   │       ├── SELECT * FROM pm_contratos_logs WHERE contrato_id = ?
   │       └── return resultados
   │
   └── render_admin_logs(contrato_id)
           ├── chama listar()
           ├── SE vazio → "Nenhum log registrado"
           ├── monta tabela HTML
           ├── exibe data, ação, usuário, IP, user agent, detalhes
           └── fim

MAPA DAS TABELAS USADAS
pm_contratos_logs


Campos esperados:

Campo	    Tipo	   Descrição
id	        bigint	   chave primária
contrato_id	bigint	    ID do contrato
acao	    varchar	    tipo da ação
dados	    text	    detalhes extras
data	    datetime	data/hora
ip	        varchar	    IP do usuário
user_agent	text	    navegador
user_id	    bigint	    ID do usuário WP
user_nome	varchar	    nome do usuário


DESCDESCRIÇÃO OFICIAL — PhotoMusic_Contratos_Logs
Gerencia o sistema de auditoria do módulo de contratos.
Registra todas as ações relevantes realizadas em um contrato, incluindo criação, edição, envio para assinatura, assinaturas, cancelamento e geração de PDF.
Cada log contém informações detalhadas como data, IP, user agent, usuário responsável e dados adicionais.
Também fornece métodos para listar e exibir logs no painel administrativo.