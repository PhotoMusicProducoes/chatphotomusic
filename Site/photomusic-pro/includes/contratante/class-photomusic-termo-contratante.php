<?php
// includes/contratante/class-photomusic-termo-contratante.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Termo_Contratante {

    public static function init() {
        add_shortcode('photomusic_termo_contratante', [__CLASS__, 'render_termo']);
        add_action('init', [__CLASS__, 'processar_aceite']);
    }

    /* ============================================================
       VERIFICA SE ESTE DISPOSITIVO JÁ ACEITOU (para este evento)
       Usado no fluxo de acesso — verifica device específico
    ============================================================ */
    public static function device_aceitou($id_evento) {
        global $wpdb;

        $tbl         = $wpdb->prefix . 'pm_aceite_contratante';
        $device_hash = PhotoMusic_Helpers::device_hash();

        return (bool) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $tbl
             WHERE  id_evento   = %d
             AND    device_hash = %s
             LIMIT  1",
            intval($id_evento),
            $device_hash
        ));
    }

    /* ============================================================
       VERIFICA SE ALGUÉM JÁ ACEITOU (para status no painel admin)
       Usado no painel admin para exibir "Termo aceito/pendente"
    ============================================================ */
    public static function contratante_aceitou($id_evento) {
        global $wpdb;

        $tbl = $wpdb->prefix . 'pm_aceite_contratante';

        return (bool) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $tbl
             WHERE  id_evento = %d
             LIMIT  1",
            intval($id_evento)
        ));
    }

    /* ============================================================
       RENDERIZA O TERMO
       Recebe: /termo-contratante/?token=CTR_xxxxx
    ============================================================ */
    public static function render_termo() {

        $token       = sanitize_text_field($_GET['token'] ?? '');
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) {
            return '<p>Link inválido. Solicite um novo link à PhotoMusic.</p>';
        }

        $id_evento = intval($contratante->id_evento);
        $evento    = PhotoMusic_Events::get_event($id_evento);

        if (!$evento || $evento->status_evento === 'desativado') {
            return '<p>Evento não disponível.</p>';
        }

        // Se este device já aceitou, redireciona direto para o painel
        if (self::device_aceitou($id_evento)) {
            wp_redirect(home_url('/painel-contratante/?token=' . urlencode($token)));
            exit;
        }

        // Pré-preenche nome e e-mail do cadastro do contratante
        $nome_pre  = esc_attr($contratante->nome ?? $contratante->razao_social ?? '');
        $email_pre = esc_attr($contratante->email ?? '');

        ob_start();
        ?>
        <div class="pm-termo" style="max-width:640px; margin:30px auto; font-family:system-ui,sans-serif; padding:0 16px;">

            <h2 style="margin-bottom:20px;">Termo de Acesso — Painel do Contratante</h2>

            <p><strong>1. Confidencialidade:</strong>
               O link enviado a você é de uso pessoal e intransferível.
               Ao compartilhar o link, você assume responsabilidade
               por todos os acessos realizados com ele.</p>

            <p><strong>2. Responsabilidade:</strong>
               Você assume total responsabilidade por qualquer acesso
               realizado com este link neste dispositivo.</p>

            <p><strong>3. Proteção de Dados (LGPD):</strong>
               Este dispositivo será registrado com IP, data, hora
               e tipo de equipamento para fins de segurança e auditoria,
               conforme a Lei Geral de Proteção de Dados.</p>

            <p><strong>4. Uso Permitido:</strong>
               O painel é destinado exclusivamente ao acompanhamento
               dos serviços contratados com a PhotoMusic Produções.</p>

            <form method="post" style="margin-top:24px;">
                <?php wp_nonce_field('pm_aceitar_termo_contratante', 'pm_termo_nonce'); ?>
                <input type="hidden" name="pm_aceitar_termo" value="1">
                <input type="hidden" name="pm_token" value="<?php echo esc_attr($token); ?>">

                <p>
                    <label style="font-weight:600;">Confirme seu nome</label><br>
                    <input type="text"
                           name="nome_contratante"
                           value="<?php echo $nome_pre; ?>"
                           required
                           style="width:100%; max-width:400px; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:4px;">
                </p>

                <p>
                    <label style="font-weight:600;">Seu e-mail</label><br>
                    <input type="email"
                           name="email_contratante"
                           value="<?php echo $email_pre; ?>"
                           style="width:100%; max-width:400px; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:4px;">
                </p>

                <p style="font-size:0.85em; color:#666; margin-top:16px;">
                    ℹ️ Este dispositivo será registrado: IP, data/hora e tipo de equipamento.
                </p>

                <button type="submit"
                        style="padding:10px 28px; font-size:1em; background:#2271b1; color:#fff;
                               border:none; border-radius:4px; cursor:pointer; margin-top:8px;">
                    Li e concordo
                </button>
            </form>

        </div>
        <?php
        return ob_get_clean();
    }

    /* ============================================================
       PROCESSA O ACEITE DO TERMO
       Grava device_hash + dados de auditoria na pm_aceite_contratante
    ============================================================ */
    public static function processar_aceite() {

        if (empty($_POST['pm_aceitar_termo'])) return;

        if (!wp_verify_nonce(
            $_POST['pm_termo_nonce'] ?? '',
            'pm_aceitar_termo_contratante'
        )) {
            wp_die('Falha de segurança.');
        }

        global $wpdb;

        $token       = sanitize_text_field($_POST['pm_token'] ?? '');
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) wp_die('Token inválido.');

        $id_evento = intval($contratante->id_evento);
        $evento    = PhotoMusic_Events::get_event($id_evento);

        if (!$evento || $evento->status_evento === 'desativado') {
            wp_die('Evento não disponível.');
        }

        $nome        = sanitize_text_field($_POST['nome_contratante'] ?? '');
        $email       = sanitize_email($_POST['email_contratante'] ?? '');
        $ua          = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $ip          = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $device_hash = PhotoMusic_Helpers::device_hash();
        $navegador   = PhotoMusic_Helpers::detect_browser($ua);
        $dispositivo = PhotoMusic_Helpers::detect_device($ua);
        $tbl         = $wpdb->prefix . 'pm_aceite_contratante';

        // Evita duplo clique: verifica se este device já está registrado
        $ja_existe = $wpdb->get_row($wpdb->prepare(
            "SELECT id, total_acessos FROM $tbl
             WHERE  id_evento   = %d
             AND    device_hash = %s
             LIMIT  1",
            $id_evento,
            $device_hash
        ));

        if ($ja_existe) {
            // Device já registrado — só atualiza contadores
            $wpdb->update(
                $tbl,
                [
                    'ultimo_acesso' => current_time('mysql'),
                    'total_acessos' => intval($ja_existe->total_acessos) + 1,
                ],
                ['id' => $ja_existe->id]
            );
        } else {
            // Novo dispositivo — grava aceite completo
            $wpdb->insert($tbl, [
                'id_evento'         => $id_evento,
                'tipo_evento'       => $contratante->tipo ?? 'PF',
                'nome_contratante'  => $nome,
                'email_contratante' => $email ?: null,
                'ip'                => $ip,
                'navegador'         => $navegador,
                'dispositivo'       => $dispositivo,
                'user_agent'        => $ua,
                'device_hash'       => $device_hash,
                'total_acessos'     => 1,
                'ultimo_acesso'     => current_time('mysql'),
                'aceite_em'         => current_time('mysql'),
                'versao_termo'      => '1.0',
            ]);
        }

        // DEPOIS (6 parâmetros — null adicionado como id_aceite):
        PhotoMusic_Logs::add(
            'aceite_contratante_device',
            $id_evento,
            null,
            null,
            null,
            "Termo aceito. Dispositivo: {$dispositivo} | Navegador: {$navegador} | IP: {$ip}"
        );

        wp_redirect(home_url('/painel-contratante/?token=' . urlencode($token)));
        exit;
    }
}