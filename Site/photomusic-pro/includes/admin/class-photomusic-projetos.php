<?php
// includes/admin/class-photomusic-projetos.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Projetos {

    const CAP_VIEW   = 'pm_ideias_view';
    const CAP_EDIT   = 'pm_projetos_editar';
    const CAP_CREATE = 'pm_projetos_criar';
    const CAP_CLOSE  = 'pm_projetos_concluir';

    const TABLE_NAME  = 'pm_projetos';
    const TABLE_IDEIAS = 'pm_ideias_futuras';

    /* ============================================================
       INIT — REGISTRA MENUS E AÇÕES
    ============================================================ */
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_post_pm_salvar_projeto', [__CLASS__, 'handle_form']);
        add_action('admin_post_pm_concluir_projeto', [__CLASS__, 'handle_concluir']);
        add_action('admin_post_pm_transformar_em_projeto', [__CLASS__, 'handle_transformar']);
    }

    /* ============================================================
       MENU — REGISTRA SUBMENU "Projetos"
    ============================================================ */
    public static function register_menu() {

        if (!current_user_can(self::CAP_VIEW)) {
            return;
        }

        add_submenu_page(
            'photomusic-roadmap',
            'Projetos',
            'Projetos',
            self::CAP_VIEW,
            'photomusic-projetos',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       RENDER PAGE — LISTAGEM + FORMULÁRIO
    ============================================================ */
    public static function render_page() {
        if (!current_user_can(self::CAP_VIEW)) {
            wp_die('Acesso negado.');
        }

        global $wpdb;

        $table = $wpdb->prefix . self::TABLE_NAME;

        $acao = isset($_GET['acao']) ? sanitize_text_field($_GET['acao']) : '';
        $id   = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $projeto = null;

        if ($acao === 'editar' && $id > 0) {
            $projeto = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id));
        }

        $projetos = $wpdb->get_results("SELECT * FROM {$table} ORDER BY prioridade DESC, data_criacao DESC");

        ?>
        <div class="wrap">
            <h1>Projetos</h1>
            <p>Gerenciamento dos projetos derivados de ideias internas.</p>
            <hr>

            <h2>Lista de Projetos</h2>

            <table class="widefat striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Título</th>
                        <th>Status</th>
                        <th>Prioridade</th>
                        <th>Progresso</th>
                        <th>Responsável</th>
                        <th>Início</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                <?php if ($projetos): ?>
                    <?php foreach ($projetos as $row): ?>
                        <tr>
                            <td><?php echo esc_html($row->id); ?></td>
                            <td><?php echo esc_html($row->titulo); ?></td>
                            <td><?php echo esc_html($row->status); ?></td>
                            <td><?php echo esc_html($row->prioridade); ?></td>
                            <td><?php echo esc_html($row->progresso); ?>%</td>
                            <td><?php echo esc_html(self::get_user_name($row->responsavel_id)); ?></td>
                            <td><?php echo esc_html($row->data_inicio); ?></td>
                            <td>
                                <?php if (current_user_can(self::CAP_EDIT)): ?>
                                    <a href="<?php echo esc_url(add_query_arg(['page' => 'photomusic-projetos', 'acao' => 'editar', 'id' => $row->id], admin_url('admin.php'))); ?>">
                                        Editar
                                    </a>
                                <?php endif; ?>

                                <?php if (current_user_can(self::CAP_CLOSE) && $row->status !== 'concluído'): ?>
                                    |
                                    <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=pm_concluir_projeto&id=' . $row->id), 'pm_concluir_projeto')); ?>">
                                        Concluir
                                    </a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr><td colspan="8">Nenhum projeto encontrado.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>

            <?php if (current_user_can(self::CAP_CREATE)): ?>
                <hr>
                <h2><?php echo $projeto ? 'Editar Projeto' : 'Novo Projeto'; ?></h2>

                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <?php wp_nonce_field('pm_salvar_projeto', 'pm_projeto_nonce'); ?>
                    <input type="hidden" name="action" value="pm_salvar_projeto">
                    <input type="hidden" name="id" value="<?php echo $projeto ? intval($projeto->id) : 0; ?>">

                    <table class="form-table">
                        <tr>
                            <th><label for="pm-titulo">Título</label></th>
                            <td>
                                <input type="text" id="pm-titulo" name="titulo" class="regular-text"
                                       value="<?php echo $projeto ? esc_attr($projeto->titulo) : ''; ?>" required>
                            </td>
                        </tr>

                        <tr>
                            <th><label for="pm-descricao">Descrição</label></th>
                            <td>
                                <textarea id="pm-descricao" name="descricao" rows="6" class="large-text" required><?php
                                    echo $projeto ? esc_textarea($projeto->descricao) : '';
                                ?></textarea>
                            </td>
                        </tr>

                        <tr>
                            <th><label for="pm-prioridade">Prioridade</label></th>
                            <td>
                                <?php $prioridade = $projeto ? intval($projeto->prioridade) : 1; ?>
                                <select id="pm-prioridade" name="prioridade">
                                    <option value="1" <?php selected($prioridade, 1); ?>>Baixa</option>
                                    <option value="2" <?php selected($prioridade, 2); ?>>Média</option>
                                    <option value="3" <?php selected($prioridade, 3); ?>>Alta</option>
                                    <option value="4" <?php selected($prioridade, 4); ?>>Crítica</option>
                                </select>
                            </td>
                        </tr>

                        <tr>
                            <th><label for="pm-status">Status</label></th>
                            <td>
                                <?php $status = $projeto ? $projeto->status : 'planejado'; ?>
                                <select id="pm-status" name="status">
                                    <option value="planejado" <?php selected($status, 'planejado'); ?>>Planejado</option>
                                    <option value="em_andamento" <?php selected($status, 'em_andamento'); ?>>Em andamento</option>
                                    <option value="pausado" <?php selected($status, 'pausado'); ?>>Pausado</option>
                                    <option value="concluído" <?php selected($status, 'concluído'); ?>>Concluído</option>
                                </select>
                            </td>
                        </tr>

                        <tr>
                            <th><label for="pm-responsavel">Responsável</label></th>
                            <td>
                                <select id="pm-responsavel" name="responsavel_id">
                                    <option value="">— Nenhum —</option>
                                    <?php
                                    $users = get_users(['role__in' => ['administrator', 'photomusic_admin']]);
                                    foreach ($users as $user):
                                        $selected = ($projeto && $projeto->responsavel_id == $user->ID) ? 'selected' : '';
                                        echo "<option value='{$user->ID}' {$selected}>{$user->display_name}</option>";
                                    endforeach;
                                    ?>
                                </select>
                            </td>
                        </tr>

                        <tr>
                            <th><label for="pm-progresso">Progresso (%)</label></th>
                            <td>
                                <input type="number" id="pm-progresso" name="progresso" min="0" max="100"
                                       value="<?php echo $projeto ? intval($projeto->progresso) : 0; ?>">
                            </td>
                        </tr>

                    </table>

                    <?php submit_button($projeto ? 'Atualizar Projeto' : 'Criar Projeto'); ?>
                </form>
            <?php endif; ?>

        </div>
        <?php
    }

    /* ============================================================
       HANDLE FORM — SALVAR PROJETO
    ============================================================ */
    public static function handle_form() {
        if (!current_user_can(self::CAP_CREATE)) {
            wp_die('Acesso negado.');
        }

        if (!isset($_POST['pm_projeto_nonce']) || !wp_verify_nonce($_POST['pm_projeto_nonce'], 'pm_salvar_projeto')) {
            wp_die('Nonce inválido.');
        }

        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_NAME;

        $id = isset($_POST['id']) ? intval($_POST['id']) : 0;

        $data = [
            'titulo'          => sanitize_text_field($_POST['titulo']),
            'descricao'       => wp_kses_post($_POST['descricao']),
            'prioridade'      => intval($_POST['prioridade']),
            'status'          => sanitize_text_field($_POST['status']),
            'responsavel_id'  => intval($_POST['responsavel_id']),
            'progresso'       => intval($_POST['progresso']),
            'data_atualizacao' => current_time('mysql'),
        ];

        if ($id > 0) {
            $wpdb->update($table, $data, ['id' => $id]);
        } else {
            $data['data_criacao'] = current_time('mysql');
            $wpdb->insert($table, $data);
        }

        wp_redirect(admin_url('admin.php?page=photomusic-projetos'));
        exit;
    }

    /* ============================================================
       HANDLE CONCLUIR — MARCA PROJETO COMO CONCLUÍDO
    ============================================================ */
    public static function handle_concluir() {
        if (!current_user_can(self::CAP_CLOSE)) {
            wp_die('Acesso negado.');
        }

        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'pm_concluir_projeto')) {
            wp_die('Nonce inválido.');
        }

        $id = intval($_GET['id']);

        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_NAME;

        $wpdb->update($table, [
            'status'          => 'concluído',
            'progresso'       => 100,
            'data_conclusao'  => current_time('mysql'),
            'data_atualizacao' => current_time('mysql'),
        ], ['id' => $id]);

        wp_redirect(admin_url('admin.php?page=photomusic-projetos'));
        exit;
    }

    /* ============================================================
       HANDLE TRANSFORMAR — IDEIA → PROJETO
    ============================================================ */
    public static function handle_transformar() {
        if (!current_user_can(self::CAP_CREATE)) {
            wp_die('Acesso negado.');
        }

        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'pm_transformar_em_projeto')) {
            wp_die('Nonce inválido.');
        }

        $ideia_id = intval($_GET['id']);

        global $wpdb;
        $table_ideias = $wpdb->prefix . self::TABLE_IDEIAS;
        $table_projetos = $wpdb->prefix . self::TABLE_NAME;

        $ideia = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table_ideias} WHERE id = %d", $ideia_id));

        if (!$ideia) {
            wp_die('Ideia não encontrada.');
        }

        // cria projeto
        $wpdb->insert($table_projetos, [
            'ideia_id'       => $ideia_id,
            'titulo'         => $ideia->titulo,
            'descricao'      => $ideia->descricao,
            'prioridade'     => $ideia->prioridade,
            'status'         => 'planejado',
            'data_criacao'   => current_time('mysql'),
            'data_atualizacao' => current_time('mysql'),
        ]);

        // marca ideia como planejada
        $wpdb->update($table_ideias, [
            'status' => 'planejada',
            'data_atualizacao' => current_time('mysql'),
        ], ['id' => $ideia_id]);

        wp_redirect(admin_url('admin.php?page=photomusic-projetos'));
        exit;
    }

    /* ============================================================
       HELPER — NOME DO USUÁRIO
    ============================================================ */
    private static function get_user_name($user_id) {
        $user = get_user_by('id', $user_id);
        return $user ? $user->display_name : '—';
    }
}
