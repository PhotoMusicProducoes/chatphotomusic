<?php
// includes/tarefas/class-photomusic-tarefas-api.php
// REST API para o ChatBot consultar e confirmar tarefas

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tarefas_API {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'registrar_rotas']);
    }

    public static function registrar_rotas() {
        // GET  /wp-json/photomusic/v1/tarefas          → listar tarefas abertas
        // POST /wp-json/photomusic/v1/tarefas/{id}/concluir → confirmar conclusão
        register_rest_route('photomusic/v1', '/tarefas', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'listar'],
            'permission_callback' => [__CLASS__, 'verificar_chave'],
        ]);

        register_rest_route('photomusic/v1', '/tarefas/(?P<id>\d+)/concluir', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'concluir'],
            'permission_callback' => [__CLASS__, 'verificar_chave'],
        ]);
    }

    /* ============================================================
       AUTENTICAÇÃO POR API KEY (header X-PM-API-Key)
    ============================================================ */
    public static function verificar_chave(WP_REST_Request $request) {
        $chave_salva = get_option('pm_chatbot_api_key', '');
        $chave_req   = $request->get_header('X-PM-API-Key');
        return !empty($chave_salva) && hash_equals($chave_salva, (string) $chave_req);
    }

    /* ============================================================
       LISTAR TAREFAS ABERTAS
       GET /tarefas?status=pendente&responsavel=photomusic
    ============================================================ */
    public static function listar(WP_REST_Request $request) {
        if (!class_exists('PhotoMusic_Tarefas')) {
            return new WP_REST_Response(['error' => 'Módulo não disponível'], 503);
        }

        $filtros = [
            'status'      => $request->get_param('status')      ?? 'pendente',
            'responsavel' => $request->get_param('responsavel') ?? '',
            'id_evento'   => $request->get_param('id_evento')   ?? 0,
        ];

        $tarefas = PhotoMusic_Tarefas::get_all($filtros);

        $resultado = array_map(function($p) {
            return [
                'id'           => (int) $p->id,
                'id_evento'    => (int) $p->id_evento,
                'id_contrato'  => (int) $p->id_contrato,
                'responsavel'  => $p->responsavel,
                'tipo'         => $p->tipo,
                'descricao'    => $p->descricao,
                'data_prevista'=> $p->data_prevista,
                'status'       => $p->status,
                'notificacoes' => (int) $p->notificacoes_enviadas,
                'cliente'      => $p->nome_contratante ?? '',
                'data_evento'  => $p->data_evento ?? '',
            ];
        }, $tarefas);

        return new WP_REST_Response([
            'total'   => count($resultado),
            'tarefas' => $resultado,
        ], 200);
    }

    /* ============================================================
       CONCLUIR TAREFA
       POST /tarefas/{id}/concluir
       Body: { "confirmado_por": "Operador via WhatsApp" }
    ============================================================ */
    public static function concluir(WP_REST_Request $request) {
        if (!class_exists('PhotoMusic_Tarefas')) {
            return new WP_REST_Response(['error' => 'Módulo não disponível'], 503);
        }

        $id            = (int) $request->get_param('id');
        $confirmado_por= sanitize_text_field($request->get_param('confirmado_por') ?? 'ChatBot WhatsApp');

        $tarefa = PhotoMusic_Tarefas::get($id);
        if (!$tarefa) {
            return new WP_REST_Response(['error' => 'Tarefa não encontrada.'], 404);
        }
        if ($tarefa->status !== 'pendente') {
            return new WP_REST_Response(['error' => 'Tarefa já foi ' . $tarefa->status . '.'], 409);
        }

        PhotoMusic_Tarefas::concluir($id, $confirmado_por);

        return new WP_REST_Response([
            'success'  => true,
            'mensagem' => "Tarefa #{$id} marcada como concluída.",
        ], 200);
    }
}
