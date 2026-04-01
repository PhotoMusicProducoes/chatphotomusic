<?php
// includes/contratante/class-photomusic-aceites.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Aceites {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    /**
     * Registra rotas REST para aceites
     */
    public static function register_routes() {
        register_rest_route('photomusic/v1', '/aceite', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'handle_aceite'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Recebe o aceite do convidado via API
     */
    public static function handle_aceite($request) {
        global $wpdb;

        $dados = $request->get_json_params();

        $token = sanitize_text_field($dados['tokenConvite'] ?? '');
        if (empty($token)) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Token ausente.'
            ];
        }

        /* ============================================================
           1. Localizar convite pelo token
        ============================================================ */
        $tbl_convites = $wpdb->prefix . 'pm_convites';

        $convite = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_convites WHERE token_convite = %s",
            $token
        ));

        if (!$convite) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Convite não encontrado.'
            ];
        }

        $id_evento = intval($convite->id_evento);

        /* ============================================================
           2. Validar evento
        ============================================================ */
        $evento = PhotoMusic_Events::get_event($id_evento);
        if (!$evento) {
            return [
                'sucesso'  => false,
                'mensagem' => 'Evento não encontrado.'
            ];
        }

        if ($evento->status_evento === 'desativado') {
            return [
                'sucesso'  => false,
                'mensagem' => 'Este evento está desativado.'
            ];
        }

        /* ============================================================
           3. Localizar serviço pelo token (via tabela de acessos)
        ============================================================ */
        $tbl_acessos = $wpdb->prefix . 'pm_acessos_galeria';

        $acesso = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_acessos WHERE token_acesso = %s",
            $token
        ));

        $id_servico = $acesso ? intval($acesso->id_servico) : null;

        /* ============================================================
           4. Coletar dados do aceite
        ============================================================ */
        $nome     = sanitize_text_field($dados['nome'] ?? $convite->nome_convidado);
        $telefone = preg_replace('/\D/', '', ($dados['telefone'] ?? $convite->telefone));
        $email    = sanitize_email($dados['email'] ?? $convite->email);
        $idioma   = sanitize_text_field($dados['idioma'] ?? $convite->idioma_preferido);

        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        $navegador = self::detect_browser($ua);
        $so        = self::detect_os($ua);
        $device    = self::detect_device($ua);

        /* ============================================================
            5. Registrar aceite (1 por evento, independente do token)
            Regras:
            - 1 aceite por evento por pessoa
            - Verifica por telefone, email ou id_convite
        ============================================================ */

        $tbl_aceites = $wpdb->prefix . 'pm_aceites';

        // Procurar aceite existente
        $aceite_existente = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $tbl_aceites 
                 WHERE id_evento = %d 
                 AND (
                     telefone = %s
                     OR email = %s
                     OR id_convite = %d
                 )
                 ORDER BY id DESC LIMIT 1",
                $id_evento,
                $telefone,
                $email,
                $convite->id
            )
        );

        if ($aceite_existente) {

            // Atualiza dados do aceite existente
            $wpdb->update(
                $tbl_aceites,
                [
                    'ip'                  => $ip,
                    'navegador'           => $navegador,
                    'sistema_operacional' => $so,
                    'dispositivo'         => $device,
                    'user_agent'          => $ua,
                    'idioma_navegador'    => $idioma,
                    'atualizado_em'       => current_time('mysql'),
                ],
                ['id' => $aceite_existente->id]
            );

            if (class_exists('PhotoMusic_Logs')) {
                PhotoMusic_Logs::add(
                    'aceite',
                    $id_evento,
                    $convite->id,
                    $aceite_existente->id,
                    'Aceite já existia para este evento. Dados atualizados e reutilizados.'
                );
            }

            return [
                'sucesso'     => true,
                'mensagem'    => 'Aceite já registrado anteriormente.',
                'id_aceite'   => intval($aceite_existente->id),
                'reutilizado' => true
            ];
        }

        // Criar novo aceite
        $wpdb->insert($tbl_aceites, [
            'id_convite'          => $convite->id,
            'id_evento'           => $id_evento,
            'id_servico'          => $id_servico,
            'id_termos_versao'    => null,
            'nome'                => $nome,
            'telefone'            => $telefone,
            'email'               => $email,
            'ip'                  => $ip,
            'pais'                => $dados['pais']   ?? null,
            'estado'              => $dados['estado'] ?? null,
            'cidade'              => $dados['cidade'] ?? null,
            'navegador'           => $navegador,
            'sistema_operacional' => $so,
            'dispositivo'         => $device,
            'user_agent'          => $ua,
            'idioma_navegador'    => $idioma,
            'canal_origem'        => $convite->canal_origem,
            'aceite_em'           => current_time('mysql'),
            'status_envio'        => 'pendente',
            'criado_em'           => current_time('mysql'),
        ]);

        $id_aceite = (int) $wpdb->insert_id;

        /* ============================================================
           6. Registrar log
        ============================================================ */
        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add(
                'aceite',
                $id_evento,
                $convite->id,
                $id_aceite,
                'Aceite registrado via API.'
            );
        }

        return [
            'sucesso'   => true,
            'mensagem'  => 'Aceite registrado com sucesso.',
            'id_aceite' => $id_aceite
        ];
    }

    /* ============================================================
       Funções auxiliares
    ============================================================ */

    private static function detect_browser($ua) {
        if (stripos($ua, 'Chrome') !== false)  return 'Chrome';
        if (stripos($ua, 'Firefox') !== false) return 'Firefox';
        if (stripos($ua, 'Safari') !== false)  return 'Safari';
        if (stripos($ua, 'Edge') !== false)    return 'Edge';
        return 'Desconhecido';
    }

    private static function detect_os($ua) {
        if (stripos($ua, 'Windows') !== false) return 'Windows';
        if (stripos($ua, 'Mac') !== false)     return 'MacOS';
        if (stripos($ua, 'Android') !== false) return 'Android';
        if (stripos($ua, 'iPhone') !== false)  return 'iOS';
        return 'Desconhecido';
    }

    private static function detect_device($ua) {
        if (stripos($ua, 'iPhone') !== false)  return 'iPhone';
        if (stripos($ua, 'iPad') !== false)    return 'iPad';
        if (stripos($ua, 'Android') !== false) return 'Android';
        return 'Desktop';
    }

    /**
     * Relatório HTML de aceites por evento (uso interno/admin)
     */
    public static function render_relatorio() {
        global $wpdb;

        $eventos = $wpdb->get_results(
            "SELECT id, motivo_evento, data_evento 
             FROM {$wpdb->prefix}pm_eventos 
             ORDER BY data_evento DESC"
        );

        echo '<div class="wrap"><h1>Relatório de Aceites</h1>';

        foreach ($eventos as $evento) {

            echo '<h2>Evento: ' . esc_html($evento->motivo_evento) . ' (' . date('d/m/Y', strtotime($evento->data_evento)) . ')</h2>';

            $aceites = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}pm_aceites_evento
                     WHERE id_evento = %d
                     GROUP BY telefone, email
                     ORDER BY aceite_em DESC",
                    $evento->id
                )
            );

            if (!$aceites) {
                echo '<p>Nenhum aceite registrado.</p>';
                continue;
            }

            echo '<table class="widefat striped">';
            echo '<thead><tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>IP</th>
                    <th>Dispositivo</th>
                    <th>Navegador</th>
                    <th>Data do Aceite</th>
                </tr></thead><tbody>';

            foreach ($aceites as $a) {
                echo '<tr>
                        <td>' . esc_html($a->nome) . '</td>
                        <td>' . esc_html($a->telefone) . '</td>
                        <td>' . esc_html($a->email) . '</td>
                        <td>' . esc_html($a->ip) . '</td>
                        <td>' . esc_html($a->dispositivo) . '</td>
                        <td>' . esc_html($a->navegador) . '</td>
                        <td>' . ($a->aceite_em ? date('d/m/Y H:i', strtotime($a->aceite_em)) : '—') . '</td>
                    </tr>';
            }

            echo '</tbody></table><br><hr>';
        }

        echo '</div>';
    }

}
