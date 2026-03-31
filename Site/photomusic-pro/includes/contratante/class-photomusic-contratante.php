<?php
// includes/contratante/class-photomusic-contratante.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratante {

    /* ============================================================
       INIT
    ============================================================ */
    public static function init() {
        add_shortcode('photomusic_acesso_contratante', [__CLASS__, 'render_acesso']);
        add_shortcode('photomusic_sair_contratante',   [__CLASS__, 'render_logout']);
    }

    /* ============================================================
       VALIDA TOKEN — retorna objeto com contratante + evento
    ============================================================ */
    public static function validate_token($token) {
        global $wpdb;

        $token = sanitize_text_field($token);
        if (empty($token)) return null;

        return $wpdb->get_row($wpdb->prepare(
            "SELECT c.*,
                    e.id            AS id_evento,
                    e.status_evento,
                    e.motivo_evento,
                    e.data_evento
             FROM   {$wpdb->prefix}pm_contratantes c
             JOIN   {$wpdb->prefix}pm_contratos ct
                    ON ct.id_contratante = c.id
             JOIN   {$wpdb->prefix}pm_eventos e
                    ON e.id = ct.id_evento
             WHERE  c.token_acesso = %s
             LIMIT  1",
            $token
        ));
    }

    /* ============================================================
       VERIFICA SE ESTE DISPOSITIVO JÁ ACEITOU O TERMO
    ============================================================ */
    public static function device_aceitou($id_evento) {
        global $wpdb;

        $device_hash = PhotoMusic_Helpers::device_hash();
        $tbl         = $wpdb->prefix . 'pm_aceite_contratante';

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
       REGISTRA OU ATUALIZA ACESSO DO DISPOSITIVO
       Chamado a cada visita ao painel após o primeiro aceite
    ============================================================ */
    public static function registrar_acesso($id_evento) {
        global $wpdb;

        $device_hash = PhotoMusic_Helpers::device_hash();
        $tbl         = $wpdb->prefix . 'pm_aceite_contratante';

        $registro = $wpdb->get_row($wpdb->prepare(
            "SELECT id, total_acessos FROM $tbl
             WHERE  id_evento   = %d
             AND    device_hash = %s
             LIMIT  1",
            intval($id_evento),
            $device_hash
        ));

        if ($registro) {
            $wpdb->update(
                $tbl,
                [
                    'ultimo_acesso' => current_time('mysql'),
                    'total_acessos' => intval($registro->total_acessos) + 1,
                ],
                ['id' => $registro->id]
            );
        }
    }

    /* ============================================================
       SHORTCODE — PONTO DE ENTRADA DO CONTRATANTE
       [photomusic_acesso_contratante]

       URL recebida via WhatsApp:
       /painel-contratante/?token=CTR_xxxxx

       Fluxo:
         1. Lê ?token= da URL
         2. Valida token → carrega contratante + evento
         3. Evento desativado → mensagem
         4. Device não aceitou o termo → redireciona /termo-contratante/
         5. Device conhecido → registra acesso + redireciona /painel-contratante/
    ============================================================ */
    public static function render_acesso() {

        $token = sanitize_text_field($_GET['token'] ?? '');

        if (empty($token)) {
            return '<p>Link inválido. Solicite um novo link à PhotoMusic.</p>';
        }

        $contratante = self::validate_token($token);

        if (!$contratante) {
            return '<p>Link inválido ou não reconhecido. Solicite um novo link à PhotoMusic.</p>';
        }

        $id_evento = intval($contratante->id_evento);

        if ($contratante->status_evento === 'desativado') {
            return '<p>Este evento foi encerrado.</p>';
        }

        // Dispositivo ainda não aceitou o termo → exibir termo
        if (!self::device_aceitou($id_evento)) {
            wp_redirect(home_url('/termo-contratante/?token=' . urlencode($token)));
            exit;
        }

        // Dispositivo já conhecido → registra visita e entra no painel
        self::registrar_acesso($id_evento);

        wp_redirect(home_url('/painel-contratante/?token=' . urlencode($token)));
        exit;
    }

    /* ============================================================
       ENVIO DE WHATSAPP PARA CONTRATANTE
       Link agora usa ?token= em vez de ?evento=ID
    ============================================================ */
    public static function enviar_whatsapp_contratante($id_evento) {

        $contratante = PhotoMusic_Contratantes::get_by_event($id_evento);
        if (!$contratante) {
            return new WP_Error('contratante_inexistente', 'Contratante não encontrado.');
        }

        $telefone = preg_replace('/\D/', '', $contratante->telefone ?? '');
        if (empty($telefone)) {
            return new WP_Error('telefone_vazio', 'O contratante não possui telefone cadastrado.');
        }

        $template = get_option('pm_msg_contratante');
        if (empty($template)) {
            return new WP_Error('template_vazio', 'Nenhuma mensagem padrão configurada.');
        }

        $token = $contratante->token_acesso ?? '';
        if (empty($token)) {
            return new WP_Error('token_vazio', 'Token do contratante não gerado. Edite o evento para gerar o token.');
        }

        // Envia para o ponto de entrada — valida token, verifica termo, redireciona ao painel
        $link = home_url('/acesso-do-contratante/?token=' . urlencode($token));

        $nome = $contratante->nome_fantasia
            ?? $contratante->nome
            ?? 'Cliente';

        $mensagem = PhotoMusic_WhatsApp::build_message($template, [
            'nome'   => $nome,
            'evento' => $id_evento,
            'link'   => $link,
        ]);

        return PhotoMusic_WhatsApp::send(
            $telefone,
            $mensagem,
            ['id_evento' => $id_evento]
        );
    }
    /* ============================================================
        SHORTCODE — PÁGINA DE SAÍDA DO CONTRATANTE
        [photomusic_sair_contratante]
        URL: /sair-contratante/?token=CTR_xxxxx
    ============================================================ */
    public static function render_logout() {

        $token = sanitize_text_field($_GET['token'] ?? '');

        ob_start();
        ?>
        <div style="text-align:center; padding:40px 20px;
                    font-family:system-ui,sans-serif;">
            <h2>Você saiu do painel</h2>
            <p>Suas informações foram registradas com segurança.</p>
            <?php if ($token): ?>
                <a href="<?php echo esc_url(home_url('/painel-contratante/?token=' . urlencode($token))); ?>"
                style="display:inline-block; margin-top:16px; padding:10px 24px;
                        background:#2271b1; color:#fff; border-radius:4px;
                        text-decoration:none; font-size:15px;">
                    Voltar ao painel
                </a>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }
}