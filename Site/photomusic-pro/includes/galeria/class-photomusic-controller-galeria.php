<?php
// includes/galeria/class-photomusic-controller-galeria.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Galeria_Controller {

    private $wpdb;
    private $tbl_eventos;
    private $tbl_aceites_evento;
    private $tbl_devices;

    public function __construct() {
        global $wpdb;
        $this->wpdb = $wpdb;

        $this->tbl_eventos        = $wpdb->prefix . 'pm_eventos';
        $this->tbl_aceites_evento = $wpdb->prefix . 'pm_aceites_evento';
        $this->tbl_devices        = $wpdb->prefix . 'pm_devices';
    }

    /* ============================================================
       PONTO DE ENTRADA DA GALERIA
    ============================================================ */
    public function handle_request() {

        $slug  = sanitize_text_field(get_query_var('pm_evento_slug'));
        $token = sanitize_text_field($_GET['token'] ?? '');

        if (!$slug || !$token) {
            wp_die('Acesso inválido.');
        }

        /* ============================================================
           VALIDAR TOKEN
        ============================================================ */
        if (!PhotoMusic_Helpers::is_valid_sha256($token)) {
            wp_die('Token inválido.');
        }

        /* ============================================================
           BUSCAR EVENTO PELO SLUG
        ============================================================ */
        $evento = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT * FROM {$this->tbl_eventos} WHERE codigo_interno = %s",
            $slug
        ));

        if (!$evento) {
            wp_die('Evento não encontrado.');
        }

        /* ============================================================
           VALIDAR ACEITE PELO TOKEN (lookup direto)
        ============================================================ */
        $aceite = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT * FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND token_acesso = %s
             LIMIT 1",
            $evento->id,
            $token
        ));

        if (!$aceite) {
            wp_die('Acesso inválido ou expirado. Solicite o link de aceite novamente.');
        }

        /* ============================================================
           CONTROLE DE ACESSO (PhotoMusic Pro)
           - Convidado: apenas mobile, máx. 10 acessos/dia
           - Contratante: mobile + desktop, sem limite
        ============================================================ */
        $eh_contratante = (($aceite->tipo_aceite ?? 'convidado') === 'contratante');

        if (!$eh_contratante) {

            // Bloquear desktop
            $ua        = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
            $is_mobile = (
                strpos($ua, 'mobile')  !== false ||
                strpos($ua, 'android') !== false ||
                strpos($ua, 'iphone')  !== false ||
                strpos($ua, 'ipad')    !== false
            );

            if (!$is_mobile) {
                wp_die('<div style="text-align:center;padding:60px 20px;font-family:system-ui,sans-serif;">
                    <p style="font-size:3rem;">📱</p>
                    <h2 style="color:#1a1a1a;margin:0 0 12px;">Acesse pelo celular</h2>
                    <p style="color:#555;max-width:380px;margin:0 auto;line-height:1.6;">
                        A galeria para convidados está disponível apenas em dispositivos móveis.<br>
                        Abra o link pelo seu celular para acessar suas fotos.
                    </p>
                </div>');
            }

            // Limite de 10 acessos por dia
            $hoje       = current_time('Y-m-d');
            $total_hoje = (int) $this->wpdb->get_var($this->wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->wpdb->prefix}pm_logs
                 WHERE id_aceite = %d AND tipo = 'acesso_galeria'
                   AND DATE(data) = %s",
                $aceite->id,
                $hoje
            ));

            if ($total_hoje >= 10) {
                wp_die('<div style="text-align:center;padding:60px 20px;font-family:system-ui,sans-serif;">
                    <p style="font-size:3rem;">⏳</p>
                    <h2 style="color:#1a1a1a;margin:0 0 12px;">Limite diário atingido</h2>
                    <p style="color:#555;max-width:380px;margin:0 auto;line-height:1.6;">
                        Você atingiu o limite de 10 acessos por dia.<br>
                        Tente novamente amanhã.
                    </p>
                </div>');
            }
        }

        /* ============================================================
           REGISTRAR LOG DE ACESSO
        ============================================================ */
        $this->registrar_acesso($evento->id, $aceite->id);

        /* ============================================================
           CARREGAR TEMPLATE DA GALERIA
        ============================================================ */
        $this->render_template($evento, $aceite);
    }

    /* ============================================================
       REGISTRA ACESSO
    ============================================================ */
    private function registrar_acesso($id_evento, $id_aceite) {

        $ip         = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $user_agent = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        $this->wpdb->insert($this->wpdb->prefix . 'pm_logs', [
            'id_evento'  => $id_evento,
            'id_aceite'  => $id_aceite,
            'tipo'       => 'acesso_galeria',
            'ip'         => $ip,
            'user_agent' => $user_agent,
            'data'       => current_time('mysql')
        ]);
    }

    /* ============================================================
       RENDERIZA O TEMPLATE DA GALERIA
    ============================================================ */
    private function render_template($evento, $aceite) {

        $template = PHOTOMUSIC_PRO_PATH . 'includes/galeria/templates/galeria.php';

        if (!file_exists($template)) {
            wp_die('Template da galeria não encontrado.');
        }

        // Variáveis disponíveis no template:
        $eh_contratante = (($aceite->tipo_aceite ?? 'convidado') === 'contratante');
        $evento_nome    = $evento->motivo_evento ?? ($evento->nome_evento ?? '');
        $evento_data    = $evento->data_evento;
        $slug           = $evento->codigo_interno;
        $id_evento      = $evento->id;
        $id_aceite      = $aceite->id;
        $aceite_nome    = $aceite->nome ?? '';
        $link_fotoshare = $evento->link_galeria_convidado ?? ''; // fallback único

        // 1ª tentativa: pm_eventos_servicos (campo link_galeria — serviços do plugin)
        $servicos_links = $this->wpdb->get_results($this->wpdb->prepare(
            "SELECT s.nome AS nome_servico, s.slug AS tipo, es.link_galeria AS link_convidado
             FROM {$this->wpdb->prefix}pm_eventos_servicos es
             LEFT JOIN {$this->wpdb->prefix}pm_servicos s ON s.id = es.id_servico
             WHERE es.id_evento = %d
               AND es.link_galeria IS NOT NULL
               AND es.link_galeria != ''
             ORDER BY es.id ASC",
            $evento->id
        ));

        // 2ª tentativa: pm_event_services (tabela usada pela tela "Links por Serviço")
        if (empty($servicos_links)) {
            $servicos_links = $this->wpdb->get_results($this->wpdb->prepare(
                "SELECT nome_servico, tipo, link_convidado
                 FROM {$this->wpdb->prefix}pm_event_services
                 WHERE id_evento = %d
                   AND status_servico = 'ativo'
                   AND link_convidado IS NOT NULL
                   AND link_convidado != ''
                 ORDER BY id ASC",
                $evento->id
            ));
        }

        // 3ª tentativa: link único no campo do evento (fallback legado)
        if (empty($servicos_links) && !empty($link_fotoshare)) {
            $fallback              = new stdClass();
            $fallback->nome_servico = 'Galeria';
            $fallback->tipo         = 'foto';
            $fallback->link_convidado = $link_fotoshare;
            $servicos_links        = [$fallback];
        }

        // ============================================================
        // 🔥 REGISTRA VISUALIZAÇÃO DOS SERVIÇOS
        // ============================================================
        if (!empty($servicos_links)) {
            foreach ($servicos_links as $servico) {
                $this->registrar_view_servico($evento, $aceite, $servico);
            }
        }

        include $template;
    }

    /* ============================================================
        REGISTRA VISUALIZAÇÃO DE SERVIÇO NA GALERIA
        ------------------------------------------------------------
        Fluxo:
        1. Usuário acessa galeria via token
        2. Sistema identifica serviços disponíveis
        3. Cada serviço acessado gera registro

        Dados capturados:
        - Evento
        - Aceite (usuário)
        - Tipo e nome do serviço
        - IP e User Agent

        Futuro:
        - Ranking de serviços
        - Analytics por evento
        - Relatórios comerciais
    ============================================================ */
    private function registrar_view_servico($evento, $aceite, $servico) {

        $ip           = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $user_agent   = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $token_aceite = $aceite->token_acesso ?? '';
        $tipo_servico = $servico->tipo ?? '';
        $nome_servico = $servico->nome_servico ?? '';
        $agora        = current_time('mysql');

        $tbl = $this->wpdb->prefix . 'pm_galeria_views';

        $this->wpdb->query($this->wpdb->prepare(
            "INSERT INTO $tbl
                (id_evento, id_aceite, token_aceite, tipo_servico, nome_servico,
                 total_views, total_cliques, ip, user_agent, primeiro_acesso, ultimo_acesso)
             VALUES (%d, %d, %s, %s, %s, 1, 0, %s, %s, %s, %s)
             ON DUPLICATE KEY UPDATE
                total_views   = total_views + 1,
                token_aceite  = VALUES(token_aceite),
                ip            = VALUES(ip),
                user_agent    = VALUES(user_agent),
                ultimo_acesso = VALUES(ultimo_acesso)",
            $evento->id,
            $aceite->id,
            $token_aceite,
            $tipo_servico,
            $nome_servico,
            $ip,
            $user_agent,
            $agora,
            $agora
        ));
    }
}
