<?php
// includes/admin/class-photomusic-ideias-futuras.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Ideias_Futuras {

    const CAP_VIEW   = 'pm_ideias_view';
    const CAP_EDIT   = 'pm_ideias_edit';
    const TABLE_NAME = 'pm_ideias_futuras';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_post_pm_salvar_ideia',  [__CLASS__, 'handle_form']);
        add_action('admin_post_pm_excluir_ideia', [__CLASS__, 'handle_excluir']);
    }

    /* ============================================================
       MENU
    ============================================================ */
    public static function register_menu() {

        if (!current_user_can(self::CAP_VIEW)) {
            return;
        }

        add_submenu_page(
            'photomusic-roadmap',
            'Ideias Futuras',
            'Ideias Futuras',
            self::CAP_VIEW,
            'photomusic-ideias-futuras',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       RENDERIZA A PÁGINA
    ============================================================ */
    public static function render_page() {

        if (!current_user_can(self::CAP_VIEW)) {
            wp_die('Acesso negado.');
        }

        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_NAME;

        $acao  = isset($_GET['acao']) ? sanitize_text_field($_GET['acao']) : '';
        $id    = isset($_GET['id'])   ? intval($_GET['id'])                 : 0;
        $ideia = null;

        if ($acao === 'editar' && $id > 0) {
            $ideia = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id));
        }

        // Mensagem de sucesso
        $saved = isset($_GET['saved']) ? intval($_GET['saved']) : 0;

        $ideias = $wpdb->get_results("SELECT * FROM {$table} ORDER BY criado_em DESC");

        ?>
        <div class="wrap">
            <h1>Ideias Futuras</h1>
            <p>Registro interno de ideias para evolução do ecossistema PhotoMusic.</p>

            <?php if ($saved === 1): ?>
                <div class="notice notice-success is-dismissible">
                    <p>✅ Ideia salva com sucesso!</p>
                </div>
            <?php endif; ?>
            <?php if (isset($_GET['deleted'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>🗑️ Ideia excluída com sucesso!</p>
                </div>
            <?php endif; ?>

            <hr>
            <h2>Lista de ideias</h2>

            <table class="widefat striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Título</th>
                        <th>Categoria</th>
                        <th>Prioridade</th>
                        <th>Status</th>
                        <th>Sigilosa</th>
                        <th>Autor</th>
                        <th>Criada em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                <?php if ($ideias): ?>
                    <?php foreach ($ideias as $row): ?>
                        <tr>
                            <td><?php echo esc_html($row->id); ?></td>
                            <td><strong><?php echo esc_html($row->titulo); ?></strong></td>
                            <td><?php echo esc_html($row->categoria ?? '—'); ?></td>
                            <td><?php echo esc_html($row->prioridade); ?></td>
                            <td><?php echo esc_html($row->status); ?></td>
                            <td><?php echo $row->sigilosa ? '🔒 Sim' : 'Não'; ?></td>
                            <td><?php echo esc_html(self::get_autor_nome($row->autor_id)); ?></td>
                            <td><?php echo esc_html($row->criado_em); ?></td>
                            <td>
                                <?php if (current_user_can(self::CAP_EDIT)): ?>
                                    <a href="<?php echo esc_url(add_query_arg([
                                        'page' => 'photomusic-ideias-futuras',
                                        'acao' => 'editar',
                                        'id'   => $row->id,
                                    ], admin_url('admin.php'))); ?>">Editar</a>
                                <?php endif; ?>
                                <?php if (current_user_can('pm_projetos_criar')): ?>
                                    |
                                    <a href="<?php echo esc_url(wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_transformar_em_projeto&id=' . $row->id),
                                        'pm_transformar_em_projeto'
                                    )); ?>">Transformar em Projeto</a>
                                <?php endif; ?>
                                <?php if (current_user_can(self::CAP_EDIT)): ?>
                                    |
                                    <a href="<?php echo esc_url(wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_excluir_ideia&id=' . $row->id),
                                        'pm_excluir_ideia_' . $row->id
                                    )); ?>"
                                    style="color:#b71c1c;"
                                    onclick="return confirm('Tem certeza que deseja excluir esta ideia?');">
                                        Excluir
                                    </a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr><td colspan="9">Nenhuma ideia cadastrada.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>

            <?php if (current_user_can(self::CAP_EDIT)): ?>
                <hr>
                <h2><?php echo $ideia ? 'Editar ideia' : 'Nova ideia'; ?></h2>

                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <?php wp_nonce_field('pm_salvar_ideia', 'pm_ideia_nonce'); ?>
                    <input type="hidden" name="action" value="pm_salvar_ideia">
                    <input type="hidden" name="id" value="<?php echo $ideia ? intval($ideia->id) : 0; ?>">

                    <table class="form-table">
                        <tr>
                            <th><label for="pm-titulo">Título <span style="color:red">*</span></label></th>
                            <td>
                                <input type="text" id="pm-titulo" name="titulo" class="regular-text"
                                       value="<?php echo $ideia ? esc_attr($ideia->titulo) : ''; ?>" required>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-categoria">Categoria</label></th>
                            <td>
                                <input type="text" id="pm-categoria" name="categoria" class="regular-text"
                                       value="<?php echo $ideia ? esc_attr($ideia->categoria) : ''; ?>"
                                       placeholder="Ex: novo-negocio, app, ia, financeiro">
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-prioridade">Prioridade</label></th>
                            <td>
                                <select id="pm-prioridade" name="prioridade">
                                    <?php $prioridade = $ideia ? $ideia->prioridade : 'media'; ?>
                                    <option value="baixa"   <?php selected($prioridade, 'baixa');   ?>>Baixa</option>
                                    <option value="media"   <?php selected($prioridade, 'media');   ?>>Média</option>
                                    <option value="alta"    <?php selected($prioridade, 'alta');    ?>>Alta</option>
                                    <option value="critica" <?php selected($prioridade, 'critica'); ?>>Crítica</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-tags">Tags</label></th>
                            <td>
                                <input type="text" id="pm-tags" name="tags" class="regular-text"
                                       value="<?php echo $ideia ? esc_attr($ideia->tags) : ''; ?>"
                                       placeholder="Ex: me-conta, novo-negocio, spin-off">
                                <p class="description">Separe por vírgulas.</p>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-descricao">Descrição <span style="color:red">*</span></label></th>
                            <td>
                                <textarea id="pm-descricao" name="descricao" rows="12"
                                          class="large-text" required><?php
                                    echo $ideia ? esc_textarea($ideia->descricao) : '';
                                ?></textarea>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-status">Status</label></th>
                            <td>
                                <select id="pm-status" name="status">
                                    <?php $status = $ideia ? $ideia->status : 'nova'; ?>
                                    <option value="nova"         <?php selected($status, 'nova');         ?>>Nova</option>
                                    <option value="aprovada"     <?php selected($status, 'aprovada');     ?>>Aprovada</option>
                                    <option value="em_andamento" <?php selected($status, 'em_andamento'); ?>>Em andamento</option>
                                    <option value="concluida"    <?php selected($status, 'concluida');    ?>>Concluída</option>
                                    <option value="descartada"   <?php selected($status, 'descartada');   ?>>Descartada</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th><label for="pm-sigilosa">Sigilosa</label></th>
                            <td>
                                <?php $sigilosa = $ideia ? intval($ideia->sigilosa) : 0; ?>
                                <label>
                                    <input type="checkbox" id="pm-sigilosa" name="sigilosa"
                                           value="1" <?php checked($sigilosa, 1); ?>>
                                    🔒 Esta ideia é sigilosa — visível apenas para perfis autorizados
                                </label>
                            </td>
                        </tr>
                    </table>

                    <?php submit_button($ideia ? 'Atualizar ideia' : 'Salvar ideia'); ?>
                </form>
            <?php endif; ?>

        </div>
        <?php
    }

    /* ============================================================
       PROCESSA O FORMULÁRIO
    ============================================================ */
    public static function handle_form() {

        if (!current_user_can(self::CAP_EDIT)) {
            wp_die('Acesso negado.');
        }

        if (!isset($_POST['pm_ideia_nonce']) ||
            !wp_verify_nonce($_POST['pm_ideia_nonce'], 'pm_salvar_ideia')) {
            wp_die('Nonce inválido.');
        }

        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_NAME;

        $id        = isset($_POST['id'])        ? intval($_POST['id'])                          : 0;
        $titulo    = isset($_POST['titulo'])    ? sanitize_text_field($_POST['titulo'])          : '';
        $descricao = isset($_POST['descricao']) ? sanitize_textarea_field($_POST['descricao'])   : '';
        $categoria = isset($_POST['categoria']) ? sanitize_text_field($_POST['categoria'])       : '';
        $prioridade= isset($_POST['prioridade'])? sanitize_text_field($_POST['prioridade'])      : 'media';
        $status    = isset($_POST['status'])    ? sanitize_text_field($_POST['status'])          : 'nova';
        $sigilosa  = isset($_POST['sigilosa'])  ? 1                                              : 0;
        $tags      = isset($_POST['tags'])      ? sanitize_text_field($_POST['tags'])            : '';
        $agora     = current_time('mysql');

        // Valida prioridade
        $prioridades_validas = ['baixa', 'media', 'alta', 'critica'];
        if (!in_array($prioridade, $prioridades_validas, true)) {
            $prioridade = 'media';
        }

        // Valida status
        $status_validos = ['nova', 'aprovada', 'em_andamento', 'concluida', 'descartada'];
        if (!in_array($status, $status_validos, true)) {
            $status = 'nova';
        }

        $data = [
            'titulo'        => $titulo,
            'descricao'     => $descricao,
            'categoria'     => $categoria,
            'prioridade'    => $prioridade,
            'status'        => $status,
            'sigilosa'      => $sigilosa,
            'tags'          => $tags,
            'atualizado_em' => $agora,
        ];

        if ($id > 0) {
            $wpdb->update($table, $data, ['id' => $id]);
        } else {
            $data['autor_id']  = get_current_user_id();
            $data['criado_em'] = $agora;
            $wpdb->insert($table, $data);
        }

        wp_redirect(add_query_arg([
            'page'  => 'photomusic-ideias-futuras',
            'saved' => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       PROCESSA EXCLUSÃO
    ============================================================ */
    public static function handle_excluir() {

        if (!current_user_can(self::CAP_EDIT)) {
            wp_die('Acesso negado.');
        }

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if (!$id || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'pm_excluir_ideia_' . $id)) {
            wp_die('Ação inválida.');
        }

        global $wpdb;
        $wpdb->delete($wpdb->prefix . self::TABLE_NAME, ['id' => $id]);

        wp_redirect(add_query_arg([
            'page'    => 'photomusic-ideias-futuras',
            'deleted' => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       HELPER — NOME DO AUTOR
    ============================================================ */
    private static function get_autor_nome($user_id) {
        if (!$user_id) return '—';
        $user = get_user_by('id', $user_id);
        return $user ? $user->display_name : 'Desconhecido';
    }
}