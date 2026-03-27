<?php
// includes/empresa/class-photomusic-representantes.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Representantes {

    const META_FLAG   = 'pm_representante_legal';
    const META_CARGO  = 'pm_representante_cargo';
    const META_CPF    = 'pm_representante_cpf';
    const META_RG     = 'pm_representante_rg';
    const META_TEL    = 'pm_representante_telefone';
    const META_ASSINA = 'pm_assinar_contratos';

    /* ============================================================
       INICIALIZA O PAINEL
       ============================================================ */
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_pm_salvar_representante', [__CLASS__, 'salvar']);
        add_action('admin_post_pm_excluir_representante', [__CLASS__, 'excluir']);
    }

    /* ============================================================
       ADICIONA MENU NO ADMIN
       ============================================================ */
    public static function menu() {

        add_submenu_page(
            'photomusic-eventos',
            'Representantes Legais',
            'Representantes Legais',
            'pm_gerenciar_usuarios',
            'photomusic_representantes',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       OBTÉM TODOS OS REPRESENTANTES LEGAIS
       ============================================================ */
    public static function get_all() {

        $args = [
            'meta_key'   => self::META_FLAG,
            'meta_value' => 1,
            'number'     => -1,
            'orderby'    => 'display_name',
            'order'      => 'ASC'
        ];

        return get_users($args);
    }

    /* ============================================================
       SALVA REPRESENTANTE (ADD/EDIT)
       ============================================================ */
    public static function salvar() {

        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_salvar_representante');

        $user_id = intval($_POST['user_id']);
        $cargo   = sanitize_text_field($_POST['cargo']);
        $cpf     = sanitize_text_field($_POST['cpf']);
        $rg      = sanitize_text_field($_POST['rg']);
        $tel     = sanitize_text_field($_POST['telefone']);

        if (!$user_id) {
            wp_die('Usuário inválido.');
        }

        update_user_meta($user_id, self::META_FLAG, 1);
        update_user_meta($user_id, self::META_CARGO, $cargo);
        update_user_meta($user_id, self::META_CPF, $cpf);
        update_user_meta($user_id, self::META_RG, $rg);
        update_user_meta($user_id, self::META_TEL, $tel);
        update_user_meta($user_id, self::META_ASSINA, 1);

        wp_redirect(admin_url('admin.php?page=photomusic_representantes&msg=salvo'));
        exit;
    }

    /* ============================================================
       REMOVE REPRESENTANTE LEGAL
       ============================================================ */
    public static function excluir() {

        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_excluir_representante');

        $user_id = intval($_GET['user_id']);

        if (!$user_id) {
            wp_die('Usuário inválido.');
        }

        delete_user_meta($user_id, self::META_FLAG);
        delete_user_meta($user_id, self::META_CARGO);
        delete_user_meta($user_id, self::META_CPF);
        delete_user_meta($user_id, self::META_RG);
        delete_user_meta($user_id, self::META_TEL);
        delete_user_meta($user_id, self::META_ASSINA);

        wp_redirect(admin_url('admin.php?page=photomusic_representantes&msg=excluido'));
        exit;
    }

    /* ============================================================
       RENDERIZA A PÁGINA DO PAINEL
       ============================================================ */
    public static function render_page() {

        $representantes = self::get_all();
        $usuarios       = get_users(['orderby' => 'display_name', 'order' => 'ASC']);

        // Dados para edição
        $editar_id    = intval($_GET['editar'] ?? 0);
        $editar_user  = $editar_id ? get_userdata($editar_id) : null;
        $editar_cargo = $editar_id ? get_user_meta($editar_id, self::META_CARGO, true) : '';
        $editar_cpf   = $editar_id ? get_user_meta($editar_id, self::META_CPF,   true) : '';
        $editar_rg    = $editar_id ? get_user_meta($editar_id, self::META_RG,    true) : '';
        $editar_tel   = $editar_id ? get_user_meta($editar_id, self::META_TEL,   true) : '';
        ?>

        <div class="wrap">
            <h1>Representantes Legais</h1>

            <?php if (!empty($_GET['msg']) && $_GET['msg'] === 'salvo'): ?>
                <div class="updated notice is-dismissible"><p>✅ Representante salvo com sucesso.</p></div>
            <?php endif; ?>

            <?php if (!empty($_GET['msg']) && $_GET['msg'] === 'excluido'): ?>
                <div class="updated notice is-dismissible"><p>Representante removido.</p></div>
            <?php endif; ?>

            <h2><?php echo $editar_id ? '✏️ Editar Representante' : 'Adicionar Representante'; ?></h2>

            <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">

                <?php wp_nonce_field('pm_salvar_representante'); ?>
                <input type="hidden" name="action" value="pm_salvar_representante">

                <table class="form-table">

                    <tr>
                        <th><label>Usuário</label></th>
                        <td>
                            <?php if ($editar_id && $editar_user): ?>
                                <input type="hidden" name="user_id" value="<?php echo $editar_id; ?>">
                                <strong><?php echo esc_html($editar_user->display_name); ?></strong>
                                <span style="color:#666;"> (<?php echo esc_html($editar_user->user_email); ?>)</span>
                                &nbsp; <a href="<?php echo admin_url('admin.php?page=photomusic_representantes'); ?>">Cancelar edição</a>
                            <?php else: ?>
                                <select name="user_id" required>
                                    <option value="">Selecione...</option>
                                    <?php foreach ($usuarios as $u): ?>
                                        <option value="<?php echo $u->ID; ?>">
                                            <?php echo esc_html($u->display_name . ' (' . $u->user_email . ')'); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            <?php endif; ?>
                        </td>
                    </tr>

                    <tr>
                        <th><label>Cargo</label></th>
                        <td><input type="text" name="cargo" class="regular-text" required
                                   value="<?php echo esc_attr($editar_cargo); ?>"
                                   placeholder="Sócio Proprietário"></td>
                    </tr>

                    <tr>
                        <th><label>CPF</label></th>
                        <td><input type="text" name="cpf" class="regular-text" required
                                   value="<?php echo esc_attr($editar_cpf); ?>"
                                   placeholder="912.571.159-87"></td>
                    </tr>

                    <tr>
                        <th><label>RG</label></th>
                        <td><input type="text" name="rg" class="regular-text"
                                   value="<?php echo esc_attr($editar_rg); ?>"
                                   placeholder="555167-1 MB"></td>
                    </tr>

                    <tr>
                        <th><label>Telefone</label></th>
                        <td><input type="text" name="telefone" class="regular-text"
                                   value="<?php echo esc_attr($editar_tel); ?>"></td>
                    </tr>

                </table>

                <?php submit_button($editar_id ? 'Atualizar Representante' : 'Salvar Representante'); ?>

            </form>

            <hr>

            <h2>Representantes Cadastrados</h2>

            <table class="widefat striped">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Cargo</th>
                        <th>CPF</th>
                        <th>RG</th>
                        <th>Telefone</th>
                        <th>Ações</th>
                    </tr>
                </thead>

                <tbody>
                    <?php if (empty($representantes)): ?>
                        <tr><td colspan="7">Nenhum representante cadastrado.</td></tr>
                    <?php else: ?>
                        <?php foreach ($representantes as $r): ?>
                            <tr>
                                <td><?php echo esc_html($r->display_name); ?></td>
                                <td><?php echo esc_html($r->user_email); ?></td>
                                <td><?php echo esc_html(get_user_meta($r->ID, self::META_CARGO, true)); ?></td>
                                <td><?php echo esc_html(get_user_meta($r->ID, self::META_CPF, true)); ?></td>
                                <td><?php echo esc_html(get_user_meta($r->ID, self::META_RG, true)); ?></td>
                                <td><?php echo esc_html(get_user_meta($r->ID, self::META_TEL, true)); ?></td>
                                <td>
                                    <a href="<?php echo admin_url('admin.php?page=photomusic_representantes&editar=' . $r->ID); ?>"
                                       class="button button-small">
                                        ✏️ Editar
                                    </a>
                                    &nbsp;
                                    <a href="<?php echo wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_excluir_representante&user_id=' . $r->ID),
                                        'pm_excluir_representante'
                                    ); ?>"
                                       class="button button-small"
                                       style="color:#a00;"
                                       onclick="return confirm('Remover representante?');">
                                        🗑️ Remover
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>

            </table>

        </div>

        <?php
    }
}
