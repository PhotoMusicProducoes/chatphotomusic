<?php
// includes/servicos/class-photomusic-pagamentos.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Pagamentos {

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
            'photomusic-eventos', // depois mudamos para photomusic-contratos
            'Contratos - Pagamentos',
            'Pagamentos',
            'pm_gerenciar_usuarios',
            'photomusic-pagamentos',
            [__CLASS__, 'render_page']
        );
    }

    /**
     * Nome da tabela
     */
    protected static function get_table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_pagamentos';
    }

    /**
     * Lista pagamentos
     */
    public static function get_pagamentos($args = []) {
        global $wpdb;
        $table = self::get_table();

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

        $sql = "SELECT * FROM $table $where ORDER BY ordem ASC, titulo ASC";

        return !empty($params)
            ? $wpdb->get_results($wpdb->prepare($sql, $params))
            : $wpdb->get_results($sql);
    }

    /**
     * Carrega pagamento específico
     */
    public static function get_pagamento($id) {
        global $wpdb;
        $table = self::get_table();

        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM $table WHERE id = %d", intval($id))
        );
    }

    /**
     * Salva pagamento (criar/editar)
     */
    public static function save_pagamento($data) {
        global $wpdb;
        $table = self::get_table();

        $id = intval($data['id'] ?? 0);

        // Tipos válidos
        $tipos_validos = ['avista','parcelado','entrada','sinal','personalizado'];
        $tipo = sanitize_text_field($data['tipo'] ?? 'avista');

        if (!in_array($tipo, $tipos_validos, true)) {
            $tipo = 'avista';
        }

        $parcelas = max(1, intval($data['parcelas'] ?? 1));
        $juros    = max(0, floatval($data['juros'] ?? 0));
        $multa    = max(0, floatval($data['multa'] ?? 0));

        $vencimento = sanitize_text_field($data['vencimento'] ?? '');
        $vencimento = substr($vencimento, 0, 500);

        $descricao = sanitize_textarea_field($data['descricao'] ?? '');
        $descricao = substr($descricao, 0, 5000);

        $ordem = intval($data['ordem'] ?? 0);
        $ativo = isset($data['ativo']) ? 1 : 0;

        $fields = [
            'titulo'     => sanitize_text_field($data['titulo'] ?? ''),
            'tipo'       => $tipo,
            'parcelas'   => $parcelas,
            'juros'      => $juros,
            'multa'      => $multa,
            'vencimento' => $vencimento,
            'descricao'  => $descricao,
            'ordem'      => $ordem,
            'ativo'      => $ativo,
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
     * Desativa pagamento
     */
    public static function deactivate_pagamento($id) {
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

        if (empty($_POST['pm_pagamento_action'])) {
            return;
        }

        if (!current_user_can('pm_gerenciar_usuarios')) {
            return;
        }

        if (empty($_POST['pm_pagamento_nonce']) ||
            !wp_verify_nonce($_POST['pm_pagamento_nonce'], 'pm_pagamento_form')) {
            return;
        }

        $action = sanitize_text_field($_POST['pm_pagamento_action']);

        if ($action === 'save') {

            $data = [
                'id'         => $_POST['id'] ?? 0,
                'titulo'     => $_POST['titulo'] ?? '',
                'tipo'       => $_POST['tipo'] ?? 'avista',
                'parcelas'   => $_POST['parcelas'] ?? 1,
                'juros'      => $_POST['juros'] ?? 0,
                'multa'      => $_POST['multa'] ?? 0,
                'vencimento' => $_POST['vencimento'] ?? '',
                'descricao'  => $_POST['descricao'] ?? '',
                'ordem'      => $_POST['ordem'] ?? 0,
                'ativo'      => isset($_POST['ativo']) ? 1 : 0,
            ];

            $id = self::save_pagamento($data);

            PhotoMusic_Logs::add(
                'pagamento_save',
                null,
                null,
                $id,
                'Forma de pagamento salva/atualizada.'
            );

            wp_redirect(add_query_arg([
                'page'    => 'photomusic-pagamentos',
                'tab'     => 'edit',
                'edit'    => $id,
                'updated' => 1,
            ], admin_url('admin.php')));
            exit;
        }

        if ($action === 'deactivate' && !empty($_POST['id'])) {

            $id = intval($_POST['id']);
            self::deactivate_pagamento($id);

            PhotoMusic_Logs::add(
                'pagamento_deactivate',
                null,
                null,
                $id,
                'Forma de pagamento desativada.'
            );

            wp_redirect(add_query_arg([
                'page'    => 'photomusic-pagamentos',
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

        $tab = sanitize_text_field($_GET['tab'] ?? 'list');
        $editing_id = isset($_GET['edit']) ? intval($_GET['edit']) : 0;
        $editing = $editing_id ? self::get_pagamento($editing_id) : null;

        $tipos = [
            'avista'     => 'À Vista',
            'parcelado'  => 'Parcelado',
            'entrada'    => 'Entrada + Parcelas',
            'sinal'      => 'Sinal',
            'personalizado' => 'Personalizado',
        ];

        $pagamentos = self::get_pagamentos();
        ?>

        <div class="wrap">
            <h1>Contratos - Formas de Pagamento</h1>

            <?php if (!empty($_GET['updated'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>Forma de pagamento salva com sucesso.</p>
                </div>
            <?php endif; ?>

            <h2 class="nav-tab-wrapper">
                <a href="<?php echo esc_url(add_query_arg(['tab' => 'list'], admin_url('admin.php?page=photomusic-pagamentos'))); ?>"
                   class="nav-tab <?php echo $tab === 'list' ? 'nav-tab-active' : ''; ?>">
                    Lista de Formas de Pagamento
                </a>

                <a href="<?php echo esc_url(add_query_arg(['tab' => 'new'], admin_url('admin.php?page=photomusic-pagamentos'))); ?>"
                   class="nav-tab <?php echo $tab === 'new' ? 'nav-tab-active' : ''; ?>">
                    Criar Nova Forma
                </a>

                <?php if ($editing): ?>
                    <a href="<?php echo esc_url(add_query_arg(['tab' => 'edit'], admin_url('admin.php?page=photomusic-pagamentos&edit=' . $editing_id))); ?>"
                       class="nav-tab <?php echo $tab === 'edit' ? 'nav-tab-active' : ''; ?>">
                        Editar Forma
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
                    self::render_list($pagamentos, $tipos);
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
     * Renderiza a lista
     */
    protected static function render_list($pagamentos, $tipos) {
        ?>
        <h2>Formas de Pagamento Cadastradas</h2>

        <?php if (empty($pagamentos)): ?>
            <p>Nenhuma forma de pagamento cadastrada ainda.</p>
            <?php return; ?>
        <?php endif; ?>

        <table class="widefat striped">
            <thead>
            <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Parcelas</th>
                <th>Ativa</th>
                <th>Ordem</th>
                <th>Ações</th>
            </tr>
            </thead>

            <tbody>
            <?php foreach ($pagamentos as $p): ?>
                <tr>
                    <td><?php echo esc_html($p->id); ?></td>
                    <td><?php echo esc_html($p->titulo); ?></td>
                    <td><?php echo esc_html($tipos[$p->tipo] ?? $p->tipo); ?></td>
                    <td><?php echo esc_html($p->parcelas); ?></td>
                    <td><?php echo $p->ativo ? 'Sim' : 'Não'; ?></td>
                    <td><?php echo esc_html($p->ordem); ?></td>

                    <td>
                        <a href="<?php echo esc_url(add_query_arg([
                            'page' => 'photomusic-pagamentos',
                            'tab'  => 'edit',
                            'edit' => $p->id,
                        ], admin_url('admin.php'))); ?>">
                            Editar
                        </a>

                        <?php if ($p->ativo): ?>
                            |
                            <form method="post" action="" style="display:inline;"
                                  onsubmit="return confirm('Desativar esta forma de pagamento?');">
                                <?php wp_nonce_field('pm_pagamento_form', 'pm_pagamento_nonce'); ?>
                                <input type="hidden" name="pm_pagamento_action" value="deactivate">
                                <input type="hidden" name="id" value="<?php echo esc_attr($p->id); ?>">
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
     * Renderiza o formulário
     */
    protected static function render_form($editing, $tipos) {

        $is_edit = !empty($editing);
        ?>

        <h2><?php echo $is_edit ? 'Editar Forma de Pagamento' : 'Criar Nova Forma de Pagamento'; ?></h2>

        <form method="post">
            <?php wp_nonce_field('pm_pagamento_form', 'pm_pagamento_nonce'); ?>
            <input type="hidden" name="pm_pagamento_action" value="save">
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
                                    <?php selected($editing->tipo ?? 'avista', $k); ?>>
                                    <?php echo esc_html($v); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>

                <tr>
                    <th><label for="parcelas">Parcelas</label></th>
                    <td>
                        <input type="number" name="parcelas" id="parcelas" class="small-text"
                               value="<?php echo esc_attr($editing->parcelas ?? 1); ?>" min="1">
                    </td>
                </tr>

                <tr>
                    <th><label for="juros">Juros (%)</label></th>
                    <td>
                        <input type="number" step="0.01" name="juros" id="juros" class="small-text"
                               value="<?php echo esc_attr($editing->juros ?? 0); ?>">
                    </td>
                </tr>

                <tr>
                    <th><label for="multa">Multa (%)</label></th>
                    <td>
                        <input type="number" step="0.01" name="multa" id="multa" class="small-text"
                               value="<?php echo esc_attr($editing->multa ?? 0); ?>">
                    </td>
                </tr>

                <tr>
                    <th><label for="vencimento">Vencimento</label></th>
                    <td>
                        <input type="text" name="vencimento" id="vencimento" class="regular-text"
                               placeholder="Ex: 5 dias após o evento"
                               value="<?php echo esc_attr($editing->vencimento ?? ''); ?>">
                    </td>
                </tr>

                <tr>
                    <th><label for="descricao">Descrição</label></th>
                    <td>
                        <textarea name="descricao" id="descricao" rows="5" class="large-text"><?php
                            echo esc_textarea($editing->descricao ?? '');
                        ?></textarea>
                        <p class="description">Descrição opcional exibida no contrato.</p>
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
                            Forma ativa
                        </label>
                    </td>
                </tr>

            </table>

            <?php submit_button($is_edit ? 'Salvar Forma' : 'Criar Forma'); ?>
        </form>

        <?php
    }
}
