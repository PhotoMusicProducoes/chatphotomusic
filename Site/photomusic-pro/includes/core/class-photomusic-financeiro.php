<?php
// includes/core/class-photomusic-financeiro.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Financeiro
{
    protected static function table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_financeiro_movimentos';
    }

    public static function registrar_movimento($data) {
    global $wpdb;

    // -----------------------------
    // 1. Validar tipo (entrada/saida)
    // -----------------------------
    $tipo = sanitize_text_field($data['tipo'] ?? '');
    if (!in_array($tipo, ['entrada', 'saida'], true)) {
        $tipo = 'entrada';
    }

    // -----------------------------
    // 2. Validar valor
    // -----------------------------
    $valor = floatval($data['valor'] ?? 0);
    if ($valor < 0) {
        $valor = 0;
    }

    // -----------------------------
    // 3. Validar data do movimento
    // -----------------------------
    $data_mov = sanitize_text_field($data['data_movimento'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_mov)) {
        $data_mov = current_time('Y-m-d');
    }

    // -----------------------------
    // 4. Sanitizar anexos (array → JSON)
    // -----------------------------
    $anexos = null;
    if (!empty($data['anexos']) && is_array($data['anexos'])) {
        $anexos = wp_json_encode(array_map('sanitize_text_field', $data['anexos']));
    }

    // -----------------------------
    // 5. Sanitizar IDs
    // -----------------------------
    $id_evento      = !empty($data['id_evento'])      && intval($data['id_evento']) > 0      ? intval($data['id_evento'])      : null;
    $id_servico     = !empty($data['id_servico'])     && intval($data['id_servico']) > 0     ? intval($data['id_servico'])     : null;
    $id_fornecedor  = !empty($data['id_fornecedor'])  && intval($data['id_fornecedor']) > 0  ? intval($data['id_fornecedor'])  : null;
    $id_colaborador = !empty($data['id_colaborador']) && intval($data['id_colaborador']) > 0 ? intval($data['id_colaborador']) : null;
    $id_funcionario = !empty($data['id_funcionario']) && intval($data['id_funcionario']) > 0 ? intval($data['id_funcionario']) : null;

    // -----------------------------
    // 6. Montar array final
    // -----------------------------
        $insert = [
            'tipo'            => $tipo,
            'categoria'       => sanitize_text_field($data['categoria'] ?? ''),
            'subcategoria'    => sanitize_text_field($data['subcategoria'] ?? ''),
            'descricao'       => sanitize_textarea_field($data['descricao'] ?? ''),
            'valor'           => $valor,
            'data_movimento'  => $data_mov,
            'data_registro'   => current_time('mysql'),
            'origem'          => sanitize_text_field($data['origem'] ?? 'sistema'),
            'id_evento'       => $id_evento,
            'id_servico'      => $id_servico,
            'id_fornecedor'   => $id_fornecedor,
            'id_colaborador'  => $id_colaborador,
            'id_funcionario'  => $id_funcionario,
            'status'          => sanitize_text_field($data['status'] ?? 'pendente'),
            'forma_pagamento' => sanitize_text_field($data['forma_pagamento'] ?? ''),
            'documento'       => sanitize_text_field($data['documento'] ?? ''),
            'anexos'          => $anexos,
            'criado_por'      => get_current_user_id(),
            'criado_em'       => current_time('mysql'),
        ];

        // -----------------------------
        // 7. Inserir no banco
        // -----------------------------
        $wpdb->insert(self::table(), $insert);

        return $wpdb->insert_id;
    }

    public static function get_movimentos_evento($id_evento) {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::table() . " WHERE id_evento = %d ORDER BY data_movimento ASC, id ASC",
                intval($id_evento)
            )
        );
    }

    public static function get_resumo_evento($id_evento) {
        global $wpdb;

        $table = self::table();

        $entradas = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT SUM(valor) FROM $table WHERE id_evento = %d AND tipo = 'entrada' AND status != 'cancelado'",
                intval($id_evento)
            )
        );

        $saidas = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT SUM(valor) FROM $table WHERE id_evento = %d AND tipo = 'saida' AND status != 'cancelado'",
                intval($id_evento)
            )
        );

        $entradas = floatval($entradas ?: 0);
        $saidas   = floatval($saidas ?: 0);

        return [
            'entradas' => floatval($entradas),
            'saidas'   => floatval($saidas),
            'saldo'    => floatval($entradas) - floatval($saidas),
        ];
    }
}
