DIAGRAMA COMPLETO — includes/servicos/class-photomusic-servicos.php

PhotoMusic_Servicos
   ├── init()
   │       ├── Define tabelas:
   │       │       pm_servicos
   │       │       pm_servicos_subtipos
   │       │       pm_servicos_pacotes
   │       │       pm_servicos_regras
   │       │       pm_eventos_servicos
   │
   ├── listar_servicos($apenas_ativos)
   │       ├── SELECT * FROM pm_servicos
   │       ├── WHERE ativo = 1 (opcional)
   │       └── ORDER BY ordem, nome
   │
   ├── get_servico($id)
   │       └── SELECT * FROM pm_servicos WHERE id = ?
   │
   ├── listar_subtipos($id_servico)
   │       └── SELECT * FROM pm_servicos_subtipos WHERE id_servico = ? AND ativo = 1
   │
   ├── get_subtipo($id)
   │       └── SELECT * FROM pm_servicos_subtipos WHERE id = ?
   │
   ├── listar_pacotes($id_servico, $id_subtipo)
   │       ├── SELECT * FROM pm_servicos_pacotes WHERE id_servico = ?
   │       ├── AND id_subtipo = ? (opcional)
   │       └── ORDER BY ordem
   │
   ├── get_pacote($id)
   │       └── SELECT * FROM pm_servicos_pacotes WHERE id = ?
   │
   ├── get_regras_por_celebracao($id_servico, $celebracao)
   │       └── SELECT * FROM pm_servicos_regras WHERE id_servico = ? AND celebracao = ?
   │
   ├── calcular_horas_permitidas($id_servico, $celebracao)
   │       ├── regras = get_regras_por_celebracao()
   │       ├── SE não houver regras → min=1, max=12
   │       └── SENÃO → retorna horas_min e horas_max
   │
   ├── salvar_evento_servicos($id_evento, $servicos)
   │       ├── DELETE FROM pm_eventos_servicos WHERE id_evento = ?
   │       ├── LOOP servicos:
   │       │       INSERT:
   │       │           id_evento
   │       │           id_servico
   │       │           id_subtipo
   │       │           id_pacote
   │       │           horas_contratadas
   │       │           fotos_contratadas
   │       │           valor_base
   │       │           valor_adicional
   │       │           valor_final
   │       │           observacoes
   │
   └── get_evento_servicos($id_evento)
           └── SELECT * FROM pm_eventos_servicos WHERE id_evento = ?


MAPA DAS TABELAS USADAS
pm_servicos
pm_servicos_subtipos
pm_servicos_pacotes
pm_servicos_regras
pm_eventos_servicos

DESCRIÇÃO OFICIAL — PhotoMusic_Servicos
Gerencia todo o catálogo de serviços do PhotoMusic Pro, incluindo serviços principais, subtipos, pacotes e regras específicas por celebração.
Também controla os serviços contratados de cada evento, permitindo salvar combinações completas de serviço + subtipo + pacote + horas + fotos + valores.
É a camada central que conecta o evento ao que realmente foi contratado, servindo de base para contratos, financeiro, convites e relatórios.