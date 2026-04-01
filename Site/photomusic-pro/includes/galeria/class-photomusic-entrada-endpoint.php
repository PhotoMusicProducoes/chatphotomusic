<?php
// includes/galeria/class-photomusic-entrada-endpoint.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Entrada_Endpoint {

    private $wpdb;
    private $tbl_eventos;
    private $tbl_aceites_evento;

    public function __construct() {
        global $wpdb;
        $this->wpdb = $wpdb;

        $this->tbl_eventos        = $wpdb->prefix . 'pm_eventos';
        $this->tbl_aceites_evento = $wpdb->prefix . 'pm_aceites_evento';

        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /* ============================================================
       REGISTRA A ROTA REST
    ============================================================ */
    public function register_routes() {

        register_rest_route('photomusic/v1', '/entrada', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_entrada'],
            'permission_callback' => '__return_true',
        ]);
    }

    /* ============================================================
       VERIFICA SE CONVIDADO JÁ TEM ACEITE NO EVENTO
       ------------------------------------------------------------
       GET /wp-json/photomusic/v1/entrada?t=TOKEN_EVENTO&tel=TELEFONE

       Retorna:
         { acao: "galeria",  redirect: "URL_GALERIA" }   → já aceitou
         { acao: "aceite",   id_evento: X, nome: "Y" }   → precisa aceitar
         { acao: "erro",     mensagem: "..." }            → token/evento inválido
    ============================================================ */
    public function handle_entrada($request) {

        $token_evento = sanitize_text_field($request->get_param('t')   ?? '');
        $telefone     = preg_replace('/\D/', '', $request->get_param('tel') ?? '');

        if (!$token_evento || !$telefone) {
            return ['acao' => 'erro', 'mensagem' => 'Parâmetros inválidos.'];
        }

        /* ============================================================
           BUSCA O EVENTO PELO TOKEN
        ============================================================ */
        $evento = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT id, motivo_evento, codigo_interno, status_evento
             FROM {$this->tbl_eventos}
             WHERE token_evento = %s
             LIMIT 1",
            $token_evento
        ));

        if (!$evento) {
            return ['acao' => 'erro', 'mensagem' => 'Link inválido ou expirado.'];
        }

        if ($evento->status_evento === 'desativado') {
            return ['acao' => 'erro', 'mensagem' => 'Este evento está desativado.'];
        }

        /* ============================================================
           VERIFICA SE JÁ FEZ ACEITE (por telefone + evento)
        ============================================================ */
        $aceite = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT id, token_acesso
             FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND telefone = %s
             LIMIT 1",
            $evento->id,
            $telefone
        ));

        if ($aceite) {

            $token = $aceite->token_acesso;

            // Se por algum motivo não tem token, gera e salva
            if (empty($token)) {
                $token = hash('sha256', $evento->id . '|' . $aceite->id . '|' . time() . '|' . wp_generate_uuid4());
                $this->wpdb->update(
                    $this->tbl_aceites_evento,
                    ['token_acesso' => $token],
                    ['id' => $aceite->id]
                );
            }

            return [
                'acao'     => 'galeria',
                'redirect' => home_url("/galeria/{$evento->codigo_interno}/?token={$token}"),
            ];
        }

        /* ============================================================
           NÃO TEM ACEITE — retorna dados para mostrar o formulário
        ============================================================ */
        return [
            'acao'      => 'aceite',
            'id_evento' => $evento->id,
            'nome'      => esc_html($evento->motivo_evento),
        ];
    }
}
