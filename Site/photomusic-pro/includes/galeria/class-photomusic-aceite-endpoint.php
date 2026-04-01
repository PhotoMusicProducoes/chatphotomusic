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

        $nome        = sanitize_text_field($params['nome'] ?? '');
        $email       = sanitize_email($params['email'] ?? '');
        $telefone    = preg_replace('/\D/', '', $params['telefone'] ?? '');
        $idioma      = sanitize_text_field($params['idioma'] ?? 'pt');
        $idEvento    = intval($params['idEvento'] ?? 0);
        $eventoSlug  = sanitize_text_field($params['eventoSlug'] ?? '');

        if (!$nome || !$telefone || (!$idEvento && !$eventoSlug)) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Dados incompletos.'
            ];
        }

        /* ============================================================
           VALIDAR EVENTO
        ============================================================ */
        if ($idEvento) {
            $evento = $this->wpdb->get_row($this->wpdb->prepare(
                "SELECT * FROM {$this->tbl_eventos} WHERE id = %d",
                $idEvento
            ));
        } else {
            $evento = $this->wpdb->get_row($this->wpdb->prepare(
                "SELECT * FROM {$this->tbl_eventos} WHERE codigo_interno = %s",
                $eventoSlug
            ));
        }

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
           SALVAR ACEITE (1 por telefone por evento)
        ============================================================ */
        $aceite_existente = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT id, token_acesso FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND telefone = %s LIMIT 1",
            $evento->id,
            $telefone
        ));

        if ($aceite_existente) {

            $token_salvo = $aceite_existente->token_acesso;

            if (empty($token_salvo)) {
                $token_salvo = $this->generate_token($evento->id, $aceite_existente->id);
                $this->wpdb->update(
                    $this->tbl_aceites_evento,
                    ['token_acesso' => $token_salvo],
                    ['id' => $aceite_existente->id]
                );
            }

            return [
                'sucesso'  => true,
                'mensagem' => 'Aceite já registrado.',
                'redirect' => home_url("/galeria/{$evento->codigo_interno}/?token={$token_salvo}"),
            ];
        }

        $this->wpdb->insert($this->tbl_aceites_evento, [
            'id_evento'    => $evento->id,
            'nome'         => $nome,
            'telefone'     => $telefone,
            'email'        => $email ?: null,
            'device_hash'  => $device_hash,
            'ip'           => $ip,
            'user_agent'   => $user_agent,
            'versao_termo' => '1.0',
            'origem'       => 'api',
            'idioma'       => $idioma,
            'aceite_em'    => current_time('mysql'),
        ]);

        $id_aceite = $this->wpdb->insert_id;

        /* ============================================================
           GERAR E SALVAR TOKEN
        ============================================================ */
        $token = $this->generate_token($evento->id, $id_aceite);

        $this->wpdb->update(
            $this->tbl_aceites_evento,
            ['token_acesso' => $token],
            ['id' => $id_aceite]
        );

        /* ============================================================
           URL DE REDIRECIONAMENTO
        ============================================================ */
        $redirect = home_url("/galeria/{$evento->codigo_interno}/?token={$token}");

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
