<?php
// includes/galeria/class-photomusic-file-endpoint.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_File_Endpoint {

    public static function init() {
        add_action('init', [__CLASS__, 'add_rewrite_rules']);
        add_action('template_redirect', [__CLASS__, 'handle_file_request']);
    }

    /**
     * Rota amigável:
     * /pm-file/?f=BASE64&token=XYZ
     */
    public static function add_rewrite_rules() {
        add_rewrite_rule(
            '^pm-file/?',
            'index.php?pm_file_request=1',
            'top'
        );

        add_rewrite_tag('%pm_file_request%', '1');
    }

    /**
     * Processa o endpoint de entrega de arquivos protegidos
     */
    public static function handle_file_request() {

        if (!get_query_var('pm_file_request')) {
            return;
        }

        global $wpdb;

        $tbl_servicos = $wpdb->prefix . 'pm_servicos';
        $tbl_eventos  = $wpdb->prefix . 'pm_eventos';
        $tbl_acessos  = $wpdb->prefix . 'pm_acessos_galeria';

        /* ============================================================
           1. Validar parâmetros
        ============================================================ */
        $encoded = sanitize_text_field($_GET['f'] ?? '');
        $token   = sanitize_text_field($_GET['token'] ?? '');

        if (!$encoded || !$token) {
            wp_die('Acesso inválido.');
        }

        // Decodificar caminho
        $arquivo = base64_decode($encoded, true);

        if (!$arquivo) {
            wp_die('Arquivo inválido.');
        }

        // Normalizar caminho
        $arquivo = realpath($arquivo);

        // Pasta segura
        $pasta_segura = realpath(PHOTOMUSIC_PRO_PATH . 'uploads/galeria/');

        if (!$arquivo || strpos($arquivo, $pasta_segura) !== 0) {
            wp_die('Acesso negado.');
        }

        if (!file_exists($arquivo)) {
            wp_die('Arquivo não encontrado.');
        }

        /* ============================================================
           2. Identificar serviço e evento pelo token
        ============================================================ */
        $acesso = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_acessos WHERE token_acesso = %s",
            $token
        ));

        if (!$acesso) {
            wp_die('Token inválido.');
        }

        $id_evento  = intval($acesso->id_evento);
        $id_servico = intval($acesso->id_servico);

        /* ============================================================
           3. Validar evento
        ============================================================ */
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_eventos WHERE id = %d",
            $id_evento
        ));

        if (!$evento) {
            wp_die('Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            wp_die('Este evento está encerrado.');
        }

        /* ============================================================
           4. Validar serviço
        ============================================================ */
        $servico = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_servicos WHERE id = %d AND id_evento = %d",
            $id_servico,
            $id_evento
        ));

        if (!$servico) {
            wp_die('Serviço não encontrado.');
        }

        if ($servico->status_servico === 'desativado') {
            wp_die('Este serviço está desativado.');
        }

        /* ============================================================
           5. Validar regras de acesso
        ============================================================ */
        $device_hash = self::generate_device_hash();

        $validacao = PhotoMusic_Access_Rules::validate_guest_access(
            $id_evento,
            $id_servico,
            $token,
            $device_hash
        );

        if (is_wp_error($validacao)) {
            wp_die($validacao->get_error_message());
        }

        /* ============================================================
           6. Entregar arquivo com headers seguros
        ============================================================ */
        self::deliver_file($arquivo);
        exit;
    }

    /**
     * Gera hash único do dispositivo
     */
    private static function generate_device_hash() {
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        return hash('sha256', $ua . '|' . $ip);
    }

    /**
     * Entrega o arquivo com headers seguros
     */
    private static function deliver_file($arquivo) {

        // Bloquear arquivos PHP
        if (preg_match('/\.(php|phtml|php5|php7)$/i', $arquivo)) {
            wp_die('Arquivo não permitido.');
        }

        $mime = mime_content_type($arquivo);
        $nome = basename($arquivo);

        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . $nome . '"');
        header('Content-Length: ' . filesize($arquivo));
        header('X-Content-Type-Options: nosniff');

        readfile($arquivo);
        exit;
    }
}
