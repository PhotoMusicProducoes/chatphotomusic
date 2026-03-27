<?php
// includes/contratos/class-photomusic-contratos-shortcode.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Shortcode {

    /* ============================================================
       INICIALIZA O SHORTCODE E O PROCESSADOR DE ASSINATURA
       ============================================================ */
    public static function init() {
        add_shortcode('photomusic_contrato', [__CLASS__, 'render_shortcode']);
        // processar_assinatura() precisa rodar no hook init.
        // Como esta classe é inicializada dentro do próprio hook init,
        // chamamos diretamente em vez de add_action('init', ...) que seria tarde demais.
        self::processar_assinatura();
    }

    /* ============================================================
       PROCESSA A ASSINATURA DO CONTRATANTE (POST)
       ============================================================ */
    public static function processar_assinatura() {

        if (empty($_POST['pm_contrato_assinar'])) {
            return;
        }

        // Segurança
        if (!isset($_POST['pm_contrato_nonce']) ||
            !wp_verify_nonce($_POST['pm_contrato_nonce'], 'pm_assinar_contrato')) {
            wp_die('Falha de segurança.');
        }

        $token = sanitize_text_field($_POST['token']);
        $nome  = sanitize_text_field($_POST['nome_assinatura']);
        $nome  = substr($nome, 0, 200);

        if (strlen($nome) < 5) {
            wp_die('Nome muito curto para assinatura.');
        }

        // Token precisa ser hex de 32 chars
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
            wp_die('Token inválido.');
        }

        $contrato = PhotoMusic_Contratos::get_by_token($token);

        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        /* ============================================================
           BLOQUEIOS DE SEGURANÇA
        ============================================================ */

        // Contrato cancelado
        if ($contrato->status_contrato === 'cancelado') {
            wp_die('Este contrato foi cancelado e não pode ser assinado.');
        }

        // Contrato dispensado
        if ($contrato->tipo_contrato === 'simplificado') {
            wp_die('Este contrato não requer assinatura.');
        }

        // Empresa ainda não assinou
        if (empty($contrato->assinatura_admin_data)) {
            wp_die('Aguarde: este contrato ainda está em validação interna pela empresa.');
        }

        // Status incorreto
        if (!in_array($contrato->status_contrato, [
            'assinado_admin',
            'aguardando_assinatura_contratante'
        ])) {
            wp_die('Este contrato não está disponível para assinatura no momento.');
        }

        // Já assinado pelo cliente
        if (!empty($contrato->assinatura_contratante_data)) {
            wp_redirect(add_query_arg(['assinatura' => 'ok'], wp_get_referer()));
            exit;
        }

        /* ============================================================
           REGISTRA ASSINATURA
        ============================================================ */

        $ip        = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $useragent = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        PhotoMusic_Contratos::registrar_assinatura_contratante(
            $contrato->id,
            $nome,
            $ip,
            $useragent
        );

        // Atualiza hash
        PhotoMusic_Contratos::atualizar_hash_contrato($contrato->id);

        // Histórico do evento
        if (class_exists('PhotoMusic_Event_History')) {
            PhotoMusic_Event_History::add(
                $contrato->id_evento,
                'contrato_assinado_contratante',
                'Contrato assinado pelo contratante: ' . $nome
            );
        }

        // Log do sistema
        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add(
                'contrato_assinado_contratante',
                null,
                $contrato->id_evento,
                $contrato->id,
                "Assinatura do contratante registrada. Nome: {$nome}, IP: {$ip}"
            );
        }

        // Atualiza status final (direto no DB para não exigir permissão de admin)
        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['status_contrato' => 'assinado', 'atualizado_em' => current_time('mysql')],
            ['id' => $contrato->id]
        );

        // Atualiza status do evento
        if (class_exists('PhotoMusic_Events')) {
            PhotoMusic_Events::update_status($contrato->id_evento, 'contrato_assinado');
        }

        // Recarrega contrato atualizado
        $contrato = PhotoMusic_Contratos::get($contrato->id);

        // Gera PDF final
        if (class_exists('PhotoMusic_Contratos_PDF')) {
            PhotoMusic_Contratos_PDF::gerar_pdf($contrato);
        }

        // Gera Ordem de Serviço
        if (class_exists('PhotoMusic_OS')) {
            PhotoMusic_OS::gerar_os($contrato);
        }

        // Envia contrato ao cliente via WhatsApp automaticamente
        if (class_exists('PhotoMusic_Contratantes') && class_exists('PhotoMusic_WhatsApp')) {
            $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
            if ($contratante) {
                $tel = preg_replace('/\D/', '', $contratante->telefone ?? '');
                $contrato_final = PhotoMusic_Contratos::get($contrato->id);
                if ($tel && !empty($contrato_final->pdf_final)) {
                    PhotoMusic_WhatsApp::send_pdf(
                        $tel,
                        "✅ Parabéns! Seu contrato foi assinado com sucesso. Segue uma cópia para seus registros.",
                        $contrato_final->pdf_final,
                        ['id_evento' => $contrato->id_evento]
                    );
                }
            }
        }

        // Redireciona com sucesso
        wp_redirect(add_query_arg(['assinatura' => 'ok'], wp_get_referer()));
        exit;
    }

    /* ============================================================
       RENDERIZA O SHORTCODE [photomusic_contrato]
       ============================================================ */
    public static function render_shortcode() {

        // Aceita token via rewrite rule (pm_contrato_token) ou via $_GET direto
        $token = get_query_var('pm_contrato_token');
        if (!$token) {
            $token = sanitize_text_field($_GET['token'] ?? '');
        }

        if (!$token) {
            return '<p>Token inválido.</p>';
        }

        $contrato = PhotoMusic_Contratos::get_by_token($token);

        if (!$contrato) {
            return '<p>Contrato não encontrado.</p>';
        }

        /* ============================================================
           BLOQUEIOS DE EXIBIÇÃO
        ============================================================ */

        // Contrato cancelado
        if ($contrato->status_contrato === 'cancelado') {
            return '<p><strong>Este contrato foi cancelado.</strong></p>';
        }

        // Contrato dispensado
        if ($contrato->tipo_contrato === 'simplificado') {
            return '<p><strong>Este contrato não requer assinatura.</strong></p>';
        }

        // Empresa ainda não assinou
        if (empty($contrato->assinatura_admin_data)) {
            return '<p><strong>Aguarde: este contrato ainda está em validação interna pela empresa.</strong></p>';
        }

        // Contrato já assinado
        if (!empty($contrato->assinatura_contratante_data)) {
            return '<p><strong>Este contrato já foi assinado.</strong></p>';
        }

        // Assinatura concluída agora
        if (!empty($_GET['assinatura']) && $_GET['assinatura'] === 'ok') {
            return '<p><strong>Assinatura registrada com sucesso!</strong></p>';
        }

        /* ============================================================
           RENDERIZAÇÃO DO CONTRATO + FORMULÁRIO
        ============================================================ */

        ob_start();
        ?>

        <div class="pm-contrato-container">

            <!-- Conteúdo do contrato -->
            <div class="pm-contrato-html">
                <?php echo wp_kses_post($contrato->conteudo); ?>
            </div>

            <hr>

            <!-- Formulário de assinatura -->
            <h3>Assinatura do Contratante</h3>

            <form method="post">

                <?php wp_nonce_field('pm_assinar_contrato', 'pm_contrato_nonce'); ?>

                <input type="hidden" name="pm_contrato_assinar" value="1">
                <input type="hidden" name="token" value="<?php echo esc_attr($token); ?>">

                <p>
                    <label>Nome completo para assinatura:</label><br>
                    <input type="text" name="nome_assinatura" required style="width:100%; max-width:400px;">
                </p>

                <p>
                    <label>
                        <input type="checkbox" required>
                        Confirmo que li e concordo com os termos deste contrato.
                    </label>
                </p>

                <p>
                    <button type="submit" class="button button-primary">
                        Assinar Contrato
                    </button>
                </p>

            </form>

        </div>

        <?php
        return ob_get_clean();
    }
}
