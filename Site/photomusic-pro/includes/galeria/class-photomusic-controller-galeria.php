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
           VALIDAR DEVICE
        ============================================================ */
        $device_hash = PhotoMusic_Helpers::device_hash();

        if (!empty($aceite->device_hash) && $device_hash !== $aceite->device_hash) {
            wp_die('Este link não pertence a este dispositivo.');
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
        $evento_nome    = $evento->motivo_evento ?? ($evento->nome_evento ?? '');
        $evento_data    = $evento->data_evento;
        $slug           = $evento->codigo_interno;
        $id_evento      = $evento->id;
        $id_aceite      = $aceite->id;
        $aceite_nome    = $aceite->nome ?? '';
        $link_fotoshare = $evento->link_galeria_convidado ?? ''; // fallback único

        // Carrega serviços com links individuais (um evento pode ter vários)
        $servicos_links = $this->wpdb->get_results($this->wpdb->prepare(
            "SELECT nome_servico, tipo, link_convidado
             FROM {$this->wpdb->prefix}pm_event_services
             WHERE id_evento = %d
               AND status_servico = 'ativo'
               AND (link_convidado IS NOT NULL AND link_convidado != '')
             ORDER BY id ASC",
            $evento->id
        ));

        // Se não há serviços individuais mas há link único, usa o fallback
        if (empty($servicos_links) && !empty($link_fotoshare)) {
            $fallback        = new stdClass();
            $fallback->nome_servico  = 'Galeria';
            $fallback->tipo          = 'foto';
            $fallback->link_convidado = $link_fotoshare;
            $servicos_links  = [$fallback];
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
