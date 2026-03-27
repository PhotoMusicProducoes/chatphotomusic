<?php
// includes/contratos/class-photomusic-assinatura-admin.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Assinatura_Admin {

    /* ============================================================
       INICIALIZA O MÓDULO
       ============================================================ */
    public static function init() {
        add_action('admin_post_pm_assinar_empresa', [__CLASS__, 'processar_assinatura']);
    }

    /* ============================================================
       PROCESSA A ASSINATURA INTERNA DA EMPRESA
       ============================================================ */
    public static function processar_assinatura() {

        if (!current_user_can('pm_assinar_contratos')) {
            wp_die('Você não tem permissão para assinar contratos pela empresa.');
        }

        check_admin_referer('pm_assinar_empresa');

        $contrato_id = intval($_GET['contrato_id']);
        $user_id     = get_current_user_id();

        if (!$contrato_id) {
            wp_die('Contrato inválido.');
        }

        $contrato = PhotoMusic_Contratos::get($contrato_id);

        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        /* ============================================================
           BLOQUEIOS DE SEGURANÇA
        ============================================================ */

        // Status incorreto
        if ($contrato->status_contrato !== 'aguardando_assinatura_admin') {
            wp_die('Este contrato não está disponível para assinatura interna.');
        }

        // Representante não autorizado
        if (!PhotoMusic_Helpers_Representantes::usuario_pode_assinar($user_id)) {
            wp_die('Você não está autorizado a assinar contratos.');
        }

        /* ============================================================
           REGISTRA ASSINATURA DA EMPRESA
        ============================================================ */

        $ip        = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $useragent = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $data      = current_time('mysql');

        global $wpdb;

        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            [
                'assinatura_admin_nome'      => get_userdata($user_id)->display_name,
                'assinatura_admin_id'        => $user_id,
                'assinatura_admin_data'      => $data,
                'assinatura_admin_ip'        => $ip,
                'assinatura_admin_useragent' => $useragent,
            ],
            ['id' => $contrato_id]
        );

        // Atualiza status
        PhotoMusic_Contratos::update_status($contrato_id, 'assinado_admin');

        /* ============================================================
           HISTÓRICO DO EVENTO
        ============================================================ */
        if (class_exists('PhotoMusic_Event_History')) {
            PhotoMusic_Event_History::add(
                $contrato->id_evento,
                'contrato_assinado_empresa',
                'Contrato assinado internamente pela empresa.'
            );
        }

        /* ============================================================
           LOG DO SISTEMA
        ============================================================ */
        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add(
                'contrato_assinado_empresa',
                $user_id,
                $contrato->id_evento,
                $contrato_id,
                "Contrato assinado pela empresa. IP: {$ip}"
            );
        }

        /* ============================================================
           GERA PDF PRÉ-ASSINADO
        ============================================================ */
        if (class_exists('PhotoMusic_Contratos_PDF')) {
            $contrato_atualizado = PhotoMusic_Contratos::get($contrato_id);
            PhotoMusic_Contratos_PDF::gerar_pdf($contrato_atualizado);
        }

        /* ============================================================
           REDIRECIONA COM SUCESSO
        ============================================================ */
        wp_redirect(admin_url('admin.php?page=photomusic_contratos&msg=empresa_assinou'));
        exit;
    }
}
