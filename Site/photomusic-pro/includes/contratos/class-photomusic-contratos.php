<?php
// includes/contratos/class-photomusic-contratos.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos {

    /* ============================================================
       NOME DAS TABELAS
       ============================================================ */
    protected static function get_table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_contratos';
    }

    protected static function get_logs_table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_contratos_logs';
    }

    /* ============================================================
       LISTAS DE VALIDAÇÃO
       ============================================================ */
    protected static $status_validos = [
        'rascunho',
        'aguardando_assinatura_admin',
        'aguardando_assinatura_contratante',
        'assinado',
        'assinado_admin',
        'assinado_contratante',
        'dispensado',
        'cancelado'
    ];

    protected static $assinaturas_validas = [
        'digital_sistema',
        'manual_papel',
        'govbr',
        'nao_assinado'
    ];

    /* ============================================================
       GERAR TOKEN ÚNICO
       ============================================================ */
    protected static function gerar_token_unico() {
        global $wpdb;
        $table = self::get_table();

        do {
            $token  = bin2hex(random_bytes(16));
            $existe = $wpdb->get_var(
                $wpdb->prepare("SELECT COUNT(*) FROM $table WHERE token = %s", $token)
            );
        } while ($existe > 0);

        return $token;
    }

    /* ============================================================
       REGISTRAR LOG
       ============================================================ */
    public static function registrar_log($id_contrato, $acao, $detalhes = null) {
        global $wpdb;

        $id_contrato = intval($id_contrato);
        if ($id_contrato <= 0) return;

        $acao     = substr(sanitize_text_field($acao), 0, 200);
        $detalhes = $detalhes ? substr(wp_kses_post($detalhes), 0, 5000) : null;

        $ip        = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $useragent = substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500);

        $wpdb->insert(
            self::get_logs_table(),
            [
                'id_contrato' => $id_contrato,
                'acao'        => $acao,
                'detalhes'    => $detalhes,
                'ip'          => $ip,
                'user_agent'  => $useragent,
                'criado_em'   => current_time('mysql'),
            ]
        );
    }

    /* ============================================================
       CRIAR CONTRATO COMPLETO
       ============================================================ */
    public static function criar_contrato_completo($id_evento, $id_contratante, $conteudo_html) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_criar()) {
            wp_die('Você não tem permissão para criar contratos.');
        }

        $conteudo_html = wp_kses_post($conteudo_html);

        $dados = [
            'id_evento'       => intval($id_evento),
            'id_contratante'  => $id_contratante ? intval($id_contratante) : null,
            'token'           => self::gerar_token_unico(),
            'tipo_contrato'   => 'completo',
            'status_contrato' => 'rascunho',
            'tipo_assinatura' => 'nao_assinado',
            'conteudo'        => $conteudo_html,
            'criado_em'       => current_time('mysql'),
        ];

        $wpdb->insert(self::get_table(), $dados);
        $id = $wpdb->insert_id;

        self::registrar_log($id, 'contrato_criado', 'Contrato completo criado.');

        return $id;
    }

    /* ============================================================
       CRIAR CONTRATO SIMPLIFICADO
       ============================================================ */
    public static function criar_contrato_simplificado($id_evento, $id_contratante = null) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_criar()) {
            wp_die('Você não tem permissão para criar contratos.');
        }

        $dados = [
            'id_evento'       => intval($id_evento),
            'id_contratante'  => $id_contratante ? intval($id_contratante) : null,
            'token'           => self::gerar_token_unico(),
            'tipo_contrato'   => 'simplificado',
            'status_contrato' => 'rascunho',
            'tipo_assinatura' => 'nao_assinado',
            'conteudo'        => null,
            'criado_em'       => current_time('mysql'),
        ];

        $wpdb->insert(self::get_table(), $dados);
        $id = $wpdb->insert_id;

        self::registrar_log($id, 'contrato_criado_simplificado', 'Contrato simplificado criado.');

        return $id;
    }

    /* ============================================================
       BUSCAS
       ============================================================ */
    public static function get_by_token($token) {
        global $wpdb;

        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM " . self::get_table() . " WHERE token = %s",
                sanitize_text_field($token)
            )
        );
    }

    public static function get($id) {
        global $wpdb;

        $id = intval($id);
        if ($id <= 0) return null;

        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM " . self::get_table() . " WHERE id = %d",
                $id
            )
        );
    }

    public static function get_by_event($id_evento) {
        global $wpdb;

        $id_evento = intval($id_evento);
        if ($id_evento <= 0) return null;

        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM " . self::get_table() . " WHERE id_evento = %d ORDER BY id DESC LIMIT 1",
                $id_evento
            )
        );
    }

    /* ============================================================
       LISTAR TODOS OS CONTRATOS      ← ADICIONAR ESTE BLOCO INTEIRO
    ============================================================ */
    public static function get_all() {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM " . self::get_table() . " ORDER BY id DESC"
        );
    }

    /* ============================================================
       ATUALIZAR CAMPOS
       ============================================================ */
    public static function atualizar($id, $dados) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_die('Você não tem permissão para editar contratos.');
        }

        if (empty($dados)) return false;

        $dados['atualizado_em'] = current_time('mysql');

        $result = $wpdb->update(self::get_table(), $dados, ['id' => intval($id)]);

        if ($result !== false) {
            self::registrar_log($id, 'contrato_atualizado', 'Campos atualizados.');
        }

        return $result;
    }

    /* ============================================================
       ASSINATURA DO CONTRATANTE (PÚBLICA)
       ============================================================ */
    public static function registrar_assinatura_contratante($id_contrato, $nome, $ip, $useragent) {
        global $wpdb;

        $id_contrato = intval($id_contrato);
        if ($id_contrato <= 0) return false;

        $nome      = substr(sanitize_text_field($nome), 0, 200);
        $ip        = sanitize_text_field($ip);
        $useragent = substr(sanitize_text_field($useragent), 0, 500);

        $hash = hash('sha256', $id_contrato . $nome . $ip . microtime(true));

        $dados = [
            'assinatura_contratante_nome'      => $nome,
            'assinatura_contratante_data'      => current_time('mysql'),
            'assinatura_contratante_ip'        => $ip,
            'assinatura_contratante_useragent' => $useragent,
            'assinatura_contratante_hash'      => $hash,
            'tipo_assinatura'                  => 'digital_sistema',
            'status_contrato'                  => 'assinado_contratante',
            'atualizado_em'                    => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => $id_contrato]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'assinatura_contratante');
        }

        return $result;
    }

    /* ============================================================
       ASSINATURA DO ADMIN (EMPRESA)
       ============================================================ */
    public static function registrar_assinatura_admin($id_contrato, $nome, $ip, $useragent) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_assinar()) {
            wp_die('Você não tem permissão para assinar contratos como empresa.');
        }

        $id_contrato = intval($id_contrato);
        if ($id_contrato <= 0) return false;

        $nome      = substr(sanitize_text_field($nome), 0, 200);
        $ip        = sanitize_text_field($ip);
        $useragent = substr(sanitize_text_field($useragent), 0, 500);

        $hash = hash('sha256', $id_contrato . $nome . $ip . microtime(true));

        $contrato = self::get($id_contrato);
        if (!$contrato) return false;

        $status = $contrato->assinatura_contratante_hash
            ? 'assinado'
            : 'assinado_admin';

        $dados = [
            'assinatura_admin_nome'      => $nome,
            'assinatura_admin_data'      => current_time('mysql'),
            'assinatura_admin_ip'        => $ip,
            'assinatura_admin_useragent' => $useragent,
            'assinatura_admin_hash'      => $hash,
            'status_contrato'            => $status,
            'atualizado_em'              => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => $id_contrato]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'assinatura_admin');
        }

        return $result;
    }

    /* ============================================================
       ASSINATURA MANUAL
       ============================================================ */
    public static function marcar_assinatura_manual($id_contrato) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_assinar()) {
            wp_die('Você não tem permissão para registrar assinatura manual.');
        }

        $dados = [
            'tipo_assinatura' => 'manual_papel',
            'status_contrato' => 'assinado',
            'atualizado_em'   => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => intval($id_contrato)]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'assinatura_manual');
        }

        return $result;
    }

    /* ============================================================
       ASSINATURA GOV.BR
       ============================================================ */
    public static function marcar_assinatura_govbr($id_contrato) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_assinar()) {
            wp_die('Você não tem permissão para registrar assinatura GovBR.');
        }

        $dados = [
            'tipo_assinatura' => 'govbr',
            'status_contrato' => 'assinado',
            'atualizado_em'   => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => intval($id_contrato)]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'assinatura_govbr');
        }

        return $result;
    }

    /* ============================================================
       SALVAR PDF FINAL
       ============================================================ */
    public static function salvar_pdf($id_contrato, $caminho_pdf) {
        global $wpdb;

        if (!PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_die('Você não tem permissão para salvar o PDF final.');
        }

        $dados = [
            'pdf_final'     => esc_url_raw($caminho_pdf),
            'atualizado_em' => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => intval($id_contrato)]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'pdf_salvo');
        }

        return $result;
    }

    /* ============================================================
       ALTERAR STATUS
       ============================================================ */
    public static function set_status($id_contrato, $status) {
        global $wpdb;

        $status = sanitize_text_field($status);

        if (!in_array($status, self::$status_validos, true)) {
            return false;
        }

        // Regras de permissão por tipo de status
        if ($status === 'cancelado' && !PhotoMusic_Contratos_Permissoes::pode_cancelar()) {
            wp_die('Você não tem permissão para cancelar contratos.');
        }

        if ($status === 'aguardando_assinatura_admin' && !PhotoMusic_Contratos_Permissoes::pode_enviar()) {
            wp_die('Você não tem permissão para enviar contratos para assinatura interna.');
        }

        if ($status === 'assinado' && !PhotoMusic_Contratos_Permissoes::pode_assinar()) {
            wp_die('Você não tem permissão para marcar contratos como assinados.');
        }

        $dados = [
            'status_contrato' => $status,
            'atualizado_em'   => current_time('mysql'),
        ];

        $result = $wpdb->update(self::get_table(), $dados, ['id' => intval($id_contrato)]);

        if ($result !== false) {
            self::registrar_log($id_contrato, 'status_alterado', "Novo status: {$status}");
        }

        return $result;
    }

    public static function update_status($id_contrato, $status) {
        return self::set_status($id_contrato, $status);
    }

    /* ============================================================
       ATUALIZAR HASH DE INTEGRIDADE
       ============================================================ */
    public static function atualizar_hash_contrato($id_contrato) {
        global $wpdb;

        $id_contrato = intval($id_contrato);
        if ($id_contrato <= 0) return false;

        $contrato = self::get($id_contrato);
        if (!$contrato) return false;

        $base = wp_json_encode([
            $contrato->id,
            $contrato->id_evento,
            $contrato->conteudo,
            $contrato->assinatura_contratante_hash,
            $contrato->assinatura_admin_hash,
            $contrato->pdf_final,
        ]);

        $hash = hash('sha256', $base);

        $result = $wpdb->update(
            self::get_table(),
            ['hash_contrato' => $hash],
            ['id' => $id_contrato]
        );

        if ($result !== false) {
            self::registrar_log($id_contrato, 'hash_atualizado');
        }

        return $result;
    }
}
