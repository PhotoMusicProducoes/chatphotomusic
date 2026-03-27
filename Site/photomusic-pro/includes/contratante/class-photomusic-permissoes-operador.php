<?php
// includes/contratos/class-photomusic-permissoes-operador.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Permissoes_Operador {

    /* ============================================================
       METAS DE PERMISSÃO
       ============================================================ */
    const META_CRIAR       = 'pm_criar_contratos';
    const META_EDITAR      = 'pm_editar_contratos';
    const META_ENVIAR      = 'pm_enviar_para_assinatura';
    const META_CANCELAR    = 'pm_cancelar_contratos';
    const META_FINANCEIRO  = 'pm_ver_financeiro';
    const META_ASSINAR     = 'pm_assinar_contratos'; // também usado por representantes legais

    /* ============================================================
       INICIALIZA O PAINEL
       ============================================================ */
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_pm_salvar_permissoes', [__CLASS__, 'salvar']);
    }

    /* ============================================================
       ADICIONA MENU NO ADMIN
       ============================================================ */
    public static function menu() {

        add_submenu_page(
            'photomusic-eventos',
            'Permissões do Operador',
            'Permissões do Operador',
            'pm_gerenciar_usuarios',
            'photomusic_permissoes',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       RETORNA AS PERMISSÕES DE UM USUÁRIO
       ============================================================ */
    public static function get_permissoes($user_id) {

        return [
            'criar'      => (bool) get_user_meta($user_id, self::META_CRIAR, true),
            'editar'     => (bool) get_user_meta($user_id, self::META_EDITAR, true),
            'enviar'     => (bool) get_user_meta($user_id, self::META_ENVIAR, true),
            'cancelar'   => (bool) get_user_meta($user_id, self::META_CANCELAR, true),
            'financeiro' => (bool) get_user_meta($user_id, self::META_FINANCEIRO, true),
            'assinar'    => (bool) get_user_meta($user_id, self::META_ASSINAR, true),
        ];
    }

    /* ============================================================
       SALVA PERMISSÕES
       ============================================================ */
    public static function salvar() {

        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_salvar_permissoes');

        $user_id = intval($_POST['user_id'] ?? 0);

        if (!$user_id || !get_userdata($user_id)) {
            wp_die('Usuário inválido.');
        }

        // Lista de permissões
        $permissoes = [
            self::META_CRIAR,
            self::META_EDITAR,
            self::META_ENVIAR,
            self::META_CANCELAR,
            self::META_FINANCEIRO,
            self::META_ASSINAR,
        ];

        // Salva cada permissão
        foreach ($permissoes as $meta) {
            if (!empty($_POST[$meta])) {
                update_user_meta($user_id, $meta, 1);
            } else {
                delete_user_meta($user_id, $meta);
            }
        }

        wp_redirect(admin_url('admin.php?page=photomusic_permissoes&msg=salvo&user_id=' . $user_id));
        exit;
    }

    /* ============================================================
       RENDERIZA A PÁGINA DO PAINEL
       ============================================================ */
    public static function render_page() {

        $usuarios = get_users(['orderby' => 'display_name', 'order' => 'ASC']);

        $user_id_selecionado = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
        $permissoes = $user_id_selecionado ? self::get_permissoes($user_id_selecionado) : [];
        ?>

        <div class="wrap">
            <h1>Permissões do Operador</h1>

            <?php if (!empty($_GET['msg']) && $_GET['msg'] === 'salvo'): ?>
                <div class="updated notice"><p>Permissões salvas com sucesso.</p></div>
            <?php endif; ?>

            <form method="get" action="">
                <input type="hidden" name="page" value="photomusic_permissoes">

                <h2>Selecione o Usuário</h2>

                <select name="user_id" onchange="this.form.submit()">
                    <option value="">Selecione...</option>
                    <?php foreach ($usuarios as $u): ?>
                        <option value="<?php echo $u->ID; ?>"
                            <?php selected($user_id_selecionado, $u->ID); ?>>
                            <?php echo esc_html($u->display_name . ' (' . $u->user_email . ')'); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </form>

            <?php if ($user_id_selecionado): ?>

                <hr>

                <h2>Permissões de <?php echo esc_html(get_userdata($user_id_selecionado)->display_name); ?></h2>

                <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">

                    <?php wp_nonce_field('pm_salvar_permissoes'); ?>
                    <input type="hidden" name="action" value="pm_salvar_permissoes">
                    <input type="hidden" name="user_id" value="<?php echo $user_id_selecionado; ?>">

                    <table class="form-table">

                        <tr>
                            <th><label>Criar contratos</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_CRIAR; ?>" <?php checked($permissoes['criar']); ?>></td>
                        </tr>

                        <tr>
                            <th><label>Editar contratos</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_EDITAR; ?>" <?php checked($permissoes['editar']); ?>></td>
                        </tr>

                        <tr>
                            <th><label>Enviar para assinatura interna</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_ENVIAR; ?>" <?php checked($permissoes['enviar']); ?>></td>
                        </tr>

                        <tr>
                            <th><label>Cancelar contratos</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_CANCELAR; ?>" <?php checked($permissoes['cancelar']); ?>></td>
                        </tr>

                        <tr>
                            <th><label>Visualizar financeiro</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_FINANCEIRO; ?>" <?php checked($permissoes['financeiro']); ?>></td>
                        </tr>

                        <tr>
                            <th><label>Assinar contratos (representante legal)</label></th>
                            <td><input type="checkbox" name="<?php echo self::META_ASSINAR; ?>" <?php checked($permissoes['assinar']); ?>></td>
                        </tr>

                    </table>

                    <?php submit_button('Salvar Permissões'); ?>

                </form>

            <?php endif; ?>

        </div>

        <?php
    }
}
