<?php
// includes/eucaristia/class-photomusic-formulario-eucaristia.php
// Shortcode público + processamento do pré-cadastro da 1ª Eucaristia

if (!defined('ABSPATH')) exit;

class PhotoMusic_Formulario_Eucaristia {

    public static function init() {
        add_shortcode('photomusic_formulario_eucaristia', [__CLASS__, 'render_formulario']);
        add_action('init', [__CLASS__, 'processar_formulario']);
    }

    /* ============================================================
       SHORTCODE: [photomusic_formulario_eucaristia]
       Exibe o formulário público de pré-cadastro
    ============================================================ */
    public static function render_formulario() {

        // Mensagem de confirmação após envio
        if (!empty($_GET['pm_eucaristia']) && $_GET['pm_eucaristia'] === 'enviado') {
            return '<div style="max-width:640px;margin:30px auto;padding:20px;background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;font-family:system-ui,sans-serif;">
                <h2 style="color:#2e7d32;margin-top:0;">✅ Cadastro enviado com sucesso!</h2>
                <p>Recebemos suas informações. Em breve entraremos em contato via WhatsApp para confirmar o agendamento e enviar o contrato para assinatura.</p>
                <p><strong>PhotoMusic Produções</strong> — (21) 96442-8172</p>
            </div>';
        }

        $vp = esc_html(get_option('pm_eucaristia_valor_pix',    '150,00'));
        $vc = esc_html(get_option('pm_eucaristia_valor_cartao', '170,00'));

        ob_start();
        ?>
        <div class="pm-form-eucaristia" style="max-width:640px;margin:30px auto;font-family:system-ui,sans-serif;padding:0 16px;">

            <h2 style="margin-bottom:4px;">📸 Fotografia — 1ª Eucaristia</h2>
            <p style="color:#555;margin-top:0;">Preencha seus dados para contratar a cobertura fotográfica. Após o envio, entraremos em contato para confirmar e enviar o contrato.</p>

            <?php if (!empty($_GET['pm_erro'])): ?>
            <div style="background:#ffebee;border:1px solid #f44336;border-radius:4px;padding:12px;margin-bottom:16px;color:#b71c1c;">
                <?php echo esc_html(urldecode($_GET['pm_erro'])); ?>
            </div>
            <?php endif; ?>

            <form method="post" id="pm-form-eucaristia">
                <?php wp_nonce_field('pm_precadastro_eucaristia', 'pm_eucaristia_nonce'); ?>
                <input type="hidden" name="pm_action" value="pm_precadastro_eucaristia">

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
                    </p>
                    <p>
                        <label style="display:block;font-weight:600;margin-bottom:4px;">RG</label>
                        <input type="text" name="rg"
                               style="width:100%;max-width:220px;padding:8px;border:1px solid #ccc;border-radius:4px;">
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

                <!-- DADOS DA CATEQUESE -->
                <fieldset style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin-bottom:20px;">
                    <legend style="font-weight:bold;padding:0 8px;">⛪ Dados da Catequese</legend>
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
                        <strong>PIX</strong> — R$ <?php echo $vp; ?> à vista
                        <span style="display:block;font-size:0.85em;color:#555;margin-top:4px;margin-left:20px;">Desconto de R$ <?php echo number_format(floatval(str_replace(',','.',$vc)) - floatval(str_replace(',','.',$vp)), 2, ',', '.'); ?> para pagamento via PIX</span>
                    </label>
                    <label style="display:block;cursor:pointer;padding:10px;border:1px solid #ccc;border-radius:4px;">
                        <input type="radio" name="forma_pagamento_eucaristia" value="cartao">
                        <strong>Cartão de Crédito</strong> — R$ <?php echo $vc; ?> em 3x sem juros
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
            // Máscara CPF
            var cpfEl = document.getElementById('pm-cpf-pub');
            if (cpfEl) cpfEl.addEventListener('input', function() {
                var v = this.value.replace(/\D/g,'').substring(0,11);
                v = v.replace(/(\d{3})(\d)/,'$1.$2');
                v = v.replace(/(\d{3})(\d)/,'$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
                this.value = v;
            });
            // Máscara telefone
            var telEl = document.getElementById('pm-tel-pub');
            if (telEl) telEl.addEventListener('input', function() {
                var v = this.value.replace(/\D/g,'').substring(0,11);
                if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
                else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
                this.value = v;
            });
            // Adicionar catequizando
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
        $fp               = in_array($_POST['forma_pagamento_eucaristia'] ?? '', ['pix','cartao'])
                            ? $_POST['forma_pagamento_eucaristia'] : null;

        // Validações mínimas
        $erro = '';
        if (empty($nome_contratante)) $erro = 'O nome é obrigatório.';
        elseif (empty($telefone))     $erro = 'O celular/WhatsApp é obrigatório.';
        elseif (empty($nome_paroquia)) $erro = 'O nome da paróquia é obrigatório.';
        elseif (empty($fp))           $erro = 'Selecione a forma de pagamento.';

        // Validação CPF
        $cpf = preg_replace('/\D/', '', $_POST['cpf'] ?? '');
        if (empty($erro) && !empty($cpf) && strlen($cpf) !== 11) {
            $erro = 'CPF inválido. Verifique o número digitado.';
        }

        // Pelo menos um catequizando
        $nomes_cat = array_filter(array_map('sanitize_text_field', (array)($_POST['catequizando_nome'] ?? [])));
        if (empty($erro) && empty($nomes_cat)) {
            $erro = 'Informe o nome de pelo menos um(a) catequizando(a).';
        }

        if (!empty($erro)) {
            wp_redirect(add_query_arg('pm_erro', urlencode($erro), wp_get_referer() ?: get_permalink()));
            exit;
        }

        // Monta o motivo/título do evento
        $primeiro_cat = reset($nomes_cat);
        $motivo = '1ª Eucaristia — ' . $primeiro_cat;
        if (count($nomes_cat) > 1) {
            $motivo .= ' e mais ' . (count($nomes_cat) - 1);
        }

        // Insere evento com status de pré-cadastro
        $dados_evento = [
            'tipo_evento'                => 'PF',
            'nome_contratante'           => $nome_contratante,
            'cpf'                        => $cpf ?: null,
            'rg'                         => sanitize_text_field($_POST['rg'] ?? '') ?: null,
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
            'tipo_celebracao'            => '1eucaristia',
            'nome_catequista'            => sanitize_text_field($_POST['nome_catequista'] ?? '') ?: null,
            'horario_catequese'          => sanitize_text_field($_POST['horario_catequese'] ?? '') ?: null,
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
                 . "👤 {$nome_contratante} — " . $telefone . "\n"
                 . "✝️ " . implode(', ', $nomes_cat) . "\n"
                 . "⛪ {$nome_paroquia}\n"
                 . "💳 " . ($fp === 'pix' ? 'PIX' : 'Cartão') . "\n"
                 . "🔗 Acesse: " . admin_url('admin.php?page=photomusic-eventos');
            PhotoMusic_WhatsApp::send($tel_admin, $msg, ['id_evento' => $id_evento]);
        }

        // Cria contrato rascunho
        if (class_exists('PhotoMusic_Contratos')) {
            PhotoMusic_Contratos::criar_contrato_simplificado($id_evento, 0);
        }

        wp_redirect(add_query_arg('pm_eucaristia', 'enviado', get_permalink()));
        exit;
    }
}
