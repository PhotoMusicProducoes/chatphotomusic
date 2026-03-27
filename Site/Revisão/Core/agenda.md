DIAGRAMA COMPLETO — includes/core/class-photomusic-agenda.php

PhotoMusic_Agenda
   ├── init()
   │       └── add_action('admin_menu', register_menu)
   │
   ├── register_menu()   (public static)
   │       ├── verifica capability pm_ver_eventos
   │       └── add_submenu_page(
   │               parent:   photomusic-eventos,
   │               título:   Agenda,
   │               slug:     photomusic-agenda,
   │               callback: render_page
   │           )
   │
   ├── render_page()   (public static)
   │       ├── verifica capability pm_ver_eventos
   │       │
   │       ├── lê parâmetros GET:
   │       │       ├── mes  → mês a exibir (padrão: mês atual)
   │       │       └── ano  → ano a exibir (padrão: ano atual)
   │       │
   │       ├── calcula navegação:
   │       │       ├── prev_mes / prev_ano  ← mês anterior
   │       │       └── next_mes / next_ano  ← mês seguinte
   │       │
   │       ├── get_eventos_do_mes(mes, ano)
   │       │       └── retorna todos os eventos com status do contrato
   │       │
   │       ├── agrupa eventos por dia → $por_dia[dia][]
   │       │
   │       ├── calcula dados do calendário:
   │       │       ├── primeiro_dia_semana  (0=Dom … 6=Sáb)
   │       │       ├── total_dias           (28, 29, 30 ou 31)
   │       │       └── hoje_dia             (destaque visual)
   │       │
   │       ├── renderiza navegação:
   │       │       ├── botão ← mês anterior
   │       │       ├── título "Mês Ano"
   │       │       ├── botão → mês seguinte
   │       │       └── botão Hoje
   │       │
   │       ├── renderiza legenda de cores:
   │       │       ├── verde    → evento ativo
   │       │       ├── azul     → contrato assinado
   │       │       ├── amarelo  → sem contrato assinado
   │       │       └── cinza    → evento desativado
   │       │
   │       ├── detecta conflitos de data:
   │       │       ├── filtra dias com 2+ eventos
   │       │       └── exibe alerta vermelho por dia conflitante
   │       │
   │       ├── renderiza calendário (grade 7 colunas):
   │       │       ├── para cada célula do mês:
   │       │       │       ├── exibe número do dia
   │       │       │       ├── destaca dia atual (círculo azul)
   │       │       │       └── para cada evento do dia:
   │       │       │               ├── get_status_css(ev) → classe de cor
   │       │       │               ├── get_evento_label(ev) → texto abreviado
   │       │       │               └── link → photomusic-evento-detalhes&id=
   │       │       └── células fora do mês ficam em cinza claro
   │       │
   │       ├── renderiza resumo do mês (cards):
   │       │       ├── total de eventos
   │       │       ├── eventos ativos
   │       │       ├── contratos assinados
   │       │       └── sem contrato assinado
   │       │
   │       └── renderiza lista detalhada:
   │               colunas: Data | Evento | Contratante | Tipo |
   │                        Contrato | Status | Ações
   │               ├── get_contratante_nome(ev)
   │               ├── get_contrato_badge(ev)
   │               ├── link → photomusic-evento-detalhes&id=
   │               └── link → photomusic-contrato-detalhes&id= (se existir)
   │
   ├── get_eventos_do_mes($mes, $ano)   (private static)
   │       ├── calcula $inicio = YYYY-MM-01
   │       ├── calcula $fim    = YYYY-MM-último_dia
   │       ├── query:
   │       │       SELECT e.*, c.id AS id_contrato, c.status_contrato
   │       │       FROM pm_eventos e
   │       │       LEFT JOIN pm_contratos c ON c.id_evento = e.id
   │       │       WHERE e.data_evento BETWEEN %s AND %s
   │       │       ORDER BY data_evento ASC, id ASC
   │       └── retorna array de objetos (evento + contrato)
   │
   ├── get_status_css($ev)   (private static)
   │       ├── status_evento = 'desativado'  → 'pm-status-desativado'
   │       ├── status_contrato IN
   │       │   (assinado, assinado_admin, assinado_contratante)
   │       │                              → 'pm-status-assinado'
   │       ├── status_contrato = 'rascunho'
   │       │   ou sem contrato           → 'pm-status-sem-contrato'
   │       └── demais                    → 'pm-status-ativo'
   │
   ├── get_evento_label($ev)   (private static)
   │       ├── usa motivo_evento ou 'Evento #ID'
   │       └── trunca em 22 caracteres + '…' para caber na célula
   │
   ├── get_contratante_nome($ev)   (private static)
   │       ├── SE sem id_contratante → retorna '—'
   │       ├── PhotoMusic_Contratantes::get(id_contratante)
   │       └── retorna nome ou razao_social ou '—'
   │
   └── get_contrato_badge($ev)   (private static)
           ├── SE sem contrato → span "Sem contrato" cinza
           └── mapa de status → badge colorido:
                   rascunho                         → cinza
                   aguardando_assinatura_admin       → laranja
                   aguardando_assinatura_contratante → amarelo
                   assinado_admin                    → verde claro
                   assinado_contratante              → azul claro
                   assinado                          → verde escuro ✔
                   dispensado                        → roxo
                   cancelado                         → vermelho



