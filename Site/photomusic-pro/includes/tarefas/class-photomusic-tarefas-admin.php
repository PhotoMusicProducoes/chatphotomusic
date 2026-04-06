<?php
// includes/tarefas/class-photomusic-tarefas-admin.php
// Painel administrativo de tarefas

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tarefas_Admin {

    public static function init() {
        add_action('admin_menu',        [__CLASS__, 'registrar_menu'], 25);
        add_action('admin_bar_menu',    [__CLASS__, 'badge_admin_bar'], 100);
        add_action('admin_post_pm_concluir_tarefa', [__CLASS__, 'processar_concluir']);
        add_action('admin_post_pm_cancelar_tarefa', [__CLASS__, 'processar_cancelar']);
        add_action('admin_post_pm_criar_tarefa',    [__CLASS__, 'processar_criar']);
        add_action('admin_head',        [__CLASS__, 'badge_css']);
    }

    /* ============================================================
       CSS BADGE NO MENU
    ============================================================ */
    public static function badge_css() {
        $total = PhotoMusic_Tarefas::count_abertas();
        if ($total < 1) return;
        echo '<style>
        .pm-badge {
            display:inline-block;
            background:#d63638;
            color:#fff;
            border-radius:10px;
            padding:1px 6px;
            font-size:11px;
            font-weight:600;
            margin-left:6px;
            line-height:1.6;
        }
        </style>';
    }

    /* ============================================================
       REGISTRAR SUBMENU
    ============================================================ */
    public static function registrar_menu() {
        $total = PhotoMusic_Tarefas::count_abertas();
        $badge = $total > 0 ? ' <span class="pm-badge">' . $total . '</span>' : '';

        add_submenu_page(
            'photomusic-eventos',
            'Tarefas',
            'Tarefas' . $badge,
            'manage_options',
            'photomusic-tarefas',
            [__CLASS__, 'render_pagina']
        );
    }

    /* ============================================================
       BADGE NA BARRA DO ADMIN
    ============================================================ */
    public static function badge_admin_bar(WP_Admin_Bar $bar) {
        $total = PhotoMusic_Tarefas::count_abertas();
        if ($total < 1) return;

        $bar->add_node([
            'id'    => 'pm-tarefas',
            'title' => '📋 Tarefas <span style="background:#d63638;color:#fff;border-radius:8px;padding:1px 6px;font-size:11px;">' . $total . '</span>',
            'href'  => admin_url('admin.php?page=photomusic-tarefas'),
            'meta'  => ['title' => 'Ver tarefas abertas'],
        ]);
    }

    /* ============================================================
       PÁGINA PRINCIPAL — LISTA GERAL
    ============================================================ */
    public static function render_pagina() {
        if (!current_user_can('manage_options')) wp_die('Acesso negado.');

        $filtro_status      = sanitize_text_field($_GET['status']      ?? 'pendente');
        $filtro_responsavel = sanitize_text_field($_GET['responsavel'] ?? '');
        $msg_ok = $_GET['ok'] ?? '';

        $tarefas = PhotoMusic_Tarefas::get_all([
            'status'      => $filtro_status ?: 'pendente',
            'responsavel' => $filtro_responsavel,
        ]);
        ?>
        <div class="wrap">
            <h1>📋 Tarefas</h1>

            <?php if ($msg_ok === 'concluida'): ?>
                <div class="notice notice-success is-dismissible"><p>✅ Tarefa marcada como concluída.</p></div>
            <?php elseif ($msg_ok === 'cancelada'): ?>
                <div class="notice notice-warning is-dismissible"><p>Tarefa cancelada.</p></div>
            <?php elseif ($msg_ok === 'criada'): ?>
                <div class="notice notice-success is-dismissible"><p>✅ Tarefa criada com sucesso.</p></div>
            <?php endif; ?>

            <!-- FILTROS -->
            <form method="get" style="margin-bottom:16px;">
                <input type="hidden" name="page" value="photomusic-tarefas">
                <select name="status" onchange="this.form.submit()">
                    <option value="pendente"  <?php selected($filtro_status,'pendente');  ?>>Pendente</option>
                    <option value="concluida" <?php selected($filtro_status,'concluida'); ?>>Concluída</option>
                    <option value="cancelada" <?php selected($filtro_status,'cancelada'); ?>>Cancelada</option>
                    <option value=""          <?php selected($filtro_status,'');          ?>>Todas</option>
                </select>
                <select name="responsavel" onchange="this.form.submit()">
                    <option value="">Todos responsáveis</option>
                    <option value="photomusic" <?php selected($filtro_responsavel,'photomusic'); ?>>📌 PhotoMusic</option>
                    <option value="cliente"    <?php selected($filtro_responsavel,'cliente');    ?>>👤 Cliente</option>
                </select>
            </form>

            <!-- NOVA TAREFA -->
            <details style="margin-bottom:20px;">
                <summary style="cursor:pointer;font-weight:600;color:#2271b1;">➕ Adicionar tarefa manualmente</summary>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>"
                      style="background:#f9f9f9;padding:16px;border:1px solid #ddd;border-radius:6px;margin-top:10px;max-width:700px;">
                    <?php wp_nonce_field('pm_criar_tarefa'); ?>
                    <input type="hidden" name="action" value="pm_criar_tarefa">
                    <table class="form-table" style="margin:0;">
                        <tr>
                            <th>Evento</th>
                            <td>
                                <?php
                                global $wpdb;
                                $eventos = $wpdb->get_results(
                                    "SELECT e.id, e.data_evento, e.nome_contratante, e.razao_social
                                     FROM {$wpdb->prefix}pm_eventos e
                                     WHERE e.status_evento != 'concluido'
                                     ORDER BY e.data_evento DESC
                                     LIMIT 200"
                                );
                                ?>
                                <select name="id_evento" required style="min-width:320px;">
                                    <option value="">— Selecione o evento —</option>
                                    <?php foreach ($eventos as $ev):
                                        $nome = $ev->nome_contratante ?: $ev->razao_social ?: '(sem nome)';
                                        $data = $ev->data_evento ? date('d/m/Y', strtotime($ev->data_evento)) : '—';
                                    ?>
                                        <option value="<?php echo intval($ev->id); ?>">
                                            #<?php echo intval($ev->id); ?> — <?php echo esc_html($nome); ?> (<?php echo $data; ?>)
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Responsável</th>
                            <td>
                                <select name="responsavel">
                                    <option value="photomusic">📌 PhotoMusic</option>
                                    <option value="cliente">👤 Cliente</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Tipo</th>
                            <td>
                                <select name="tipo">
                                    <?php foreach (PhotoMusic_Tarefas::tipos() as $k => $v): ?>
                                        <option value="<?php echo esc_attr($k); ?>"><?php echo esc_html($v); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Descrição</th>
                            <td><textarea name="descricao" rows="2" style="width:100%;max-width:400px;"></textarea></td>
                        </tr>
                        <tr>
                            <th>Data prevista</th>
                            <td><input type="date" name="data_prevista"></td>
                        </tr>
                    </table>
                    <p><button type="submit" class="button button-primary">Criar Tarefa</button></p>
                </form>
            </details>

            <!-- TABELA -->
            <?php if (empty($tarefas)): ?>
                <p><em>Nenhuma tarefa encontrada com os filtros selecionados.</em></p>
            <?php else: ?>
            <table class="widefat striped" style="max-width:1100px;">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Responsável</th>
                        <th>Tarefa</th>
                        <th>Cliente / Evento</th>
                        <th>Data Prevista</th>
                        <th>Notif.</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($tarefas as $p): ?>
                    <?php
                    $icone_resp  = $p->responsavel === 'photomusic' ? '📌' : '👤';
                    $label_resp  = $p->responsavel === 'photomusic' ? 'PhotoMusic' : 'Cliente';
                    $data_prev   = $p->data_prevista ? date('d/m/Y', strtotime($p->data_prevista)) : '—';
                    $data_evento = $p->data_evento   ? date('d/m/Y', strtotime($p->data_evento))   : '—';
                    $vencida     = $p->status === 'pendente' && $p->data_prevista && $p->data_prevista < current_time('Y-m-d');
                    $cor_linha   = $vencida ? 'background:#fff5f5;' : '';
                    ?>
                    <tr style="<?php echo $cor_linha; ?>">
                        <td><?php echo intval($p->id); ?></td>
                        <td><?php echo $icone_resp . ' ' . $label_resp; ?></td>
                        <td>
                            <strong><?php echo esc_html(PhotoMusic_Tarefas::label_tipo($p->tipo)); ?></strong>
                            <?php if ($p->descricao): ?>
                                <br><small style="color:#666;"><?php echo esc_html($p->descricao); ?></small>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php echo esc_html($p->nome_contratante ?? '—'); ?><br>
                            <small>Evento #<?php echo intval($p->id_evento); ?> — <?php echo $data_evento; ?></small>
                        </td>
                        <td><?php echo $vencida ? '<span style="color:#d63638;font-weight:600;">' . $data_prev . ' ⚠️</span>' : $data_prev; ?></td>
                        <td style="text-align:center;"><?php echo intval($p->notificacoes_enviadas); ?></td>
                        <td>
                            <?php if ($p->status === 'pendente'): ?>
                                <span style="color:#d63638;font-weight:600;">⏳ Pendente</span>
                            <?php elseif ($p->status === 'concluida'): ?>
                                <span style="color:#2e7d32;font-weight:600;">✅ Concluída</span>
                                <?php if ($p->confirmado_por): ?>
                                    <br><small><?php echo esc_html($p->confirmado_por); ?></small>
                                <?php endif; ?>
                            <?php else: ?>
                                <span style="color:#888;">Cancelada</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($p->status === 'pendente'): ?>
                                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=pm_concluir_tarefa&id=' . $p->id), 'pm_concluir_tarefa')); ?>"
                                   class="button button-small button-primary"
                                   onclick="return confirm('Confirmar conclusão desta tarefa?')">
                                   ✅ Concluir
                                </a>
                                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=pm_cancelar_tarefa&id=' . $p->id), 'pm_cancelar_tarefa')); ?>"
                                   class="button button-small"
                                   onclick="return confirm('Cancelar esta tarefa?')"
                                   style="margin-left:4px;">
                                   ✖ Cancelar
                                </a>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
        <?php
    }

    /* ============================================================
       RENDER ABA NO EVENTO (chamado externamente)
    ============================================================ */
    public static function render_aba_evento($id_evento) {
        $tarefas = PhotoMusic_Tarefas::get_by_evento($id_evento);
        $url_lista  = admin_url('admin.php?page=photomusic-tarefas&id_evento=' . $id_evento);
        ?>
        <div style="margin-top:20px;">
            <h3>📋 Tarefas do Evento
                <a href="<?php echo esc_url($url_lista); ?>" class="button button-small" style="margin-left:8px;">Ver todas</a>
            </h3>
            <?php if (empty($tarefas)): ?>
                <p><em>Nenhuma tarefa cadastrada para este evento.</em></p>
            <?php else: ?>
                <table class="widefat striped">
                    <thead>
                        <tr><th>Responsável</th><th>Tarefa</th><th>Data Prevista</th><th>Status</th><th>Ação</th></tr>
                    </thead>
                    <tbody>
                    <?php foreach ($tarefas as $p):
                        $icone = $p->responsavel === 'photomusic' ? '📌' : '👤';
                        $data  = $p->data_prevista ? date('d/m/Y', strtotime($p->data_prevista)) : '—';
                    ?>
                        <tr>
                            <td><?php echo $icone; ?> <?php echo $p->responsavel === 'photomusic' ? 'PhotoMusic' : 'Cliente'; ?></td>
                            <td><?php echo esc_html(PhotoMusic_Tarefas::label_tipo($p->tipo)); ?></td>
                            <td><?php echo $data; ?></td>
                            <td><?php echo $p->status === 'pendente' ? '<span style="color:#d63638;">⏳ Pendente</span>' : '<span style="color:#2e7d32;">✅ Concluída</span>'; ?></td>
                            <td>
                                <?php if ($p->status === 'pendente'): ?>
                                    <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=pm_concluir_tarefa&id=' . $p->id . '&ref=evento&id_evento=' . $id_evento), 'pm_concluir_tarefa')); ?>"
                                       class="button button-small button-primary">✅ Concluir</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
    }

    /* ============================================================
       PROCESSAR: CONCLUIR
    ============================================================ */
    public static function processar_concluir() {
        check_admin_referer('pm_concluir_tarefa');
        if (!current_user_can('manage_options')) wp_die('Acesso negado.');

        $id = intval($_GET['id'] ?? 0);
        $usuario = wp_get_current_user()->display_name . ' (painel)';
        PhotoMusic_Tarefas::concluir($id, $usuario);

        $ref = sanitize_text_field($_GET['ref'] ?? '');
        $id_evento = intval($_GET['id_evento'] ?? 0);
        if ($ref === 'evento' && $id_evento) {
            wp_redirect(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&ok=concluida'));
        } else {
            wp_redirect(admin_url('admin.php?page=photomusic-tarefas&ok=concluida'));
        }
        exit;
    }

    /* ============================================================
       PROCESSAR: CANCELAR
    ============================================================ */
    public static function processar_cancelar() {
        check_admin_referer('pm_cancelar_tarefa');
        if (!current_user_can('manage_options')) wp_die('Acesso negado.');

        $id = intval($_GET['id'] ?? 0);
        PhotoMusic_Tarefas::cancelar($id);

        wp_redirect(admin_url('admin.php?page=photomusic-tarefas&ok=cancelada'));
        exit;
    }

    /* ============================================================
       PROCESSAR: CRIAR MANUAL
    ============================================================ */
    public static function processar_criar() {
        check_admin_referer('pm_criar_tarefa');
        if (!current_user_can('manage_options')) wp_die('Acesso negado.');

        PhotoMusic_Tarefas::criar([
            'id_evento'    => intval($_POST['id_evento'] ?? 0),
            'responsavel'  => sanitize_key($_POST['responsavel'] ?? 'photomusic'),
            'tipo'         => sanitize_key($_POST['tipo'] ?? 'outro'),
            'descricao'    => sanitize_textarea_field($_POST['descricao'] ?? ''),
            'data_prevista'=> sanitize_text_field($_POST['data_prevista'] ?? ''),
        ]);

        wp_redirect(admin_url('admin.php?page=photomusic-tarefas&ok=criada'));
        exit;
    }
}
