<?php
// includes/contratos/class-photomusic-contratos-permissoes.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Permissoes {

    /* ============================================================
       INICIALIZA O MÓDULO
       ============================================================ */
    public static function init() {

        // Validações de backend (admin-post)
        add_action('admin_post_pm_criar_contrato',   [__CLASS__, 'validar_criar']);
        add_action('admin_post_pm_editar_contrato',  [__CLASS__, 'validar_editar']);
        add_action('admin_post_pm_enviar_assinatura',[__CLASS__, 'validar_enviar']);
        add_action('admin_post_pm_cancelar_contrato',[__CLASS__, 'validar_cancelar']);

        // Hooks para UI (botões)
        add_filter('photomusic_contratos_show_btn_criar',   [__CLASS__, 'pode_criar']);
        add_filter('photomusic_contratos_show_btn_editar',  [__CLASS__, 'pode_editar']);
        add_filter('photomusic_contratos_show_btn_enviar',  [__CLASS__, 'pode_enviar']);
        add_filter('photomusic_contratos_show_btn_cancelar',[__CLASS__, 'pode_cancelar']);
        add_filter('photomusic_contratos_show_btn_assinar', [__CLASS__, 'pode_assinar']);
    }

    /* ============================================================
       PERMISSÕES (UI)
       ============================================================ */

   public static function pode_criar($default = false) {
        if (current_user_can('administrator')) return true;
        return get_user_meta(get_current_user_id(), 'pm_criar_contratos', true) == 1;
    }

    public static function pode_editar($default = false) {
        if (current_user_can('administrator')) return true;
        return get_user_meta(get_current_user_id(), 'pm_editar_contratos', true) == 1;
    }

    public static function pode_enviar($default = false) {
        if (current_user_can('administrator')) return true;
        return get_user_meta(get_current_user_id(), 'pm_enviar_para_assinatura', true) == 1;
    }

    public static function pode_cancelar($default = false) {
        if (current_user_can('administrator')) return true;
        return get_user_meta(get_current_user_id(), 'pm_cancelar_contratos', true) == 1;
    }

    public static function pode_assinar($default = false) {
        if (current_user_can('administrator')) return true;
        return get_user_meta(get_current_user_id(), 'pm_assinar_contratos', true) == 1;
    }

    /* ============================================================
       VALIDAÇÕES (BACKEND)
       ============================================================ */

    public static function validar_criar() {
        if (!self::pode_criar()) {
            wp_die('Você não tem permissão para criar contratos.');
        }
    }

    public static function validar_editar() {
        if (!self::pode_editar()) {
            wp_die('Você não tem permissão para editar contratos.');
        }
    }

    public static function validar_enviar() {
        if (!self::pode_enviar()) {
            wp_die('Você não tem permissão para enviar contratos para assinatura interna.');
        }
    }

    public static function validar_cancelar() {
        if (!self::pode_cancelar()) {
            wp_die('Você não tem permissão para cancelar contratos.');
        }
    }

    /* ============================================================
       VALIDAÇÃO DE STATUS (SEGURANÇA EXTRA)
       ============================================================ */

    public static function validar_status_para_edicao($contrato) {

        // Administrador pode editar contratos em qualquer status
        if (current_user_can('administrator')) return;

        if ($contrato->status_contrato !== 'rascunho') {
            wp_die('Este contrato não pode mais ser editado.');
        }

        if (!self::pode_editar()) {
            wp_die('Você não tem permissão para editar contratos.');
        }
    }

    public static function validar_status_para_envio($contrato) {

        if ($contrato->status_contrato !== 'rascunho') {
            wp_die('Este contrato não pode ser enviado para assinatura interna.');
        }

        if (!self::pode_enviar()) {
            wp_die('Você não tem permissão para enviar contratos.');
        }
    }

    public static function validar_status_para_cancelar($contrato) {

        if ($contrato->status_contrato === 'assinado') {
            wp_die('Contratos assinados não podem ser cancelados.');
        }

        if (!self::pode_cancelar()) {
            wp_die('Você não tem permissão para cancelar contratos.');
        }
    }
}
