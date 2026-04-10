<?php
// includes/pagamento/class-photomusic-tabela-precos.php
// Tabela de Preços com cálculo automático por hora + regras por tipo de evento

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tabela_Precos {

    const HORAS          = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const QTDS_LEMBRANCA = [60, 100, 150, 200, 300, 400, 500];

    /* ============================================================
       CONFIG (wp_options: pm_tabela_precos_config)
    ============================================================ */
    public static function get_config() {
        $default = [
            'increment_hora'    => 200,   // R$ por hora acima de 3h
            'adicional_corp200' => 300,   // R$ adicional no base(3h) para Corporativo 200+
            'servicos'          => [],    // [id_servico => [...]]
        ];
        $saved = get_option('pm_tabela_precos_config', []);
        return array_replace_recursive($default, is_array($saved) ? $saved : []);
    }

    public static function salvar_config($config) {
        update_option('pm_tabela_precos_config', $config);
    }

    /* ============================================================
       GERAR TABELA COMPLETA
       Calcula todos os preços conforme regras + config.
       Preserva células com gerado_automatico = 0 (override manual).
    ============================================================ */
    public static function gerar_tudo() {
        $config      = self::get_config();
        $inc         = floatval($config['increment_hora']    ?? 200);
        $corp200_add = floatval($config['adicional_corp200'] ?? 300);
        $servicos    = $config['servicos'] ?? [];

        // 1ª passagem: serviços "horario" (têm base própria)
        foreach ($servicos as $id => $srv) {
            if (($srv['tipo'] ?? '') === 'horario') {
                $base = floatval($srv['base_social_3h'] ?? 0);
                if ($base > 0) {
                    self::gerar_linhas_horario(intval($id), $base, $inc, $corp200_add);
                }
            }
        }

        // 2ª passagem: serviços "derivado" (copiam de outro + diferença fixa)
        foreach ($servicos as $id => $srv) {
            if (($srv['tipo'] ?? '') === 'derivado') {
                $base_id = intval($srv['base_de']  ?? 0);
                $diff    = floatval($srv['diferenca'] ?? 0);
                if ($base_id > 0) {
                    self::gerar_linhas_derivado(intval($id), $base_id, $diff);
                }
            }
        }

        // 3ª passagem: Foto Lembrança (por quantidade)
        foreach ($servicos as $id => $srv) {
            if (($srv['tipo'] ?? '') === 'lembranca') {
                self::gerar_linhas_lembranca(intval($id), $srv['precos'] ?? []);
            }
        }
    }

    /* ---- Gera preços horários (2h–10h × 3 tipos de evento) ---- */
    private static function gerar_linhas_horario($id_srv, $base_social, $inc, $corp200_add) {
        foreach (self::HORAS as $h) {
            // Social (2h e 3h = mesmo preço; acima de 3h +R$inc/h)
            $val_s = $h <= 3 ? $base_social : $base_social + ($h - 3) * $inc;

            // Corporativo até 200 pessoas = mesmo preço do Social
            $val_c200 = $val_s;

            // Corporativo 200+ = base(3h) + adicional, depois mesmo incremento
            $base_corp200 = $base_social + $corp200_add;
            $val_c200plus = $h <= 3 ? $base_corp200 : $base_corp200 + ($h - 3) * $inc;

            self::upsert_auto($id_srv, 'social',              $h, null, $val_s);
            self::upsert_auto($id_srv, 'corporativo_ate200',  $h, null, $val_c200);
            self::upsert_auto($id_srv, 'corporativo_200mais', $h, null, $val_c200plus);
        }
    }

    /* ---- Gera linhas derivadas de outro serviço + diferença ---- */
    private static function gerar_linhas_derivado($id_srv, $base_id, $diff) {
        global $wpdb;
        $linhas = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_tabela_precos
             WHERE id_servico = %d AND ativo = 1 AND horas IS NOT NULL",
            $base_id
        ));
        foreach ($linhas as $l) {
            $val = max(0, floatval($l->valor) + $diff);
            self::upsert_auto($id_srv, $l->tipo_evento, (int)$l->horas, null, $val);
        }
    }

    /* ---- Gera preços de Foto Lembrança por quantidade ---- */
    private static function gerar_linhas_lembranca($id_srv, $precos) {
        foreach (self::QTDS_LEMBRANCA as $qtd) {
            $v = isset($precos[$qtd]) ? floatval(str_replace(',', '.', $precos[$qtd])) : 0;
            if ($v > 0) {
                self::upsert_auto($id_srv, 'social', null, $qtd, $v);
            }
        }
    }

    /* ---- Upsert automático (não sobrescreve overrides manuais) ---- */
    private static function upsert_auto($id_srv, $tipo_ev, $horas, $qtd, $valor) {
        global $wpdb;
        $tbl      = $wpdb->prefix . 'pm_tabela_precos';
        $existing = self::find_row($id_srv, $tipo_ev, $horas, $qtd);

        if ($existing) {
            if ((int)$existing->gerado_automatico === 0) return; // preserve manual override
            if (abs(floatval($existing->valor) - $valor) < 0.001) return; // unchanged
            self::log_hist($existing->id, $id_srv, $tipo_ev, $existing->valor, $valor, 'Recálculo automático');
            $wpdb->update($tbl, ['valor' => $valor, 'atualizado_em' => current_time('mysql')], ['id' => $existing->id]);
        } else {
            $wpdb->insert($tbl, [
                'id_servico'        => $id_srv,
                'tipo_evento'       => $tipo_ev,
                'horas'             => $horas,
                'qtd_fotos'         => $qtd,
                'valor'             => $valor,
                'gerado_automatico' => 1,
                'ativo'             => 1,
                'criado_em'         => current_time('mysql'),
            ]);
        }
    }

    /* ============================================================
       OVERRIDE MANUAL DE UM PREÇO ESPECÍFICO
    ============================================================ */
    public static function override($id, $novo_valor, $motivo = '') {
        global $wpdb;
        $tbl = $wpdb->prefix . 'pm_tabela_precos';
        $row = $wpdb->get_row("SELECT * FROM $tbl WHERE id = " . intval($id));
        if (!$row) return false;

        $novo_valor = floatval(str_replace(',', '.', $novo_valor));
        if (abs(floatval($row->valor) - $novo_valor) > 0.001) {
            self::log_hist($id, $row->id_servico, $row->tipo_evento, $row->valor, $novo_valor, $motivo ?: 'Override manual');
        }
        return $wpdb->update($tbl,
            ['valor' => $novo_valor, 'gerado_automatico' => 0, 'atualizado_em' => current_time('mysql')],
            ['id' => intval($id)]
        );
    }

    /* ============================================================
       RESTAURAR AO VALOR CALCULADO
    ============================================================ */
    public static function restaurar_auto($id) {
        global $wpdb;
        $wpdb->update($wpdb->prefix . 'pm_tabela_precos', ['gerado_automatico' => 1], ['id' => intval($id)]);
        self::gerar_tudo(); // recalcula todos (incluindo o restaurado)
    }

    /* ============================================================
       CONSULTAS
    ============================================================ */

    /** Busca o preço aplicável a um evento (retorna o objeto ou null) */
    public static function get_preco($id_servico, $tipo_evento, $horas = null, $qtd_fotos = null) {
        return self::find_row($id_servico, $tipo_evento, $horas, $qtd_fotos);
    }

    /** Lista serviços ativos para o formulário de config */
    public static function listar_servicos_ativos() {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT id, nome, codigo FROM {$wpdb->prefix}pm_servicos WHERE ativo = 1 ORDER BY nome ASC"
        );
    }

    /** Lista tabela agrupada por serviço (para a tela de exibição) */
    public static function listar_agrupado() {
        global $wpdb;
        $tbl   = $wpdb->prefix . 'pm_tabela_precos';
        $tbl_s = $wpdb->prefix . 'pm_servicos';

        $rows = $wpdb->get_results(
            "SELECT p.*, s.nome AS nome_servico
             FROM $tbl p
             LEFT JOIN $tbl_s s ON p.id_servico = s.id
             WHERE p.ativo = 1
             ORDER BY s.nome ASC, p.tipo_evento ASC, p.horas ASC, p.qtd_fotos ASC"
        );

        $agrupado = [];
        foreach ($rows as $r) {
            $sid = $r->id_servico;
            if (!isset($agrupado[$sid])) {
                $agrupado[$sid] = ['nome' => $r->nome_servico ?? ('Serviço #' . $sid), 'linhas' => []];
            }
            $agrupado[$sid]['linhas'][] = $r;
        }
        return $agrupado;
    }

    /** Histórico de alterações de uma célula */
    public static function historico($id_preco) {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT h.*, u.display_name AS nome
             FROM {$wpdb->prefix}pm_tabela_precos_historico h
             LEFT JOIN {$wpdb->users} u ON h.alterado_por = u.ID
             WHERE h.id_preco = %d ORDER BY h.alterado_em DESC LIMIT 50",
            intval($id_preco)
        ));
    }

    /* ============================================================
       HELPERS
    ============================================================ */
    public static function label_tipo_evento($t) {
        return [
            'social'              => '🎉 Social',
            'corporativo_ate200'  => '🏢 Corp. até 200',
            'corporativo_200mais' => '🏢 Corp. 200+',
        ][$t] ?? $t;
    }

    private static function find_row($id_srv, $tipo_ev, $horas, $qtd) {
        global $wpdb;
        $tbl    = $wpdb->prefix . 'pm_tabela_precos';
        $where  = 'id_servico = %d AND tipo_evento = %s AND ativo = 1';
        $params = [intval($id_srv), $tipo_ev];

        if ($horas === null) {
            $where .= ' AND horas IS NULL';
        } else {
            $where .= ' AND horas = %d';
            $params[] = intval($horas);
        }
        if ($qtd === null) {
            $where .= ' AND qtd_fotos IS NULL';
        } else {
            $where .= ' AND qtd_fotos = %d';
            $params[] = intval($qtd);
        }

        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $tbl WHERE $where LIMIT 1", ...$params));
    }

    private static function log_hist($id_preco, $id_srv, $tipo_ev, $val_ant, $val_novo, $motivo) {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'pm_tabela_precos_historico', [
            'id_preco'       => intval($id_preco),
            'id_servico'     => intval($id_srv),
            'tipo'           => 'servico',
            'tipo_evento'    => $tipo_ev,
            'valor_anterior' => floatval($val_ant),
            'valor_novo'     => floatval($val_novo),
            'alterado_por'   => get_current_user_id() ?: null,
            'alterado_em'    => current_time('mysql'),
            'motivo'         => sanitize_text_field($motivo),
        ]);
    }
}
