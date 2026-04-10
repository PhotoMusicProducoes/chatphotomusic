<?php
// includes/pagamento/class-photomusic-links-pagamento.php
// Modelo CRUD — Banco de Links de Pagamento (InfinitePay)

if (!defined('ABSPATH')) exit;

class PhotoMusic_Links_Pagamento {

    /* ============================================================
       CRIAR
    ============================================================ */
    public static function criar($dados) {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'pm_links_pagamento',
            [
                'forma'         => sanitize_key($dados['forma']),
                'tipo_evento'   => sanitize_key($dados['tipo_evento'] ?? 'ambos'),
                'valor'         => floatval($dados['valor']),
                'link'          => esc_url_raw($dados['link']),
                'parcelas_max'  => intval($dados['parcelas_max'] ?? 1),
                'valor_parcela' => !empty($dados['valor_parcela']) ? floatval($dados['valor_parcela']) : null,
                'descricao'     => sanitize_text_field($dados['descricao'] ?? ''),
                'ativo'         => 1,
                'criado_em'     => current_time('mysql'),
            ],
            ['%s','%s','%f','%s','%d','%f','%s','%d','%s']
        );
        return $wpdb->insert_id;
    }

    /* ============================================================
       ATUALIZAR
    ============================================================ */
    public static function atualizar($id, $dados) {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'pm_links_pagamento',
            [
                'forma'         => sanitize_key($dados['forma']),
                'tipo_evento'   => sanitize_key($dados['tipo_evento'] ?? 'ambos'),
                'valor'         => floatval($dados['valor']),
                'link'          => esc_url_raw($dados['link']),
                'parcelas_max'  => intval($dados['parcelas_max'] ?? 1),
                'valor_parcela' => !empty($dados['valor_parcela']) ? floatval($dados['valor_parcela']) : null,
                'descricao'     => sanitize_text_field($dados['descricao'] ?? ''),
                'atualizado_em' => current_time('mysql'),
            ],
            ['id' => intval($id)],
            ['%s','%s','%f','%s','%d','%f','%s','%s'],
            ['%d']
        );
    }

    /* ============================================================
       EXCLUIR (soft delete)
    ============================================================ */
    public static function excluir($id) {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'pm_links_pagamento',
            ['ativo' => 0, 'atualizado_em' => current_time('mysql')],
            ['id' => intval($id)],
            ['%d','%s'],
            ['%d']
        );
    }

    /* ============================================================
       BUSCAR POR ID
    ============================================================ */
    public static function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_links_pagamento WHERE id = %d AND ativo = 1",
            intval($id)
        ));
    }

    /* ============================================================
       BUSCAR LINK POR VALOR + FORMA + TIPO EVENTO
       Retorna o link correspondente ou null
    ============================================================ */
    public static function buscar($valor, $forma, $tipo_evento = 'social') {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_links_pagamento
             WHERE ativo = 1
               AND forma = %s
               AND valor = %f
               AND (tipo_evento = %s OR tipo_evento = 'ambos')
             ORDER BY FIELD(tipo_evento, %s, 'ambos')
             LIMIT 1",
            $forma,
            floatval($valor),
            $tipo_evento,
            $tipo_evento
        ));
    }

    /* ============================================================
       LISTAR TODOS (com filtros opcionais)
    ============================================================ */
    public static function listar($filtros = []) {
        global $wpdb;

        $where = ['ativo = 1'];
        $params = [];

        if (!empty($filtros['forma'])) {
            $where[]  = 'forma = %s';
            $params[] = sanitize_key($filtros['forma']);
        }

        if (!empty($filtros['tipo_evento'])) {
            $where[]  = '(tipo_evento = %s OR tipo_evento = \'ambos\')';
            $params[] = sanitize_key($filtros['tipo_evento']);
        }

        if (!empty($filtros['busca_valor'])) {
            $where[]  = 'valor = %f';
            $params[] = floatval(str_replace(',', '.', $filtros['busca_valor']));
        }

        $sql = "SELECT * FROM {$wpdb->prefix}pm_links_pagamento
                WHERE " . implode(' AND ', $where) . "
                ORDER BY forma ASC, tipo_evento ASC, valor ASC";

        if (!empty($params)) {
            return $wpdb->get_results($wpdb->prepare($sql, ...$params));
        }

        return $wpdb->get_results($sql);
    }

    /* ============================================================
       VERIFICAR VALORES SEM LINK CADASTRADO
       Recebe array de ['valor' => X, 'forma' => Y, 'tipo_evento' => Z]
    ============================================================ */
    public static function verificar_lote($itens) {
        $faltando = [];
        foreach ($itens as $item) {
            $encontrado = self::buscar($item['valor'], $item['forma'], $item['tipo_evento'] ?? 'social');
            if (!$encontrado) {
                $faltando[] = $item;
            }
        }
        return $faltando;
    }

    /* ============================================================
       LABELS
    ============================================================ */
    public static function label_forma($forma) {
        $labels = [
            'cartao'          => '💳 Cartão (InfinitePay)',
            'pix_infinitepay' => '⚡ PIX InfinitePay',
        ];
        return $labels[$forma] ?? $forma;
    }

    public static function label_tipo_evento($tipo) {
        $labels = [
            'social'      => '🎉 Social',
            'corporativo' => '🏢 Corporativo (PJ)',
            'ambos'       => '🔁 Ambos',
        ];
        return $labels[$tipo] ?? $tipo;
    }
}
