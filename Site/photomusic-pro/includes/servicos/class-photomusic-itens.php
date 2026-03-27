<?php
// includes/servicos/class-photomusic-itens.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Itens {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_init', [__CLASS__, 'handle_form_submit']);
    }

    /**
     * Registra submenu dentro do módulo de Contratos
     */
    public static function register_menu() {

        if (!PhotoMusic_Users::is_admin()) {
            return;
        }

        add_submenu_page(
            'photomusic-eventos',          // depois mudamos para photomusic-contratos
            'Contratos - Itens',
            'Itens',
            'pm_gerenciar_usuarios',
            'photomusic-itens',
            [__CLASS__, 'render_page']
        );
    }

    /**
     * Nome da tabela
     */
    protected static function get_table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_itens';
    }

    /**
     * Lista itens
     */
    public static function get_itens($args = []) {
        global $wpdb;
        $table = self::get_table();

        // Sanitização reforçada
        $tipo  = isset($args['tipo']) ? sanitize_text_field($args['tipo']) : '';
        $ativo = isset($args['ativo']) ? intval($args['ativo']) : '';

        $where = "WHERE 1=1";
        $params = [];

        if (!empty($tipo)) {
            $where .= " AND tipo = %s";
            $params[] = $tipo;
        }

        if ($ativo !== '') {
            $where .= " AND ativo = %d";
            $params[] = $ativo;
        }

        // ORDER BY mais consistente
        $sql = "SELECT * FROM $table $where ORDER BY ordem ASC, titulo ASC";

        return !empty($params)
            ? $wpdb->get_results($wpdb->prepare($sql, $params))
            : $wpdb->get_results($sql);
    }

    /**
     * Carrega item específico
     */
    public static function get_item($id) {
        global $wpdb;
        $table = self::get_table();

        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM $table WHERE id = %d", intval($id))
        );
    }

    /**
     * Salva item (criar/editar)
     */
    public static function save_item($data) {
        global $wpdb;
        $table = self::get_table();

        $id = isset($data['id']) ? intval($data['id']) : 0;

        // Lista oficial de tipos
        $tipos_validos = [
            'geral', 'pagamento', 'logistica', 'direitos_imagem',
            'responsabilidade', 'cancelamento', 'montagem',
            'desmontagem', 'servico'
        ];

        $tipo = sanitize_text_field($data['tipo'] ?? 'geral');

        // Se tipo for inválido → força para "geral"
        if (!in_array($tipo, $tipos_validos, true)) {
            $tipo = 'geral';
        }

        // Limite de tamanho da descrição
        $descricao = sanitize_textarea_field($data['descricao'] ?? '');
        $descricao = substr($descricao, 0, 5000);

        $fields = [
            'titulo'     => sanitize_text_field($data['titulo'] ?? ''),
            'tipo'       => $tipo,
            'descricao'  => $descricao,
            'ordem'      => intval($data['ordem'] ?? 0),
            'ativo'      => isset($data['ativo']) ? 1 : 0,
            'updated_at' => current_time('mysql'),
        ];

        if ($id > 0) {
            $wpdb->update($table, $fields, ['id' => $id]);
            return $id;
        }

        $fields['created_at'] = current_time('mysql');
        $wpdb->insert($table, $fields);
        return $wpdb->insert_id;
    }

    /**
     * Desativa item
     */
    public static function deactivate_item($id) {
        global $wpdb;
        $table = self::get_table();

        return $wpdb->update(
            $table,
            ['ativo' => 0, 'updated_at' => current_time('mysql')],
            ['id' => intval($id)]
        );
    }

        /**
     * Processa envio de formulários
     */
    public static function handle_form_submit() {

        if (empty($_POST['pm_item_action'])) {
            return;
        }

        if (!current_user_can('pm_gerenciar_usuarios')) {
            return;
        }

        if (empty($_POST['pm_item_nonce']) ||
            !wp_verify_nonce($_POST['pm_item_nonce'], 'pm_item_form')) {
            return;
        }

        $action = sanitize_text_field($_POST['pm_item_action']);

        if ($action === 'save') {

            $data = [
                'id'        => $_POST['id'] ?? 0,
                'titulo'    => $_POST['titulo'] ?? '',
                'tipo'      => $_POST['tipo'] ?? 'geral',
                'descricao' => $_POST['descricao'] ?? '',
                'ordem'     => $_POST['ordem'] ?? 0,
                'ativo'     => isset($_POST['ativo']) ? 1 : 0,
            ];

            $id = self::save_item($data);

            PhotoMusic_Logs::add(
                'item_save',
                null,
                null,
                $id,
                'Item de contrato salvo/atualizado.'
            );

            wp_redirect(add_query_arg([
                'page'    => 'photomusic-itens',
                'tab'     => 'edit',
                'edit'    => $id,
                'updated' => 1,
            ], admin_url('admin.php')));
            exit;
        }

        if ($action === 'deactivate' && !empty($_POST['id'])) {

            $id = intval($_POST['id']);
            self::deactivate_item($id);

            PhotoMusic_Logs::add(
                'item_deactivate',
                null,
                null,
                $id,
                'Item de contrato desativado.'
            );

            wp_redirect(add_query_arg([
                'page'    => 'photomusic-itens',
                'updated' => 1,
            ], admin_url('admin.php')));
            exit;
        }
    }

    /**
     * Renderiza a página com abas
     */
    public static function render_page() {

        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Acesso negado.');
        }

        $tab = $_GET['tab'] ?? 'list';
        $editing_id = isset($_GET['edit']) ? intval($_GET['edit']) : 0;
        $editing = $editing_id ? self::get_item($editing_id) : null;

        $tipos = [
            'geral'             => 'Geral',
            'pagamento'         => 'Pagamento',
            'logistica'         => 'Logística',
            'direitos_imagem'   => 'Direitos de Imagem',
            'responsabilidade'  => 'Responsabilidade',
            'cancelamento'      => 'Cancelamento',
            'montagem'          => 'Montagem',
            'desmontagem'       => 'Desmontagem',
            'servico'           => 'Serviço',
        ];

        $itens = self::get_itens();
        ?>

        <div class="wrap">
            <h1>Contratos - Itens</h1>

            <?php if (!empty($_GET['updated'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>Item salvo com sucesso.</p>
                </div>
            <?php endif; ?>

            <h2 class="nav-tab-wrapper">
                <a href="<?php echo esc_url(add_query_arg(['tab' => 'list'], admin_url('admin.php?page=photomusic-itens'))); ?>"
                   class="nav-tab <?php echo $tab === 'list' ? 'nav-tab-active' : ''; ?>">
                    Lista de Itens
                </a>

                <a href="<?php echo esc_url(add_query_arg(['tab' => 'new'], admin_url('admin.php?page=photomusic-itens'))); ?>"
                   class="nav-tab <?php echo $tab === 'new' ? 'nav-tab-active' : ''; ?>">
                    Criar Novo Item
                </a>

                <?php if ($editing): ?>
                    <a href="<?php echo esc_url(add_query_arg(['tab' => 'edit'], admin_url('admin.php?page=photomusic-itens&edit=' . $editing_id))); ?>"
                       class="nav-tab <?php echo $tab === 'edit' ? 'nav-tab-active' : ''; ?>">
                        Editar Item
                    </a>
                <?php endif; ?>
            </h2>

            <?php
            switch ($tab) {

                case 'new':
                    self::render_form(null, $tipos);
                    break;

                case 'edit':
                    self::render_form($editing, $tipos);
                    break;

                default:
                    self::render_list($itens, $tipos);
                    break;
            }
            ?>

        </div>

        <style>
            .link-button {
                background:none;
                border:none;
                padding:0;
                margin:0;
                cursor:pointer;
                color:#a00;
            }
        </style>

        <?php
    }

    /**
     * Renderiza a lista de itens
     */
    protected static function render_list($itens, $tipos) {
        ?>
        <h2>Itens Cadastrados</h2>

        <?php if (empty($itens)): ?>
            <p>Nenhum item cadastrado ainda.</p>
            <?php return; ?>
        <?php endif; ?>

        <table class="widefat striped">
            <thead>
            <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Ativo</th>
                <th>Ordem</th>
                <th>Ações</th>
            </tr>
            </thead>

            <tbody>
            <?php foreach ($itens as $i): ?>
                <tr>
                    <td><?php echo esc_html($i->id); ?></td>
                    <td><?php echo esc_html($i->titulo); ?></td>
                    <td><?php echo esc_html($tipos[$i->tipo] ?? $i->tipo); ?></td>
                    <td><?php echo $i->ativo ? 'Sim' : 'Não'; ?></td>
                    <td><?php echo esc_html($i->ordem); ?></td>

                    <td>
                        <a href="<?php echo esc_url(add_query_arg([
                            'page' => 'photomusic-itens',
                            'tab'  => 'edit',
                            'edit' => $i->id,
                        ], admin_url('admin.php'))); ?>">
                            Editar
                        </a>

                        <?php if ($i->ativo): ?>
                            |
                            <form method="post" action="" style="display:inline;"
                                  onsubmit="return confirm('Desativar este item?');">
                                <?php wp_nonce_field('pm_item_form', 'pm_item_nonce'); ?>
                                <input type="hidden" name="pm_item_action" value="deactivate">
                                <input type="hidden" name="id" value="<?php echo esc_attr($i->id); ?>">
                                <button type="submit" class="link-button">Desativar</button>
                            </form>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>

        </table>
        <?php
    }

    /**
     * Renderiza o formulário (novo ou edição)
     */
    protected static function render_form($editing, $tipos) {

        $is_edit = !empty($editing);
        ?>

        <h2><?php echo $is_edit ? 'Editar Item' : 'Criar Novo Item'; ?></h2>

        <form method="post">
            <?php wp_nonce_field('pm_item_form', 'pm_item_nonce'); ?>
            <input type="hidden" name="pm_item_action" value="save">
            <input type="hidden" name="id" value="<?php echo esc_attr($editing->id ?? 0); ?>">

            <table class="form-table">

                <tr>
                    <th><label for="titulo">Título</label></th>
                    <td>
                        <input type="text" name="titulo" id="titulo" class="regular-text"
                               value="<?php echo esc_attr($editing->titulo ?? ''); ?>" required>
                    </td>
                </tr>

                <tr>
                    <th><label for="tipo">Tipo</label></th>
                    <td>
                        <select name="tipo" id="tipo">
                            <?php foreach ($tipos as $k => $v): ?>
                                <option value="<?php echo esc_attr($k); ?>"
                                    <?php selected($editing->tipo ?? 'geral', $k); ?>>
                                    <?php echo esc_html($v); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>

                <tr>
                    <th><label for="descricao">Descrição</label></th>
                    <td>
                        <textarea name="descricao" id="descricao" rows="5" class="large-text"><?php
                            echo esc_textarea($editing->descricao ?? '');
                        ?></textarea>
                        <p class="description">Texto curto que será incluído no contrato.</p>
                    </td>
                </tr>

                <tr>
                    <th><label for="ordem">Ordem</label></th>
                    <td>
                        <input type="number" name="ordem" id="ordem" class="small-text"
                               value="<?php echo esc_attr($editing->ordem ?? 0); ?>">
                    </td>
                </tr>

                <tr>
                    <th><label for="ativo">Ativo</label></th>
                    <td>
                        <label>
                            <input type="checkbox" name="ativo" id="ativo"
                                <?php checked($editing->ativo ?? 1, 1); ?>>
                            Item ativo
                        </label>
                    </td>
                </tr>

            </table>

            <?php submit_button($is_edit ? 'Salvar Item' : 'Criar Item'); ?>
        </form>

        <?php
    }
}

