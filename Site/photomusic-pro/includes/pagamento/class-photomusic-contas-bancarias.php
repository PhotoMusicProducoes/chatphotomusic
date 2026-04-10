<?php
// includes/pagamento/class-photomusic-contas-bancarias.php
// Modelo CRUD — Contas Bancárias da Empresa

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contas_Bancarias {

    /* ============================================================
       CRIAR
    ============================================================ */
    public static function criar($dados) {
        global $wpdb;

        // Se for definida como principal, remove o flag das outras do mesmo tipo
        if (!empty($dados['principal'])) {
            self::remover_principal($dados['tipo']);
        }

        $wpdb->insert(
            $wpdb->prefix . 'pm_contas_bancarias',
            [
                'nome'        => sanitize_text_field($dados['nome']),
                'tipo'        => sanitize_key($dados['tipo']),
                'banco'       => sanitize_text_field($dados['banco'] ?? ''),
                'beneficiario'=> sanitize_text_field($dados['beneficiario'] ?? ''),
                'chave_pix'   => sanitize_text_field($dados['chave_pix'] ?? ''),
                'tipo_chave'  => sanitize_key($dados['tipo_chave'] ?? ''),
                'agencia'     => sanitize_text_field($dados['agencia'] ?? ''),
                'codigo_banco'=> sanitize_text_field($dados['codigo_banco'] ?? ''),
                'conta'       => sanitize_text_field($dados['conta'] ?? ''),
                'cnpj'        => sanitize_text_field($dados['cnpj'] ?? ''),
                'principal'   => !empty($dados['principal']) ? 1 : 0,
                'ativo'       => 1,
                'criado_em'   => current_time('mysql'),
            ]
        );
        return $wpdb->insert_id;
    }

    /* ============================================================
       ATUALIZAR
    ============================================================ */
    public static function atualizar($id, $dados) {
        global $wpdb;

        if (!empty($dados['principal'])) {
            self::remover_principal($dados['tipo'], $id);
        }

        return $wpdb->update(
            $wpdb->prefix . 'pm_contas_bancarias',
            [
                'nome'        => sanitize_text_field($dados['nome']),
                'tipo'        => sanitize_key($dados['tipo']),
                'banco'       => sanitize_text_field($dados['banco'] ?? ''),
                'beneficiario'=> sanitize_text_field($dados['beneficiario'] ?? ''),
                'chave_pix'   => sanitize_text_field($dados['chave_pix'] ?? ''),
                'tipo_chave'  => sanitize_key($dados['tipo_chave'] ?? ''),
                'agencia'     => sanitize_text_field($dados['agencia'] ?? ''),
                'codigo_banco'=> sanitize_text_field($dados['codigo_banco'] ?? ''),
                'conta'       => sanitize_text_field($dados['conta'] ?? ''),
                'cnpj'        => sanitize_text_field($dados['cnpj'] ?? ''),
                'principal'   => !empty($dados['principal']) ? 1 : 0,
                'atualizado_em' => current_time('mysql'),
            ],
            ['id' => intval($id)]
        );
    }

    /* ============================================================
       EXCLUIR (soft delete)
    ============================================================ */
    public static function excluir($id) {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'pm_contas_bancarias',
            ['ativo' => 0, 'atualizado_em' => current_time('mysql')],
            ['id' => intval($id)]
        );
    }

    /* ============================================================
       BUSCAR POR ID
    ============================================================ */
    public static function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_contas_bancarias WHERE id = %d AND ativo = 1",
            intval($id)
        ));
    }

    /* ============================================================
       BUSCAR CONTA PRINCIPAL POR TIPO
    ============================================================ */
    public static function get_principal($tipo) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_contas_bancarias
             WHERE ativo = 1 AND tipo = %s AND principal = 1
             LIMIT 1",
            sanitize_key($tipo)
        ));
    }

    /* ============================================================
       LISTAR TODAS ATIVAS (opcionalmente por tipo)
    ============================================================ */
    public static function listar($tipo = '') {
        global $wpdb;

        if ($tipo) {
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}pm_contas_bancarias
                 WHERE ativo = 1 AND (tipo = %s OR tipo = 'ambos')
                 ORDER BY principal DESC, nome ASC",
                sanitize_key($tipo)
            ));
        }

        return $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}pm_contas_bancarias
             WHERE ativo = 1
             ORDER BY tipo ASC, principal DESC, nome ASC"
        );
    }

    /* ============================================================
       MONTAR TEXTO PIX (para contrato)
    ============================================================ */
    public static function texto_pix($conta) {
        if (!$conta) return '';
        $txt = 'Banco ' . $conta->banco;
        if ($conta->beneficiario) $txt .= ' – ' . $conta->beneficiario;
        if ($conta->chave_pix)    $txt .= ' – Chave PIX ' . self::label_tipo_chave($conta->tipo_chave) . ': ' . $conta->chave_pix;
        return $txt;
    }

    /* ============================================================
       MONTAR TEXTO TRANSFERÊNCIA (para contrato)
    ============================================================ */
    public static function texto_transferencia($conta) {
        if (!$conta) return '';
        $partes = [];
        if ($conta->banco)        $partes[] = $conta->banco;
        if ($conta->beneficiario) $partes[] = $conta->beneficiario;
        if ($conta->codigo_banco) $partes[] = 'Banco: ' . $conta->codigo_banco;
        if ($conta->agencia)      $partes[] = 'Ag.: ' . $conta->agencia;
        if ($conta->conta)        $partes[] = 'C/C: ' . $conta->conta;
        if ($conta->cnpj)         $partes[] = 'CNPJ: ' . $conta->cnpj;
        return implode(' – ', $partes);
    }

    /* ============================================================
       LABELS
    ============================================================ */
    public static function label_tipo($tipo) {
        return [
            'pix'          => '⚡ PIX',
            'transferencia'=> '🏛️ Transferência',
            'ambos'        => '🔁 PIX + Transferência',
        ][$tipo] ?? $tipo;
    }

    public static function label_tipo_chave($tipo) {
        return [
            'cnpj'      => 'CNPJ',
            'cpf'       => 'CPF',
            'email'     => 'E-mail',
            'celular'   => 'Celular',
            'aleatoria' => 'Aleatória',
        ][$tipo] ?? $tipo;
    }

    /* ============================================================
       HELPER — remove flag principal de outras contas do mesmo tipo
    ============================================================ */
    private static function remover_principal($tipo, $exceto_id = 0) {
        global $wpdb;
        $sql = "UPDATE {$wpdb->prefix}pm_contas_bancarias SET principal = 0
                WHERE tipo = %s AND ativo = 1";
        $params = [sanitize_key($tipo)];
        if ($exceto_id > 0) {
            $sql    .= ' AND id != %d';
            $params[] = intval($exceto_id);
        }
        $wpdb->query($wpdb->prepare($sql, ...$params));
    }
}
