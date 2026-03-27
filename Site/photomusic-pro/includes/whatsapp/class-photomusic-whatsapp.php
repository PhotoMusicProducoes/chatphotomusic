<?php
// includes/whatsapp/class-photomusic-whatsapp.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_WhatsApp {

    /**
     * Normaliza telefone para o formato Z-API: 5521XXXXXXXXX
     * Aceita todos os formatos: +55 21 96708-2501, (21) 96708-2501, 21967082501, 967082501 etc.
     * DDD padrão = 21 (RJ) para números sem DDD
     */
    public static function normalizar_telefone($telefone, $ddd_padrao = '21') {

        // Remove tudo que não é dígito
        $num = preg_replace('/\D/', '', $telefone);

        // Remove prefixo 0055 se houver
        if (substr($num, 0, 4) === '0055') {
            $num = substr($num, 4);
        }

        // Já começa com 55 e tem 12 ou 13 dígitos → correto
        if (substr($num, 0, 2) === '55' && strlen($num) >= 12) {
            return $num;
        }

        // 11 dígitos: DDD (2) + 9 dígitos  → ex: 21967082501
        // 10 dígitos: DDD (2) + 8 dígitos  → ex: 2196708250
        if (strlen($num) === 11 || strlen($num) === 10) {
            return '55' . $num;
        }

        // 9 dígitos: número com 9 sem DDD  → ex: 967082501
        // 8 dígitos: número com 8 sem DDD  → ex: 96708250
        if (strlen($num) === 9 || strlen($num) === 8) {
            return '55' . $ddd_padrao . $num;
        }

        // Formato desconhecido — retorna apenas dígitos
        return $num;
    }

    /**
     * Envia mensagem via provedor configurado
     */
    public static function send($telefone, $mensagem, $extra = []) {

        $telefone = self::normalizar_telefone($telefone);
        // Decodifica entidades HTML (&amp; → &) e remove tags — WhatsApp usa texto puro
        $mensagem = html_entity_decode(wp_strip_all_tags($mensagem), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        if (empty($telefone)) {
            error_log('[PM WhatsApp] ERRO: telefone vazio após normalização.');
            return new WP_Error('telefone_invalido', 'Telefone inválido.');
        }

        $provider = get_option('pm_whatsapp_provider', 'zapi');

        switch ($provider) {

            case 'zapi':
                $result = self::send_zapi($telefone, $mensagem);
                break;

            case 'lumaboot':
                $result = self::send_lumaboot($telefone, $mensagem);
                break;

            case 'api_generica':
                $result = self::send_generic_api($telefone, $mensagem);
                break;

            case 'dslboot':
            default:
                $result = self::send_dslboot($telefone, $mensagem);
                break;
        }

        // Log
        PhotoMusic_Logs::add(
            'whatsapp_envio',
            $extra['id_evento'] ?? null,
            null,
            null,
            'Envio WhatsApp para ' . $telefone
        );

        return $result;
    }

    /* ============================================================
       Z-API (mesmo chatbot PhotoMusic Pro)
    ============================================================ */
    private static function send_zapi($telefone, $mensagem) {

        $instance     = get_option('pm_zapi_instance');
        $token        = get_option('pm_zapi_token');
        $client_token = get_option('pm_zapi_client_token');

        error_log('[PM WhatsApp] send_zapi → telefone=' . $telefone);
        error_log('[PM WhatsApp] send_zapi → instance=' . ($instance ?: 'VAZIO'));
        error_log('[PM WhatsApp] send_zapi → token=' . ($token ?: 'VAZIO'));
        error_log('[PM WhatsApp] send_zapi → client_token=' . ($client_token ? 'OK' : 'VAZIO'));

        if (!$instance || !$token || !$client_token) {
            error_log('[PM WhatsApp] ERRO: credenciais Z-API não configuradas.');
            return new WP_Error('config_invalida', 'Configuração Z-API ausente.');
        }

        $endpoint = "https://api.z-api.io/instances/{$instance}/token/{$token}/send-text";
        $body     = json_encode(['phone' => $telefone, 'message' => $mensagem]);

        error_log('[PM WhatsApp] send_zapi → endpoint=' . $endpoint);
        error_log('[PM WhatsApp] send_zapi → body=' . $body);

        $response = wp_remote_post($endpoint, [
            'timeout' => 20,
            'headers' => [
                'Content-Type' => 'application/json',
                'client-token' => $client_token,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            error_log('[PM WhatsApp] ERRO wp_remote_post: ' . $response->get_error_message());
            return $response;
        }

        $code     = wp_remote_retrieve_response_code($response);
        $respbody = wp_remote_retrieve_body($response);
        error_log('[PM WhatsApp] send_zapi → HTTP ' . $code . ' resposta=' . $respbody);

        return self::handle_response($response);
    }

    /* ============================================================
       DSLBOOT
    ============================================================ */
    private static function send_dslboot($telefone, $mensagem) {

        $api_url = get_option('pm_dslboot_url');
        $api_key = get_option('pm_dslboot_key');

        if (!$api_url || !$api_key) {
            return new WP_Error('config_invalida', 'Configuração DSLBoot ausente.');
        }

        $response = wp_remote_post($api_url, [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json'
            ],
            'body' => json_encode([
                'phone'    => $telefone,
                'message'  => $mensagem
            ])
        ]);

        return self::handle_response($response);
    }

    /* ============================================================
       LUMABOOT
    ============================================================ */
    private static function send_lumaboot($telefone, $mensagem) {

        $api_url = get_option('pm_lumaboot_url');
        $api_key = get_option('pm_lumaboot_key');

        if (!$api_url || !$api_key) {
            return new WP_Error('config_invalida', 'Configuração LumaBoot ausente.');
        }

        $response = wp_remote_post($api_url, [
            'timeout' => 20,
            'headers' => [
                'apikey'       => $api_key,
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode([
                'number'   => $telefone,
                'message'  => $mensagem
            ])
        ]);

        return self::handle_response($response);
    }

    /* ============================================================
       API GENÉRICA
    ============================================================ */
    private static function send_generic_api($telefone, $mensagem) {

        $api_url = get_option('pm_generic_api_url');
        $api_key = get_option('pm_generic_api_key');

        if (!$api_url || !$api_key) {
            return new WP_Error('config_invalida', 'Configuração da API genérica ausente.');
        }

        $response = wp_remote_post($api_url, [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json'
            ],
            'body' => json_encode([
                'to'      => $telefone,
                'message' => $mensagem
            ])
        ]);

        return self::handle_response($response);
    }

    /* ============================================================
       TRATAMENTO DE RESPOSTA
    ============================================================ */
    private static function handle_response($response) {

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code >= 200 && $code < 300) {
            return ['sucesso' => true, 'resposta' => $body];
        }

        return new WP_Error('erro_envio', 'Falha ao enviar mensagem: ' . $body);
    }

    /* ============================================================
       TEMPLATE DE MENSAGEM
    ============================================================ */
    public static function build_message($template, $vars = []) {
        foreach ($vars as $key => $value) {
            $template = str_replace('{' . $key . '}', $value, $template);
        }
        return $template;
    }

    /* ============================================================
       ENVIO DE PDF VIA Z-API
    ============================================================ */
    public static function send_pdf_zapi($telefone, $mensagem, $url_pdf) {

        $telefone = self::normalizar_telefone($telefone);

        if (!filter_var($url_pdf, FILTER_VALIDATE_URL)) {
            return new WP_Error('url_invalida', 'URL do PDF inválida.');
        }

        $instance     = get_option('pm_zapi_instance');
        $token        = get_option('pm_zapi_token');
        $client_token = get_option('pm_zapi_client_token');

        if (!$instance || !$token || !$client_token) {
            return new WP_Error('config_invalida', 'Configuração Z-API ausente.');
        }

        $endpoint = "https://api.z-api.io/instances/{$instance}/token/{$token}/send-document";

        $response = wp_remote_post($endpoint, [
            'timeout' => 20,
            'headers' => [
                'Content-Type' => 'application/json',
                'client-token' => $client_token,
            ],
            'body' => json_encode([
                'phone'    => $telefone,
                'document' => $url_pdf,
                'filename' => basename($url_pdf),
                'caption'  => $mensagem,
            ])
        ]);

        return self::handle_response($response);
    }
}
