<?php
// includes/pagamento/class-photomusic-pagamento-evento.php
// Página pública de pagamento de eventos: /pagamento/?t=TOKEN_EVENTO
// Shortcode: [photomusic_pagamento_evento]

if (!defined('ABSPATH')) exit;

class PhotoMusic_Pagamento_Evento {

    public static function init() {
        add_shortcode('photomusic_pagamento_evento', [__CLASS__, 'render']);
    }

    /* ============================================================
       SHORTCODE PRINCIPAL
    ============================================================ */
    public static function render() {
        global $wpdb;

        $token = sanitize_text_field($_GET['t'] ?? '');
        if (empty($token)) {
            return self::msg_erro('Link inválido. Use o link enviado pela PhotoMusic.');
        }

        $tbl = $wpdb->prefix . 'pm_eventos';
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tbl} WHERE token_evento = %s LIMIT 1",
            $token
        ));

        if (!$evento) {
            return self::msg_erro('Link inválido ou expirado.');
        }

        if ($evento->status_evento === 'desativado') {
            return self::msg_erro('Este evento foi desativado.');
        }

        // Se pagamento já confirmado pelo operador, exibe tela de conclusão
        if (!empty($evento->pagamento_confirmado)) {
            $nome_ev = esc_html($evento->motivo_evento ?? 'seu evento');
            return '
            <div style="max-width:600px;margin:40px auto;font-family:system-ui,sans-serif;padding:0 16px;text-align:center;">
                <div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:10px;padding:32px 24px;">
                    <div style="font-size:3rem;margin-bottom:12px;">✅</div>
                    <h2 style="color:#2e7d32;margin:0 0 12px;">Pagamento Realizado com Sucesso!</h2>
                    <p style="color:#333;font-size:1rem;margin-bottom:20px;">Seu pagamento referente a <strong>' . $nome_ev . '</strong> foi confirmado e registrado em nosso sistema.</p>
                    <div style="background:#fff;border-radius:8px;padding:18px 20px;margin:0 auto 20px;max-width:460px;text-align:left;border-left:4px solid #4caf50;">
                        <p style="margin:0;color:#555;font-size:0.95rem;">Agradecemos pelo seu pagamento. 🙏</p>
                        <p style="margin:10px 0 0;color:#2e7d32;font-weight:600;font-size:1rem;">Deus abençoe e multiplique, grandiosamente, na sua vida e na sua família!!!</p>
                    </div>
                    <p style="color:#777;font-size:0.85rem;margin:0;"><strong>PhotoMusic Produções</strong></p>
                </div>
            </div>';
        }

        // Calcula total dos serviços
        $tbl_es = $wpdb->prefix . 'pm_eventos_servicos';
        $servicos = $wpdb->get_results($wpdb->prepare(
            "SELECT es.*, s.nome AS nome_servico
             FROM {$tbl_es} es
             LEFT JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
             WHERE es.id_evento = %d
             ORDER BY es.id ASC",
            $evento->id
        ), ARRAY_A);

        // Soma bruta dos serviços
        $total_servicos = 0;
        foreach ($servicos as $s) {
            $total_servicos += floatval($s['valor_final'] ?? 0);
        }

        // Config de pagamento do evento
        $pgto = [];
        if (!empty($evento->pagamento_config)) {
            $pgto = json_decode($evento->pagamento_config, true) ?: [];
        }
        $forma           = $pgto['forma'] ?? '';
        $pix_desconto    = intval($pgto['pix_desconto_pct'] ?? 0);
        $cartao_parcelas = intval($pgto['cartao_parcelas'] ?? 1);
        $misto_valor     = floatval($pgto['misto_valor'] ?? 0);
        $misto_parcelas  = intval($pgto['misto_parcelas'] ?? 1);

        // Descontos sobre serviços (guestbook, 2º serviço) — base para o desconto PIX
        $descontos = [];
        if (!empty($pgto['desc_segundo_servico']) && !empty($pgto['desc_segundo_exibir'])) {
            $descontos[] = ['label' => 'Desconto 2º serviço', 'valor' => -100.00];
        }
        if (!empty($pgto['desc_guestbook']) && !empty($pgto['desc_guestbook_exibir'])) {
            $descontos[] = ['label' => 'Desconto Guestbook', 'valor' => -floatval($pgto['desc_guestbook'])];
        }

        $total_descontos = 0;
        foreach ($descontos as $d) { $total_descontos += $d['valor']; }
        $base_pix = $total_servicos + $total_descontos; // base sobre a qual incide o desconto PIX

        // Desconto PIX à vista (NÃO incide sobre deslocamento)
        $desconto_pix = ($pix_desconto > 0 && $forma === 'pix_avista')
            ? $base_pix * ($pix_desconto / 100)
            : 0;

        // Deslocamento somado DEPOIS do desconto PIX
        $val_desloc  = 0;
        $desloc_item = null;
        if (isset($pgto['desc_deslocamento']) && $pgto['desc_deslocamento'] !== '' && !empty($pgto['desc_deslocamento_exibir'])) {
            $val_desloc  = floatval($pgto['desc_deslocamento']);
            $desloc_item = ['label' => 'Deslocamento', 'valor' => $val_desloc, 'gratis' => ($val_desloc == 0)];
        }
        $desloc_valor = ($desloc_item && !$desloc_item['gratis']) ? $val_desloc : 0;

        $total_final = $base_pix - $desconto_pix + $desloc_valor;
        $subtotal    = $base_pix + $desloc_valor; // sem desconto PIX, para exibição

        // Formatações
        $subtotal_fmt       = 'R$ ' . number_format($subtotal,    2, ',', '.');
        $total_fmt          = 'R$ ' . number_format($total_final, 2, ',', '.'); // base para cartão/dinheiro/transferência/misto
        $valor_pix_fmt      = 'R$ ' . number_format($total_final, 2, ',', '.');

        // Misto: parte PIX/dinheiro já cadastrada; restante no cartão
        $valor_cartao_misto     = $total_final - $misto_valor;
        $valor_misto_pix_fmt    = 'R$ ' . number_format($misto_valor,       2, ',', '.');
        $valor_misto_cartao_fmt = 'R$ ' . number_format($valor_cartao_misto, 2, ',', '.');

        // Configurações globais (mesmas da eucaristia)
        $pix_chave   = get_option('pm_eucaristia_pix_chave',        '55353989000109');
        $pix_banco   = get_option('pm_eucaristia_pix_banco',        'Nubank');
        $pix_benefic = get_option('pm_eucaristia_pix_beneficiario', '55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ');
        // PIX payload: específico do evento; se vazio, exibe só chave PIX
        $pix_payload = trim($pgto['pix_payload'] ?? '');
        $wpp         = preg_replace('/\D/', '', get_option('pm_eucaristia_whatsapp_comprovante', ''));

        // Link do cartão (por evento)
        $link_cartao = esc_url_raw($evento->link_pagamento_cartao ?? '');

        // Nome do serviço/evento para exibição
        $nome_evento = esc_html($evento->motivo_evento ?? 'Evento');

        ob_start();
        ?>
        <div style="max-width:640px;margin:30px auto;font-family:system-ui,sans-serif;padding:0 16px;">

            <!-- Cabeçalho -->
            <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #1a73e8;">
                <h2 style="margin:0 0 4px;color:#1a1a1a;font-size:1.2rem;">🎉 <?php echo $nome_evento; ?></h2>
                <?php if (!empty($evento->data_evento)):
                    $dt = DateTime::createFromFormat('Y-m-d', $evento->data_evento);
                    echo '<p style="margin:0;color:#555;font-size:0.9rem;">📅 ' . ($dt ? $dt->format('d/m/Y') : esc_html($evento->data_evento)) . '</p>';
                endif; ?>
            </div>

            <!-- Resumo financeiro -->
            <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                <h3 style="margin:0 0 12px;color:#333;font-size:1rem;">📊 Resumo do Pedido</h3>
                <table style="width:100%;border-collapse:collapse;font-size:0.93em;">
                    <?php foreach ($servicos as $s):
                        $horas = floatval($s['horas_contratadas'] ?? 0);
                    ?>
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0;">
                            <?php echo esc_html($s['nome_servico'] ?? '—'); ?>
                            <?php if ($horas > 0): ?>
                            <span style="color:#888;font-size:0.85em;">(<?php echo number_format($horas, 0); ?>h)</span>
                            <?php endif; ?>
                        </td>
                        <td style="padding:6px 0;text-align:right;font-weight:600;">
                            R$ <?php echo number_format(floatval($s['valor_final']), 2, ',', '.'); ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>

                    <?php foreach ($descontos as $d): ?>
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0;color:#2e7d32;"><?php echo esc_html($d['label']); ?></td>
                        <td style="padding:6px 0;text-align:right;color:#2e7d32;">
                            − R$ <?php echo number_format(abs($d['valor']), 2, ',', '.'); ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>

                    <?php if ($forma === 'pix_avista' && $desconto_pix > 0): ?>
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0;color:#2e7d32;">💸 Desconto PIX à vista (<?php echo $pix_desconto; ?>%)</td>
                        <td style="padding:6px 0;text-align:right;color:#2e7d32;">− R$ <?php echo number_format($desconto_pix, 2, ',', '.'); ?></td>
                    </tr>
                    <?php endif; ?>

                    <?php if ($desloc_item): ?>
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0;color:#555;">
                            Deslocamento<?php if ($desloc_item['gratis']): ?> <em style="color:#2e7d32;">(Incluso)</em><?php endif; ?>
                        </td>
                        <td style="padding:6px 0;text-align:right;color:#c62828;">
                            <?php echo $desloc_item['gratis'] ? 'Grátis' : '+ R$ ' . number_format($val_desloc, 2, ',', '.'); ?>
                        </td>
                    </tr>
                    <?php endif; ?>

                    <tr style="border-top:2px solid #333;">
                        <td style="padding:8px 0;font-weight:700;">Total</td>
                        <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a73e8;font-size:1.05em;"><?php echo $total_fmt; ?></td>
                    </tr>
                </table>
            </div>

            <?php
            // ── PIX À VISTA ──────────────────────────────────────────
            if ($forma === 'pix_avista'):
            ?>
            <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#e65100;margin-top:0;">
                    💛 Pagamento via PIX - <?php echo $valor_pix_fmt; ?>
                    <?php if ($pix_desconto > 0): ?>
                    <span style="font-size:0.8rem;background:#e65100;color:#fff;padding:2px 8px;border-radius:20px;margin-left:6px;">
                        <?php echo $pix_desconto; ?>% de desconto
                    </span>
                    <?php endif; ?>
                </h3>
                <p style="margin:0 0 16px;">Para confirmar seu agendamento de <strong><?php echo $nome_evento; ?></strong>, realize o pagamento via PIX:</p>
                <?php echo self::bloco_pix_html($pix_payload, $pix_chave, $pix_banco, $pix_benefic, $valor_pix_fmt, $wpp, $nome_evento); ?>
            </div>

            <?php
            // ── PIX PARCELADO ─────────────────────────────────────────
            elseif ($forma === 'pix_parcelado'):
                $p1       = floatval($pgto['pix_p_1_valor'] ?? 0);
                $p2       = floatval($pgto['pix_p_2_valor'] ?? 0);
                $p2_data  = $pgto['pix_p_2_data'] ?? '';
                $p1_fmt   = 'R$ ' . number_format($p1, 2, ',', '.');
                $p2_fmt   = 'R$ ' . number_format($p2, 2, ',', '.');
            ?>
            <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#e65100;margin-top:0;">📅 Pagamento via PIX Parcelado - <?php echo $total_fmt; ?></h3>
                <p style="margin:0 0 12px;">Para confirmar seu agendamento de <strong><?php echo $nome_evento; ?></strong>, realize o pagamento conforme abaixo:</p>
                <?php if ($p1 > 0): ?>
                <table style="width:100%;border-collapse:collapse;font-size:0.93em;margin-bottom:16px;">
                    <tr style="border-bottom:1px solid #ffe082;">
                        <td style="padding:7px 4px;font-weight:600;">1ª parcela</td>
                        <td style="padding:7px 4px;font-weight:700;color:#2e7d32;"><?php echo $p1_fmt; ?></td>
                        <td style="padding:7px 4px;color:#777;font-size:0.88rem;">na assinatura do contrato</td>
                    </tr>
                    <?php if ($p2 > 0): ?>
                    <tr>
                        <td style="padding:7px 4px;font-weight:600;">2ª parcela</td>
                        <td style="padding:7px 4px;font-weight:700;color:#2e7d32;"><?php echo $p2_fmt; ?></td>
                        <td style="padding:7px 4px;color:#777;font-size:0.88rem;">
                            <?php echo $p2_data ? 'até ' . date('d/m/Y', strtotime($p2_data)) : ''; ?>
                        </td>
                    </tr>
                    <?php endif; ?>
                </table>
                <?php endif; ?>
                <?php echo self::bloco_pix_html($pix_payload, $pix_chave, $pix_banco, $pix_benefic, $p1 > 0 ? $p1_fmt : $total_fmt, $wpp, $nome_evento); ?>
            </div>

            <?php
            // ── CARTÃO ────────────────────────────────────────────────
            elseif ($forma === 'cartao'):
                $parcelas_label = $cartao_parcelas > 1
                    ? ' (até ' . $cartao_parcelas . 'x' . ($cartao_parcelas <= 3 ? ' sem juros' : ' com juros') . ')'
                    : ' à vista';
            ?>
            <div style="background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#0d47a1;margin-top:0;">💳 Pagamento via Cartão de Crédito - <?php echo $total_fmt; ?></h3>
                <p style="margin:0 0 16px;">Clique no botão abaixo para realizar o pagamento<?php echo esc_html($parcelas_label); ?> referente a <strong><?php echo $nome_evento; ?></strong>:</p>
                <?php if (!empty($link_cartao)): ?>
                <a href="<?php echo esc_url($link_cartao); ?>" target="_blank"
                   style="display:inline-block;padding:12px 24px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:1.05em;">
                    💳 Pagar <?php echo $total_fmt; ?> com Cartão
                </a>
                <?php else: ?>
                <p style="color:#555;font-size:0.9rem;">Entre em contato para receber o link de pagamento.</p>
                <?php endif; ?>
                <?php if (!empty($wpp)): ?>
                <p style="margin:16px 0 0;font-size:0.9em;">
                    Após o pagamento, envie o comprovante pelo WhatsApp:
                    <a href="<?php echo esc_url('https://wa.me/55' . $wpp . '?text=' . urlencode('Olá! Realizei o pagamento com cartão referente ao evento ' . ($evento->motivo_evento ?? '') . '. Segue o comprovante:')); ?>"
                       target="_blank"
                       style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                        📲 Enviar comprovante via WhatsApp
                    </a>
                </p>
                <?php endif; ?>
            </div>

            <?php
            // ── DINHEIRO ──────────────────────────────────────────────
            elseif ($forma === 'dinheiro'):
            ?>
            <div style="background:#f1f8e9;border:1px solid #aed581;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#33691e;margin-top:0;">💵 Pagamento em Dinheiro - <?php echo $total_fmt; ?></h3>
                <p style="margin:0 0 16px;">O pagamento referente a <strong><?php echo $nome_evento; ?></strong> será realizado em dinheiro. Entre em contato para combinar data e local:</p>
                <?php if (!empty($wpp)): ?>
                <a href="<?php echo esc_url('https://wa.me/55' . $wpp . '?text=' . urlencode('Olá! Gostaria de confirmar o pagamento em dinheiro do evento ' . ($evento->motivo_evento ?? '') . '.')); ?>"
                   target="_blank"
                   style="display:inline-block;padding:10px 20px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                    📲 Falar no WhatsApp
                </a>
                <?php endif; ?>
            </div>

            <?php
            // ── TRANSFERÊNCIA BANCÁRIA ────────────────────────────────
            elseif ($forma === 'transferencia'):
            ?>
            <div style="background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#0d47a1;margin-top:0;">🏦 Transferência Bancária - <?php echo $total_fmt; ?></h3>
                <p style="margin:0 0 16px;">Para confirmar seu agendamento de <strong><?php echo $nome_evento; ?></strong>, realize a transferência:</p>
                <table style="width:100%;border-collapse:collapse;font-size:0.92em;">
                    <tr style="border-bottom:1px solid #bbdefb;">
                        <td style="padding:7px 0;font-weight:600;width:130px;">Banco</td>
                        <td style="padding:7px 0;"><?php echo esc_html($pix_banco); ?></td>
                    </tr>
                    <tr style="border-bottom:1px solid #bbdefb;">
                        <td style="padding:7px 0;font-weight:600;">Beneficiário</td>
                        <td style="padding:7px 0;"><?php echo esc_html($pix_benefic); ?></td>
                    </tr>
                    <tr style="border-bottom:1px solid #bbdefb;">
                        <td style="padding:7px 0;font-weight:600;">CNPJ</td>
                        <td style="padding:7px 0;">
                            <code style="background:#e3f2fd;padding:3px 8px;border-radius:4px;"><?php echo esc_html($pix_chave); ?></code>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;font-weight:600;">Valor</td>
                        <td style="padding:7px 0;font-size:1.1em;font-weight:bold;color:#0d47a1;"><?php echo $total_fmt; ?></td>
                    </tr>
                </table>
                <?php if (!empty($wpp)): ?>
                <p style="margin:16px 0 0;font-size:0.9em;">
                    Após a transferência, envie o comprovante pelo WhatsApp:
                    <a href="<?php echo esc_url('https://wa.me/55' . $wpp . '?text=' . urlencode('Olá! Realizei a transferência referente ao evento ' . ($evento->motivo_evento ?? '') . '. Segue o comprovante:')); ?>"
                       target="_blank"
                       style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                        📲 Enviar comprovante via WhatsApp
                    </a>
                </p>
                <?php endif; ?>
            </div>

            <?php
            // ── MISTO (PIX/dinheiro + cartão) ─────────────────────────
            elseif ($forma === 'misto'):
                $parcelas_misto_label = $misto_parcelas > 1
                    ? ' (até ' . $misto_parcelas . 'x' . ($misto_parcelas <= 3 ? ' sem juros' : ' com juros') . ')'
                    : ' à vista';
            ?>
            <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#e65100;margin-top:0;">💸 Parte via PIX / Dinheiro - <?php echo $valor_misto_pix_fmt; ?></h3>
                <p style="margin:0 0 16px;">Para confirmar seu agendamento de <strong><?php echo $nome_evento; ?></strong>, realize o pagamento desta parte via PIX:</p>
                <?php echo self::bloco_pix_html($pix_payload, $pix_chave, $pix_banco, $pix_benefic, $valor_misto_pix_fmt, $wpp, $nome_evento); ?>
            </div>

            <div style="background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#0d47a1;margin-top:0;">💳 Restante no Cartão - <?php echo $valor_misto_cartao_fmt; ?></h3>
                <p style="margin:0 0 16px;">O restante será pago no cartão<?php echo esc_html($parcelas_misto_label); ?>:</p>
                <?php if (!empty($link_cartao)): ?>
                <a href="<?php echo esc_url($link_cartao); ?>" target="_blank"
                   style="display:inline-block;padding:12px 24px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:1.05em;">
                    💳 Pagar <?php echo $valor_misto_cartao_fmt; ?> com Cartão
                </a>
                <?php else: ?>
                <p style="color:#555;font-size:0.9rem;">Entre em contato para receber o link de pagamento com cartão.</p>
                <?php endif; ?>
                <?php if (!empty($wpp)): ?>
                <p style="margin:16px 0 0;font-size:0.9em;">
                    Após o pagamento, envie o comprovante:
                    <a href="<?php echo esc_url('https://wa.me/55' . $wpp . '?text=' . urlencode('Olá! Realizei o pagamento com cartão referente ao evento ' . ($evento->motivo_evento ?? '') . '. Segue o comprovante:')); ?>"
                       target="_blank"
                       style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                        📲 Enviar comprovante via WhatsApp
                    </a>
                </p>
                <?php endif; ?>
            </div>

            <?php else: ?>
            <!-- Forma não configurada -->
            <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:20px;margin-bottom:20px;">
                <p style="margin:0;color:#555;">Entre em contato para combinar a forma de pagamento.</p>
                <?php if (!empty($wpp)): ?>
                <a href="<?php echo esc_url('https://wa.me/55' . $wpp); ?>"
                   target="_blank"
                   style="display:inline-block;margin-top:12px;padding:10px 20px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                    📲 Falar no WhatsApp
                </a>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- Mensagem de agradecimento -->
            <div style="background:#f9fbe7;border:1px solid #c5e1a5;border-radius:8px;padding:18px 20px;margin-top:8px;margin-bottom:16px;">
                <p style="margin:0 0 8px;color:#555;font-size:0.95rem;">
                    ⏳ <strong>Em até 24 horas</strong> estaremos analisando seu pagamento e entraremos em contato para confirmar.
                </p>
                <p style="margin:0;color:#33691e;font-weight:600;font-size:0.98rem;">
                    🙏 Agradecemos pelo seu pagamento. Deus abençoe e multiplique, grandiosamente, na sua vida e na sua família!!!
                </p>
            </div>

            <p style="color:#555;font-size:0.9em;margin-top:8px;">
                <strong>PhotoMusic Produções</strong><?php if (!empty($wpp)): ?> - (<?php echo substr($wpp,2,2); ?>) <?php echo substr($wpp,4,5); ?>-<?php echo substr($wpp,9); ?><?php endif; ?>
            </p>

        </div>
        <?php
        return ob_get_clean();
    }

    /* ============================================================
       HTML DO BLOCO PIX (QR code + copia e cola + dados + comprovante)
    ============================================================ */
    private static function bloco_pix_html($payload, $chave, $banco, $benefic, $valor_fmt, $wpp, $motivo) {
        ob_start();
        ?>
        <?php if (!empty($payload)): ?>
        <div style="text-align:center;margin-bottom:20px;">
            <img src="<?php echo esc_url('https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=' . rawurlencode($payload)); ?>"
                 alt="QR Code PIX <?php echo esc_attr($valor_fmt); ?>"
                 style="border:3px solid #ffc107;border-radius:8px;display:block;margin:0 auto 10px;">
            <span style="font-size:0.85em;color:#555;">Aponte a câmera do celular para pagar</span>
        </div>
        <div style="margin-bottom:16px;">
            <p style="font-weight:600;margin:0 0 6px;">Ou use o PIX Copia e Cola:</p>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <code style="background:#fff3cd;padding:6px 10px;border-radius:4px;font-size:0.78em;word-break:break-all;flex:1;min-width:0;"><?php echo esc_html($payload); ?></code>
                <button type="button"
                        onclick="navigator.clipboard.writeText('<?php echo esc_js($payload); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{this.textContent='📋 Copiar código';},2500); }.bind(this))"
                        style="white-space:nowrap;padding:8px 14px;border:1px solid #ffc107;border-radius:6px;background:#fff;cursor:pointer;font-size:0.9em;font-weight:600;">
                    📋 Copiar código
                </button>
            </div>
        </div>
        <?php endif; ?>
        <table style="width:100%;border-collapse:collapse;font-size:0.92em;">
            <tr style="border-bottom:1px solid #ffe082;">
                <td style="padding:7px 0;font-weight:600;width:130px;">Chave PIX (CNPJ)</td>
                <td style="padding:7px 0;">
                    <code style="background:#fff3cd;padding:3px 8px;border-radius:4px;"><?php echo esc_html($chave); ?></code>
                    &nbsp;
                    <button type="button"
                            onclick="navigator.clipboard.writeText('<?php echo esc_js($chave); ?>').then(function(){ this.textContent='✅'; setTimeout(()=>{this.textContent='📋';},2000); }.bind(this))"
                            style="padding:2px 8px;border:1px solid #ffc107;border-radius:4px;background:#fff;cursor:pointer;font-size:0.85em;">
                        📋
                    </button>
                </td>
            </tr>
            <tr style="border-bottom:1px solid #ffe082;">
                <td style="padding:7px 0;font-weight:600;">Banco</td>
                <td style="padding:7px 0;"><?php echo esc_html($banco); ?></td>
            </tr>
            <tr style="border-bottom:1px solid #ffe082;">
                <td style="padding:7px 0;font-weight:600;">Beneficiário</td>
                <td style="padding:7px 0;"><?php echo esc_html($benefic); ?></td>
            </tr>
            <tr>
                <td style="padding:7px 0;font-weight:600;">Valor</td>
                <td style="padding:7px 0;font-size:1.1em;font-weight:bold;color:#2e7d32;"><?php echo esc_html($valor_fmt); ?></td>
            </tr>
        </table>
        <?php if (!empty($wpp)): ?>
        <p style="margin:16px 0 0;font-size:0.9em;">
            Após realizar o PIX, envie o comprovante pelo WhatsApp:
            <a href="<?php echo esc_url('https://wa.me/55' . $wpp . '?text=' . urlencode('Olá! Acabei de realizar o pagamento via PIX referente ao evento ' . $motivo . '. Segue o comprovante:')); ?>"
               target="_blank"
               style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                📲 Enviar comprovante via WhatsApp
            </a>
        </p>
        <?php endif; ?>
        <?php
        return ob_get_clean();
    }

    private static function msg_erro($msg) {
        return '<div style="max-width:560px;margin:40px auto;padding:24px;background:#fce4ec;border:1px solid #f44336;border-radius:6px;font-family:sans-serif;text-align:center;">'
             . '<p style="color:#c62828;font-size:1.1rem;margin:0;">' . esc_html($msg) . '</p>'
             . '</div>';
    }
}
