<?php
if (!defined('ABSPATH')) exit;

class PhotoMusic_Dashboard {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
    }

    public static function menu() {
        add_submenu_page(
            'photomusic-eventos',
            'Dashboard',
            '📊 Dashboard',
            'pm_ver_eventos',
            'photomusic-dashboard',
            [__CLASS__, 'render']
        );
    }

    public static function render() {

        global $wpdb;

        $tbl = $wpdb->prefix . 'pm_galeria_views';

        // 🔥 TOP SERVIÇOS
        $top_servicos = $wpdb->get_results("
            SELECT nome_servico, SUM(total_views) as total
            FROM $tbl
            GROUP BY nome_servico
            ORDER BY total DESC
            LIMIT 10
        ");

        // 🔥 TOP EVENTOS
        $top_eventos = $wpdb->get_results("
            SELECT id_evento, SUM(total_views) as total
            FROM $tbl
            GROUP BY id_evento
            ORDER BY total DESC
            LIMIT 10
        ");

        echo "<div class='wrap'>";
        echo "<h1>📊 Dashboard PhotoMusic</h1>";

        // =========================
        // TOP SERVIÇOS
        // =========================
        echo "<h2>🔥 Serviços mais acessados</h2>";
        echo "<table class='widefat'>";
        echo "<thead><tr><th>Serviço</th><th>Views</th></tr></thead><tbody>";

        foreach ($top_servicos as $s) {
            echo "<tr>
                    <td>{$s->nome_servico}</td>
                    <td>{$s->total}</td>
                  </tr>";
        }

        echo "</tbody></table>";

        // =========================
        // TOP EVENTOS
        // =========================
        echo "<h2 style='margin-top:40px;'>🎉 Eventos com mais acessos</h2>";
        echo "<table class='widefat'>";
        echo "<thead><tr><th>ID Evento</th><th>Views</th></tr></thead><tbody>";

        foreach ($top_eventos as $e) {
            echo "<tr>
                    <td>{$e->id_evento}</td>
                    <td>{$e->total}</td>
                  </tr>";
        }

        echo "</tbody></table>";

        echo "</div>";
    }
}