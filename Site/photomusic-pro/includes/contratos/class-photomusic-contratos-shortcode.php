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

        // Já assinado pelo cliente — verifica ANTES do status para evitar erro em duplo envio
        if (!empty($contrato->assinatura_contratante_data)) {
            wp_redirect(home_url('/contrato/' . $token . '?assinatura=ok'));
            exit;
        }

        // Status incorreto
        if (!in_array($contrato->status_contrato, [
            'assinado_admin',
            'aguardando_assinatura_contratante'
        ])) {
            wp_die('Este contrato não está disponível para assinatura no momento.');
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

        // Gera tarefas automaticamente ao assinar contrato
        if (class_exists('PhotoMusic_Tarefas_Auto')) {
            PhotoMusic_Tarefas_Auto::gerar($contrato->id, $contrato->id_evento);
        }

        // Envia contrato ao cliente via WhatsApp automaticamente
        if (class_exists('PhotoMusic_WhatsApp')) {
            $tel = '';

            // 1ª tentativa: tabela contratantes
            if (class_exists('PhotoMusic_Contratantes')) {
                $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
                if ($contratante) {
                    $tel = preg_replace('/\D/', '', $contratante->telefone ?? '');
                }
            }

            // 2ª tentativa: telefone direto no evento
            if (empty($tel) && !empty($contrato->id_evento)) {
                $tel_ev = $wpdb->get_var($wpdb->prepare(
                    "SELECT telefone_contratante FROM {$wpdb->prefix}pm_eventos WHERE id = %d LIMIT 1",
                    $contrato->id_evento
                ));
                $tel = preg_replace('/\D/', '', $tel_ev ?? '');
            }

            if ($tel) {
                $contrato_final = PhotoMusic_Contratos::get($contrato->id);

                // 1. Envia PDF do contrato assinado
                if (!empty($contrato_final->pdf_final)) {
                    $result_pdf = PhotoMusic_WhatsApp::send_pdf_zapi(
                        $tel,
                        "✅ Parabéns! Seu contrato foi assinado com sucesso. Segue uma cópia para seus registros.",
                        $contrato_final->pdf_final
                    );
                    // Fallback: se send_pdf_zapi falhar, envia link do PDF via texto
                    if (is_wp_error($result_pdf)) {
                        PhotoMusic_WhatsApp::send(
                            $tel,
                            "✅ Seu contrato foi assinado com sucesso! Acesse a cópia em PDF:\n" . $contrato_final->pdf_final,
                            ['id_evento' => $contrato->id_evento]
                        );
                    }
                } else {
                    // PDF não gerado — envia confirmação de texto
                    PhotoMusic_WhatsApp::send(
                        $tel,
                        "✅ Parabéns! Seu contrato foi assinado com sucesso. Em breve você receberá o PDF.",
                        ['id_evento' => $contrato->id_evento]
                    );
                }

                // 2. Envia instruções de pagamento apenas se não estiver confirmado
                $pgto_confirmado = (bool) $wpdb->get_var($wpdb->prepare(
                    "SELECT pagamento_confirmado FROM {$wpdb->prefix}pm_eventos WHERE id = %d LIMIT 1",
                    $contrato->id_evento
                ));

                if (!$pgto_confirmado && $tel && !empty($contrato->id_evento)) {
                    try {
                        $ev = $wpdb->get_row($wpdb->prepare(
                            "SELECT pagamento_config, token_evento, motivo_evento FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
                            intval($contrato->id_evento)
                        ));
                        if ($ev) {
                            $pgto_cfg = [];
                            if (!empty($ev->pagamento_config)) {
                                $pgto_cfg = json_decode($ev->pagamento_config, true) ?: [];
                            }

                            // Usa descrição de pagamento personalizada ou monta texto automático
                            $desc_pgto = trim($pgto_cfg['descricao_pagamento'] ?? '');

                            if (!empty($desc_pgto)) {
                                $msg_pgto = "💰 *Informações de Pagamento*\n\n" . $desc_pgto;
                            } else {
                                $forma = $pgto_cfg['forma'] ?? '';
                                $formas_label = [
                                    'pix_avista'    => 'PIX à vista',
                                    'pix_parcelado' => 'PIX parcelado',
                                    'cartao'        => 'Cartão de Crédito',
                                    'dinheiro'      => 'Dinheiro',
                                    'transferencia' => 'Transferência Bancária',
                                    'misto'         => 'Misto (PIX + Cartão)',
                                ];
                                $forma_txt = $formas_label[$forma] ?? 'a combinar';
                                $msg_pgto  = "💰 *Informações de Pagamento*\n\nForma: {$forma_txt}";
                            }

                            // Inclui link da página de pagamento
                            if (!empty($ev->token_evento)) {
                                $pgto_page_id = intval(get_option('pm_pagamento_page_id', 0));
                                if ($pgto_page_id > 0) {
                                    $permalink = get_permalink($pgto_page_id);
                                    $pgto_url  = $permalink
                                        ? add_query_arg('t', $ev->token_evento, $permalink)
                                        : home_url('/pagamento/?t=' . $ev->token_evento);
                                } else {
                                    $pgto_url = home_url('/pagamento/?t=' . $ev->token_evento);
                                }
                                $msg_pgto .= "\n\n🔗 Acesse para ver detalhes e realizar o pagamento:\n" . $pgto_url;
                            }

                            PhotoMusic_WhatsApp::send($tel, $msg_pgto, ['id_evento' => intval($contrato->id_evento)]);
                        }
                    } catch (\Throwable $e) {
                        if (class_exists('PhotoMusic_Logs')) {
                            PhotoMusic_Logs::add('erro_wpp_pagamento', null, intval($contrato->id_evento ?? 0), null, $e->getMessage());
                        }
                    }
                }
            }
        }

        // Redireciona com sucesso — usa URL direta do contrato para evitar redirect para admin
        wp_redirect(home_url('/contrato/' . $token . '?assinatura=ok'));
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

        // Assinatura concluída agora (verifica ANTES do "já assinado")
        if (!empty($_GET['assinatura']) && $_GET['assinatura'] === 'ok') {
            $nome_ev = '';
            global $wpdb;
            $ev_tmp = $wpdb->get_row($wpdb->prepare(
                "SELECT motivo_evento, token_evento FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
                intval($contrato->id_evento)
            ));
            if ($ev_tmp) $nome_ev = esc_html($ev_tmp->motivo_evento ?? '');

            $pgto_url = '';
            if (!empty($ev_tmp->token_evento)) {
                $pgto_page_id = intval(get_option('pm_pagamento_page_id', 0));
                if ($pgto_page_id > 0) {
                    $permalink = get_permalink($pgto_page_id);
                    $pgto_url  = $permalink ? add_query_arg('t', $ev_tmp->token_evento, $permalink) : home_url('/pagamento/?t=' . $ev_tmp->token_evento);
                } else {
                    $pgto_url = home_url('/pagamento/?t=' . $ev_tmp->token_evento);
                }
            }

            $html  = '<div style="max-width:600px;margin:30px auto;font-family:system-ui,sans-serif;text-align:center;">';
            $html .= '<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:10px;padding:32px 24px;">';
            $html .= '<div style="font-size:3rem;margin-bottom:12px;">✅</div>';
            $html .= '<h2 style="color:#2e7d32;margin:0 0 12px;">Contrato Assinado com Sucesso!</h2>';
            if ($nome_ev) $html .= '<p style="color:#333;margin-bottom:16px;">Obrigado! Seu contrato referente a <strong>' . $nome_ev . '</strong> foi assinado e registrado.</p>';
            $html .= '<p style="color:#555;margin-bottom:20px;">📲 Uma cópia em PDF foi enviada para o seu WhatsApp.</p>';
            if (!empty($pgto_url)) {
                $html .= '<a href="' . esc_url($pgto_url) . '" style="display:inline-block;padding:12px 28px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:1rem;">💰 Ver instruções de pagamento</a>';
            }
            $html .= '</div></div>';
            return $html;
        }

        // Contrato já assinado (acesso posterior)
        if (!empty($contrato->assinatura_contratante_data)) {
            return '<div style="max-width:500px;margin:30px auto;text-align:center;font-family:system-ui,sans-serif;">'
                 . '<p style="background:#f5f5f5;padding:20px;border-radius:8px;color:#555;">✅ <strong>Este contrato já foi assinado.</strong><br>Se precisar de uma cópia, entre em contato com a PhotoMusic Produções.</p>'
                 . '</div>';
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
