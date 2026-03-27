<?php
// photomusic-aceite/photomusic-aceite.php

/**
 * Plugin Name: PhotoMusic Aceite
 * Description: Endpoint para registrar aceite de convidados e salvar no banco de dados.
 * Version: 1.0
 * Author: PhotoMusic Produções
 */

if (!defined('ABSPATH')) exit;

// ---------------------------------------------------------
// 1. CRIAÇÃO DA TABELA NO BANCO AO ATIVAR O PLUGIN
// ---------------------------------------------------------
function photomusic_aceite_create_table() {
    global $wpdb;

    $table = $wpdb->prefix . "photomusic_aceites";
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        nome VARCHAR(200) NULL,
        telefone VARCHAR(30) NOT NULL,
        email VARCHAR(200) NULL,
        idioma VARCHAR(10) NOT NULL,
        token_convite VARCHAR(200) NULL,
        id_evento VARCHAR(200) NULL,
        ip VARCHAR(50) NULL,
        user_agent TEXT NULL,
        data_aceite DATETIME NOT NULL,
        versao_termos VARCHAR(10) DEFAULT '1.0',
        canal_origem VARCHAR(50) DEFAULT 'formulario',
        PRIMARY KEY (id)
    ) $charset;";

    require_once(ABSPATH . "wp-admin/includes/upgrade.php");
    dbDelta($sql);
}
register_activation_hook(__FILE__, "photomusic_aceite_create_table");


// ---------------------------------------------------------
// 2. REGISTRA O ENDPOINT REST API
// ---------------------------------------------------------
add_action('rest_api_init', function () {
    register_rest_route('photomusic/v1', '/aceite', [
        'methods'  => 'POST',
        'callback' => 'photomusic_registrar_aceite',
        'permission_callback' => '__return_true'
    ]);
});


// ---------------------------------------------------------
// 3. FUNÇÃO QUE RECEBE E SALVA O ACEITE
// ---------------------------------------------------------
function photomusic_registrar_aceite($request) {
    global $wpdb;
    $table = $wpdb->prefix . "photomusic_aceites";

    $dados = $request->get_json_params();

    $nome     = sanitize_text_field($dados['nome'] ?? '');
    $telefone = sanitize_text_field($dados['telefone'] ?? '');
    $email    = sanitize_email($dados['email'] ?? '');
    $idioma   = sanitize_text_field($dados['idioma'] ?? 'pt');
    $token    = sanitize_text_field($dados['tokenConvite'] ?? '');
    $evento   = sanitize_text_field($dados['idEvento'] ?? '');

    if (empty($telefone)) {
        return [
            "sucesso" => false,
            "mensagem" => "Telefone é obrigatório."
        ];
    }

    // Normaliza telefone
    $telefone = preg_replace('/\D/', '', $telefone);

    // Captura IP e User Agent
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

    // Salva no banco
    $wpdb->insert($table, [
        'nome'         => $nome,
        'telefone'     => $telefone,
        'email'        => $email,
        'idioma'       => $idioma,
        'token_convite'=> $token,
        'id_evento'    => $evento,
        'ip'           => $ip,
        'user_agent'   => $ua,
        'data_aceite'  => current_time('mysql'),
        'versao_termos'=> '1.0',
        'canal_origem' => 'formulario'
    ]);

    // Aqui você pode integrar com o BOT
    // Exemplo:
    // wp_remote_post("https://seu-bot.com/webhook", [
    //     "body" => json_encode([
    //         "telefone" => $telefone,
    //         "evento"   => $evento,
    //         "token"    => $token
    //     ]),
    //     "headers" => ["Content-Type" => "application/json"]
    // ]);

    return [
        "sucesso" => true,
        "mensagem" => "Aceite registrado com sucesso."
    ];
}
