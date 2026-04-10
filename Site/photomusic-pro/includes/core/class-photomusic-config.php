<?php
// includes/core/class-photomusic-config.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Config {

    public static function init() {
        add_action('admin_init', [__CLASS__, 'register_settings']);
        add_action('admin_post_pm_salvar_config', [__CLASS__, 'salvar']);
        add_action('admin_post_pm_regenerar_api_key', [__CLASS__, 'regenerar_api_key']);
    }

    /* ============================================================
       REGENERA A CHAVE DE API DO CHATBOT
    ============================================================ */
    public static function regenerar_api_key() {

        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_regenerar_api_key');

        $nova_chave = wp_generate_password(32, false);
        update_option('pm_chatbot_api_key', $nova_chave);

        wp_redirect(add_query_arg([
            'page'        => 'photomusic-config',
            'key_renewed' => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       REGISTRA AS CONFIGURAÇÕES
    ============================================================ */
    public static function register_settings() {
        register_setting('pm_config_group', 'photomusic_contrato_page', [
            'type'              => 'integer',
            'sanitize_callback' => 'intval',
            'default'           => 0,
        ]);
    }

    /* ============================================================
       PROCESSA O FORMULÁRIO (admin-post)
    ============================================================ */
    public static function salvar() {

        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_salvar_config');

        $page_id = intval($_POST['photomusic_contrato_page'] ?? 0);
        update_option('photomusic_contrato_page', $page_id);

        $pgto_page_id = intval($_POST['pm_pagamento_page_id'] ?? 0);
        update_option('pm_pagamento_page_id', $pgto_page_id);

        update_option('pm_eucaristia_form_url', esc_url_raw($_POST['pm_eucaristia_form_url'] ?? ''));

        // Pagamento 1ª Eucaristia
        update_option('pm_eucaristia_valor_pix',          sanitize_text_field($_POST['pm_eucaristia_valor_pix'] ?? '150,00'));
        update_option('pm_eucaristia_pix_chave',          sanitize_text_field($_POST['pm_eucaristia_pix_chave'] ?? ''));
        update_option('pm_eucaristia_pix_banco',          sanitize_text_field($_POST['pm_eucaristia_pix_banco'] ?? ''));
        update_option('pm_eucaristia_pix_beneficiario',   sanitize_text_field($_POST['pm_eucaristia_pix_beneficiario'] ?? ''));
        update_option('pm_eucaristia_pix_payload',        sanitize_text_field($_POST['pm_eucaristia_pix_payload'] ?? ''));
        update_option('pm_eucaristia_valor_cartao',       sanitize_text_field($_POST['pm_eucaristia_valor_cartao'] ?? '170,00'));
        update_option('pm_eucaristia_link_cartao',        esc_url_raw($_POST['pm_eucaristia_link_cartao'] ?? ''));
        update_option('pm_eucaristia_whatsapp_comprovante', sanitize_text_field($_POST['pm_eucaristia_whatsapp_comprovante'] ?? ''));

        // Número sequencial do próximo contrato
        $proximo = intval($_POST['pm_contrato_proximo_numero'] ?? 1);
        if ($proximo > 0) update_option('pm_contrato_proximo_numero', $proximo);

        // Contas PIX — Nubank
        update_option('pm_pix_nubank_nome',   sanitize_text_field($_POST['pm_pix_nubank_nome']   ?? ''));
        update_option('pm_pix_nubank_chave',  sanitize_text_field($_POST['pm_pix_nubank_chave']  ?? ''));
        update_option('pm_pix_nubank_banco',  sanitize_text_field($_POST['pm_pix_nubank_banco']  ?? ''));

        // Contas PIX — InfinitePay
        update_option('pm_pix_infinitepay_nome',  sanitize_text_field($_POST['pm_pix_infinitepay_nome']  ?? ''));
        update_option('pm_pix_infinitepay_chave', sanitize_text_field($_POST['pm_pix_infinitepay_chave'] ?? ''));

        // Contas PIX — PicPay
        update_option('pm_pix_picpay_nome',  sanitize_text_field($_POST['pm_pix_picpay_nome']  ?? ''));
        update_option('pm_pix_picpay_chave', sanitize_text_field($_POST['pm_pix_picpay_chave'] ?? ''));

        // Transferência bancária
        update_option('pm_transferencia_banco',      sanitize_text_field($_POST['pm_transferencia_banco']      ?? ''));
        update_option('pm_transferencia_nome',       sanitize_text_field($_POST['pm_transferencia_nome']       ?? ''));
        update_option('pm_transferencia_agencia',    sanitize_text_field($_POST['pm_transferencia_agencia']    ?? ''));
        update_option('pm_transferencia_codigo',     sanitize_text_field($_POST['pm_transferencia_codigo']     ?? ''));
        update_option('pm_transferencia_conta',      sanitize_text_field($_POST['pm_transferencia_conta']      ?? ''));
        update_option('pm_transferencia_cnpj',       sanitize_text_field($_POST['pm_transferencia_cnpj']       ?? ''));

        wp_redirect(add_query_arg([
            'page'    => 'photomusic-config',
            'saved'   => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       RENDERIZA A PÁGINA DE CONFIGURAÇÕES
    ============================================================ */
    public static function render_page() {

        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }

        // ID salvo atualmente
        $pagina_contrato_id  = (int) get_option('photomusic_contrato_page', 0);
        $pagina_pagamento_id = (int) get_option('pm_pagamento_page_id', 0);
        $proximo_num         = (int) get_option('pm_contrato_proximo_numero', 1);
        $eucaristia_form_url = get_option('pm_eucaristia_form_url', '');
        $url_empresa         = admin_url('admin.php?page=photomusic_empresa');

        // Verifica páginas configuradas
        $pagina_pgto_salva = $pagina_pagamento_id ? get_post($pagina_pagamento_id) : null;
        $url_pgto_publica  = $pagina_pgto_salva ? get_permalink($pagina_pgto_salva) : '';

        // Pagamento 1ª Eucaristia
        $euc_valor_pix       = get_option('pm_eucaristia_valor_pix',          '150,00');
        $euc_pix_chave       = get_option('pm_eucaristia_pix_chave',          '55353989000109');
        $euc_pix_banco       = get_option('pm_eucaristia_pix_banco',          'Nubank');
        $euc_pix_benefic     = get_option('pm_eucaristia_pix_beneficiario',   '55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ');
        $euc_pix_payload     = get_option('pm_eucaristia_pix_payload',         '');
        $euc_valor_cartao    = get_option('pm_eucaristia_valor_cartao',       '170,00');
        $euc_link_cartao     = get_option('pm_eucaristia_link_cartao',        '');
        $euc_wpp_comprovante = get_option('pm_eucaristia_whatsapp_comprovante', '2196442-8172');

        // Busca todas as páginas publicadas para o select
        $paginas = get_pages(['post_status' => 'publish', 'sort_column' => 'post_title']);

        // Verifica se a página salva existe
        $pagina_salva = $pagina_contrato_id ? get_post($pagina_contrato_id) : null;
        $url_publica  = $pagina_salva ? get_permalink($pagina_salva) : '';
        ?>

        <div class="wrap">
            <h1>Configurações — PhotoMusic Pro</h1>

            <?php if (!empty($_GET['saved'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p><strong>✅ Configurações salvas com sucesso.</strong></p>
                </div>
            <?php endif; ?>

            <?php if (!empty($_GET['key_renewed'])): ?>
                <div class="notice notice-warning is-dismissible">
                    <p>
                        <strong>🔄 Nova chave gerada.</strong>
                        Atualize o <code>PM_API_KEY</code> no arquivo <code>.env</code> do servidor do ChatBot e reinicie o processo.
                    </p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('pm_salvar_config'); ?>
                <input type="hidden" name="action" value="pm_salvar_config">

                <table class="form-table">

                    <!-- ============================================
                         PÁGINA DE ASSINATURA DE CONTRATO
                    ============================================ -->
                    <tr>
                        <th scope="row">
                            <label for="photomusic_contrato_page">
                                Página de Assinatura de Contrato
                            </label>
                        </th>
                        <td>
                            <select name="photomusic_contrato_page"
                                    id="photomusic_contrato_page"
                                    style="min-width: 300px;">

                                <option value="0">— Selecione uma página —</option>

                                <?php foreach ($paginas as $pagina): ?>
                                    <option value="<?php echo esc_attr($pagina->ID); ?>"
                                        <?php selected($pagina_contrato_id, $pagina->ID); ?>>
                                        <?php echo esc_html($pagina->post_title); ?>
                                        (ID: <?php echo esc_html($pagina->ID); ?>)
                                    </option>
                                <?php endforeach; ?>

                            </select>

                            <?php if ($pagina_salva && $url_publica): ?>
                                <p class="description">
                                    ✅ Página configurada:
                                    <a href="<?php echo esc_url($url_publica); ?>" target="_blank">
                                        <?php echo esc_html($url_publica); ?>
                                    </a>
                                </p>
                            <?php else: ?>
                                <p class="description" style="color: #b32d2e;">
                                    ⚠️ Nenhuma página configurada. Os links de contrato vão
                                    retornar erro 404 até isso ser definido.
                                </p>
                            <?php endif; ?>

                            <p class="description">
                                Selecione a página que contém o shortcode
                                <code>[photomusic_contrato]</code>.
                                Todos os links <code>/contrato/{token}/</code>
                                gerados no PDF e no WhatsApp vão redirecionar para ela.
                            </p>
                        </td>
                    </tr>

                    <!-- ============================================
                         PÁGINA DE PAGAMENTO
                    ============================================ -->
                    <tr>
                        <th scope="row">
                            <label for="pm_pagamento_page_id">
                                Página de Pagamento
                            </label>
                        </th>
                        <td>
                            <select name="pm_pagamento_page_id"
                                    id="pm_pagamento_page_id"
                                    style="min-width: 300px;">

                                <option value="0">— Selecione uma página —</option>

                                <?php foreach ($paginas as $pagina): ?>
                                    <option value="<?php echo esc_attr($pagina->ID); ?>"
                                        <?php selected($pagina_pagamento_id, $pagina->ID); ?>>
                                        <?php echo esc_html($pagina->post_title); ?>
                                        (ID: <?php echo esc_html($pagina->ID); ?>)
                                    </option>
                                <?php endforeach; ?>

                            </select>

                            <?php if ($pagina_pgto_salva && $url_pgto_publica): ?>
                                <p class="description">
                                    ✅ Página configurada:
                                    <a href="<?php echo esc_url($url_pgto_publica); ?>" target="_blank">
                                        <?php echo esc_html($url_pgto_publica); ?>
                                    </a>
                                </p>
                            <?php else: ?>
                                <p class="description" style="color: #b32d2e;">
                                    ⚠️ Nenhuma página configurada. Os links de pagamento não funcionarão.
                                </p>
                            <?php endif; ?>

                            <p class="description">
                                Selecione a página que contém o shortcode
                                <code>[photomusic_pagamento_evento]</code>.
                                O link é enviado automaticamente ao cliente após assinar o contrato.
                            </p>
                        </td>
                    </tr>

                    <!-- ============================================
                         URL DO FORMULÁRIO DE 1ª EUCARISTIA
                    ============================================ -->
                    <tr>
                        <th scope="row">
                            <label for="pm_eucaristia_form_url">URL do Formulário de 1ª Eucaristia</label>
                        </th>
                        <td>
                            <input type="url" id="pm_eucaristia_form_url" name="pm_eucaristia_form_url"
                                   class="regular-text"
                                   value="<?php echo esc_attr($eucaristia_form_url); ?>"
                                   placeholder="https://photomusic.com.br/formulario-eucaristia/">
                            <p class="description">
                                URL da página WordPress que contém o shortcode
                                <code>[photomusic_formulario_eucaristia]</code>.
                                Este link é exibido na página do evento para o operador copiar e enviar ao cliente.
                            </p>
                        </td>
                    </tr>

                    <!-- ============================================
                         NUMERAÇÃO DE CONTRATOS
                    ============================================ -->
                    <tr>
                        <th scope="row"><label for="pm_contrato_proximo_numero">Próximo Nº de Contrato</label></th>
                        <td>
                            <input type="number" min="1" id="pm_contrato_proximo_numero"
                                   name="pm_contrato_proximo_numero"
                                   value="<?php echo esc_attr($proximo_num); ?>"
                                   style="width:120px;">
                            <p class="description">O número que será atribuído ao próximo contrato gerado. Use para continuar a numeração existente (ex.: 965).</p>
                        </td>
                    </tr>

                </table>

                <div class="notice notice-info inline" style="margin:16px 0;">
                    <p>
                        🏢 <strong>Dados da Empresa</strong> (nome, CNPJ, endereço, logo etc.) são gerenciados na página dedicada:<br>
                        <a href="<?php echo esc_url($url_empresa); ?>" class="button button-secondary" style="margin-top:6px;">
                            ✏️ Editar Dados da Empresa
                        </a>
                    </p>
                </div>

                <!-- ============================================
                     PAGAMENTO — 1ª EUCARISTIA
                ============================================ -->
                <h2>💳 Pagamento — 1ª Eucaristia</h2>
                <p class="description">Informações exibidas ao cliente após o envio do formulário de 1ª Eucaristia, de acordo com a forma de pagamento escolhida.</p>
                <table class="form-table">
                    <tr>
                        <th colspan="2"><strong>PIX</strong></th>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_valor_pix">Valor (PIX)</label></th>
                        <td><input type="text" id="pm_eucaristia_valor_pix" name="pm_eucaristia_valor_pix"
                                   style="width:120px;" value="<?php echo esc_attr($euc_valor_pix); ?>"
                                   placeholder="150,00">
                            <p class="description">Ex.: 150,00</p></td>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_pix_chave">Chave PIX</label></th>
                        <td><input type="text" id="pm_eucaristia_pix_chave" name="pm_eucaristia_pix_chave"
                                   class="regular-text" value="<?php echo esc_attr($euc_pix_chave); ?>"
                                   placeholder="CNPJ, CPF, e-mail ou telefone">
                            <p class="description">Ex.: 55353989000109</p></td>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_pix_banco">Banco</label></th>
                        <td><input type="text" id="pm_eucaristia_pix_banco" name="pm_eucaristia_pix_banco"
                                   class="regular-text" value="<?php echo esc_attr($euc_pix_banco); ?>"
                                   placeholder="Ex.: Nubank"></td>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_pix_beneficiario">Beneficiário</label></th>
                        <td><input type="text" id="pm_eucaristia_pix_beneficiario" name="pm_eucaristia_pix_beneficiario"
                                   class="large-text" value="<?php echo esc_attr($euc_pix_benefic); ?>"
                                   placeholder="Ex.: 55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ"></td>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_pix_payload">PIX Copia e Cola</label></th>
                        <td>
                            <textarea id="pm_eucaristia_pix_payload" name="pm_eucaristia_pix_payload"
                                      class="large-text" rows="3"
                                      placeholder="Cole aqui o código PIX gerado no app do Nubank (começa com 00020126...)"><?php echo esc_textarea($euc_pix_payload); ?></textarea>
                            <p class="description">
                                Gere no Nubank → <strong>Cobrar → R$ 150,00 → Gerar QR Code → Copiar código PIX</strong>.<br>
                                O QR Code e o botão "Copiar" serão exibidos automaticamente na tela de confirmação do cliente.
                            </p>
                            <?php if (!empty($euc_pix_payload)): ?>
                                <p><img src="<?php echo esc_url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' . rawurlencode($euc_pix_payload)); ?>"
                                        alt="QR Code PIX" style="border:1px solid #ccc;padding:4px;margin-top:6px;">
                                <br><small style="color:#555;">Pré-visualização do QR Code</small></p>
                            <?php endif; ?>
                        </td>
                    </tr>

                    <tr>
                        <th colspan="2"><strong>Cartão de Crédito</strong></th>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_valor_cartao">Valor (Cartão)</label></th>
                        <td><input type="text" id="pm_eucaristia_valor_cartao" name="pm_eucaristia_valor_cartao"
                                   style="width:120px;" value="<?php echo esc_attr($euc_valor_cartao); ?>"
                                   placeholder="170,00">
                            <p class="description">Ex.: 170,00</p></td>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_link_cartao">Link de Pagamento (Cartão)</label></th>
                        <td><input type="url" id="pm_eucaristia_link_cartao" name="pm_eucaristia_link_cartao"
                                   class="large-text" value="<?php echo esc_attr($euc_link_cartao); ?>"
                                   placeholder="https://link.infinitepay.io/...">
                            <p class="description">Link gerado pela maquininha / InfinitePay.</p></td>
                    </tr>

                    <tr>
                        <th colspan="2"><strong>WhatsApp para Comprovante</strong></th>
                    </tr>
                    <tr>
                        <th><label for="pm_eucaristia_whatsapp_comprovante">Número WhatsApp</label></th>
                        <td><input type="text" id="pm_eucaristia_whatsapp_comprovante" name="pm_eucaristia_whatsapp_comprovante"
                                   style="width:200px;" value="<?php echo esc_attr($euc_wpp_comprovante); ?>"
                                   placeholder="21996442-8172">
                            <p class="description">Número para onde o cliente envia o comprovante (PIX ou Cartão).</p></td>
                    </tr>
                </table>

                <!-- ── CONTAS PIX ─────────────────────────────────────── -->
                <tr><td colspan="2"><hr><h3 style="margin:0;">🏦 Contas PIX da Empresa</h3>
                <p class="description">Usadas para geração automática do texto de pagamento no contrato.</p></td></tr>

                <tr><th colspan="2"><strong>PIX — Nubank</strong></th></tr>
                <tr>
                    <th><label>Nome / Beneficiário</label></th>
                    <td><input type="text" name="pm_pix_nubank_nome" style="width:100%;max-width:420px;"
                               value="<?php echo esc_attr(get_option('pm_pix_nubank_nome', '55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Chave PIX</label></th>
                    <td><input type="text" name="pm_pix_nubank_chave" style="width:260px;"
                               value="<?php echo esc_attr(get_option('pm_pix_nubank_chave', '55.353.989/0001-09')); ?>"
                               placeholder="CNPJ, CPF, e-mail ou celular"></td>
                </tr>
                <tr>
                    <th><label>Banco</label></th>
                    <td><input type="text" name="pm_pix_nubank_banco" style="width:200px;"
                               value="<?php echo esc_attr(get_option('pm_pix_nubank_banco', 'Nubank')); ?>"></td>
                </tr>

                <tr><th colspan="2"><strong>PIX — InfinitePay</strong></th></tr>
                <tr>
                    <th><label>Nome / Beneficiário</label></th>
                    <td><input type="text" name="pm_pix_infinitepay_nome" style="width:100%;max-width:420px;"
                               value="<?php echo esc_attr(get_option('pm_pix_infinitepay_nome', '')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Chave PIX</label></th>
                    <td><input type="text" name="pm_pix_infinitepay_chave" style="width:260px;"
                               value="<?php echo esc_attr(get_option('pm_pix_infinitepay_chave', '')); ?>"></td>
                </tr>

                <tr><th colspan="2"><strong>PIX — PicPay</strong></th></tr>
                <tr>
                    <th><label>Nome / Beneficiário</label></th>
                    <td><input type="text" name="pm_pix_picpay_nome" style="width:100%;max-width:420px;"
                               value="<?php echo esc_attr(get_option('pm_pix_picpay_nome', '')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Chave PIX</label></th>
                    <td><input type="text" name="pm_pix_picpay_chave" style="width:260px;"
                               value="<?php echo esc_attr(get_option('pm_pix_picpay_chave', '')); ?>"></td>
                </tr>

                <!-- ── TRANSFERÊNCIA BANCÁRIA ─────────────────────── -->
                <tr><td colspan="2"><hr><h3 style="margin:0;">🏛️ Transferência Bancária (TED/DOC)</h3></td></tr>
                <tr>
                    <th><label>Nome do Banco</label></th>
                    <td><input type="text" name="pm_transferencia_banco" style="width:300px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_banco', 'Nu Pagamentos S.A. - Instituição de Pagamento')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Nome / Beneficiário</label></th>
                    <td><input type="text" name="pm_transferencia_nome" style="width:100%;max-width:420px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_nome', '55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Código do Banco</label></th>
                    <td><input type="text" name="pm_transferencia_codigo" style="width:100px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_codigo', '0260')); ?>"
                               placeholder="Ex: 0260"></td>
                </tr>
                <tr>
                    <th><label>Agência</label></th>
                    <td><input type="text" name="pm_transferencia_agencia" style="width:100px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_agencia', '0001')); ?>"></td>
                </tr>
                <tr>
                    <th><label>Conta</label></th>
                    <td><input type="text" name="pm_transferencia_conta" style="width:160px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_conta', '787593852-9')); ?>"></td>
                </tr>
                <tr>
                    <th><label>CNPJ</label></th>
                    <td><input type="text" name="pm_transferencia_cnpj" style="width:200px;"
                               value="<?php echo esc_attr(get_option('pm_transferencia_cnpj', '55.353.989/0001-09')); ?>"></td>
                </tr>

                <?php submit_button('Salvar Configurações'); ?>

            </form>

            <!-- ============================================
                 CHAVE DE API DO CHATBOT
            ============================================ -->
            <hr>
            <h2>🤖 Integração ChatBot</h2>
            <p class="description">
                Esta chave é usada pelo ChatBot (Node.js) para autenticar na API WordPress.
                Adicione no arquivo <code>.env</code> do servidor do ChatBot.
            </p>
            <?php
            $api_key = get_option('pm_chatbot_api_key', '');
            if (empty($api_key)) {
                $api_key = wp_generate_password(32, false);
                update_option('pm_chatbot_api_key', $api_key);
            }
            ?>
            <table class="widefat" style="max-width:680px; margin-bottom:20px;">
                <tr>
                    <th style="width:200px;">Variável no <code>.env</code></th>
                    <td><code>PM_API_KEY</code></td>
                </tr>
                <tr>
                    <th>Chave</th>
                    <td>
                        <code id="pm-api-key-value" style="
                            display:inline-block;
                            background:#f0f0f1;
                            padding:6px 12px;
                            border-radius:4px;
                            font-size:14px;
                            letter-spacing:1px;
                            user-select:all;
                        "><?php echo esc_html($api_key); ?></code>
                        &nbsp;
                        <button type="button" class="button"
                            onclick="navigator.clipboard.writeText('<?php echo esc_js($api_key); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{ this.textContent='📋 Copiar'; },2000); }.bind(this))">
                            📋 Copiar
                        </button>
                    </td>
                </tr>
                <tr>
                    <th>Linha completa para o <code>.env</code></th>
                    <td>
                        <code id="pm-env-line">PM_API_KEY=<?php echo esc_html($api_key); ?></code>
                        &nbsp;
                        <button type="button" class="button"
                            onclick="navigator.clipboard.writeText('PM_API_KEY=<?php echo esc_js($api_key); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{ this.textContent='📋 Copiar linha'; },2000); }.bind(this))">
                            📋 Copiar linha
                        </button>
                    </td>
                </tr>
                <tr>
                    <th>Endpoint ChatBot</th>
                    <td>
                        <code><?php echo esc_html(home_url('/wp-json/photomusic/v1/eventos-chatbot')); ?></code>
                    </td>
                </tr>
            </table>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                <?php wp_nonce_field('pm_regenerar_api_key'); ?>
                <input type="hidden" name="action" value="pm_regenerar_api_key">
                <button type="submit" class="button button-secondary"
                    onclick="return confirm('Atenção: ao regenerar a chave, o ChatBot vai parar de funcionar até você atualizar o .env no servidor. Deseja continuar?')">
                    🔄 Regenerar chave
                </button>
                <p class="description" style="margin-top:6px;">
                    Use somente se a chave atual for comprometida. Lembre de atualizar o <code>.env</code> no servidor do ChatBot e reiniciá-lo.
                </p>
            </form>

            <!-- ============================================
                 INFORMAÇÃO EXTRA: ID ATUAL
            ============================================ -->
            <?php if ($pagina_contrato_id > 0): ?>
                <hr>
                <h3>Informação técnica</h3>
                <table class="widefat" style="max-width: 500px;">
                    <tr>
                        <th>Opção no banco</th>
                        <td><code>photomusic_contrato_page</code></td>
                    </tr>
                    <tr>
                        <th>ID salvo</th>
                        <td><strong><?php echo esc_html($pagina_contrato_id); ?></strong></td>
                    </tr>
                    <tr>
                        <th>Título da página</th>
                        <td><?php echo $pagina_salva ? esc_html($pagina_salva->post_title) : '<em style="color:#b32d2e;">Página não encontrada</em>'; ?></td>
                    </tr>
                    <tr>
                        <th>URL pública</th>
                        <td>
                            <?php if ($url_publica): ?>
                                <a href="<?php echo esc_url($url_publica); ?>" target="_blank">
                                    <?php echo esc_html($url_publica); ?>
                                </a>
                            <?php else: ?>
                                <em style="color:#b32d2e;">URL não disponível</em>
                            <?php endif; ?>
                        </td>
                    </tr>
                </table>
            <?php endif; ?>

        </div>

        <?php
    }
}