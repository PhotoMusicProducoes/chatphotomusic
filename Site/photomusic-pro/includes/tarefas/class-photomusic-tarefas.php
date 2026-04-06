<?php
// includes/tarefas/class-photomusic-tarefas.php
// Modelo e CRUD da tabela pm_tarefas

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tarefas {

    // Tipos disponíveis com labels
    public static function tipos() {
        return [
            // PhotoMusic
            'nota_fiscal'       => 'Emitir e enviar Nota Fiscal',
            'moldura_modelo'    => 'Enviar modelo das molduras ao cliente',
            'moldura_arte'      => 'Criar moldura com arte do cliente',
            'guestbook_capa'    => 'Enviar capa do Guestbook para gráfica',
            'guestbook_montar'  => 'Montar Guestbook',
            'playlist_cobrar'   => 'Cobrar playlist do cliente',
            'playlist_organizar'=> 'Organizar playlist para o evento',
            // Cliente
            'convite_arte'      => 'Enviar arte do convite',
            'moldura_aprovar'   => 'Aprovar molduras enviadas',
            'playlist_enviar'   => 'Enviar playlist das músicas',
            // Genérico
            'outro'             => 'Outro',
        ];
    }

    public static function label_tipo($tipo) {
        return self::tipos()[$tipo] ?? $tipo;
    }

    /* ============================================================
       CRIAR TAREFA
    ============================================================ */
    public static function criar($dados) {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'pm_tarefas',
            [
                'id_evento'     => intval($dados['id_evento']),
                'id_contrato'   => !empty($dados['id_contrato']) ? intval($dados['id_contrato']) : null,
                'responsavel'   => in_array($dados['responsavel'], ['photomusic','cliente']) ? $dados['responsavel'] : 'photomusic',
                'tipo'          => sanitize_key($dados['tipo']),
                'descricao'     => sanitize_textarea_field($dados['descricao']),
                'data_prevista' => !empty($dados['data_prevista']) ? $dados['data_prevista'] : null,
                'status'        => 'pendente',
                'criado_em'     => current_time('mysql'),
            ],
            ['%d','%d','%s','%s','%s','%s','%s','%s']
        );
        return $wpdb->insert_id;
    }

    /* ============================================================
       BUSCAR POR ID
    ============================================================ */
    public static function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_tarefas WHERE id = %d",
            intval($id)
        ));
    }

    /* ============================================================
       BUSCAR POR EVENTO
    ============================================================ */
    public static function get_by_evento($id_evento) {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_tarefas WHERE id_evento = %d ORDER BY responsavel, data_prevista ASC",
            intval($id_evento)
        ));
    }

    /* ============================================================
       BUSCAR TODAS COM FILTROS
    ============================================================ */
    public static function get_all($filtros = []) {
        global $wpdb;
        $where = ['1=1'];
        $params = [];

        if (!empty($filtros['status'])) {
            $where[] = 'p.status = %s';
            $params[] = $filtros['status'];
        }
        if (!empty($filtros['responsavel'])) {
            $where[] = 'p.responsavel = %s';
            $params[] = $filtros['responsavel'];
        }
        if (!empty($filtros['id_evento'])) {
            $where[] = 'p.id_evento = %d';
            $params[] = intval($filtros['id_evento']);
        }

        $where_sql = implode(' AND ', $where);
        $sql = "SELECT p.*, e.nome_contratante, e.data_evento
                FROM {$wpdb->prefix}pm_tarefas p
                LEFT JOIN {$wpdb->prefix}pm_eventos e ON e.id = p.id_evento
                WHERE {$where_sql}
                ORDER BY p.data_prevista ASC, p.responsavel ASC";

        if (!empty($params)) {
            $sql = $wpdb->prepare($sql, $params);
        }

        return $wpdb->get_results($sql);
    }

    /* ============================================================
       BUSCAR TAREFAS ABERTAS COM DATA <= HOJE (para notificar)
    ============================================================ */
    public static function get_para_notificar() {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT p.*, e.nome_contratante, e.data_evento
             FROM {$wpdb->prefix}pm_tarefas p
             LEFT JOIN {$wpdb->prefix}pm_eventos e ON e.id = p.id_evento
             WHERE p.status = 'pendente'
               AND (p.data_prevista IS NULL OR p.data_prevista <= %s)
             ORDER BY p.data_prevista ASC",
            current_time('Y-m-d')
        ));
    }

    /* ============================================================
       CONTAR TAREFAS ABERTAS (para badge)
    ============================================================ */
    public static function count_abertas() {
        global $wpdb;
        return (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->prefix}pm_tarefas WHERE status = 'pendente'"
        );
    }

    /* ============================================================
       CONCLUIR TAREFA
    ============================================================ */
    public static function concluir($id, $confirmado_por = '') {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'pm_tarefas',
            [
                'status'        => 'concluida',
                'confirmado_por'=> sanitize_text_field($confirmado_por),
                'confirmado_em' => current_time('mysql'),
                'atualizado_em' => current_time('mysql'),
            ],
            ['id' => intval($id)],
            ['%s','%s','%s','%s'],
            ['%d']
        );
    }

    /* ============================================================
       CANCELAR TAREFA
    ============================================================ */
    public static function cancelar($id) {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'pm_tarefas',
            ['status' => 'cancelada', 'atualizado_em' => current_time('mysql')],
            ['id' => intval($id)],
            ['%s','%s'],
            ['%d']
        );
    }

    /* ============================================================
       INCREMENTAR CONTADOR DE NOTIFICAÇÕES
    ============================================================ */
    public static function incrementar_notificacoes($id) {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}pm_tarefas SET notificacoes_enviadas = notificacoes_enviadas + 1, atualizado_em = %s WHERE id = %d",
            current_time('mysql'),
            intval($id)
        ));
    }

    /* ============================================================
       VERIFICAR SE JÁ EXISTE TAREFA DO MESMO TIPO NO EVENTO
    ============================================================ */
    public static function existe($id_evento, $tipo) {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}pm_tarefas WHERE id_evento = %d AND tipo = %s AND status != 'cancelada'",
            intval($id_evento),
            sanitize_key($tipo)
        ));
    }
}
