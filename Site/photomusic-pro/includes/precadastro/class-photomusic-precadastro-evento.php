<?php
// includes/precadastro/class-photomusic-precadastro-evento.php
// Shortcode público de pré-cadastro para eventos de outros serviços.
// URL: /pre-cadastro/?t=TOKEN_EVENTO
// O admin adiciona a página com o shortcode [photomusic_precadastro_evento].

if (!defined('ABSPATH')) exit;

class PhotoMusic_Precadastro_Evento {

    public static function init() {
        add_shortcode('photomusic_precadastro_evento', [__CLASS__, 'render']);
        add_action('template_redirect', [__CLASS__, 'processar']);
    }

    /* ============================================================
       RENDER — shortcode principal
    ============================================================ */
    public static function render($atts) {

        $token = sanitize_text_field($_GET['t'] ?? '');

        if (empty($token)) {
            return self::msg_erro('Link inválido. Use o link enviado pela PhotoMusic.');
        }

        global $wpdb;
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

        // Sucesso após envio (verificar antes do status "confirmado")
        if (!empty($_GET['pm_precadastro']) && $_GET['pm_precadastro'] === 'enviado') {
            return self::tela_sucesso($evento);
        }

        // Busca serviços do evento
        if (class_exists('PhotoMusic_Servicos')) {
            $servicos = PhotoMusic_Servicos::get_evento_servicos($evento->id);
        } else {
            $servicos = $wpdb->get_results($wpdb->prepare(
                "SELECT es.*, s.nome AS nome_servico, p.titulo AS nome_pacote
                 FROM {$wpdb->prefix}pm_eventos_servicos es
                 LEFT JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
                 LEFT JOIN {$wpdb->prefix}pm_servicos_pacotes p ON p.id = es.id_pacote
                 WHERE es.id_evento = %d
                 ORDER BY es.id ASC",
                $evento->id
            ), ARRAY_A);
        }

        ob_start();
        self::render_form($evento, $servicos, $token);
        return ob_get_clean();
    }

    /* ============================================================
       TELA DE SUCESSO
    ============================================================ */
    private static function tela_sucesso($evento) {
        $nome = esc_html($evento->motivo_evento ?? '');
        return '<div style="max-width:560px;margin:0 auto;padding:32px 16px;text-align:center;font-family:sans-serif;">'
            . '<div style="font-size:3rem;">🎉</div>'
            . '<h2>Pré-cadastro enviado!</h2>'
            . '<p>Obrigado! Seus dados para o evento <strong>' . $nome . '</strong> foram registrados.</p>'
            . '<p>Em breve nossa equipe entrará em contato para finalizar o contrato.</p>'
            . '</div>';
    }

