<?php
// includes/galeria/class-photomusic-aceite-endpoint.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Aceite_Endpoint {

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

        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /* ============================================================
       REGISTRA A ROTA REST
    ============================================================ */
    public function register_routes() {

        register_rest_route('photomusic/v1', '/aceite', [
            'methods'  => 'POST',
            'callback' => [$this, 'handle_aceite'],
            'permission_callback' => '__return_true'
        ]);
    }

    /* ============================================================
       PROCESSA O ACEITE VIA API
    ============================================================ */
    public function handle_aceite($request) {

        $params = $request->get_json_params();

        $nome     = sanitize_text_field($params['nome'] ?? '');
        $email    = sanitize_email($params['email'] ?? '');
        $telefone = preg_replace('/\D/', '', $params['telefone'] ?? '');
        $idioma   = sanitize_text_field($params['idioma'] ?? 'pt');
        $idEvento = intval($params['idEvento'] ?? 0);

        if (!$nome || !$telefone || !$idEvento) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Dados incompletos.'
            ];
        }

        /* ============================================================
           VALIDAR EVENTO
        ============================================================ */
        $evento = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT * FROM {$this->tbl_eventos} WHERE id = %d",
            $idEvento
        ));

        if (!$evento) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Evento não encontrado.'
            ];
        }

        if ($evento->status_evento === 'desativado') {
            return [
                'sucesso'  => false,
                'mensagem' => 'Este evento está desativado.'
            ];
        }

        /* ============================================================
           REGISTRAR DEVICE
        ============================================================ */
        $device_hash = PhotoMusic_Helpers::device_hash();
        $ip          = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $user_agent  = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        $existe = $this->wpdb->get_var($this->wpdb->prepare(
            "SELECT id FROM {$this->tbl_devices} WHERE device_hash = %s",
            $device_hash
        ));

        if (!$existe) {
            $this->wpdb->insert($this->tbl_devices, [
                'device_hash'   => $device_hash,
                'telefone'      => $telefone,
                'ip'            => $ip,
                'user_agent'    => $user_agent,
                'data_registro' => current_time('mysql')
            ]);
        }

        /* ============================================================
           SALVAR ACEITE (1 por dispositivo)
        ============================================================ */
        $aceite_existente = $this->wpdb->get_var($this->wpdb->prepare(
            "SELECT id FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND device_hash = %s LIMIT 1",
            $idEvento,
            $device_hash
        ));

        if ($aceite_existente) {
            return [
                'sucesso'  => true,
                'mensagem' => 'Aceite já registrado.',
                'redirect' => home_url("/galeria/{$evento->codigo_interno}/?token=" . $this->generate_token($idEvento, $aceite_existente))
            ];
        }

        $this->wpdb->insert($this->tbl_aceites_evento, [
            'id_evento'     => $idEvento,
            'nome'          => $nome,
            'telefone'      => $telefone,
            'email'         => $email ?: null,
            'device_hash'   => $device_hash,
            'ip'            => $ip,
            'user_agent'    => $user_agent,
            'versao_termo'  => '1.0',
            'origem'        => 'api',
            'idioma'        => $idioma,
            'aceite_em'     => current_time('mysql')
        ]);

        $id_aceite = $this->wpdb->insert_id;

        /* ============================================================
           GERAR TOKEN
        ============================================================ */
        $token = $this->generate_token($idEvento, $id_aceite);

        /* ============================================================
           URL DE REDIRECIONAMENTO
        ============================================================ */
        $slug = $evento->codigo_interno;

        $redirect = home_url("/galeria/{$slug}/?token={$token}");

        return [
            'sucesso'  => true,
            'redirect' => $redirect
        ];
    }

    /* ============================================================
       GERA TOKEN SEGURO
    ============================================================ */
    private function generate_token($id_evento, $id_aceite) {
        $raw = $id_evento . '|' . $id_aceite . '|' . time() . '|' . wp_generate_uuid4();
        return hash('sha256', $raw);
    }
}
