<?php
// /includes/stats/class-photomusic-stats.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Stats {

    /**
     * Retorna estatísticas básicas de acessos por evento
     */
    public static function get_event_stats($id_evento) {
        global $wpdb;

        $tbl_acessos = $wpdb->prefix . 'pm_acessos_galeria';
        $tbl_logs    = $wpdb->prefix . 'pm_logs';

        $id_evento = intval($id_evento);

        // Acessos totais de convidados
        $acessos_total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(acessos_total) FROM $tbl_acessos WHERE id_evento = %d",
            $id_evento
        ));

        // Acessos hoje de convidados
        // Aqui assumimos que a coluna acessos_hoje já representa o dia atual
        $acessos_hoje = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(acessos_hoje) FROM $tbl_acessos WHERE id_evento = %d",
            $id_evento
        ));

        // Acessos do contratante (logs)
        $acessos_contratante = 0;
        $table_exists = $wpdb->get_var(
            $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_logs)
        );

        if ($table_exists === $tbl_logs) {
            $acessos_contratante = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $tbl_logs WHERE id_evento = %d AND acao = %s",
                $id_evento,
                'login_contratante'
            ));
        }

        return [
            'acessos_convidados_total' => $acessos_total,
            'acessos_convidados_hoje'  => $acessos_hoje,
            'acessos_contratante'      => $acessos_contratante,
        ];
    }
}
