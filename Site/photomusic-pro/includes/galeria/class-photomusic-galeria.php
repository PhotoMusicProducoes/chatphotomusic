<?php
// includes/galeria/class-photomusic-galeria.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Galeria {

    public static function init() {

        // Shortcode legado (mantido por compatibilidade)
        add_shortcode('photomusic_galeria', [__CLASS__, 'render_galeria_shortcode']);

        // NOVO — Rotas amigáveis
        add_action('init', [__CLASS__, 'register_routes']);
        add_filter('query_vars', [__CLASS__, 'register_query_vars']);
        add_action('template_redirect', [__CLASS__, 'handle_route']);
    }

    /**
     * ============================================================
     * PASSO 1 — Registrar rota amigável:
     * /galeria/{evento}/{servico}/
     * ============================================================
     */
    public static function register_routes() {
        add_rewrite_rule(
            '^galeria/([^/]+)/([^/]+)/?$',
            'index.php?pm_galeria=1&evento_slug=$1&servico_slug=$2',
            'top'
        );
    }

    public static function register_query_vars($vars) {
        $vars[] = 'pm_galeria';
        $vars[] = 'evento_slug';
        $vars[] = 'servico_slug';
        return $vars;
    }

    /**
     * Controla a rota amigável e delega ao controller
     */
    public static function handle_route() {

        if (intval(get_query_var('pm_galeria')) === 1) {

            require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-controller-galeria.php';

            $controller = new PhotoMusic_Galeria_Controller();
            $controller->handle_request();

            exit;
        }
    }

    /**
     * ============================================================
     * Shortcode legado — acesso via token
     * ============================================================
     */
    public static function render_galeria_shortcode($atts) {

        if (empty($_GET['acesso'])) {
            return '<p>Acesso inválido.</p>';
        }

        $token = sanitize_text_field($_GET['acesso']);

        global $wpdb;
        $tbl_acessos = $wpdb->prefix . 'pm_acessos_galeria';

        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_acessos WHERE token_acesso = %s",
            $token
        ));

        if (!$row) {
            return '<p>Acesso não encontrado ou inválido.</p>';
        }

        /**
         * ============================================================
         * Validação de dispositivo
         * ============================================================
         */
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

        $device_raw  = $ip . '|' . $ua;
        $device_hash = hash('sha256', $device_raw);

        if (!empty($row->device_hash) && $device_hash !== $row->device_hash) {
            return '<p>Este link só pode ser acessado do dispositivo original.</p>';
        }

        /**
         * ============================================================
         * Limite diário de acessos
         * ============================================================
         */
        $limite = 10;
        $hoje   = current_time('Y-m-d');

        $acessos_hoje = (int) $row->acessos_hoje;
        $ultimo       = $row->ultimo_acesso;

        if ($ultimo !== $hoje) {
            $acessos_hoje = 0;
        }

        if ($acessos_hoje >= $limite) {
            return '<p>Limite de acessos diários atingido. Tente novamente amanhã.</p>';
        }

        // Atualiza contagem
        $acessos_hoje++;

        $wpdb->update($tbl_acessos, [
            'acessos_hoje' => $acessos_hoje,
            'ultimo_acesso'=> $hoje,
        ], ['id' => $row->id]);

        /**
         * ============================================================
         * Placeholder da galeria (será substituído pela versão final)
         * ============================================================
         */
        ob_start();
        ?>
        <div class="photomusic-galeria">
            <h2>Galeria do Evento #<?php echo esc_html($row->id_evento); ?></h2>
            <p>(Em breve: fotos reais carregadas de forma protegida.)</p>
        </div>
        <?php
        return ob_get_clean();
    }
}
