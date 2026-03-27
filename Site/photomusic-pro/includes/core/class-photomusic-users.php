<?php
// includes/core/class-photomusic-users.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Users {

    public static function init() {
        // No futuro podemos adicionar telas próprias de gestão de usuários
        // Por enquanto, usamos roles e capabilities do WordPress.
    }

    /**
     * Verifica permissão customizada
     */
    public static function current_user_can($cap) {
        if (current_user_can('administrator')) return true;
        return current_user_can($cap);
    }

    /**
     * Verifica se é administrador PhotoMusic
     */
    public static function is_admin() {
        if (current_user_can('administrator')) return true;
        return current_user_can('pm_gerenciar_usuarios');
    }

    /**
     * Verifica se é usuário PhotoMusic
     */
    public static function is_user() {
        return current_user_can('pm_ver_eventos');
    }

    /**
     * Pode criar eventos?
     */
    public static function can_create_event() {
        return current_user_can('pm_criar_eventos');
    }

    /**
     * Pode editar eventos?
     */
    public static function can_edit_event() {
        return current_user_can('pm_editar_eventos');
    }

    /**
     * Pode desativar eventos?
     */
    public static function can_disable_event() {
        return current_user_can('pm_desativar_eventos');
    }

    /**
     * Pode ver logs?
     */
    public static function can_view_logs() {
        return current_user_can('pm_ver_logs');
    }

    /**
     * Retorna o usuário logado
     */
    public static function get_current_user() {
        return wp_get_current_user();
    }

    /**
     * Verifica se o usuário é contratante (painel do contratante)
     */
    public static function is_contractor() {
        return isset($_SESSION) && isset($_SESSION['pm_contratante_evento']);
    }

    /**
     * Verifica se o contratante pode acessar um evento específico
     */
    public static function contractor_can_access_event($id_evento) {
        $id_evento = intval($id_evento);

        return self::is_contractor()
            && $id_evento > 0
            && intval($_SESSION['pm_contratante_evento']) === $id_evento;
    }

}
