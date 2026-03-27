<?php
// includes/core/class-photomusic-contratantes.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratantes {

    private static function table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_contratantes';
    }

    /* ============================================================
       CRIAÇÃO — PESSOA FÍSICA (PF)
    ============================================================ */
    public static function create_pf($data) {
        global $wpdb;

        if (empty($data['nome'])) {
            return new WP_Error('nome_obrigatorio', 'O nome é obrigatório.');
        }

        if (empty($data['cpf'])) {
            return new WP_Error('cpf_obrigatorio', 'O CPF é obrigatório.');
        }

        if (empty($data['email'])) {
            return new WP_Error('email_obrigatorio', 'O e-mail é obrigatório.');
        }

        $email = sanitize_email($data['email']);
        if (!is_email($email)) {
            return new WP_Error('email_invalido', 'E-mail inválido.');
        }

        $cpf = preg_replace('/\D/', '', $data['cpf']);
        if (strlen($cpf) !== 11) {
            return new WP_Error('cpf_invalido', 'CPF inválido.');
        }

        $data_nascimento = '';
        if (!empty($data['data_nascimento'])) {
            $data_nascimento = sanitize_text_field($data['data_nascimento']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_nascimento)) {
                return new WP_Error('data_nascimento_invalida', 'Data de nascimento inválida. Use o formato YYYY-MM-DD.');
            }
        }

        $insert = [
            'tipo'              => 'PF',
            'nome'              => substr(sanitize_text_field($data['nome']), 0, 200),
            'cpf'               => $cpf,
            'rg'                => sanitize_text_field($data['rg'] ?? ''),
            'rg_orgao'          => sanitize_text_field($data['rg_orgao'] ?? ''),
            'data_nascimento'   => $data_nascimento,
            'parentesco'        => sanitize_text_field($data['parentesco'] ?? ''),
            'telefone'          => sanitize_text_field($data['telefone'] ?? ''),
            'email'             => $email,
            'instagram'         => sanitize_text_field($data['instagram'] ?? ''),
            'facebook'          => sanitize_text_field($data['facebook'] ?? ''),
            'logradouro'        => sanitize_text_field($data['logradouro'] ?? ''),
            'numero'            => sanitize_text_field($data['numero'] ?? ''),
            'complemento'       => sanitize_text_field($data['complemento'] ?? ''),
            'bairro'            => sanitize_text_field($data['bairro'] ?? ''),
            'cidade'            => sanitize_text_field($data['cidade'] ?? ''),
            'estado'            => sanitize_text_field($data['estado'] ?? ''),
            'cep'               => sanitize_text_field($data['cep'] ?? ''),
            'token_acesso' => PhotoMusic_Token_Generator::generate_contratante_token(),
            'criado_em'         => current_time('mysql'),            
        ];

        $wpdb->insert(self::table(), $insert);
        return $wpdb->insert_id;
    }

    /* ============================================================
       CRIAÇÃO — PESSOA JURÍDICA (PJ)
    ============================================================ */
    public static function create_pj($data) {
        global $wpdb;

        if (empty($data['nome_fantasia'])) {
            return new WP_Error('nome_fantasia_obrigatorio', 'O nome fantasia é obrigatório.');
        }

        if (empty($data['razao_social'])) {
            return new WP_Error('razao_social_obrigatoria', 'A razão social é obrigatória.');
        }

        if (empty($data['cnpj'])) {
            return new WP_Error('cnpj_obrigatorio', 'O CNPJ é obrigatório.');
        }

        if (empty($data['representante_nome'])) {
            return new WP_Error('representante_obrigatorio', 'O nome do representante é obrigatório.');
        }

        if (empty($data['email'])) {
            return new WP_Error('email_obrigatorio', 'O e-mail é obrigatório.');
        }

        $email = sanitize_email($data['email']);
        if (!is_email($email)) {
            return new WP_Error('email_invalido', 'E-mail inválido.');
        }

        $cnpj = preg_replace('/\D/', '', $data['cnpj']);
        if (strlen($cnpj) !== 14) {
            return new WP_Error('cnpj_invalido', 'CNPJ inválido.');
        }

        $representante_cpf = '';
        if (!empty($data['representante_cpf'])) {
            $representante_cpf = preg_replace('/\D/', '', $data['representante_cpf']);
            if (strlen($representante_cpf) !== 11) {
                return new WP_Error('representante_cpf_invalido', 'CPF do representante inválido.');
            }
        }

        $representante_data_nascimento = '';
        if (!empty($data['representante_data_nascimento'])) {
            $representante_data_nascimento = sanitize_text_field($data['representante_data_nascimento']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $representante_data_nascimento)) {
                return new WP_Error('representante_data_invalida', 'Data de nascimento do representante inválida. Use o formato YYYY-MM-DD.');
            }
        }

        $insert = [
            'tipo'                          => 'PJ',
            'nome_fantasia'                 => substr(sanitize_text_field($data['nome_fantasia']), 0, 200),
            'razao_social'                  => substr(sanitize_text_field($data['razao_social']), 0, 200),
            'cnpj'                          => $cnpj,
            'representante_nome'            => substr(sanitize_text_field($data['representante_nome']), 0, 200),
            'representante_cpf'             => $representante_cpf,
            'representante_rg'              => sanitize_text_field($data['representante_rg'] ?? ''),
            'representante_rg_orgao'        => sanitize_text_field($data['representante_rg_orgao'] ?? ''),
            'representante_data_nascimento' => $representante_data_nascimento,
            'representante_celular'         => sanitize_text_field($data['representante_celular'] ?? ''),
            'telefone'                      => sanitize_text_field($data['telefone'] ?? ''),
            'email'                         => $email,
            'instagram'                     => sanitize_text_field($data['instagram'] ?? ''),
            'facebook'                      => sanitize_text_field($data['facebook'] ?? ''),
            'logradouro'                    => sanitize_text_field($data['logradouro'] ?? ''),
            'numero'                        => sanitize_text_field($data['numero'] ?? ''),
            'complemento'                   => sanitize_text_field($data['complemento'] ?? ''),
            'bairro'                        => sanitize_text_field($data['bairro'] ?? ''),
            'cidade'                        => sanitize_text_field($data['cidade'] ?? ''),
            'estado'                        => sanitize_text_field($data['estado'] ?? ''),
            'cep'                           => sanitize_text_field($data['cep'] ?? ''),
            'token_acesso' => PhotoMusic_Token_Generator::generate_contratante_token(),
            'criado_em'                     => current_time('mysql'),
        ];

        $wpdb->insert(self::table(), $insert);
        return $wpdb->insert_id;
    }

    /* ============================================================
       ATUALIZAÇÃO — PF
    ============================================================ */
    public static function update_pf($id, $data) {
        global $wpdb;

        $id = (int) $id;
        if ($id <= 0) {
            return new WP_Error('id_invalido', 'ID inválido.');
        }

        $contratante = self::get($id);
        if (!$contratante) {
            return new WP_Error('contratante_inexistente', 'Contratante não encontrado.');
        }

        $email = sanitize_email($data['email'] ?? '');
        if (!empty($data['email']) && !is_email($email)) {
            return new WP_Error('email_invalido', 'E-mail inválido.');
        }

        $cpf = $contratante->cpf;
        if (!empty($data['cpf'])) {
            $cpf_limpo = preg_replace('/\D/', '', $data['cpf']);
            if (strlen($cpf_limpo) !== 11) {
                return new WP_Error('cpf_invalido', 'CPF inválido.');
            }
            $cpf = $cpf_limpo;
        }

        $data_nascimento = $contratante->data_nascimento;
        if (!empty($data['data_nascimento'])) {
            $data_nascimento = sanitize_text_field($data['data_nascimento']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_nascimento)) {
                return new WP_Error('data_nascimento_invalida', 'Data de nascimento inválida. Use o formato YYYY-MM-DD.');
            }
        }

        $update = [
            'nome'              => substr(sanitize_text_field($data['nome'] ?? $contratante->nome), 0, 200),
            'cpf'               => $cpf,
            'rg'                => sanitize_text_field($data['rg'] ?? $contratante->rg),
            'rg_orgao'          => sanitize_text_field($data['rg_orgao'] ?? $contratante->rg_orgao),
            'data_nascimento'   => $data_nascimento,
            'parentesco'        => sanitize_text_field($data['parentesco'] ?? $contratante->parentesco),
            'telefone'          => sanitize_text_field($data['telefone'] ?? $contratante->telefone),
            'email'             => !empty($email) ? $email : $contratante->email,
            'instagram'         => sanitize_text_field($data['instagram'] ?? $contratante->instagram),
            'facebook'          => sanitize_text_field($data['facebook'] ?? $contratante->facebook),
            'logradouro'        => sanitize_text_field($data['logradouro'] ?? $contratante->logradouro),
            'numero'            => sanitize_text_field($data['numero'] ?? $contratante->numero),
            'complemento'       => sanitize_text_field($data['complemento'] ?? $contratante->complemento),
            'bairro'            => sanitize_text_field($data['bairro'] ?? $contratante->bairro),
            'cidade'            => sanitize_text_field($data['cidade'] ?? $contratante->cidade),
            'estado'            => sanitize_text_field($data['estado'] ?? $contratante->estado),
            'cep'               => sanitize_text_field($data['cep'] ?? $contratante->cep),
        ];

        return $wpdb->update(self::table(), $update, ['id' => $id]);
    }

    /* ============================================================
       ATUALIZAÇÃO — PJ
    ============================================================ */
    public static function update_pj($id, $data) {
        global $wpdb;

        $id = (int) $id;
        if ($id <= 0) {
            return new WP_Error('id_invalido', 'ID inválido.');
        }

        $contratante = self::get($id);
        if (!$contratante) {
            return new WP_Error('contratante_inexistente', 'Contratante não encontrado.');
        }

        $email = sanitize_email($data['email'] ?? '');
        if (!empty($data['email']) && !is_email($email)) {
            return new WP_Error('email_invalido', 'E-mail inválido.');
        }

        $cnpj = $contratante->cnpj;
        if (!empty($data['cnpj'])) {
            $cnpj_limpo = preg_replace('/\D/', '', $data['cnpj']);
            if (strlen($cnpj_limpo) !== 14) {
                return new WP_Error('cnpj_invalido', 'CNPJ inválido.');
            }
            $cnpj = $cnpj_limpo;
        }

        $representante_cpf = $contratante->representante_cpf;
        if (!empty($data['representante_cpf'])) {
            $cpf_rep = preg_replace('/\D/', '', $data['representante_cpf']);
            if (strlen($cpf_rep) !== 11) {
                return new WP_Error('representante_cpf_invalido', 'CPF do representante inválido.');
            }
            $representante_cpf = $cpf_rep;
        }

        $representante_data_nascimento = $contratante->representante_data_nascimento;
        if (!empty($data['representante_data_nascimento'])) {
            $data_rep = sanitize_text_field($data['representante_data_nascimento']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_rep)) {
                return new WP_Error('representante_data_invalida', 'Data de nascimento do representante inválida. Use o formato YYYY-MM-DD.');
            }
            $representante_data_nascimento = $data_rep;
        }

        $update = [
            'nome_fantasia'                 => substr(sanitize_text_field($data['nome_fantasia'] ?? $contratante->nome_fantasia), 0, 200),
            'razao_social'                  => substr(sanitize_text_field($data['razao_social'] ?? $contratante->razao_social), 0, 200),
            'cnpj'                          => $cnpj,
            'representante_nome'            => substr(sanitize_text_field($data['representante_nome'] ?? $contratante->representante_nome), 0, 200),
            'representante_cpf'             => $representante_cpf,
            'representante_rg'              => sanitize_text_field($data['representante_rg'] ?? $contratante->representante_rg),
            'representante_rg_orgao'        => sanitize_text_field($data['representante_rg_orgao'] ?? $contratante->representante_rg_orgao),
            'representante_data_nascimento' => $representante_data_nascimento,
            'representante_celular'         => sanitize_text_field($data['representante_celular'] ?? $contratante->representante_celular),
            'telefone'                      => sanitize_text_field($data['telefone'] ?? $contratante->telefone),
            'email'                         => !empty($email) ? $email : $contratante->email,
            'instagram'                     => sanitize_text_field($data['instagram'] ?? $contratante->instagram),
            'facebook'                      => sanitize_text_field($data['facebook'] ?? $contratante->facebook),
            'logradouro'                    => sanitize_text_field($data['logradouro'] ?? $contratante->logradouro),
            'numero'                        => sanitize_text_field($data['numero'] ?? $contratante->numero),
            'complemento'                   => sanitize_text_field($data['complemento'] ?? $contratante->complemento),
            'bairro'                        => sanitize_text_field($data['bairro'] ?? $contratante->bairro),
            'cidade'                        => sanitize_text_field($data['cidade'] ?? $contratante->cidade),
            'estado'                        => sanitize_text_field($data['estado'] ?? $contratante->estado),
            'cep'                           => sanitize_text_field($data['cep'] ?? $contratante->cep),
        ];

        return $wpdb->update(self::table(), $update, ['id' => $id]);
    }

    /* ============================================================
       BUSCAR CONTRATANTE
    ============================================================ */
    public static function get($id) {
        global $wpdb;

        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM " . self::table() . " WHERE id = %d",
            $id
        ));
    }

    /* ============================================================
       BUSCAR CONTRATANTE PELO EVENTO
    ============================================================ */
    public static function get_by_event($id_evento) {
        global $wpdb;

        $id_contratante = $wpdb->get_var($wpdb->prepare(
            "SELECT id_contratante FROM {$wpdb->prefix}pm_contratos WHERE id_evento = %d",
            $id_evento
        ));

        if (!$id_contratante) return null;

        return self::get($id_contratante);
    }
}
