DIAGRAMA COMPLETO — includes/stats/class-photomusic-stats.php

PhotoMusic_Stats
   └── get_event_stats($id_evento)
           ├── id_evento = intval($id_evento)
           ├── acessos_convidados_total
           │       └── SUM(acessos_total) em pm_acessos_galeria
           ├── acessos_convidados_hoje
           │       └── SUM(acessos_hoje) em pm_acessos_galeria
           ├── acessos_contratante
           │       ├── verifica existência de pm_logs
           │       └── COUNT(*) em pm_logs com acao = 'login_contratante'
           └── retorna array:
                   acessos_convidados_total
                   acessos_convidados_hoje
                   acessos_contratante


MAPA DAS TABELAS USADAS
pm_acessos_galeria  → soma acessos de convidados
pm_logs             → conta logins do contratante (se existir)


DESCRIÇÃO OFICIAL — PhotoMusic_Stats
Fornece estatísticas básicas de acesso por evento no PhotoMusic Pro.
Agrupa acessos de convidados (totais e do dia, conforme a modelagem da tabela) e contabiliza logins do contratante a partir da tabela de logs, quando disponível.
É uma camada de leitura, sem escrita, usada para dashboards, relatórios e telas de acompanhamento de engajamento da galeria.


OBS:
Se você quiser, a gente pode evoluir essa classe depois para:

ranking de eventos mais acessados

taxa de engajamento por serviço

comparativo contratante x convidados