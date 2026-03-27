<?php
// includes/core/class-photomusic-agenda.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Agenda {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
    }

    /* ============================================================
       MENU
    ============================================================ */
    public static function register_menu() {
        add_submenu_page(
            'photomusic-eventos',
            'Agenda',
            'Agenda',
            'pm_ver_eventos',
            'photomusic-agenda',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       RENDERIZA A PÁGINA DA AGENDA
    ============================================================ */
    public static function render_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        // Mês e ano atual ou via GET
        $mes_atual = intval($_GET['mes'] ?? date('n'));
        $ano_atual = intval($_GET['ano'] ?? date('Y'));

        // Garante limites válidos
        if ($mes_atual < 1 || $mes_atual > 12) $mes_atual = date('n');
        if ($ano_atual < 2020 || $ano_atual > 2040) $ano_atual = date('Y');

        // Navegação: mês anterior e próximo
        $prev_mes = $mes_atual - 1;
        $prev_ano = $ano_atual;
        if ($prev_mes < 1) { $prev_mes = 12; $prev_ano--; }

        $next_mes = $mes_atual + 1;
        $next_ano = $ano_atual;
        if ($next_mes > 12) { $next_mes = 1; $next_ano++; }

        // Carrega eventos do mês
        $eventos = self::get_eventos_do_mes($mes_atual, $ano_atual);

        // Agrupa por dia
        $por_dia = [];
        foreach ($eventos as $e) {
            if (empty($e->data_evento)) continue;
            $dia = intval(date('j', strtotime($e->data_evento)));
            $por_dia[$dia][] = $e;
        }

        // Dados do calendário
        $primeiro_dia_semana = intval(date('w', mktime(0, 0, 0, $mes_atual, 1, $ano_atual)));
        $total_dias          = intval(date('t', mktime(0, 0, 0, $mes_atual, 1, $ano_atual)));
        $hoje_dia            = (date('n') == $mes_atual && date('Y') == $ano_atual) ? intval(date('j')) : 0;

        $meses_nomes = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março',
            4 => 'Abril',   5 => 'Maio',      6 => 'Junho',
            7 => 'Julho',   8 => 'Agosto',    9 => 'Setembro',
            10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro',
        ];

        $url_prev = esc_url(add_query_arg(['page' => 'photomusic-agenda', 'mes' => $prev_mes, 'ano' => $prev_ano], admin_url('admin.php')));
        $url_next = esc_url(add_query_arg(['page' => 'photomusic-agenda', 'mes' => $next_mes, 'ano' => $next_ano], admin_url('admin.php')));
        $url_hoje = esc_url(add_query_arg(['page' => 'photomusic-agenda', 'mes' => date('n'), 'ano' => date('Y')], admin_url('admin.php')));

        ?>
        <div class="wrap">
            <h1>Agenda da Empresa</h1>

            <style>
                .pm-agenda-wrap        { max-width: 1100px; }
                .pm-agenda-nav         { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
                .pm-agenda-nav h2      { margin:0; font-size:1.4em; }
                .pm-agenda-nav a       { text-decoration:none; }
                .pm-cal                { width:100%; border-collapse:collapse; }
                .pm-cal th             { background:#2271b1; color:#fff; text-align:center;
                                         padding:8px; font-size:13px; }
                .pm-cal td             { width:14.28%; vertical-align:top; border:1px solid #ddd;
                                         padding:6px; min-height:90px; background:#fff; }
                .pm-cal td.pm-fora     { background:#f9f9f9; }
                .pm-cal td.pm-hoje     { background:#eaf4ff; }
                .pm-dia-num            { font-weight:700; font-size:13px; color:#333;
                                         margin-bottom:4px; display:block; }
                .pm-cal td.pm-hoje .pm-dia-num {
                                         background:#2271b1; color:#fff; border-radius:50%;
                                         width:24px; height:24px; display:inline-flex;
                                         align-items:center; justify-content:center; }
                .pm-evento-pill        { display:block; margin:2px 0; padding:2px 6px;
                                         border-radius:3px; font-size:11px; line-height:1.4;
                                         text-decoration:none; white-space:nowrap;
                                         overflow:hidden; text-overflow:ellipsis; }
                .pm-status-ativo       { background:#e6f6e9; color:#1b5e20; border-left:3px solid #2e7d32; }
                .pm-status-desativado  { background:#f5f5f5; color:#666; border-left:3px solid #bbb; }
                .pm-status-sem-contrato{ background:#fff8e1; color:#5d4037; border-left:3px solid #f9a825; }
                .pm-status-assinado    { background:#e3f2fd; color:#0d47a1; border-left:3px solid #1565c0; }
                .pm-legenda            { display:flex; gap:16px; margin:16px 0; flex-wrap:wrap; }
                .pm-legenda-item       { display:flex; align-items:center; gap:6px; font-size:12px; }
                .pm-legenda-cor        { width:14px; height:14px; border-radius:2px; flex-shrink:0; }
                .pm-resumo             { margin-top:24px; }
                .pm-resumo-grid        { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr));
                                         gap:12px; margin-top:12px; }
                .pm-resumo-card        { background:#fff; border:1px solid #ddd; border-radius:6px;
                                         padding:14px 18px; }
                .pm-resumo-num         { font-size:28px; font-weight:700; color:#2271b1; }
                .pm-resumo-label       { font-size:12px; color:#666; margin-top:2px; }
                .pm-conflito           { background:#fce4ec; border-left:3px solid #c62828;
                                         padding:6px 10px; border-radius:3px; font-size:12px;
                                         margin-bottom:8px; color:#b71c1c; }
            </style>

            <!-- NAVEGAÇÃO -->
            <div class="pm-agenda-nav">
                <a href="<?php echo $url_prev; ?>" class="button">← <?php echo $meses_nomes[$prev_mes]; ?></a>
                <h2><?php echo $meses_nomes[$mes_atual] . ' ' . $ano_atual; ?></h2>
                <a href="<?php echo $url_next; ?>" class="button"><?php echo $meses_nomes[$next_mes]; ?> →</a>
                <a href="<?php echo $url_hoje; ?>" class="button button-secondary">Hoje</a>
            </div>

            <!-- LEGENDA -->
            <div class="pm-legenda">
                <div class="pm-legenda-item">
                    <div class="pm-legenda-cor" style="background:#e6f6e9; border-left:3px solid #2e7d32;"></div>
                    Evento ativo
                </div>
                <div class="pm-legenda-item">
                    <div class="pm-legenda-cor" style="background:#e3f2fd; border-left:3px solid #1565c0;"></div>
                    Contrato assinado
                </div>
                <div class="pm-legenda-item">
                    <div class="pm-legenda-cor" style="background:#fff8e1; border-left:3px solid #f9a825;"></div>
                    Sem contrato assinado
                </div>
                <div class="pm-legenda-item">
                    <div class="pm-legenda-cor" style="background:#f5f5f5; border-left:3px solid #bbb;"></div>
                    Evento desativado
                </div>
            </div>

            <?php
            // Alerta de conflitos (dois ou mais eventos no mesmo dia)
            $conflitos = array_filter($por_dia, fn($evs) => count($evs) > 1);
            if (!empty($conflitos)) {
                foreach ($conflitos as $dia => $evs) {
                    $data_fmt = sprintf('%02d/%02d/%d', $dia, $mes_atual, $ano_atual);
                    echo '<div class="pm-conflito">⚠️ ' . count($evs) . ' eventos no mesmo dia: <strong>' . $data_fmt . '</strong> — verifique possível conflito de agenda.</div>';
                }
            }
            ?>

            <!-- CALENDÁRIO -->
            <table class="pm-cal">
                <thead>
                    <tr>
                        <th>Dom</th><th>Seg</th><th>Ter</th>
                        <th>Qua</th><th>Qui</th><th>Sex</th><th>Sáb</th>
                    </tr>
                </thead>
                <tbody>
                <?php
                $dia     = 1;
                $celula  = 0;
                $total_celulas = $primeiro_dia_semana + $total_dias;
                $linhas  = ceil($total_celulas / 7);

                for ($linha = 0; $linha < $linhas; $linha++) {
                    echo '<tr>';
                    for ($col = 0; $col < 7; $col++) {
                        $num_celula = $linha * 7 + $col;

                        if ($num_celula < $primeiro_dia_semana || $dia > $total_dias) {
                            echo '<td class="pm-fora"></td>';
                        } else {
                            $classe = 'pm-dia';
                            if ($dia === $hoje_dia) $classe .= ' pm-hoje';

                            $eventos_dia = $por_dia[$dia] ?? [];
                            echo '<td class="' . $classe . '">';
                            echo '<span class="pm-dia-num">' . $dia . '</span>';

                            foreach ($eventos_dia as $ev) {
                                $status_css = self::get_status_css($ev);
                                $label      = self::get_evento_label($ev);
                                $link       = esc_url(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $ev->id));
                                echo '<a href="' . $link . '" class="pm-evento-pill ' . $status_css . '" title="' . esc_attr($label) . '">' . esc_html($label) . '</a>';
                            }

                            echo '</td>';
                            $dia++;
                        }
                    }
                    echo '</tr>';
                }
                ?>
                </tbody>
            </table>

            <!-- RESUMO DO MÊS -->
            <?php
            $total_eventos    = count($eventos);
            $total_ativos     = count(array_filter($eventos, fn($e) => $e->status_evento === 'ativo'));
            $total_assinados  = count(array_filter($eventos, fn($e) => !empty($e->status_contrato) && in_array($e->status_contrato, ['assinado','assinado_admin','assinado_contratante'])));
            $total_sem_contrato = count(array_filter($eventos, fn($e) => empty($e->status_contrato) || $e->status_contrato === 'rascunho'));
            ?>
            <div class="pm-resumo">
                <h3>Resumo de <?php echo $meses_nomes[$mes_atual] . ' ' . $ano_atual; ?></h3>
                <div class="pm-resumo-grid">
                    <div class="pm-resumo-card">
                        <div class="pm-resumo-num"><?php echo $total_eventos; ?></div>
                        <div class="pm-resumo-label">Total de eventos</div>
                    </div>
                    <div class="pm-resumo-card">
                        <div class="pm-resumo-num" style="color:#2e7d32;"><?php echo $total_ativos; ?></div>
                        <div class="pm-resumo-label">Eventos ativos</div>
                    </div>
                    <div class="pm-resumo-card">
                        <div class="pm-resumo-num" style="color:#1565c0;"><?php echo $total_assinados; ?></div>
                        <div class="pm-resumo-label">Contratos assinados</div>
                    </div>
                    <div class="pm-resumo-card">
                        <div class="pm-resumo-num" style="color:#f9a825;"><?php echo $total_sem_contrato; ?></div>
                        <div class="pm-resumo-label">Sem contrato assinado</div>
                    </div>
                </div>
            </div>

            <!-- LISTA DETALHADA DO MÊS -->
            <?php if (!empty($eventos)): ?>
            <div class="pm-resumo" style="margin-top:32px;">
                <h3>Eventos do mês em detalhes</h3>
                <table class="widefat striped" style="margin-top:12px;">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Evento</th>
                            <th>Contratante</th>
                            <th>Tipo</th>
                            <th>Contrato</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($eventos as $ev): ?>
                        <?php
                            $data_fmt   = !empty($ev->data_evento) ? date('d/m/Y', strtotime($ev->data_evento)) : '—';
                            $contratante_nome = self::get_contratante_nome($ev);
                            $contrato_status  = self::get_contrato_badge($ev);
                            $link_evento = esc_url(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $ev->id));
                            $link_contrato = !empty($ev->id_contrato)
                                ? esc_url(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $ev->id_contrato))
                                : '';
                        ?>
                        <tr>
                            <td><strong><?php echo $data_fmt; ?></strong></td>
                            <td><?php echo esc_html($ev->motivo_evento); ?></td>
                            <td><?php echo esc_html($contratante_nome); ?></td>
                            <td><?php echo esc_html($ev->tipo_evento); ?></td>
                            <td><?php echo $contrato_status; ?></td>
                            <td>
                                <span style="font-size:11px; padding:2px 8px; border-radius:999px;
                                    background:<?php echo $ev->status_evento === 'ativo' ? '#e6f6e9' : '#f5f5f5'; ?>;
                                    color:<?php echo $ev->status_evento === 'ativo' ? '#1b5e20' : '#666'; ?>;">
                                    <?php echo $ev->status_evento === 'ativo' ? 'Ativo' : 'Desativado'; ?>
                                </span>
                            </td>
                            <td>
                                <a href="<?php echo $link_evento; ?>" class="button button-small">Ver evento</a>
                                <?php if ($link_contrato): ?>
                                    <a href="<?php echo $link_contrato; ?>" class="button button-small">Ver contrato</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>

        </div>
        <?php
    }

    /* ============================================================
       BUSCA EVENTOS DO MÊS COM STATUS DO CONTRATO
    ============================================================ */
    private static function get_eventos_do_mes($mes, $ano) {
        global $wpdb;

        $inicio = sprintf('%d-%02d-01', $ano, $mes);
        $fim    = sprintf('%d-%02d-%02d', $ano, $mes, cal_days_in_month(CAL_GREGORIAN, $mes, $ano));

        return $wpdb->get_results($wpdb->prepare(
            "SELECT e.*,
                    c.id            AS id_contrato,
                    c.status_contrato
             FROM   {$wpdb->prefix}pm_eventos e
             LEFT JOIN {$wpdb->prefix}pm_contratos c
                    ON c.id_evento = e.id
             WHERE  e.data_evento BETWEEN %s AND %s
             ORDER  BY e.data_evento ASC, e.id ASC",
            $inicio,
            $fim
        ));
    }

    /* ============================================================
       RETORNA A CLASSE CSS DO STATUS DO EVENTO
    ============================================================ */
    private static function get_status_css($ev) {
        if ($ev->status_evento === 'desativado') return 'pm-status-desativado';

        $assinados = ['assinado', 'assinado_admin', 'assinado_contratante'];
        if (!empty($ev->status_contrato) && in_array($ev->status_contrato, $assinados)) {
            return 'pm-status-assinado';
        }

        if (empty($ev->status_contrato) || $ev->status_contrato === 'rascunho') {
            return 'pm-status-sem-contrato';
        }

        return 'pm-status-ativo';
    }

    /* ============================================================
       RETORNA O LABEL DO EVENTO PARA O CALENDÁRIO
    ============================================================ */
    private static function get_evento_label($ev) {
        $nome = $ev->motivo_evento ?? 'Evento #' . $ev->id;
        // Abreviar para caber na célula
        return mb_strlen($nome) > 22 ? mb_substr($nome, 0, 20) . '…' : $nome;
    }

    /* ============================================================
       RETORNA O NOME DO CONTRATANTE
    ============================================================ */
    private static function get_contratante_nome($ev) {
        if (empty($ev->id_contratante)) return '—';
        $c = PhotoMusic_Contratantes::get($ev->id_contratante);
        if (!$c) return '—';
        return $c->nome ?? $c->razao_social ?? '—';
    }

    /* ============================================================
       RETORNA O BADGE DE STATUS DO CONTRATO
    ============================================================ */
    private static function get_contrato_badge($ev) {
        if (empty($ev->status_contrato)) {
            return '<span style="font-size:11px; color:#999;">Sem contrato</span>';
        }

        $mapa = [
            'rascunho'                         => ['Rascunho',         '#f5f5f5', '#666'],
            'aguardando_assinatura_admin'       => ['Aguarda admin',    '#fff3e0', '#e65100'],
            'aguardando_assinatura_contratante' => ['Aguarda cliente',  '#fff8e1', '#f57f17'],
            'assinado_admin'                    => ['Assinado (admin)', '#e8f5e9', '#2e7d32'],
            'assinado_contratante'              => ['Assinado (cliente)','#e3f2fd','#1565c0'],
            'assinado'                          => ['✔ Assinado',       '#e8f5e9', '#1b5e20'],
            'dispensado'                        => ['Dispensado',       '#f3e5f5', '#6a1b9a'],
            'cancelado'                         => ['Cancelado',        '#fce4ec', '#b71c1c'],
        ];

        $info = $mapa[$ev->status_contrato] ?? [$ev->status_contrato, '#f5f5f5', '#333'];
        return sprintf(
            '<span style="font-size:11px; padding:2px 8px; border-radius:999px; background:%s; color:%s;">%s</span>',
            $info[1], $info[2], $info[0]
        );
    }
}