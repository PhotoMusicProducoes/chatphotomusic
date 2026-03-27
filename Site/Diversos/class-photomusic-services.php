<?php
// includes/servicos/class-photomusic-services.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Services {

    public static function init() {
        // No futuro podemos adicionar endpoints, hooks, etc.
    }

    /**
     * Cria um serviço dentro de um evento
     *
     * $data esperado:
     * - id_evento
     * - nome_servico
     * - slug_servico
     * - tipo (foto, video, 360, gif, outro)
     * - regras_acesso (array)
     * - pasta_protegida
     */
    public static function create_service($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_event_services';

        if (empty($data['id_evento']) || empty($data['nome_servico']) || empty($data['slug_servico'])) {
            return new WP_Error('dados_incompletos', 'Dados insuficientes para criar o serviço.');
        }

        $id_evento     = intval($data['id_evento']);
        $nome_servico  = sanitize_text_field($data['nome_servico']);
        $slug_servico  = sanitize_title($data['slug_servico']);
        $tipo          = sanitize_text_field($data['tipo'] ?? 'foto');
        $pasta         = sanitize_text_field($data['pasta_protegida'] ?? '');

        // Regras de acesso (JSON)
        $regras = !empty($data['regras_acesso']) ? wp_json_encode($data['regras_acesso']) : wp_json_encode([]);

        // Geração dos links protegidos
        $link_convidado = home_url("/galeria/$slug_servico/");
        $link_contratante = home_url("/painel/galeria/$slug_servico/");

        $wpdb->insert($table, [
            'id_evento'        => $id_evento,
            'nome_servico'     => $nome_servico,
            'slug_servico'     => $slug_servico,
            'tipo'             => $tipo,
            'status_servico'   => 'ativo',
            'link_convidado'   => $link_convidado,
            'link_contratante' => $link_contratante,
            'regras_acesso'    => $regras,
            'pasta_protegida'  => $pasta,
            'criado_em'        => current_time('mysql'),
        ]);

        if (!$wpdb->insert_id) {
            return new WP_Error('erro_criar_servico', 'Não foi possível criar o serviço.');
        }

        return (int) $wpdb->insert_id;
    }

    /**
     * Atualiza um serviço
     */
    public static function update_service($id_servico, $data) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_event_services';

        $id_servico = intval($id_servico);
        if ($id_servico <= 0) {
            return new WP_Error('id_invalido', 'ID de serviço inválido.');
        }

        $update = [];

        if (isset($data['nome_servico'])) {
            $update['nome_servico'] = sanitize_text_field($data['nome_servico']);
        }

        if (isset($data['slug_servico'])) {
            $update['slug_servico'] = sanitize_title($data['slug_servico']);
        }

        if (isset($data['tipo'])) {
            $update['tipo'] = sanitize_text_field($data['tipo']);
        }

        if (isset($data['status_servico']) && in_array($data['status_servico'], ['ativo', 'desativado'], true)) {
            $update['status_servico'] = $data['status_servico'];
        }

        if (isset($data['pasta_protegida'])) {
            $update['pasta_protegida'] = sanitize_text_field($data['pasta_protegida']);
        }

        if (isset($data['regras_acesso'])) {
            $update['regras_acesso'] = wp_json_encode($data['regras_acesso']);
        }

        if (empty($update)) {
            return true;
        }

        $result = $wpdb->update($table, $update, ['id' => $id_servico]);

        if ($result === false) {
            return new WP_Error('erro_atualizar_servico', 'Não foi possível atualizar o serviço.');
        }

        return true;
    }

    /**
     * Retorna um serviço pelo ID
     */
    public static function get_service($id_servico) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_event_services';

        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d",
            intval($id_servico)
        ));
    }

    /**
     * Retorna todos os serviços de um evento
     */
    public static function get_services_by_event($id_evento, $apenas_ativos = false) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_event_services';

        $id_evento = intval($id_evento);

        if ($apenas_ativos) {
            return $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM $table WHERE id_evento = %d AND status_servico = 'ativo' ORDER BY id ASC",
                $id_evento
            ));
        }

        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE id_evento = %d ORDER BY id ASC",
            $id_evento
        ));
    }

    /**
     * Ativa ou desativa um serviço
     */
    public static function set_service_status($id_servico, $status) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_event_services';

        if (!in_array($status, ['ativo', 'desativado'], true)) {
            return new WP_Error('status_invalido', 'Status inválido.');
        }

        $result = $wpdb->update($table, [
            'status_servico' => $status
        ], [
            'id' => intval($id_servico)
        ]);

        if ($result === false) {
            return new WP_Error('erro_status_servico', 'Não foi possível alterar o status do serviço.');
        }

        return true;
    }

    /**
     * Retorna as regras de acesso já decodificadas
     */
    public static function get_access_rules($id_servico) {
        $servico = self::get_service($id_servico);
        if (!$servico) return null;

        return json_decode($servico->regras_acesso, true);
    }
}