MAPA DE TABELAS USADAS

Tabela                  Tipo de acesso    Campos lidos
pm_eventos              SELECT            id, motivo_evento, data_evento,
                                          status_evento, tipo_evento, id_contratante
pm_contratos            LEFT JOIN         id, status_contrato
pm_contratantes         SELECT (helper)   id, nome, razao_social



MAPA DE DEPENDÊNCIAS

Depende de:
PhotoMusic_Users::current_user_can('pm_ver_eventos')
    → verifica permissão de acesso à página

PhotoMusic_Contratantes::get($id)
    → busca nome do contratante para a lista detalhada

cal_days_in_month(CAL_GREGORIAN, $mes, $ano)
    → função nativa PHP para total de dias do mês

add_query_arg() / admin_url()
    → monta URLs de navegação e links de ações

esc_url() / esc_html() / esc_attr()
    → sanitização de saída em todo o HTML gerado



MAPA DE INTEGRAÇÃO NO SISTEMA

photomusic-pro.php
   ├── autoload:
   │       require_once .../core/class-photomusic-agenda.php
   └── init_modules:
           PhotoMusic_Agenda::init()

class-photomusic-admin-menu.php
   └── não precisa de alteração — a agenda registra
       seu próprio submenu via add_action('admin_menu')

Acesso no painel:
   WP Admin → PhotoMusic → Agenda
   URL: admin.php?page=photomusic-agenda
   URL com mês: admin.php?page=photomusic-agenda&mes=3&ano=2026



MAPA DE CLASSES CSS GERADAS

.pm-agenda-nav          barra de navegação de mês
.pm-cal                 tabela do calendário
.pm-cal th              cabeçalho (Dom-Sáb) — fundo azul
.pm-cal td              célula de dia
.pm-cal td.pm-fora      célula fora do mês — cinza claro
.pm-cal td.pm-hoje      célula do dia atual — azul claro
.pm-dia-num             número do dia na célula
.pm-evento-pill         pílula de evento clicável na célula
.pm-status-ativo        pílula verde — evento ativo sem contrato especial
.pm-status-assinado     pílula azul — contrato assinado
.pm-status-sem-contrato pílula amarela — sem contrato ou rascunho
.pm-status-desativado   pílula cinza — evento desativado
.pm-legenda             barra de legenda de cores
.pm-resumo-grid         grid de cards do resumo mensal
.pm-resumo-card         card individual do resumo
.pm-conflito            alerta vermelho de conflito de data



FLUXO COMPLETO DE NAVEGAÇÃO

Admin acessa PhotoMusic → Agenda
   ├── sem parâmetros → exibe mês atual
   ├── clica ← → carrega ?mes=N-1&ano=YYYY
   ├── clica → → carrega ?mes=N+1&ano=YYYY
   ├── clica Hoje → carrega mês/ano atuais
   ├── clica pílula de evento → abre detalhes do evento
   ├── clica "Ver evento" na lista → abre detalhes do evento
   └── clica "Ver contrato" na lista → abre detalhes do contrato



DESCRIÇÃO OFICIAL — PhotoMusic_Agenda
Exibe o calendário mensal da empresa com todos os eventos registrados no sistema.
Cada evento aparece como pílula colorida no dia correspondente, indicando visualmente
o status do contrato (assinado, pendente, sem contrato, desativado).
Detecta e alerta conflitos de data (dois eventos no mesmo dia), exibe resumo mensal
com totais de eventos e contratos, e lista detalhada com links diretos para cada
evento e contrato. Navegação por mês com botões anterior, próximo e hoje.
Não cria tabelas próprias — lê dados de pm_eventos e pm_contratos.


DESCRIÇÃO REDUZIDA
Calendário mensal de eventos da empresa com indicação visual de status de contrato,
alertas de conflito de data, resumo do mês e lista detalhada com links diretos.
