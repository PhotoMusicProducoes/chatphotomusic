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
     * Shortcode [photomusic_galeria]
     * Aceita ?token= (novo fluxo via aceite REST API)
     * ============================================================
     */
    public static function render_galeria_shortcode($atts) {

        // Novo fluxo: ?token= gerado pela API de aceite
        if (!empty($_GET['token'])) {
            return self::render_por_token(sanitize_text_field($_GET['token']));
        }

        return '<div style="text-align:center;padding:60px 20px;color:#888;">
                    <p style="font-size:1.5rem;">🔒</p>
                    <p>Acesso inválido. Use o link recebido pelo WhatsApp.</p>
                </div>';
    }

    /**
     * ============================================================
     * Renderiza a galeria a partir de um token de aceite
     * ============================================================
     */
    private static function render_por_token($token) {
        global $wpdb;

        if (!PhotoMusic_Helpers::is_valid_sha256($token)) {
            return '<p style="color:red;">Token inválido.</p>';
        }

        // Busca aceite pelo token
        $aceite = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_aceites_evento
             WHERE token_acesso = %s LIMIT 1",
            $token
        ));

        if (!$aceite) {
            return '<div style="text-align:center;padding:40px;color:#888;">
                        <p>Link expirado ou inválido. Solicite o link novamente pelo WhatsApp.</p>
                    </div>';
        }

        // Busca evento
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
            $aceite->id_evento
        ));

        if (!$evento || $evento->status_evento === 'desativado') {
            return '<p>Evento não disponível.</p>';
        }

        // Busca serviços com links
        $servicos = $wpdb->get_results($wpdb->prepare(
            "SELECT s.nome AS nome_servico,
                    s.slug AS slug_servico,
                    es.link_galeria
             FROM {$wpdb->prefix}pm_eventos_servicos es
             LEFT JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
             WHERE es.id_evento = %d
               AND es.link_galeria IS NOT NULL
               AND es.link_galeria != ''
             ORDER BY es.id ASC",
            $evento->id
        ));

        // Registra acesso
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $tbl_views = $wpdb->prefix . 'pm_galeria_views';

        foreach ($servicos as $s) {
            $existe = $wpdb->get_row($wpdb->prepare(
                "SELECT id, total_views FROM $tbl_views
                 WHERE id_evento = %d AND id_aceite = %d AND nome_servico = %s LIMIT 1",
                $evento->id, $aceite->id, $s->nome_servico
            ));
            if ($existe) {
                $wpdb->update($tbl_views,
                    ['total_views' => $existe->total_views + 1, 'ultimo_acesso' => current_time('mysql'), 'ip' => $ip, 'user_agent' => $ua],
                    ['id' => $existe->id]
                );
            } else {
                $wpdb->insert($tbl_views, [
                    'id_evento'      => $evento->id,
                    'id_aceite'      => $aceite->id,
                    'nome_servico'   => $s->nome_servico ?? '',
                    'tipo_servico'   => $s->slug_servico ?? '',
                    'total_views'    => 1,
                    'ip'             => $ip,
                    'user_agent'     => $ua,
                    'primeiro_acesso'=> current_time('mysql'),
                    'ultimo_acesso'  => current_time('mysql'),
                ]);
            }
        }

        // Mapa de ícones por slug do serviço
        $icones = [
            'foto-cabine'       => '📸',
            'foto_cabine'       => '📸',
            'plataforma-360'    => '🎥',
            'plataforma_360'    => '🎥',
            'paparazzi-digital' => '📸',
            'paparazzi_digital' => '📸',
            'video'             => '🎥',
            'gif'               => '🎞️',
            'fotografia'        => '📷',
        ];

        $data_fmt   = $evento->data_evento ? date('d/m/Y', strtotime($evento->data_evento)) : '';
        $nome_ev    = esc_html($evento->motivo_evento ?? '');
        $nome_aceit = esc_html($aceite->nome ?? '');

        ob_start();
        ?>
        <style>
            .pm-gal-wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; font-family: system-ui, sans-serif; }
            .pm-gal-header { text-align: center; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2px solid #e5e5e5; }
            .pm-gal-header h2 { font-size: 1.7rem; margin: 0 0 4px; color: #1a1a1a; }
            .pm-gal-header .pm-data { color: #777; font-size: .95rem; margin: 4px 0; }
            .pm-gal-header .pm-usuario { display: inline-block; margin-top: 8px; background: #eaf5ea; color: #2a7a2a; border-radius: 20px; padding: 4px 14px; font-size: .88rem; }
            .pm-gal-bloco { margin-bottom: 36px; }
            .pm-gal-titulo { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; color: #333; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0; }
            .pm-gal-frame { width: 100%; min-height: 75vh; border: none; border-radius: 10px; background: #f5f5f5; display: block; }
            .pm-gal-vazia { text-align: center; padding: 60px 20px; background: #fafafa; border-radius: 10px; border: 2px dashed #ddd; color: #777; }
        </style>

        <div class="pm-gal-wrap">
            <div class="pm-gal-header">
                <h2><?php echo $nome_ev; ?></h2>
                <?php if ($data_fmt): ?>
                    <p class="pm-data">📅 <?php echo esc_html($data_fmt); ?></p>
                <?php endif; ?>
                <?php if ($nome_aceit): ?>
                    <span class="pm-usuario">✅ Acesso autorizado — <strong><?php echo $nome_aceit; ?></strong></span>
                <?php endif; ?>
            </div>

            <?php if (!empty($servicos)): ?>
                <?php foreach ($servicos as $sv): ?>
                    <?php
                        $slug_sv = strtolower($sv->slug_servico ?? '');
                        $icone   = $icones[$slug_sv] ?? '📁';
                        $nome_sv = esc_html($sv->nome_servico ?? 'Galeria');
                        $link_sv = esc_url($sv->link_galeria);
                    ?>
                    <div class="pm-gal-bloco">
                        <?php if (count($servicos) > 1): ?>
                            <div class="pm-gal-titulo">
                                <span><?php echo $icone; ?></span>
                                <span><?php echo $nome_sv; ?></span>
                            </div>
                        <?php endif; ?>
                        <iframe
                            src="<?php echo $link_sv; ?>"
                            class="pm-gal-frame"
                            allowfullscreen
                            loading="lazy"
                            title="<?php echo esc_attr($sv->nome_servico ?? ''); ?>">
                        </iframe>
                    </div>
                <?php endforeach; ?>
            <?php else: ?>
                <div class="pm-gal-vazia">
                    <p style="font-size:2rem;">⏳</p>
                    <p><strong>Galeria em preparação.</strong><br>As fotos estarão disponíveis em breve.</p>
                </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }
}
