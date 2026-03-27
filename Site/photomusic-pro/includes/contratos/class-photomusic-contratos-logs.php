<?php
// includes/contratos/class-photomusic-contratos-logs.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Logs {

    /* ============================================================
       REGISTRAR LOG
       ============================================================ */
    public static function registrar($contrato_id, $acao, $dados_extra = '') {

        global $wpdb;

        $tabela = $wpdb->prefix . 'pm_contratos_logs';

        $user = wp_get_current_user();

        $wpdb->insert($tabela, [
            'contrato_id' => intval($contrato_id),
            'acao'        => sanitize_text_field($acao),
            'dados'       => sanitize_textarea_field($dados_extra),
            'data'        => current_time('mysql'),
            'ip'          => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent'  => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'user_id'     => $user ? intval($user->ID) : 0,
            'user_nome'   => $user ? sanitize_text_field($user->display_name) : 'Visitante'
        ]);
    }

    /* ============================================================
       LISTAR LOGS DE UM CONTRATO
       ============================================================ */
    public static function listar($contrato_id) {

        global $wpdb;

        $tabela = $wpdb->prefix . 'pm_contratos_logs';

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $tabela WHERE contrato_id = %d ORDER BY id DESC",
                $contrato_id
            )
        );
    }

    /* ============================================================
       EXIBIR LOGS NO ADMIN (OPCIONAL)
       ============================================================ */
    public static function render_admin_logs($contrato_id) {

        $logs = self::listar($contrato_id);

        if (!$logs) {
            echo '<p>Nenhum log registrado.</p>';
            return;
        }

        echo '<table class="widefat striped">';
        echo '<thead><tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Usuário</th>
                <th>IP</th>
                <th>User Agent</th>
                <th>Detalhes</th>
              </tr></thead><tbody>';

        foreach ($logs as $log) {
            echo '<tr>';
            echo '<td>' . esc_html($log->data) . '</td>';
            echo '<td>' . esc_html($log->acao) . '</td>';
            echo '<td>' . esc_html($log->user_nome) . '</td>';
            echo '<td>' . esc_html($log->ip) . '</td>';
            echo '<td>' . esc_html($log->user_agent) . '</td>';
            echo '<td>' . esc_html($log->dados) . '</td>';
            echo '</tr>';
        }

        echo '</tbody></table>';
    }
}
