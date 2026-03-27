<?php
// includes/core/class-photomusic-events-core.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Events_Core {

    private $tbl_eventos;
    private $tbl_history;
    private $tbl_messages;
    private $tbl_contratantes;
    private $tbl_contratos;

    public function __construct() {
        global $wpdb;

        $this->tbl_eventos      = $wpdb->prefix . 'pm_eventos';
        $this->tbl_history      = $wpdb->prefix . 'pm_event_history';
        $this->tbl_messages     = $wpdb->prefix . 'pm_event_messages';
        $this->tbl_contratantes = $wpdb->prefix . 'pm_contratantes';
        $this->tbl_contratos    = $wpdb->prefix . 'pm_contratos';
    }

    /* ============================================================
       EVENTO — DADOS COMPLETOS (EVENTO + CONTRATANTE + SERVIÇOS)
    ============================================================ */
    public function get_evento_completo($id_evento) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return null;
        }

        // Evento
        $evento = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->tbl_eventos} WHERE id = %d", $id_evento),
            ARRAY_A
        );

        if (!$evento) {
            return null;
        }

        // Sanitização campo a campo
        foreach ($evento as $k => $v) {
            $evento[$k] = is_string($v) ? sanitize_text_field($v) : $v;
        }

        // Contratante (se houver vínculo direto)
        $contratante = null;

        if (!empty($evento['id_contratante'])) {

            $contratante = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$this->tbl_contratantes} WHERE id = %d",
                    $evento['id_contratante']
                ),
                ARRAY_A
            );

        } else {

            // fallback: tentar via contrato
            $contrato = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT id_contratante FROM {$this->tbl_contratos} WHERE id_evento = %d LIMIT 1",
                    $id_evento
                )
            );

            if ($contrato && !empty($contrato->id_contratante)) {
                $contratante = $wpdb->get_row(
                    $wpdb->prepare(
                        "SELECT * FROM {$this->tbl_contratantes} WHERE id = %d",
                        $contrato->id_contratante
                    ),
                    ARRAY_A
                );
            }
        }

        // Sanitização do contratante
        if ($contratante) {
            foreach ($contratante as $k => $v) {
                $contratante[$k] = is_string($v) ? sanitize_text_field($v) : $v;
            }
        }

        // Serviços contratados (módulo moderno)
        if (class_exists('PhotoMusic_Servicos')) {
            $servicos = PhotoMusic_Servicos::get_evento_servicos($id_evento);
        } else {
            $servicos = [];
        }

        // Histórico
        $historico = $this->listar_historico($id_evento);

        // Mensagens
        $mensagens = $this->listar_mensagens($id_evento);

        // Monta retorno completo
        $evento['contratante'] = $contratante;
        $evento['servicos']    = $servicos;
        $evento['historico']   = $historico;
        $evento['mensagens']   = $mensagens;

        return $evento;
    }

    /* ============================================================
        ATUALIZAR STATUS DO EVENTO + HISTÓRICO
    ============================================================ */
    public function update_status($id_evento, $status) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return false;
        }

        $status = sanitize_text_field($status);

        $wpdb->update(
            $this->tbl_eventos,
            [
                'status_evento' => $status,
                'atualizado_em' => current_time('mysql')
            ],
            ['id' => $id_evento],
            ['%s', '%s'],
            ['%d']
        );

        $this->registrar_historico(
            $id_evento,
            "Status atualizado para: {$status}",
            null
        );

        return true;
    }

    /* ============================================================
       HISTÓRICO DO EVENTO
    ============================================================ */
    public function registrar_historico($id_evento, $acao, $detalhes = null) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return;
        }

        $usuario_id = get_current_user_id();
        $acao = substr(sanitize_text_field($acao), 0, 200);
        $detalhes = $detalhes !== null ? substr(sanitize_textarea_field($detalhes), 0, 2000) : null;

        $wpdb->insert($this->tbl_history, [
            'id_evento'   => $id_evento,
            'acao'        => $acao,
            'detalhes'    => $detalhes,
            'usuario_id'  => $usuario_id ?: null,
            'criado_em'   => current_time('mysql'),
        ]);
    }

    public function listar_historico($id_evento) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return [];
        }

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->tbl_history} WHERE id_evento = %d ORDER BY criado_em DESC, id DESC",
                $id_evento
            ),
            ARRAY_A
        );
    }

    /* ============================================================
       MENSAGENS (WHATSAPP / COMUNICAÇÃO)
    ============================================================ */
    public function registrar_mensagem($id_evento, $chat_id, $direction, $tipo, $mensagem, $id_servico = null) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return;
        }

        // valida direction
        $direction = sanitize_text_field($direction);
        $direction = in_array($direction, ['in', 'out'], true) ? $direction : 'in';

        // valida tipo
        $tipo = sanitize_text_field($tipo);
        $tipo = in_array($tipo, ['text', 'image', 'audio', 'document'], true) ? $tipo : 'text';

        // sanitiza mensagem
        $mensagem = substr(sanitize_textarea_field($mensagem), 0, 2000);

        // valida id_servico
        if ($id_servico && class_exists('PhotoMusic_Servicos')) {
            $servicos = PhotoMusic_Servicos::get_evento_servicos($id_evento);
            $ids = array_column($servicos, 'id_servico');
            if (!in_array($id_servico, $ids)) {
                $id_servico = null;
            }
        }

        $wpdb->insert($this->tbl_messages, [
            'id_evento'  => $id_evento,
            'id_servico' => $id_servico ? (int) $id_servico : null,
            'chat_id'    => sanitize_text_field($chat_id),
            'direction'  => $direction,
            'tipo'       => $tipo,
            'mensagem'   => $mensagem,
            'enviado_em' => current_time('mysql'),
        ]);

        // registra log
        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add(
                'evento_mensagem',
                null,
                $id_evento,
                null,
                'Mensagem registrada no evento.'
            );
        }
    }

    public function listar_mensagens($id_evento) {
        global $wpdb;

        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) {
            return [];
        }

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->tbl_messages} WHERE id_evento = %d ORDER BY enviado_em DESC, id DESC",
                $id_evento
            ),
            ARRAY_A
        );
    }
}
