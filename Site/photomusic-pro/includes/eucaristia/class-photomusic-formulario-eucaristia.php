<?php
// includes/eucaristia/class-photomusic-formulario-eucaristia.php
// Shortcode público + processamento do pré-cadastro da 1ª Eucaristia

if (!defined('ABSPATH')) exit;

class PhotoMusic_Formulario_Eucaristia {

    public static function init() {
        add_shortcode('photomusic_formulario_eucaristia', [__CLASS__, 'render_formulario']);
        // wp_loaded dispara após init — garante que o processamento ocorre mesmo quando
        // init() é chamado de dentro do hook 'init' (WordPress não re-executa callbacks
        // adicionados ao hook corrente na mesma prioridade)
        add_action('wp_loaded', [__CLASS__, 'processar_formulario']);
    }

    /* ============================================================
       VALIDAÇÃO CPF — dígitos verificadores
    ============================================================ */
    private static function validar_cpf($cpf) {
        $cpf = preg_replace('/\D/', '', $cpf);
        if (strlen($cpf) !== 11 || preg_match('/^(\d)\1+$/', $cpf)) return false;
        $soma = 0;
        for ($i = 0; $i < 9; $i++) $soma += intval($cpf[$i]) * (10 - $i);
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) $resto = 0;
        if ($resto !== intval($cpf[9])) return false;
        $soma = 0;
        for ($i = 0; $i < 10; $i++) $soma += intval($cpf[$i]) * (11 - $i);
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) $resto = 0;
        return $resto === intval($cpf[10]);
    }

    /* ============================================================
       SHORTCODE: [photomusic_formulario_eucaristia]
       Exibe o formulário público de pré-cadastro
    ============================================================ */
    public static function render_formulario() {

        // Tela de confirmação após envio OU link direto de pagamento (sem cadastro)
        $pm_euc_estado = sanitize_text_field($_GET['pm_eucaristia'] ?? '');
        if (!empty($pm_euc_estado) && in_array($pm_euc_estado, ['enviado', 'direto'], true)) {

            $fp           = sanitize_text_field($_GET['fp'] ?? '');
            $link_direto  = ($pm_euc_estado === 'direto'); // true = veio do link direto, sem msg de cadastro

            // Verifica se pagamento já foi confirmado pelo operador
            $token_euc = sanitize_text_field($_GET['t'] ?? '');
            if (!empty($token_euc)) {
                global $wpdb;
                $ev_pgto = $wpdb->get_row($wpdb->prepare(
                    "SELECT pagamento_confirmado, motivo_evento FROM {$wpdb->prefix}pm_eventos WHERE token_evento = %s LIMIT 1",
                    $token_euc
                ));
                if ($ev_pgto && !empty($ev_pgto->pagamento_confirmado)) {
                    $nome_ev = esc_html($ev_pgto->motivo_evento ?? '1ª Eucaristia');
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
            }

            // Lê configurações de pagamento
            $valor_pix       = esc_html(get_option('pm_eucaristia_valor_pix',          '150,00'));
            $pix_chave       = esc_html(get_option('pm_eucaristia_pix_chave',          '55353989000109'));
            $pix_banco       = esc_html(get_option('pm_eucaristia_pix_banco',          'Nubank'));
            $pix_benefic     = esc_html(get_option('pm_eucaristia_pix_beneficiario',   '55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ'));
            $pix_payload     = get_option('pm_eucaristia_pix_payload',                 '');
            $valor_cartao    = esc_html(get_option('pm_eucaristia_valor_cartao',       '170,00'));
            $link_cartao     = get_option('pm_eucaristia_link_cartao',                 '');
            $wpp_comprovante = preg_replace('/\D/', '', get_option('pm_eucaristia_whatsapp_comprovante', '2196442-8172'));

            ob_start();
            ?>
            <div style="max-width:640px;margin:30px auto;font-family:system-ui,sans-serif;padding:0 16px;">

                <?php if (!$link_direto): ?>
                <div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;padding:20px;margin-bottom:24px;">
                    <h2 style="color:#2e7d32;margin-top:0;">✅ Cadastro enviado com sucesso!</h2>
                    <p style="margin:0;">Recebemos suas informações. Em breve entraremos em contato via WhatsApp para confirmar o agendamento e enviar o contrato para assinatura.</p>
                </div>
                <?php endif; ?>

                <?php if ($fp === 'pix'): ?>
                <!-- ===== PAGAMENTO VIA PIX ===== -->
                <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:20px;margin-bottom:20px;">
                    <h3 style="color:#e65100;margin-top:0;">💛 Pagamento via PIX - R$ <?php echo $valor_pix; ?></h3>
                    <p style="margin:0 0 16px;">Para confirmar seu agendamento, realize o pagamento via PIX:</p>

                    <?php if (!empty($pix_payload)): ?>
                    <!-- QR CODE -->
                    <div style="text-align:center;margin-bottom:20px;">
                        <img src="<?php echo esc_url('https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=' . rawurlencode($pix_payload)); ?>"
                             alt="QR Code PIX R$ <?php echo $valor_pix; ?>"
                             style="border:3px solid #ffc107;border-radius:8px;display:block;margin:0 auto 10px;">
                        <span style="font-size:0.85em;color:#555;">Aponte a câmera do celular para pagar</span>
                    </div>
                    <!-- COPIA E COLA -->
                    <div style="margin-bottom:16px;">
                        <p style="font-weight:600;margin:0 0 6px;">Ou use o PIX Copia e Cola:</p>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <code id="pm-pix-payload" style="background:#fff3cd;padding:6px 10px;border-radius:4px;font-size:0.78em;word-break:break-all;flex:1;min-width:0;"><?php echo esc_html($pix_payload); ?></code>
                            <button type="button"
                                    onclick="navigator.clipboard.writeText('<?php echo esc_js($pix_payload); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{this.textContent='📋 Copiar código';},2500); }.bind(this))"
                                    style="white-space:nowrap;padding:8px 14px;border:1px solid #ffc107;border-radius:6px;background:#fff;cursor:pointer;font-size:0.9em;font-weight:600;">
                                📋 Copiar código
                            </button>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- DADOS PARA TRANSFERÊNCIA MANUAL -->
                    <table style="width:100%;border-collapse:collapse;font-size:0.92em;">
                        <tr style="border-bottom:1px solid #ffe082;">
                            <td style="padding:7px 0;font-weight:600;width:130px;">Chave PIX (CNPJ)</td>
                            <td style="padding:7px 0;">
                                <code style="background:#fff3cd;padding:3px 8px;border-radius:4px;"><?php echo $pix_chave; ?></code>
                                &nbsp;
                                <button type="button"
                                        onclick="navigator.clipboard.writeText('<?php echo esc_js($pix_chave); ?>').then(function(){ this.textContent='✅'; setTimeout(()=>{this.textContent='📋';},2000); }.bind(this))"
                                        style="padding:2px 8px;border:1px solid #ffc107;border-radius:4px;background:#fff;cursor:pointer;font-size:0.85em;">
                                    📋
                                </button>
                            </td>
                        </tr>
                        <tr style="border-bottom:1px solid #ffe082;">
                            <td style="padding:7px 0;font-weight:600;">Banco</td>
                            <td style="padding:7px 0;"><?php echo $pix_banco; ?></td>
                        </tr>
                        <tr style="border-bottom:1px solid #ffe082;">
                            <td style="padding:7px 0;font-weight:600;">Beneficiário</td>
                            <td style="padding:7px 0;"><?php echo $pix_benefic; ?></td>
                        </tr>
                        <tr>
                            <td style="padding:7px 0;font-weight:600;">Valor</td>
                            <td style="padding:7px 0;font-size:1.1em;font-weight:bold;color:#2e7d32;">R$ <?php echo $valor_pix; ?></td>
                        </tr>
                    </table>

                    <?php if (!empty($wpp_comprovante)): ?>
                    <p style="margin:16px 0 0;font-size:0.9em;">
                        Após realizar o PIX, envie o comprovante pelo WhatsApp:
                        <a href="https://wa.me/55<?php echo esc_attr($wpp_comprovante); ?>?text=<?php echo urlencode('Olá! Acabei de realizar o pagamento via PIX da 1ª Eucaristia. Segue o comprovante:'); ?>"
                           target="_blank"
                           style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                            📲 Enviar comprovante via WhatsApp
                        </a>
                    </p>
                    <?php endif; ?>
                </div>

                <?php elseif ($fp === 'cartao' && !empty($link_cartao)): ?>
                <!-- ===== PAGAMENTO VIA CARTÃO ===== -->
                <div style="background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;padding:20px;margin-bottom:20px;">
                    <h3 style="color:#0d47a1;margin-top:0;">💳 Pagamento via Cartão de Crédito - R$ <?php echo $valor_cartao; ?></h3>
                    <p style="margin:0 0 16px;">Clique no botão abaixo para realizar o pagamento com cartão de crédito em até 3x sem juros:</p>

                    <a href="<?php echo esc_url($link_cartao); ?>" target="_blank"
                       style="display:inline-block;padding:12px 24px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:1.05em;">
                        💳 Pagar R$ <?php echo $valor_cartao; ?> com Cartão
                    </a>

                    <?php if (!empty($wpp_comprovante)): ?>
                    <p style="margin:16px 0 0;font-size:0.9em;">
                        Após o pagamento, envie o comprovante pelo WhatsApp:
                        <a href="https://wa.me/55<?php echo esc_attr($wpp_comprovante); ?>?text=<?php echo urlencode('Olá! Sou cliente da 1ª Eucaristia e quero enviar meu comprovante de pagamento com cartão.'); ?>"
                           target="_blank"
                           style="display:inline-block;margin-top:8px;padding:8px 16px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
                            📲 Enviar comprovante via WhatsApp
                        </a>
                    </p>
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
                    <strong>PhotoMusic Produções</strong> - (21) 96442-8172
                </p>
            </div>
            <?php
            return ob_get_clean();
        }

        $vp = esc_html(get_option('pm_eucaristia_valor_pix',    '150,00'));
        $vc = esc_html(get_option('pm_eucaristia_valor_cartao', '170,00'));

        ob_start();
        ?>
        <div class="pm-form-eucaristia" style="max-width:640px;margin:30px auto;font-family:system-ui,sans-serif;padding:0 16px;">

            <h2 style="margin-bottom:4px;">📸 Fotografia - 1ª Eucaristia</h2>
            <p style="color:#555;margin-top:0;">Preencha seus dados para contratar a cobertura fotográfica. Após o envio, entraremos em contato para confirmar e enviar o contrato.</p>

            <?php if (!empty($_GET['pm_erro'])): ?>
            <div style="background:#ffebee;border:1px solid #f44336;border-radius:4px;padding:12px;margin-bottom:16px;color:#b71c1c;">
                <?php echo esc_html(urldecode($_GET['pm_erro'])); ?>
            </div>
            <?php endif; ?>

            <form method="post" id="pm-form-eucaristia">
                <?php wp_nonce_field('pm_precadastro_eucaristia', 'pm_eucaristia_nonce'); ?>
                <input type="hidden" name="pm_action" value="pm_precadastro_eucaristia">
                <input type="hidden" name="pm_page_url" value="<?php echo esc_url(get_permalink()); ?>">

                <!-- DADOS DO CONTRATANTE (RESPONSÁVEL) -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">👤 Seus dados (responsável)</legend>

                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome completo *</label>
                        <input type="text" name="nome_contratante" required
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">CPF *</label>
                        <input type="text" name="cpf" required maxlength="14"
                               placeholder="000.000.000-00" id="pm-cpf-pub"
                               style="width:100%;max-width:220px;padding:8px;border:1px solid #ccc;border-radius:4px;">
                        <span id="pm-cpf-status" style="margin-left:8px;font-weight:600;font-size:0.9em;"></span>
                        <span id="pm-cpf-msg" style="display:block;margin-top:4px;font-size:0.85em;color:#c62828;"></span>
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">RG</label>
                        <input type="text" name="rg"
                               style="width:100%;max-width:220px;padding:8px;border:1px solid #ccc;border-radius:4px;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Data de nascimento</label>
                        <input type="date" name="data_nascimento"
                               style="width:100%;max-width:200px;padding:8px;border:1px solid #ccc;border-radius:4px;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Celular / WhatsApp *</label>
                        <input type="tel" name="telefone_contratante" required
                               placeholder="(21) 99999-9999" id="pm-tel-pub"
                               style="width:100%;max-width:220px;padding:8px;border:1px solid #ccc;border-radius:4px;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">E-mail</label>
                        <input type="email" name="email_contratante"
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Grau de parentesco com o(a) catequizando(a) *</label>
                        <input type="text" name="grau_parentesco" required
                               placeholder="Ex: Mãe, Pai, Avó..."
                               style="width:100%;max-width:280px;padding:8px;border:1px solid #ccc;border-radius:4px;">
                    </p>
                </fieldset>

                <!-- ENDEREÇO -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">🏠 Endereço</legend>
                    <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;margin-bottom:8px;">
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Rua / Avenida</label>
                            <input type="text" name="cont_logradouro"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Nº</label>
                            <input type="text" name="cont_numero"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </div>
                    </div>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Complemento</label>
                        <input type="text" name="cont_complemento"
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Bairro</label>
                            <input type="text" name="cont_bairro"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">CEP</label>
                            <input type="text" name="cont_cep" maxlength="9"
                                   placeholder="00000-000"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;">
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Cidade</label>
                            <input type="text" name="cont_cidade" value="Niterói"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Estado</label>
                            <input type="text" name="cont_estado" value="RJ" maxlength="2"
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;text-transform:uppercase;">
                        </div>
                    </div>
                </fieldset>

                <!-- CATEQUIZANDO(S) -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">✝️ Catequizando(s)</legend>
                    <p style="font-size:0.9em;color:#555;margin-top:0;">Para irmãos/primos no mesmo contrato, clique em "+ Adicionar".</p>

                    <div id="pm-cat-pub-lista">
                        <div class="pm-cat-pub-linha" style="border:1px solid #eee;border-radius:4px;padding:12px;margin-bottom:8px;">
                            <p style="margin:0 0 8px;">
                                <label style="display:block;font-weight:600;margin-bottom:4px;">Nome completo *</label>
                                <input type="text" name="catequizando_nome[]" required
                                       style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                            </p>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                                <div>
                                    <label style="display:block;font-weight:600;margin-bottom:4px;">Data de nascimento</label>
                                    <input type="date" name="catequizando_nascimento[]"
                                           style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="display:block;font-weight:600;margin-bottom:4px;">Parentesco</label>
                                    <input type="text" name="catequizando_parentesco[]"
                                           placeholder="Ex: Filho, Filha"
                                           style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" id="pm-cat-pub-add"
                            style="padding:7px 16px;border:1px solid #999;border-radius:4px;background:#f5f5f5;cursor:pointer;">
                        + Adicionar catequizando
                    </button>
                </fieldset>

                <!-- NOME DOS PAIS -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">👨‍👩‍👧 Nome dos Pais</legend>
                    <p style="margin-top:0;font-size:0.9em;color:#555;">Necessário para identificação durante o evento fotográfico.</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <p style="margin:0;">
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Nome do Pai *</label>
                            <input type="text" name="nome_pai" required
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </p>
                        <p style="margin:0;">
                            <label style="display:block;font-weight:600;margin-bottom:4px;">Nome da Mãe *</label>
                            <input type="text" name="nome_mae" required
                                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                        </p>
                    </div>
                </fieldset>

                <!-- DADOS DA CATEQUESE -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">⛪ Dados da Catequese</legend>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Data da 1ª Eucaristia *</label>
                        <input type="date" name="data_evento" required
                               style="width:100%;max-width:200px;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome do(a) Catequista</label>
                        <input type="text" name="nome_catequista"
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Dia e horário da catequese</label>
                        <input type="text" name="horario_catequese"
                               placeholder="Ex: Sábado às 09h00"
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome da Paróquia *</label>
                        <input type="text" name="nome_paroquia" required
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">Nome da Capela</label>
                        <input type="text" name="nome_capela"
                               style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                    </p>
                </fieldset>

                <!-- FORMA DE PAGAMENTO -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">💳 Forma de Pagamento</legend>
                    <label style="display:block;margin-bottom:10px;cursor:pointer;padding:10px;border:1px solid #ccc;border-radius:4px;">
                        <input type="radio" name="forma_pagamento_eucaristia" value="pix" required>
                        <strong>PIX</strong> - R$ <?php echo $vp; ?> à vista
                        <span style="display:block;font-size:0.85em;color:#555;margin-top:4px;margin-left:20px;">Desconto de R$ <?php echo number_format(floatval(str_replace(',','.',$vc)) - floatval(str_replace(',','.',$vp)), 2, ',', '.'); ?> para pagamento via PIX</span>
                    </label>
                    <label style="display:block;cursor:pointer;padding:10px;border:1px solid #ccc;border-radius:4px;">
                        <input type="radio" name="forma_pagamento_eucaristia" value="cartao">
                        <strong>Cartão de Crédito</strong> - R$ <?php echo $vc; ?> em 3x sem juros
                    </label>
                </fieldset>

                <p style="font-size:0.82em;color:#666;margin-bottom:16px;">
                    ℹ️ Ao enviar, seus dados serão registrados conforme a LGPD. Usamos suas informações exclusivamente para prestação do serviço contratado.
                </p>

                <button type="submit"
                        style="width:100%;padding:14px;font-size:1.05em;font-weight:bold;background:#1565c0;color:#fff;border:none;border-radius:6px;cursor:pointer;">
                    Enviar cadastro
                </button>
            </form>
        </div>

        <script>
        (function() {

            /* ---- Validação matemática CPF ---- */
            function validarCPF(cpf) {
                cpf = cpf.replace(/\D/g, '');
                if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
                var soma = 0, resto;
                for (var i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
                resto = (soma * 10) % 11;
                if (resto === 10 || resto === 11) resto = 0;
                if (resto !== parseInt(cpf[9])) return false;
                soma = 0;
                for (var i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
                resto = (soma * 10) % 11;
                if (resto === 10 || resto === 11) resto = 0;
                return resto === parseInt(cpf[10]);
            }

            function setCpfStatus(valido, vazio) {
                var st  = document.getElementById('pm-cpf-status');
                var msg = document.getElementById('pm-cpf-msg');
                var el  = document.getElementById('pm-cpf-pub');
                if (!st) return;
                if (vazio) {
                    st.textContent = '';
                    msg.textContent = '';
                    el.style.borderColor = '#ccc';
                } else if (valido) {
                    st.textContent = '✅';
                    msg.textContent = '';
                    el.style.borderColor = '#4caf50';
                } else {
                    st.textContent = '❌';
                    msg.textContent = 'CPF inválido - verifique os números digitados.';
                    el.style.borderColor = '#f44336';
                }
            }

            /* ---- Máscara + validação em tempo real ---- */
            var cpfEl = document.getElementById('pm-cpf-pub');
            if (cpfEl) {
                cpfEl.addEventListener('input', function() {
                    var d = this.value.replace(/\D/g,'').substring(0,11);
                    var v = d;
                    v = v.replace(/(\d{3})(\d)/,'$1.$2');
                    v = v.replace(/(\d{3})(\d)/,'$1.$2');
                    v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
                    this.value = v;
                    if (d.length === 0) setCpfStatus(false, true);
                    else if (d.length === 11) setCpfStatus(validarCPF(d), false);
                    else setCpfStatus(false, true); // ainda digitando — sem erro
                });

                /* ---- Ao sair do campo: valida imediatamente ---- */
                cpfEl.addEventListener('blur', function() {
                    var d = this.value.replace(/\D/g,'');
                    if (d.length === 0) { setCpfStatus(false, true); return; }
                    setCpfStatus(validarCPF(d), false);
                });
            }

            /* ---- Máscara telefone ---- */
            var telEl = document.getElementById('pm-tel-pub');
            if (telEl) telEl.addEventListener('input', function() {
                var v = this.value.replace(/\D/g,'').substring(0,11);
                if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
                else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
                this.value = v;
            });

            /* ---- Bloqueio no submit se CPF inválido + anti-duplo-envio ---- */
            var form = document.getElementById('pm-form-eucaristia');
            var _submitando = false;
            if (form) form.addEventListener('submit', function(e) {
                // Valida CPF primeiro
                var cpfEl = document.getElementById('pm-cpf-pub');
                if (cpfEl) {
                    var d = cpfEl.value.replace(/\D/g,'');
                    if (d.length > 0 && !validarCPF(d)) {
                        e.preventDefault();
                        setCpfStatus(false, false);
                        cpfEl.focus();
                        cpfEl.scrollIntoView({behavior:'smooth', block:'center'});
                        return;
                    }
                }
                // Impede duplo clique / reenvio
                if (_submitando) { e.preventDefault(); return; }
                _submitando = true;
                var btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = '⏳ Enviando...';
                    btn.style.background = '#999';
                }
            });

            /* ---- Adicionar catequizando ---- */
            document.getElementById('pm-cat-pub-add') && document.getElementById('pm-cat-pub-add').addEventListener('click', function() {
                var lista = document.getElementById('pm-cat-pub-lista');
                var modelo = lista.querySelector('.pm-cat-pub-linha').cloneNode(true);
                modelo.querySelectorAll('input').forEach(function(i){ i.value = ''; i.removeAttribute('required'); });
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = '✕ Remover';
                btn.style.cssText = 'margin-top:8px;padding:4px 12px;border:1px solid #f44336;border-radius:4px;background:#fff;color:#f44336;cursor:pointer;font-size:0.85em;';
                btn.addEventListener('click', function(){ this.closest('.pm-cat-pub-linha').remove(); });
                modelo.appendChild(btn);
                lista.appendChild(modelo);
            });

        })();
        </script>
        <?php
        return ob_get_clean();
    }

    /* ============================================================
       PROCESSA O ENVIO DO FORMULÁRIO PÚBLICO
    ============================================================ */
    public static function processar_formulario() {

        if (empty($_POST['pm_action']) || $_POST['pm_action'] !== 'pm_precadastro_eucaristia') return;

        if (!wp_verify_nonce($_POST['pm_eucaristia_nonce'] ?? '', 'pm_precadastro_eucaristia')) {
            wp_die('Falha de segurança. Volte e tente novamente.');
        }

        global $wpdb;
        $tbl_ev  = $wpdb->prefix . 'pm_eventos';
        $tbl_cat = $wpdb->prefix . 'pm_eucaristia_catequizandos';

        $nome_contratante = sanitize_text_field($_POST['nome_contratante'] ?? '');
        $telefone         = sanitize_text_field($_POST['telefone_contratante'] ?? '');
        $nome_paroquia    = sanitize_text_field($_POST['nome_paroquia'] ?? '');
        $nome_pai         = sanitize_text_field($_POST['nome_pai'] ?? '');
        $nome_mae         = sanitize_text_field($_POST['nome_mae'] ?? '');
        $fp               = in_array($_POST['forma_pagamento_eucaristia'] ?? '', ['pix','cartao'])
                            ? $_POST['forma_pagamento_eucaristia'] : null;

        // Validações mínimas
        $data_evento = sanitize_text_field($_POST['data_evento'] ?? '');

        $erro = '';
        if (empty($nome_contratante)) $erro = 'O nome é obrigatório.';
        elseif (empty($telefone))      $erro = 'O celular/WhatsApp é obrigatório.';
        elseif (empty($nome_pai))      $erro = 'O nome do pai é obrigatório.';
        elseif (empty($nome_mae))      $erro = 'O nome da mãe é obrigatório.';
        elseif (empty($data_evento))   $erro = 'A data da 1ª Eucaristia é obrigatória.';
        elseif (empty($nome_paroquia)) $erro = 'O nome da paróquia é obrigatório.';
        elseif (empty($fp))            $erro = 'Selecione a forma de pagamento.';

        // Validação CPF — matemática completa
        $cpf = preg_replace('/\D/', '', $_POST['cpf'] ?? '');
        if (empty($erro) && !empty($cpf) && !self::validar_cpf($cpf)) {
            $erro = 'CPF inválido. Verifique o número digitado.';
        }

        // Pelo menos um catequizando
        $nomes_cat = array_filter(array_map('sanitize_text_field', (array)($_POST['catequizando_nome'] ?? [])));
        if (empty($erro) && empty($nomes_cat)) {
            $erro = 'Informe o nome de pelo menos um(a) catequizando(a).';
        }

        $page_url = esc_url_raw($_POST['pm_page_url'] ?? '');
        if (empty($page_url)) $page_url = wp_get_referer() ?: home_url('/');

        if (!empty($erro)) {
            wp_redirect(add_query_arg('pm_erro', urlencode($erro), $page_url));
            exit;
        }

        // ============================================================
        // PROTEÇÃO ANTI-DUPLICATA
        // Verifica se já existe cadastro com mesmo telefone + data do evento.
        // Se sim, redireciona para a tela de pagamento do cadastro existente
        // em vez de criar um novo.
        // ============================================================
        $tel_limpo    = preg_replace('/\D/', '', $telefone);
        $data_ev_dup  = sanitize_text_field($_POST['data_evento'] ?? '');

        $duplicado = $wpdb->get_row($wpdb->prepare(
            "SELECT id, token_evento FROM {$tbl_ev}
             WHERE telefone_contratante = %s
               AND data_evento = %s
               AND tipo_celebracao = '1eucaristia'
               AND status_evento != 'desativado'
             ORDER BY id DESC
             LIMIT 1",
            $tel_limpo,
            $data_ev_dup
        ));

        if ($duplicado) {
            // Garante token
            $token_dup = $duplicado->token_evento;
            if (empty($token_dup)) {
                $token_dup = bin2hex(random_bytes(16));
                $wpdb->update($tbl_ev, ['token_evento' => $token_dup], ['id' => $duplicado->id]);
            }
            // Redireciona para a tela de pagamento do cadastro já existente
            wp_redirect(add_query_arg([
                'pm_eucaristia' => 'enviado',
                'fp'            => $fp,
                't'             => $token_dup,
            ], $page_url));
            exit;
        }

        // Monta o motivo/título do evento
        $primeiro_cat = reset($nomes_cat);
        $motivo = '1ª Eucaristia - ' . $primeiro_cat;
        if (count($nomes_cat) > 1) {
            $motivo .= ' e mais ' . (count($nomes_cat) - 1);
        }

        // Insere evento com status de pré-cadastro
        $dados_evento = [
            'tipo_evento'                => 'PF',
            'nome_contratante'           => $nome_contratante,
            'cpf'                        => $cpf ?: null,
            'rg'                         => sanitize_text_field($_POST['rg'] ?? '') ?: null,
            'data_nascimento'            => sanitize_text_field($_POST['data_nascimento'] ?? '') ?: null,
            'email_contratante'          => sanitize_email($_POST['email_contratante'] ?? '') ?: null,
            'telefone_contratante'       => preg_replace('/\D/', '', $telefone),
            'grau_parentesco'            => sanitize_text_field($_POST['grau_parentesco'] ?? '') ?: null,
            'cont_logradouro'            => sanitize_text_field($_POST['cont_logradouro'] ?? '') ?: null,
            'cont_numero'                => sanitize_text_field($_POST['cont_numero'] ?? '') ?: null,
            'cont_complemento'           => sanitize_text_field($_POST['cont_complemento'] ?? '') ?: null,
            'cont_bairro'                => sanitize_text_field($_POST['cont_bairro'] ?? '') ?: null,
            'cont_cidade'                => sanitize_text_field($_POST['cont_cidade'] ?? 'Niterói'),
            'cont_estado'                => strtoupper(sanitize_text_field($_POST['cont_estado'] ?? 'RJ')),
            'cont_cep'                   => sanitize_text_field($_POST['cont_cep'] ?? '') ?: null,
            'motivo_evento'              => $motivo,
            'data_evento'                => sanitize_text_field($_POST['data_evento'] ?? '') ?: null,
            'tipo_celebracao'            => '1eucaristia',
            'nome_catequista'            => sanitize_text_field($_POST['nome_catequista'] ?? '') ?: null,
            'horario_catequese'          => sanitize_text_field($_POST['horario_catequese'] ?? '') ?: null,
            'nome_pais'                  => trim($nome_pai . ' e ' . $nome_mae),
            'nome_paroquia'              => $nome_paroquia,
            'nome_capela'                => sanitize_text_field($_POST['nome_capela'] ?? '') ?: null,
            'forma_pagamento_eucaristia' => $fp,
            'pre_cadastro_status'        => 'pendente',
            'status_evento'              => 'ativo',
            'codigo_interno'             => PhotoMusic_Helpers::generate_code('EUC'),
            'criado_em'                  => current_time('mysql'),
        ];

        $wpdb->insert($tbl_ev, $dados_evento);
        $id_evento = $wpdb->insert_id;

        if (!$id_evento) {
            wp_redirect(add_query_arg('pm_erro', urlencode('Erro ao salvar. Tente novamente ou entre em contato.'), wp_get_referer() ?: get_permalink()));
            exit;
        }

        // Insere catequizandos
        $nascimentos  = array_map('sanitize_text_field', (array)($_POST['catequizando_nascimento'] ?? []));
        $parentescos  = array_map('sanitize_text_field', (array)($_POST['catequizando_parentesco'] ?? []));
        $ordem = 1;
        foreach ($nomes_cat as $i => $nome) {
            $wpdb->insert($tbl_cat, [
                'id_evento'       => $id_evento,
                'nome'            => $nome,
                'data_nascimento' => $nascimentos[$i] ?: null,
                'grau_parentesco' => $parentescos[$i] ?: null,
                'ordem'           => $ordem++,
                'criado_em'       => current_time('mysql'),
            ]);
        }

        // Notifica admin via WhatsApp (se configurado)
        $tel_admin = get_option('pm_whatsapp_admin');
        if (!empty($tel_admin) && class_exists('PhotoMusic_WhatsApp')) {
            $msg = "📋 *Novo pré-cadastro 1ª Eucaristia*\n"
                 . "👤 {$nome_contratante} - " . $telefone . "\n"
                 . "✝️ " . implode(', ', $nomes_cat) . "\n"
                 . "⛪ {$nome_paroquia}\n"
                 . "💳 " . ($fp === 'pix' ? 'PIX' : 'Cartão') . "\n"
                 . "🔗 Acesse: " . admin_url('admin.php?page=photomusic-eventos');
            PhotoMusic_WhatsApp::send($tel_admin, $msg, ['id_evento' => $id_evento]);
        }

        // Cria contrato rascunho
        if (class_exists('PhotoMusic_Contratos')) {
            PhotoMusic_Contratos::criar_contrato_simplificado($id_evento, 0, true);
        }

        // Garante que o evento tem token para o link de pagamento
        $token_ev = $wpdb->get_var($wpdb->prepare(
            "SELECT token_evento FROM {$tbl_ev} WHERE id = %d", $id_evento
        ));
        if (empty($token_ev)) {
            $token_ev = bin2hex(random_bytes(16));
            $wpdb->update($tbl_ev, ['token_evento' => $token_ev], ['id' => $id_evento]);
        }

        wp_redirect(add_query_arg(['pm_eucaristia' => 'enviado', 'fp' => $fp, 't' => $token_ev], $page_url));
        exit;
    }
}
