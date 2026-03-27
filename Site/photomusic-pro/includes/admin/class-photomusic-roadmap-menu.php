<?php
// includes/admin/class-photomusic-roadmap-menu.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Roadmap_Menu {

    public function __construct() {
        add_action('admin_menu', [$this, 'add_menu']);
    }

    public function add_menu() {

        // Apenas usuários com a capability personalizada podem ver
        if (!current_user_can('photomusic_view_roadmap')) {
            return;
        }

        add_menu_page(
            'Roadmap PhotoMusic',
            'Roadmap PhotoMusic',
            'photomusic_view_roadmap',
            'photomusic-roadmap',
            [$this, 'render_page'],
            'dashicons-lightbulb',
            99
        );
    }

    public function render_page() {

        if (!current_user_can('photomusic_view_roadmap')) {
            wp_die('Acesso negado.');
        }

        if (!defined('PHOTOMUSIC_PRO_PATH')) {
            wp_die('Caminho base do plugin não definido.');
        }

        $file = trailingslashit(PHOTOMUSIC_PRO_PATH) . 'docs/PhotoMusicBoot.md';

        echo '<div class="wrap">';
        echo '<h1>Roadmap / Ideias Futuras</h1>';
        echo '<p><em>Somente usuários autorizados podem ver esta página.</em></p>';
        echo '<hr>';

        if (file_exists($file)) {
            echo '<pre style="background:#f7f7f7;padding:20px;border:1px solid #ddd;white-space:pre-wrap;font-family:monospace;">';
            echo esc_html(file_get_contents($file));
            echo '</pre>';
        } else {
            echo '<p>Arquivo de roadmap não encontrado.</p>';
        }

        echo '</div>';
    }

}
