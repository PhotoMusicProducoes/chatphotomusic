<?php
// includes/galeria/class-photomusic-galeria.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Galeria {

    public static function init() {

        // Shortcode [photomusic_galeria]
        add_shortcode('photomusic_galeria', [__CLASS__, 'render_galeria_shortcode']);

        // Rotas amigáveis /galeria/{evento}/{servico}/
        add_action('init', [__CLASS__, 'register_routes']);
        add_filter('query_vars', [__CLASS__, 'register_query_vars']);
        add_action('template_redirect', [__CLASS__, 'handle_route']);

        // Bloqueia desktop na página de aceite do convidado
        add_action('template_redirect', [__CLASS__, 'bloquear_desktop_aceite']);

        // AJAX — registra clique em serviço (logado e não-logado)
        add_action('wp_ajax_pm_registrar_clique',        [__CLASS__, 'ajax_registrar_clique']);
        add_action('wp_ajax_nopriv_pm_registrar_clique', [__CLASS__, 'ajax_registrar_clique']);
    }

    /* ============================================================
       Bloqueia acesso por desktop à página de aceite do convidado
       Identifica a página pelo slug "aceite-de-fotos-e-videos"
       ou pela presença do parâmetro ?evento=
    ============================================================ */
    public static function bloquear_desktop_aceite() {

        // Só age em páginas (não em admin, REST, etc.)
        if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        // Verifica se é a página de aceite pelo slug
        $slug_aceite = 'aceite-de-fotos-e-videos';
        $eh_pagina_aceite = is_page($slug_aceite) ||
                            (isset($_GET['evento']) && !empty($_GET['evento']));

        if (!$eh_pagina_aceite) {
            return;
        }

        // Se for desktop, exibe tela de bloqueio e encerra
        if (!PhotoMusic_Helpers::is_mobile()) {
            wp_head();
            echo '<!DOCTYPE html><html><head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Acesse pelo celular</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: system-ui, sans-serif; background: #f5f5f5;
                           display: flex; align-items: center; justify-content: center;
                           min-height: 100vh; padding: 20px; }
                    .box { background: #fff; border-radius: 16px; padding: 48px 32px;
                           text-align: center; max-width: 420px; width: 100%;
                           box-shadow: 0 4px 24px rgba(0,0,0,.08); }
                    .icon { font-size: 4rem; margin-bottom: 20px; }
                    h1 { font-size: 1.5rem; color: #1a1a1a; margin-bottom: 12px; }
                    p  { color: #555; font-size: 1rem; line-height: 1.6; }
                </style>
            </head><body>
                <div class="box">
                    <div class="icon">📱</div>
                    <h1>Acesse pelo celular</h1>
                    <p>A galeria de fotos e vídeos está disponível apenas para dispositivos móveis.<br><br>
                       Abra o link pelo seu celular para acessar suas fotos. 😊</p>
                </div>
            </body></html>';
            exit;
        }
    }

    /* ============================================================
       ROTA AMIGÁVEL /galeria/{evento}/{servico}/
    ============================================================ */
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

    public static function handle_route() {
        if (intval(get_query_var('pm_galeria')) === 1) {
            require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-controller-galeria.php';
            $controller = new PhotoMusic_Galeria_Controller();
            $controller->handle_request();
            exit;
        }
    }

    /* ============================================================
       AJAX — Registra clique em serviço específico
       POST: token, nome_servico
    ============================================================ */
    public static function ajax_registrar_clique() {

        global $wpdb;

        $token        = sanitize_text_field($_POST['token']         ?? '');
        $nome_servico = sanitize_text_field($_POST['nome_servico']  ?? '');

        if (!$token || !$nome_servico) {
            wp_send_json_error('Dados inválidos.');
        }

        if (!PhotoMusic_Helpers::is_valid_sha256($token)) {
            wp_send_json_error('Token inválido.');
        }

        $tbl_views = $wpdb->prefix . 'pm_galeria_views';

        // Atualiza apenas o campo de cliques do serviço correspondente
        $existe = $wpdb->get_row($wpdb->prepare(
            "SELECT id, total_cliques FROM $tbl_views
             WHERE token_aceite = %s AND nome_servico = %s
             LIMIT 1",
            $token, $nome_servico
        ));

        if ($existe) {
            $wpdb->update(
                $tbl_views,
                [
                    'total_cliques' => ($existe->total_cliques ?? 0) + 1,
                    'ultimo_clique' => current_time('mysql'),
                ],
                ['id' => $existe->id]
            );
        }

        wp_send_json_success('ok');
    }

    /* ============================================================
       Shortcode [photomusic_galeria]
    ============================================================ */
    public static function render_galeria_shortcode($atts) {

        if (!empty($_GET['token'])) {
            return self::render_por_token(sanitize_text_field($_GET['token']));
        }

        return '<div style="text-align:center;padding:60px 20px;color:#888;">
                    <p style="font-size:1.5rem;">🔒</p>
                    <p>Acesso inválido. Use o link recebido pelo WhatsApp.</p>
                </div>';
    }

    /* ============================================================
       Renderiza a galeria a partir do token de aceite
    ============================================================ */
    private static function render_por_token($token) {
        global $wpdb;

        // Bloqueia acesso por computador — galeria apenas para dispositivos móveis
        if (!PhotoMusic_Helpers::is_mobile()) {
            return '<div style="text-align:center;padding:60px 20px;font-family:system-ui,sans-serif;">
                        <p style="font-size:3rem;">📱</p>
                        <h2 style="color:#1a1a1a;margin-bottom:12px;">Acesse pelo celular</h2>
                        <p style="color:#555;font-size:1rem;max-width:380px;margin:0 auto;">
                            A galeria de fotos e vídeos está disponível apenas para dispositivos móveis.<br><br>
                            Abra o link pelo celular para acessar suas fotos. 😊
                        </p>
                    </div>';
        }

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

        // ============================================================
        // REGISTRA ACESSO À PÁGINA (contagem de views por serviço)
        // Também garante que a linha existe com token_aceite
        // ============================================================
        $ip        = sanitize_text_field($_SERVER['REMOTE_ADDR']     ?? '');
        $ua        = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $tbl_views = $wpdb->prefix . 'pm_galeria_views';

        foreach ($servicos as $s) {
            $existe = $wpdb->get_row($wpdb->prepare(
                "SELECT id, total_views FROM $tbl_views
                 WHERE token_aceite = %s AND nome_servico = %s LIMIT 1",
                $token, $s->nome_servico
            ));

            if ($existe) {
                $wpdb->update(
                    $tbl_views,
                    [
                        'total_views'  => $existe->total_views + 1,
                        'ultimo_acesso'=> current_time('mysql'),
                        'ip'           => $ip,
                        'user_agent'   => $ua,
                    ],
                    ['id' => $existe->id]
                );
            } else {
                $wpdb->insert($tbl_views, [
                    'id_evento'      => $evento->id,
                    'id_aceite'      => $aceite->id,
                    'token_aceite'   => $token,
                    'nome_servico'   => $s->nome_servico ?? '',
                    'tipo_servico'   => $s->slug_servico ?? '',
                    'total_views'    => 1,
                    'total_cliques'  => 0,
                    'ip'             => $ip,
                    'user_agent'     => $ua,
                    'primeiro_acesso'=> current_time('mysql'),
                    'ultimo_acesso'  => current_time('mysql'),
                ]);
            }
        }

        // Mapa de ícones
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
        $ajax_url   = esc_url(admin_url('admin-ajax.php'));
        $token_esc  = esc_js($token);

        ob_start();
        ?>
        <style>
            .pm-gal-wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; font-family: system-ui, sans-serif; }
            .pm-gal-header { text-align: center; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2px solid #e5e5e5; }
            .pm-gal-header h2 { font-size: 1.5rem; margin: 0 0 4px; color: #1a1a1a; }
            .pm-gal-header .pm-data { color: #777; font-size: .9rem; margin: 4px 0; }
            .pm-gal-header .pm-usuario { display: inline-block; margin-top: 8px; background: #eaf5ea; color: #2a7a2a; border-radius: 20px; padding: 4px 14px; font-size: .85rem; }
            .pm-gal-bloco { margin-bottom: 36px; }
            .pm-gal-titulo { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; color: #333; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0; }
            /* Placeholder — exibido antes de clicar para abrir */
            .pm-gal-placeholder {
                width: 100%;
                min-height: 260px;
                border-radius: 12px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 14px;
                cursor: pointer;
                border: none;
                padding: 32px 20px;
                box-sizing: border-box;
            }
            .pm-gal-placeholder .pm-icon  { font-size: 3.5rem; }
            .pm-gal-placeholder .pm-txt   { color: #fff; font-size: 1rem; font-weight: 600; text-align: center; }
            .pm-gal-placeholder .pm-subtxt{ color: rgba(255,255,255,.65); font-size: .82rem; text-align: center; }
            .pm-gal-placeholder .pm-open-btn {
                background: #fff;
                color: #0f3460;
                border: none;
                border-radius: 50px;
                padding: 10px 28px;
                font-size: .95rem;
                font-weight: 700;
                cursor: pointer;
                margin-top: 4px;
            }
            /* iframe — oculto até o clique */
            .pm-gal-frame { width: 100%; min-height: 75vh; border: none; border-radius: 10px; background: #f5f5f5; display: none; }
            .pm-gal-vazia { text-align: center; padding: 60px 20px; background: #fafafa; border-radius: 10px; border: 2px dashed #ddd; color: #777; }
        </style>

        <div class="pm-gal-wrap">
            <div class="pm-gal-header">
                <h2><?php echo $nome_ev; ?></h2>
                <?php if ($data_fmt): ?>
                    <p class="pm-data">📅 <?php echo esc_html($data_fmt); ?></p>
                <?php endif; ?>
                <?php if ($nome_aceit): ?>
                    <span class="pm-usuario">✅ <strong><?php echo $nome_aceit; ?></strong></span>
                <?php endif; ?>
            </div>

            <?php if (!empty($servicos)): ?>
                <?php foreach ($servicos as $idx => $sv): ?>
                    <?php
                        $slug_sv  = strtolower($sv->slug_servico ?? '');
                        $icone    = $icones[$slug_sv] ?? '📁';
                        $nome_sv  = esc_html($sv->nome_servico ?? 'Galeria');
                        $link_sv  = esc_url($sv->link_galeria);
                        $bloco_id = 'pm-bloco-' . $idx;
                    ?>
                    <div class="pm-gal-bloco" id="<?php echo $bloco_id; ?>">

                        <?php if (count($servicos) > 1): ?>
                            <div class="pm-gal-titulo">
                                <span><?php echo $icone; ?></span>
                                <span><?php echo $nome_sv; ?></span>
                            </div>
                        <?php endif; ?>

                        <!-- Placeholder: clique para abrir e registrar -->
                        <div class="pm-gal-placeholder"
                             onclick="pmAbrirServico('<?php echo $bloco_id; ?>', '<?php echo $link_sv; ?>', '<?php echo esc_js($sv->nome_servico); ?>')">
                            <span class="pm-icon"><?php echo $icone; ?></span>
                            <span class="pm-txt"><?php echo $nome_sv; ?></span>
                            <span class="pm-subtxt">Toque para abrir suas fotos/vídeos</span>
                            <button class="pm-open-btn">Abrir galeria ▶</button>
                        </div>

                        <!-- iframe oculto — exibido após o clique -->
                        <iframe
                            class="pm-gal-frame"
                            data-src="<?php echo $link_sv; ?>"
                            allowfullscreen
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

        <script>
        function pmAbrirServico(blocoId, url, nomeServico) {
            var bloco       = document.getElementById(blocoId);
            var placeholder = bloco.querySelector('.pm-gal-placeholder');
            var iframe      = bloco.querySelector('.pm-gal-frame');

            // Mostra iframe e oculta placeholder
            placeholder.style.display = 'none';
            iframe.src = url;
            iframe.style.display = 'block';

            // Registra o clique via AJAX
            var fd = new FormData();
            fd.append('action',       'pm_registrar_clique');
            fd.append('token',        '<?php echo $token_esc; ?>');
            fd.append('nome_servico', nomeServico);

            fetch('<?php echo $ajax_url; ?>', { method: 'POST', body: fd })
                .catch(function() {}); // silencioso — não bloqueia a UX
        }
        </script>
        <?php
        return ob_get_clean();
    }
}
