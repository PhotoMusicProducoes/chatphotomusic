<?php
// includes/empresa/class-photomusic-helpers-representantes.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Helpers_Representantes {

    /* ============================================================
       RETORNA O REPRESENTANTE LEGAL PADRÃO
       ============================================================ */
    public static function get_representante_padrao() {

        $args = [
            'meta_key'   => PhotoMusic_Representantes::META_FLAG,
            'meta_value' => 1,
            'number'     => 1,
            'orderby'    => 'ID',
            'order'      => 'ASC'
        ];

        $users = get_users($args);

        return $users ? $users[0] : null;
    }

    /* ============================================================
       RETORNA TODOS OS REPRESENTANTES LEGAIS
       ============================================================ */
    public static function get_todos() {

        $args = [
            'meta_key'   => PhotoMusic_Representantes::META_FLAG,
            'meta_value' => 1,
            'number'     => -1,
            'orderby'    => 'display_name',
            'order'      => 'ASC'
        ];

        return get_users($args);
    }

    /* ============================================================
       RETORNA OS DADOS COMPLETOS DE UM REPRESENTANTE
       ============================================================ */
    public static function get_dados($user_id) {

        $user = get_userdata($user_id);

        if (!$user) {
            return null;
        }

        return [
            'id'       => $user_id,
            'nome'     => $user->display_name,
            'email'    => $user->user_email,
            'cargo'    => get_user_meta($user_id, PhotoMusic_Representantes::META_CARGO, true),
            'cpf'      => get_user_meta($user_id, PhotoMusic_Representantes::META_CPF, true),
            'telefone' => get_user_meta($user_id, PhotoMusic_Representantes::META_TEL, true),
            'pode_assinar' => get_user_meta($user_id, PhotoMusic_Representantes::META_ASSINA, true) == 1,
        ];
    }

    /* ============================================================
       VERIFICA SE O USUÁRIO PODE ASSINAR CONTRATOS
       ============================================================ */
    public static function usuario_pode_assinar($user_id) {

        return get_user_meta($user_id, PhotoMusic_Representantes::META_FLAG,  true) == 1
            && get_user_meta($user_id, PhotoMusic_Representantes::META_ASSINA, true) == 1;
    }

    /* ============================================================
       RETORNA DADOS FORMATADOS PARA PDF
       ============================================================ */
    public static function get_dados_para_pdf() {

        $rep = self::get_representante_padrao();

        if (!$rep) {
            return null;
        }

        return self::get_dados($rep->ID);
    }
}