    /* ============================================================
       RENDER DO FORMULÁRIO
    ============================================================ */
    private static function render_form($evento, $servicos, $token) {

        $motivo  = esc_html($evento->motivo_evento ?? '');
        $data_ev = $evento->data_evento
            ? date_i18n('d/m/Y', strtotime($evento->data_evento))
            : '';

        $tipo_ev = $evento->tipo_evento === 'PJ' ? 'PJ' : 'PF';

        $celebracoes = [
            'aniversario' => 'Aniversário',
            'casamento'   => 'Casamento',
            'corporativo' => 'Corporativo',
            'formatura'   => 'Formatura',
            'bodas'       => 'Bodas',
            '1eucaristia' => '1ª Eucaristia',
            'outro'       => 'Outro',
        ];

        // Pré-preenche com dados já salvos (se existirem)
        $nome_pre  = esc_attr($evento->nome_contratante ?? '');
        $cpf_pre   = esc_attr($evento->cpf ?? '');
        $email_pre = esc_attr($evento->email_contratante ?? '');
        $tel_pre   = esc_attr($evento->telefone_contratante ?? '');
        ?>
        <div id="pm-precadastro-wrap" style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;">

            <h2 style="margin-bottom:4px;"><?php echo $motivo; ?></h2>
            <?php if ($data_ev): ?>
                <p style="color:#666;margin-top:0;">📅 <?php echo esc_html($data_ev); ?></p>
            <?php endif; ?>

            <?php if (!empty($servicos)): ?>
                <div style="background:#f7f9fc;border:1px solid #dde3ea;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
                    <strong>📦 Serviços contratados:</strong>
                    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:0.92rem;">
                        <thead>
                            <tr style="border-bottom:1px solid #dde3ea;text-align:left;">
                                <th style="padding:4px 8px;">Serviço</th>
                                <th style="padding:4px 8px;">Horas</th>
                                <th style="padding:4px 8px;">Pacote</th>
                                <th style="padding:4px 8px;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($servicos as $s): ?>
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:4px 8px;"><?php echo esc_html($s['nome_servico'] ?? '—'); ?></td>
                                    <td style="padding:4px 8px;"><?php echo esc_html($s['horas_contratadas'] ?? '—'); ?>h</td>
                                    <td style="padding:4px 8px;"><?php echo esc_html($s['nome_pacote'] ?? '—'); ?></td>
                                    <td style="padding:4px 8px;">R$ <?php echo esc_html(number_format(floatval($s['valor_final'] ?? 0), 2, ',', '.')); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>

            <?php
            // Resumo financeiro
            $pgto_raw = $evento->pagamento_config ?? '';
            $pgto = $pgto_raw ? (json_decode($pgto_raw, true) ?: []) : [];
            $pgto_forma = $pgto['forma'] ?? '';

            // Calcular total dos serviços
            $total_servicos = 0;
            foreach ($servicos as $s) { $total_servicos += floatval($s['valor_final'] ?? 0); }

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

            // Desconto PIX (só sobre serviços+descontos, NÃO sobre deslocamento)
            $desconto_pix = 0;
            $pct_pix = 0;
            if ($pgto_forma === 'pix_avista') {
                $pct_pix = intval($pgto['pix_desconto_pct'] ?? 0);
                $desconto_pix = $base_pix * ($pct_pix / 100);
            }

            // Deslocamento é somado DEPOIS do desconto PIX
            $val_desloc   = 0;
            $desloc_item  = null;
            if (isset($pgto['desc_deslocamento']) && $pgto['desc_deslocamento'] !== '' && !empty($pgto['desc_deslocamento_exibir'])) {
                $val_desloc  = floatval($pgto['desc_deslocamento']);
                $desloc_item = ['label' => 'Deslocamento', 'valor' => $val_desloc, 'gratis' => ($val_desloc == 0)];
            }

            $total_final = $base_pix - $desconto_pix + ($desloc_item && !$desloc_item['gratis'] ? $val_desloc : 0);
            $subtotal    = $base_pix + ($desloc_item && !$desloc_item['gratis'] ? $val_desloc : 0); // subtotal sem desconto PIX (para exibição)
            ?>

            <?php if ($total_servicos > 0 || $pgto_forma): ?>
            <div style="background:#f7f9fc;border:1px solid #dde3ea;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
                <strong>💰 Resumo Financeiro</strong>
                <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:0.92rem;">
                    <?php if ($total_servicos > 0): ?>
                    <tr>
                        <td style="padding:4px 8px;color:#555;">Subtotal serviços</td>
                        <td style="padding:4px 8px;text-align:right;">R$ <?php echo number_format($total_servicos, 2, ',', '.'); ?></td>
                    </tr>
                    <?php endif; ?>
                    <?php foreach ($descontos as $d): ?>
                    <tr>
                        <td style="padding:4px 8px;color:#2a7a2a;"><?php echo esc_html($d['label']); ?></td>
                        <td style="padding:4px 8px;text-align:right;color:#2a7a2a;">
                            - R$ <?php echo number_format(abs($d['valor']), 2, ',', '.'); ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($pgto_forma === 'pix_avista' && $desconto_pix > 0): ?>
                    <tr style="border-top:1px solid #dde3ea;">
                        <td style="padding:6px 8px;color:#2a7a2a;">💸 Desconto PIX à vista (<?php echo $pct_pix; ?>%)</td>
                        <td style="padding:6px 8px;text-align:right;color:#2a7a2a;">- R$ <?php echo number_format($desconto_pix, 2, ',', '.'); ?></td>
                    </tr>
                    <?php endif; ?>
                    <?php if ($desloc_item): ?>
                    <tr style="border-top:1px solid #dde3ea;">
                        <td style="padding:4px 8px;color:#555;">
                            Deslocamento
                            <?php if ($desloc_item['gratis']): ?><em style="color:#2a7a2a;">(Incluso)</em><?php endif; ?>
                        </td>
                        <td style="padding:4px 8px;text-align:right;color:#c62828;">
                            <?php echo $desloc_item['gratis'] ? 'Grátis' : '+ R$ ' . number_format($val_desloc, 2, ',', '.'); ?>
                        </td>
                    </tr>
                    <?php endif; ?>
                    <tr style="border-top:2px solid #2271b1;background:#eef3fb;">
                        <td style="padding:8px;font-weight:700;">Total</td>
                        <td style="padding:8px;text-align:right;font-weight:700;font-size:1.1rem;">R$ <?php echo number_format($total_final, 2, ',', '.'); ?></td>
                    </tr>
                </table>

                <?php if ($pgto_forma): ?>
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid #dde3ea;">
                    <strong>📋 Forma de Pagamento:</strong><br>
                    <span style="margin-top:6px;display:inline-block;">
                    <?php
                    $parcelas_cartao = intval($pgto['cartao_parcelas'] ?? 3);
                    $misto_parcelas  = intval($pgto['misto_parcelas'] ?? 3);
                    $misto_valor     = floatval($pgto['misto_valor'] ?? 0);

                    switch ($pgto_forma) {
                        case 'pix_avista':
                            $val_original = number_format($total_servicos + $total_descontos, 2, ',', '.');
                            $val_desconto = number_format($total_final, 2, ',', '.');
                            echo "💸 PIX à vista com {$pct_pix}% de desconto<br>";
                            echo "<span style='color:#555;'>Valor sem desconto: R$ {$val_original}</span><br>";
                            echo "<strong style='color:#2a7a2a;'>Valor com desconto: R$ {$val_desconto}</strong>";
                            break;
                        case 'pix_parcelado':
                            $p1 = floatval($pgto['pix_p_1_valor'] ?? 0);
                            $p2 = floatval($pgto['pix_p_2_valor'] ?? 0);
                            $p3 = $total_final - $p1 - $p2;
                            echo "📅 PIX parcelado:<br>";
                            echo "• 1ª parcela: <strong>R$ " . number_format($p1, 2, ',', '.') . "</strong> na assinatura do contrato<br>";
                            if ($p2 > 0) {
                                $data_p2 = $pgto['pix_p_2_data'] ?? '';
                                $data_p2_fmt = $data_p2 ? date('d/m/Y', strtotime($data_p2)) : '—';
                                echo "• 2ª parcela: <strong>R$ " . number_format($p2, 2, ',', '.') . "</strong> até {$data_p2_fmt}<br>";
                            }
                            echo "• " . ($p2 > 0 ? "3ª" : "2ª") . " parcela: <strong>R$ " . number_format(max(0, $p3), 2, ',', '.') . "</strong> até a data do evento";
                            break;
                        case 'cartao':
                            $juros = $parcelas_cartao > 3 ? ' (com juros)' : ' (sem juros)';
                            echo "💳 Cartão de crédito em <strong>{$parcelas_cartao}x{$juros}</strong>";
                            break;
                        case 'dinheiro':
                            echo "💵 Dinheiro";
                            break;
                        case 'transferencia':
                            echo "🏦 Transferência bancária";
                            break;
                        case 'misto':
                            $restante = $total_final - $misto_valor;
                            $juros_m  = $misto_parcelas > 3 ? ' com juros' : ' sem juros';
                            echo "🔀 R$ " . number_format($misto_valor, 2, ',', '.') . " em dinheiro ou PIX";
                            echo " + R$ " . number_format(max(0,$restante), 2, ',', '.') . " em <strong>{$misto_parcelas}x{$juros_m}</strong> no cartão";
                            break;
                    }
                    ?>
                    </span>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <p style="margin-bottom:20px;color:#444;">Preencha seus dados para confirmar o pré-cadastro do evento.</p>

            <form method="post">
                <?php wp_nonce_field('pm_precadastro_evento', 'pm_nonce_pc'); ?>
                <input type="hidden" name="pm_precadastro_submit" value="1">
                <input type="hidden" name="pm_token_evento" value="<?php echo esc_attr($token); ?>">

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Nome / Motivo do Evento *</label>
                    <input type="text" name="motivo_evento" required
                           value="<?php echo esc_attr($evento->motivo_evento ?? ''); ?>"
                           placeholder="Ex: Aniversário 15 anos da Maria"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Telefone / WhatsApp *</label>
                    <input type="tel" name="telefone_contratante" required
                           value="<?php echo esc_attr($evento->telefone_contratante ?? ''); ?>"
                           placeholder="(21) 99999-9999"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    <small style="color:#888;">Informe o número que receberá as comunicações do evento.</small>
                </div>

                <hr style="margin:20px 0;">
                <p style="font-weight:700;font-size:1.05rem;margin-bottom:16px;">📅 Dados do Evento</p>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Tipo de Celebração</label>
                    <select name="tipo_celebracao"
                            style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                        <option value="">— Selecione —</option>
                        <?php foreach ($celebracoes as $k => $v): ?>
                            <option value="<?php echo esc_attr($k); ?>"
                                <?php selected($evento->tipo_celebracao ?? '', $k); ?>>
                                <?php echo esc_html($v); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <?php $inp = 'width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;'; ?>

                <div id="pc-aniversariante" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Nome do(a) Aniversariante</label>
                    <input type="text" name="nome_aniversariante"
                           value="<?php echo esc_attr($evento->nome_aniversariante ?? ''); ?>"
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-pais" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Nome dos Pais</label>
                    <input type="text" name="nome_pais"
                           value="<?php echo esc_attr($evento->nome_pais ?? ''); ?>"
                           style="<?php echo $inp; ?>">
                    <small style="color:#888;">Para menores de 18 anos.</small>
                </div>
                <div id="pc-idade" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Idade do(a) Aniversariante</label>
                    <input type="text" name="idade_aniversariante"
                           value="<?php echo esc_attr($evento->idade_aniversariante ?? ''); ?>"
                           placeholder="Ex: 15 anos"
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-nascimento-aniv" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Data de Nascimento do(a) Aniversariante</label>
                    <input type="date" name="data_nascimento_aniversariante"
                           value="<?php echo esc_attr($evento->data_nascimento_aniversariante ?? ''); ?>"
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-noivos" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Nome dos Noivos / Casal</label>
                    <input type="text" name="nome_noivos"
                           value="<?php echo esc_attr($evento->nome_noivos ?? ''); ?>"
                           placeholder="Ex: Maria e João"
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-grau-noivos" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Grau de Parentesco com os Noivos</label>
                    <input type="text" name="grau_parentesco_noivos"
                           value="<?php echo esc_attr($evento->grau_parentesco_noivos ?? ''); ?>"
                           placeholder="Ex: Pai da noiva, Irmão do noivo..."
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-tema" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Tema da Festa</label>
                    <input type="text" name="tema_festa"
                           value="<?php echo esc_attr($evento->tema_festa ?? ''); ?>"
                           placeholder="Ex: Frozen, Super-Herói, Boteco..."
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-cores" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Cores da Festa</label>
                    <input type="text" name="cores_festa"
                           value="<?php echo esc_attr($evento->cores_festa ?? ''); ?>"
                           placeholder="Ex: Azul e Dourado"
                           style="<?php echo $inp; ?>">
                </div>
                <div id="pc-modelo-foto" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Modelo da Foto (Foto Cabine ou Totem Fotográfico)</label>
                    <select name="modelo_foto" style="<?php echo $inp; ?>">
                        <option value="">— Selecione —</option>
                        <?php
                        $modelos = [
                            'Foto Tirinha',
                            'Foto Retrato 10x15',
                            'Foto Tirinha e Foto Retrato 10x15 (O convidado escolhe o modelo que deseja receber)',
                        ];
                        $modelo_atual = $evento->modelo_foto ?? '';
                        foreach ($modelos as $m):
                        ?>
                            <option value="<?php echo esc_attr($m); ?>" <?php selected($modelo_atual, $m); ?>>
                                <?php echo esc_html($m); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Data do Evento *</label>
                    <input type="date" name="data_evento" required
                           value="<?php echo esc_attr($evento->data_evento ?? ''); ?>"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Horário de Início</label>
                        <input type="time" name="horario_inicio"
                               value="<?php echo esc_attr($evento->horario_inicio ? substr($evento->horario_inicio, 0, 5) : ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Horário de Fim</label>
                        <input type="time" name="horario_fim"
                               value="<?php echo esc_attr($evento->horario_fim ? substr($evento->horario_fim, 0, 5) : ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>

                <hr style="margin:20px 0;">
                <p style="font-weight:700;font-size:1.05rem;margin-bottom:16px;">📍 Local do Evento</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome do Local</label>
                        <input type="text" name="local_evento"
                               value="<?php echo esc_attr($evento->local_evento ?? ''); ?>"
                               placeholder="Ex: Salão de Festas XYZ"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Contato do Salão</label>
                        <input type="text" name="contato_salao"
                               value="<?php echo esc_attr($evento->contato_salao ?? ''); ?>"
                               placeholder="(21) 99999-9999 - Nome"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Cerimonialista</label>
                        <input type="text" name="contato_cerimonialista"
                               value="<?php echo esc_attr($evento->contato_cerimonialista ?? ''); ?>"
                               placeholder="(21) 99999-9999 - Nome"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                        <small style="color:#888;">Eventos sociais: aniversário, casamento, formatura.</small>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Responsável pelo Evento</label>
                        <input type="text" name="contato_responsavel"
                               value="<?php echo esc_attr($evento->contato_responsavel ?? ''); ?>"
                               placeholder="(21) 99999-9999 - Nome"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                        <small style="color:#888;">Eventos corporativos.</small>
                    </div>
                </div>

                <p style="font-weight:600;margin-bottom:14px;">Endereço do Local</p>

                <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Logradouro</label>
                        <input type="text" name="local_logradouro"
                               value="<?php echo esc_attr($evento->local_logradouro ?? ''); ?>"
                               placeholder="Rua, Avenida, Travessa, Alameda..."
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="min-width:90px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Número</label>
                        <input type="text" name="local_numero"
                               value="<?php echo esc_attr($evento->local_numero ?? ''); ?>"
                               placeholder="123 ou S/Nº"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Complemento</label>
                    <input type="text" name="local_complemento"
                           value="<?php echo esc_attr($evento->local_complemento ?? ''); ?>"
                           placeholder="Apto, Bloco, Quadra, Lote..."
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Bairro</label>
                        <input type="text" name="local_bairro"
                               value="<?php echo esc_attr($evento->local_bairro ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CEP</label>
                        <input type="text" name="cep_evento"
                               value="<?php echo esc_attr($evento->cep_evento ?? ''); ?>"
                               placeholder="00000-000"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Cidade</label>
                        <input type="text" name="local_cidade"
                               value="<?php echo esc_attr($evento->local_cidade ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="min-width:70px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Estado</label>
                        <input type="text" name="local_estado"
                               value="<?php echo esc_attr($evento->local_estado ?? 'RJ'); ?>"
                               maxlength="2"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;text-transform:uppercase;">
                    </div>
                </div>

                <hr style="margin:20px 0;">
                <p style="font-weight:700;font-size:1.05rem;margin-bottom:16px;">👤 Dados do Contratante</p>

                <?php if ($tipo_ev === 'PF'): ?>

                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome completo *</label>
                        <input type="text" name="nome_contratante" required value="<?php echo $nome_pre; ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CPF *</label>
                        <input type="text" name="cpf" required value="<?php echo $cpf_pre; ?>"
                               placeholder="000.000.000-00"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">RG</label>
                        <input type="text" name="rg" value="<?php echo esc_attr($evento->rg ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Data de nascimento</label>
                        <input type="date" name="data_nascimento" value="<?php echo esc_attr($evento->data_nascimento ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>

                <?php else: ?>

                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Razão Social *</label>
                        <input type="text" name="razao_social" required value="<?php echo esc_attr($evento->razao_social ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CNPJ *</label>
                        <input type="text" name="cnpj" required value="<?php echo esc_attr($evento->cnpj ?? ''); ?>"
                               placeholder="00.000.000/0000-00"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Responsável *</label>
                        <input type="text" name="responsavel" required value="<?php echo esc_attr($evento->responsavel ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CPF do Responsável</label>
                        <input type="text" name="cpf_responsavel" value="<?php echo esc_attr($evento->cpf_responsavel ?? ''); ?>"
                               placeholder="000.000.000-00"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>

                <?php endif; ?>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">E-mail</label>
                    <input type="email" name="email_contratante" value="<?php echo $email_pre; ?>"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Instagram</label>
                    <input type="text" name="instagram_contratante"
                           value="<?php echo esc_attr($evento->instagram_contratante ?? ''); ?>"
                           placeholder="@usuario"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>

                <div id="pc-grau-parentesco" style="display:none;margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Grau de Parentesco</label>
                    <input type="text" name="grau_parentesco"
                           value="<?php echo esc_attr($evento->grau_parentesco ?? ''); ?>"
                           placeholder="Ex: Mãe do aniversariante"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    <small style="color:#888;">Relação do contratante com o evento.</small>
                </div>

                <hr style="margin:20px 0;">
                <p style="font-weight:600;margin-bottom:14px;">Endereço do Contratante</p>

                <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Logradouro</label>
                        <input type="text" name="cont_logradouro" value="<?php echo esc_attr($evento->cont_logradouro ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="min-width:90px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Número</label>
                        <input type="text" name="cont_numero" value="<?php echo esc_attr($evento->cont_numero ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Complemento</label>
                    <input type="text" name="cont_complemento" value="<?php echo esc_attr($evento->cont_complemento ?? ''); ?>"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Bairro</label>
                        <input type="text" name="cont_bairro" value="<?php echo esc_attr($evento->cont_bairro ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CEP</label>
                        <input type="text" name="cont_cep" value="<?php echo esc_attr($evento->cont_cep ?? ''); ?>"
                               placeholder="00000-000"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:24px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Cidade</label>
                        <input type="text" name="cont_cidade" value="<?php echo esc_attr($evento->cont_cidade ?? ''); ?>"
                               style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                    </div>
                    <div style="min-width:70px;">
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Estado</label>
                        <input type="text" name="cont_estado" value="<?php echo esc_attr($evento->cont_estado ?? 'RJ'); ?>"
                               maxlength="2" style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;text-transform:uppercase;">
                    </div>
                </div>

                <button type="submit"
                        style="width:100%;padding:13px;background:#1a73e8;color:#fff;border:none;border-radius:6px;font-size:1.05rem;font-weight:600;cursor:pointer;">
                    ✅ Confirmar Pré-Cadastro
                </button>

            </form>
            <script>
            (function() {
                var campos = {
                    'aniversario': ['pc-aniversariante','pc-pais','pc-idade','pc-nascimento-aniv','pc-tema','pc-cores','pc-modelo-foto','pc-grau-parentesco'],
                    'casamento':   ['pc-noivos','pc-grau-noivos','pc-cores','pc-modelo-foto','pc-grau-parentesco'],
                    'bodas':       ['pc-noivos','pc-grau-noivos','pc-cores','pc-modelo-foto'],
                    'corporativo': ['pc-tema','pc-cores','pc-modelo-foto'],
                    'formatura':   ['pc-aniversariante','pc-tema','pc-cores','pc-modelo-foto'],
                    '1eucaristia': ['pc-pais','pc-grau-parentesco'],
                    'outro':       ['pc-tema','pc-cores','pc-modelo-foto'],
                };
                var todos = ['pc-aniversariante','pc-pais','pc-idade','pc-nascimento-aniv','pc-noivos','pc-grau-noivos','pc-tema','pc-cores','pc-modelo-foto','pc-grau-parentesco'];

                function toggleCelebracao(val) {
                    todos.forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });
                    if (val && campos[val]) {
                        campos[val].forEach(function(id) {
                            var el = document.getElementById(id);
                            if (el) el.style.display = '';
                        });
                    }
                }

                var sel = document.querySelector('[name="tipo_celebracao"]');
                if (sel) {
                    sel.addEventListener('change', function() { toggleCelebracao(this.value); });
                    toggleCelebracao(sel.value); // aplica ao carregar (se já tem valor salvo)
                }
            })();
            </script>
        </div>
        <?php
    }

    /* ============================================================
       PROCESSAR O ENVIO DO FORMULÁRIO
    ============================================================ */
    public static function processar() {

        if (empty($_POST['pm_precadastro_submit'])) return;

        if (!wp_verify_nonce($_POST['pm_nonce_pc'] ?? '', 'pm_precadastro_evento')) {
            wp_die('Falha de segurança. Tente novamente.');
        }

        $token = sanitize_text_field($_POST['pm_token_evento'] ?? '');
        if (empty($token)) wp_die('Token inválido.');

        global $wpdb;
        $tbl = $wpdb->prefix . 'pm_eventos';

        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tbl} WHERE token_evento = %s LIMIT 1",
            $token
        ));

        if (!$evento) wp_die('Evento não encontrado.');

        // Dados do formulário
        $tipo_ev = $evento->tipo_evento ?? 'PF';
        $dados   = ['pre_cadastro_status' => 'confirmado'];

        if ($tipo_ev === 'PJ') {
            $dados['razao_social']    = sanitize_text_field($_POST['razao_social'] ?? '');
            $dados['cnpj']            = sanitize_text_field($_POST['cnpj'] ?? '');
            $dados['responsavel']     = sanitize_text_field($_POST['responsavel'] ?? '');
            $dados['cpf_responsavel'] = sanitize_text_field($_POST['cpf_responsavel'] ?? '');
        } else {
            $dados['nome_contratante'] = sanitize_text_field($_POST['nome_contratante'] ?? '');
            $dados['cpf']              = sanitize_text_field($_POST['cpf'] ?? '');
            $dados['rg']               = sanitize_text_field($_POST['rg'] ?? '');
            $raw_nasc = sanitize_text_field($_POST['data_nascimento'] ?? '');
            if ($raw_nasc && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw_nasc)) {
                $dados['data_nascimento'] = $raw_nasc;
            }
        }

        $dados['motivo_evento']           = sanitize_text_field($_POST['motivo_evento'] ?? '') ?: $evento->motivo_evento;
        $dados['telefone_contratante']    = sanitize_text_field($_POST['telefone_contratante'] ?? '');
        $dados['email_contratante']       = sanitize_email($_POST['email_contratante'] ?? '');
        $dados['instagram_contratante']   = sanitize_text_field($_POST['instagram_contratante'] ?? '') ?: null;
        $dados['grau_parentesco']         = sanitize_text_field($_POST['grau_parentesco'] ?? '') ?: null;

        // Dados do evento
        $dados['tipo_celebracao']      = sanitize_text_field($_POST['tipo_celebracao']      ?? '') ?: null;
        $dados['nome_aniversariante']  = sanitize_text_field($_POST['nome_aniversariante']  ?? '') ?: null;
        $dados['nome_pais']            = sanitize_text_field($_POST['nome_pais']            ?? '') ?: null;
        $dados['idade_aniversariante'] = sanitize_text_field($_POST['idade_aniversariante'] ?? '') ?: null;
        $raw_nasc_aniv = sanitize_text_field($_POST['data_nascimento_aniversariante'] ?? '');
        if ($raw_nasc_aniv && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw_nasc_aniv)) {
            $dados['data_nascimento_aniversariante'] = $raw_nasc_aniv;
        }
        $dados['nome_noivos']                 = sanitize_text_field($_POST['nome_noivos']                 ?? '') ?: null;
        $dados['grau_parentesco_noivos']      = sanitize_text_field($_POST['grau_parentesco_noivos']      ?? '') ?: null;
        $dados['tema_festa']                  = sanitize_text_field($_POST['tema_festa']                  ?? '') ?: null;
        $dados['cores_festa']                 = sanitize_text_field($_POST['cores_festa']                 ?? '') ?: null;
        $dados['modelo_foto']                 = sanitize_text_field($_POST['modelo_foto']                 ?? '') ?: null;
        $raw_data_ev = sanitize_text_field($_POST['data_evento'] ?? '');
        if ($raw_data_ev && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw_data_ev)) {
            $dados['data_evento'] = $raw_data_ev;
        }
        $dados['horario_inicio'] = sanitize_text_field($_POST['horario_inicio'] ?? '') ?: null;
        $dados['horario_fim']    = sanitize_text_field($_POST['horario_fim']    ?? '') ?: null;

        // Local do evento
        $dados['local_evento']           = sanitize_text_field($_POST['local_evento']           ?? '');
        $dados['contato_salao']          = sanitize_text_field($_POST['contato_salao']          ?? '');
        $dados['contato_cerimonialista'] = sanitize_text_field($_POST['contato_cerimonialista'] ?? '');
        $dados['contato_responsavel']    = sanitize_text_field($_POST['contato_responsavel']    ?? '');
        $dados['local_logradouro']       = sanitize_text_field($_POST['local_logradouro']       ?? '');
        $dados['local_numero']           = sanitize_text_field($_POST['local_numero']           ?? '');
        $dados['local_complemento']      = sanitize_text_field($_POST['local_complemento']      ?? '');
        $dados['local_bairro']           = sanitize_text_field($_POST['local_bairro']           ?? '');
        $dados['local_cidade']           = sanitize_text_field($_POST['local_cidade']           ?? '');
        $dados['local_estado']           = strtoupper(sanitize_text_field($_POST['local_estado'] ?? 'RJ'));
        $dados['cep_evento']             = sanitize_text_field($_POST['cep_evento']             ?? '');

        // Endereço do contratante
        $dados['cont_logradouro']  = sanitize_text_field($_POST['cont_logradouro']  ?? '');
        $dados['cont_numero']      = sanitize_text_field($_POST['cont_numero']      ?? '');
        $dados['cont_complemento'] = sanitize_text_field($_POST['cont_complemento'] ?? '');
        $dados['cont_bairro']      = sanitize_text_field($_POST['cont_bairro']      ?? '');
        $dados['cont_cidade']      = sanitize_text_field($_POST['cont_cidade']      ?? '');
        $dados['cont_estado']      = strtoupper(sanitize_text_field($_POST['cont_estado'] ?? 'RJ'));
        $dados['cont_cep']         = sanitize_text_field($_POST['cont_cep']         ?? '');

        $wpdb->update($tbl, $dados, ['id' => $evento->id]);

        // Cria rascunho do contrato se ainda não existe
        if (class_exists('PhotoMusic_Contratos')) {
            $existente = PhotoMusic_Contratos::get_by_event($evento->id);
            if (!$existente) {
                PhotoMusic_Contratos::criar_contrato_simplificado($evento->id);
            }
        }

        // Notifica admin via WhatsApp
        $tel_admin = get_option('pm_whatsapp_notificacao', '');
        if ($tel_admin && class_exists('PhotoMusic_WhatsApp')) {
            $nome_cliente = $dados['nome_contratante'] ?? ($dados['razao_social'] ?? 'cliente');
            $msg = "✅ Pré-cadastro confirmado!\n"
                 . "Evento: {$evento->motivo_evento}\n"
                 . "Cliente: {$nome_cliente}\n"
                 . "Telefone: {$dados['telefone_contratante']}\n"
                 . "Acesse o painel para revisar e criar o contrato.";
            PhotoMusic_WhatsApp::send($tel_admin, $msg);
        }

        $base_url    = home_url(wp_unslash($_SERVER['REQUEST_URI'] ?? ''));
        $base_url    = remove_query_arg('pm_precadastro', $base_url);
        $redirect_url = add_query_arg('pm_precadastro', 'enviado', $base_url);
        wp_redirect($redirect_url);
        exit;
    }

    /* ============================================================
       HELPER — mensagem de erro
    ============================================================ */
    private static function msg_erro($msg) {
        return '<div style="max-width:480px;margin:40px auto;padding:20px;background:#fff3f3;border:1px solid #fcc;border-radius:8px;font-family:sans-serif;text-align:center;">'
            . '<p style="color:#c00;font-size:1rem;">' . esc_html($msg) . '</p>'
            . '</div>';
    }
}
