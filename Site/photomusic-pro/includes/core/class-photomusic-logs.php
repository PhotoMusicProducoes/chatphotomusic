<?php
//includes/core/class-photomusic-logs.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Logs {

    public static function init() {
        // Futuro: tela de logs no admin
    }

    /**
     * Adiciona um log ao sistema
     *
     * @param string $tipo
     * @param int|null $id_evento
     * @param int|null $id_servico
     * @param int|null $id_convite
     * @param int|null $id_aceite
     * @param string $mensagem
     */
    public static function add($tipo, $id_evento = null, $id_servico = null, $id_convite = null, $id_aceite = null, $mensagem = '') {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_logs_sistema';

        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        $navegador   = self::detect_browser($ua);
        $dispositivo = self::detect_device($ua);

        $mensagem = substr(sanitize_textarea_field($mensagem), 0, 2000);

        $id_evento  = ($id_evento  > 0) ? (int)$id_evento  : null;
        $id_servico = ($id_servico > 0) ? (int)$id_servico : null;
        $id_convite = ($id_convite > 0) ? (int)$id_convite : null;
        $id_aceite  = ($id_aceite  > 0) ? (int)$id_aceite  : null;

        $wpdb->insert($table, [
            'tipo'        => sanitize_text_field($tipo),
            'id_evento'   => $id_evento,
            'id_servico'  => $id_servico,
            'id_convite'  => $id_convite,
            'id_aceite'   => $id_aceite,
            'mensagem'    => $mensagem,
            'ip'          => $ip,
            'navegador'   => $navegador,
            'dispositivo' => $dispositivo,
            'user_agent'  => $ua,
            'criado_em'   => current_time('mysql'),
        ]);
    }

    /**
     * Lista logs por evento
     */
    public static function get_by_event($id_evento) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_logs_sistema';

        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE id_evento = %d ORDER BY criado_em DESC",
            $id_evento
        ));
    }

    /**
     * Lista logs por serviço
     */
    public static function get_by_service($id_servico) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_logs_sistema';

        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE id_servico = %d ORDER BY criado_em DESC",
            $id_servico
        ));
    }

    /**
     * Lista logs por tipo
     */
    public static function get_by_type($tipo) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_logs_sistema';
        $tipo = sanitize_text_field($tipo);

        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE tipo = %s ORDER BY criado_em DESC",
            $tipo
        ));
    }

    /* ============================================================
       Funções auxiliares
    ============================================================ */

    private static function detect_browser($ua) {
        $ua = sanitize_text_field($ua);
        if (stripos($ua, 'Chrome') !== false) return 'Chrome';
        if (stripos($ua, 'Firefox') !== false) return 'Firefox';
        if (stripos($ua, 'Safari') !== false) return 'Safari';
        if (stripos($ua, 'Edge') !== false) return 'Edge';
        return 'Desconhecido';
    }

    private static function detect_device($ua) {
        $ua = sanitize_text_field($ua);
        if (stripos($ua, 'iPhone') !== false) return 'iPhone';
        if (stripos($ua, 'iPad') !== false) return 'iPad';
        if (stripos($ua, 'Android') !== false) return 'Android';
        return 'Desktop';
    }
}
