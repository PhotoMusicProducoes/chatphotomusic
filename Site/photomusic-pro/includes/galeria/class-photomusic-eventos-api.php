<?php
// includes/galeria/class-photomusic-eventos-api.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Eventos_API {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    /* ============================================================
       REGISTRA AS ROTAS REST
    ============================================================ */
    public static function register_routes() {

        // Eventos de hoje (ChatBot — legado)
        register_rest_route('photomusic/v1', '/eventos-hoje', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'get_eventos_hoje'],
            'permission_callback' => [__CLASS__, 'check_api_key'],
        ]);

        // Eventos de uma data específica ?data=YYYY-MM-DD
        register_rest_route('photomusic/v1', '/eventos', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'get_eventos'],
            'permission_callback' => [__CLASS__, 'check_api_key'],
        ]);

        // ✅ NOVO — Eventos ativados para o ChatBot (sem filtro de data)
        register_rest_route('photomusic/v1', '/eventos-chatbot', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'get_eventos_chatbot'],
            'permission_callback' => [__CLASS__, 'check_api_key'],
        ]);
    }

    /* ============================================================
       VALIDA A CHAVE DE API (header X-PM-API-Key)
    ============================================================ */
    public static function check_api_key(WP_REST_Request $request) {
        $key    = $request->get_header('X-PM-API-Key');
        $stored = get_option('pm_chatbot_api_key', '');

        if (!$key || !$stored) {
            return new WP_Error(
                'sem_chave',
                'Chave de API ausente ou não configurada.',
                ['status' => 401]
            );
        }

        if (!hash_equals($stored, $key)) {
            return new WP_Error(
                'chave_invalida',
                'Chave de API inválida.',
                ['status' => 401]
            );
        }

        return true;
    }

    /* ============================================================
       GET /wp-json/photomusic/v1/eventos-hoje
    ============================================================ */
    public static function get_eventos_hoje(WP_REST_Request $request) {
        $request->set_param('data', current_time('Y-m-d'));
        return self::get_eventos($request);
    }

    /* ============================================================
       GET /wp-json/photomusic/v1/eventos?data=YYYY-MM-DD
    ============================================================ */
    public static function get_eventos(WP_REST_Request $request) {
        global $wpdb;

        $data = sanitize_text_field($request->get_param('data') ?? current_time('Y-m-d'));

        // Valida formato de data
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            return new WP_Error('data_invalida', 'Formato de data inválido. Use YYYY-MM-DD.', ['status' => 400]);
        }

        $eventos = $wpdb->get_results($wpdb->prepare(
            "SELECT id, motivo_evento, codigo_interno, data_evento,
                    horario_inicio, horario_fim, link_galeria_convidado, link_galeria_contratante
             FROM {$wpdb->prefix}pm_eventos
             WHERE data_evento = %s AND status_evento = 'ativo'
             ORDER BY horario_inicio ASC, id ASC",
            $data
        ));

        if (empty($eventos)) {
            return rest_ensure_response([]);
        }

        $resultado = [];

        foreach ($eventos as $i => $evento) {

            /* ----------------------------------------
               Links de serviço (pm_event_services)
               Um evento pode ter vários serviços,
               cada um com seu próprio link fotoshare.
            ---------------------------------------- */
            $servicos = $wpdb->get_results($wpdb->prepare(
                "SELECT id, nome_servico, tipo, link_convidado, link_contratante
                 FROM {$wpdb->prefix}pm_event_services
                 WHERE id_evento = %d
                   AND status_servico = 'ativo'
                   AND (link_convidado IS NOT NULL AND link_convidado != '')
                 ORDER BY id ASC",
                $evento->id
            ));

            $links_servicos = [];

            foreach ($servicos as $s) {
                $links_servicos[] = [
                    'id'   => (int) $s->id,
                    'nome' => $s->nome_servico,
                    'tipo' => $s->tipo,
                    'link' => $s->link_convidado,
                ];
            }

            /* ----------------------------------------
               Fallback: link único no campo do evento
               (para compatibilidade com cadastros antigos)
            ---------------------------------------- */
            if (empty($links_servicos) && !empty($evento->link_galeria_convidado)) {
                $links_servicos[] = [
                    'id'   => 0,
                    'nome' => 'Galeria',
                    'tipo' => 'foto_cabine',
                    'link' => $evento->link_galeria_convidado,
                ];
            }

            /* ----------------------------------------
               Monta o retorno do evento
            ---------------------------------------- */
            $link_aceite = '';
            if (!empty($evento->codigo_interno)) {
                $link_aceite = home_url('/galeria/' . $evento->codigo_interno . '/aceite/');
            }

            $resultado[] = [
                'id'             => (int) $evento->id,
                'numero'         => (string) ($i + 1),
                'nome'           => $evento->motivo_evento,
                'codigo_interno' => $evento->codigo_interno,
                'data'           => $evento->data_evento,
                'horario_inicio' => substr($evento->horario_inicio ?? '', 0, 5),
                'link_aceite'    => $link_aceite,
                'servicos'       => $links_servicos,
            ];
        }

        return rest_ensure_response($resultado);
    }

    /* ============================================================
       GET /wp-json/photomusic/v1/eventos-chatbot
       -------------------------------------------------------
       Retorna todos os eventos com chatbot_ativo = 1,
       independente da data — usado pelo ChatBot para montar
       o menu "Baixar minha foto".

       Regras:
       - status_evento = 'ativo'      (evento não foi desativado)
       - chatbot_ativo = 1            (flag de visibilidade no bot)
       - Ordena por data_evento DESC  (mais recentes primeiro)

       Links retornados:
       - links de pm_event_services (status_servico = 'ativo')
       - fallback: link_galeria_convidado do evento
    ============================================================ */
    public static function get_eventos_chatbot(WP_REST_Request $request) {
        global $wpdb;

        // O flag chatbot_ativo é o único controle de visibilidade no ChatBot.
        // status_evento = 'desativado' ainda pode aparecer se o operador ativou
        // o toggle explicitamente — confiamos no chatbot_ativo para isso.
        $eventos = $wpdb->get_results(
            "SELECT id, motivo_evento, codigo_interno, data_evento, horario_inicio
             FROM {$wpdb->prefix}pm_eventos
             WHERE chatbot_ativo = 1
               AND status_evento != 'desativado'
             ORDER BY data_evento DESC, id DESC"
        );

        if (empty($eventos)) {
            return rest_ensure_response([]);
        }

        $resultado = [];

        foreach ($eventos as $i => $evento) {

            /* --------------------------------------------------
               Um evento pode ter N serviços, cada um com seu link.
               Ex: Foto Cabine, Plataforma 360°, Foto Paparazzi,
                   2x Foto Cabine + 1x Plataforma + 1x Paparazzi...
               Lê de pm_eventos_servicos (link_galeria por serviço).
            -------------------------------------------------- */
            $servicos = $wpdb->get_results($wpdb->prepare(
                "SELECT es.id, s.nome AS nome_servico, s.slug AS slug_servico,
                        es.link_galeria, es.observacoes
                 FROM {$wpdb->prefix}pm_eventos_servicos es
                 LEFT JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
                 WHERE es.id_evento = %d
                   AND es.link_galeria IS NOT NULL
                   AND es.link_galeria != ''
                 ORDER BY es.id ASC",
                $evento->id
            ));

            $links = [];

            foreach ($servicos as $s) {
                $links[] = [
                    'nome' => $s->nome_servico ?? 'Galeria',
                    'link' => $s->link_galeria,
                ];
            }

            // Monta data formatada para o título
            $data_fmt = $evento->data_evento
                ? date('d/m/Y', strtotime($evento->data_evento))
                : '';

            // Link da página de aceite (enviado pelo ChatBot)
            $link_aceite = !empty($evento->codigo_interno)
                ? home_url('/galeria/' . $evento->codigo_interno . '/aceite/')
                : '';

            $resultado[] = [
                'id'             => (int) $evento->id,
                'numero'         => (string) ($i + 1),
                'nome'           => $evento->motivo_evento,
                'titulo'         => $evento->motivo_evento . ($data_fmt ? " — {$data_fmt}" : ''),
                'codigo_interno' => $evento->codigo_interno,
                'data'           => $evento->data_evento,
                'link_aceite'    => $link_aceite,
                'links'          => $links,
            ];
        }

        return rest_ensure_response($resultado);
    }
}
