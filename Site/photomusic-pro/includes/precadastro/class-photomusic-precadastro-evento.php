<?php
// includes/precadastro/class-photomusic-precadastro-evento.php
// Shortcode público de pré-cadastro para eventos de outros serviços.
// URL: /pre-cadastro/?t=TOKEN_EVENTO
// O admin adiciona a página com o shortcode [photomusic_precadastro_evento].

if (!defined('ABSPATH')) exit;

class PhotoMusic_Precadastro_Evento {

    public static function init() {
        add_shortcode('photomusic_precadastro_evento', [__CLASS__, 'render']);
        add_action('init', [__CLASS__, 'processar']);
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

        // Já preenchido?
        if ($evento->pre_cadastro_status === 'confirmado') {
            return '<div style="max-width:560px;margin:0 auto;padding:32px 16px;text-align:center;font-family:sans-serif;">'
                . '<div style="font-size:3rem;">✅</div>'
                . '<h2>Pré-cadastro já confirmado!</h2>'
                . '<p>Seus dados já foram registrados. Em breve entraremos em contato.</p>'
                . '</div>';
        }

        // Busca serviços do evento
        $servicos = $wpdb->get_results($wpdb->prepare(
            "SELECT s.nome AS nome_servico, es.horas, es.nome_pacote, es.valor_final
             FROM {$wpdb->prefix}pm_eventos_servicos es
             LEFT JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
             WHERE es.id_evento = %d
             ORDER BY es.id ASC",
            $evento->id
        ));

        // Sucesso após envio
        if (!empty($_GET['pm_precadastro']) && $_GET['pm_precadastro'] === 'enviado') {
            return self::tela_sucesso($evento);
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
                                    <td style="padding:4px 8px;"><?php echo esc_html($s->nome_servico ?? '—'); ?></td>
                                    <td style="padding:4px 8px;"><?php echo esc_html($s->horas ?? '—'); ?>h</td>
                                    <td style="padding:4px 8px;"><?php echo esc_html($s->nome_pacote ?? '—'); ?></td>
                                    <td style="padding:4px 8px;">R$ <?php echo esc_html(number_format(floatval($s->valor_final ?? 0), 2, ',', '.')); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>

            <p style="margin-bottom:20px;color:#444;">Preencha seus dados para confirmar o pré-cadastro do evento.</p>

            <form method="post">
                <?php wp_nonce_field('pm_precadastro_evento', 'pm_nonce_pc'); ?>
                <input type="hidden" name="pm_precadastro_submit" value="1">
                <input type="hidden" name="pm_token_evento" value="<?php echo esc_attr($token); ?>">

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
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Telefone / WhatsApp *</label>
                    <input type="tel" name="telefone_contratante" required value="<?php echo $tel_pre; ?>"
                           placeholder="(21) 99999-9999"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">E-mail</label>
                    <input type="email" name="email_contratante" value="<?php echo $email_pre; ?>"
                           style="width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
                </div>

                <hr style="margin:20px 0;">
                <p style="font-weight:600;margin-bottom:14px;">Endereço</p>

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
        if ($evento->pre_cadastro_status === 'confirmado') {
            wp_redirect(add_query_arg('pm_precadastro', 'enviado', get_permalink()));
            exit;
        }

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

        $dados['telefone_contratante'] = sanitize_text_field($_POST['telefone_contratante'] ?? '');
        $dados['email_contratante']    = sanitize_email($_POST['email_contratante'] ?? '');
        $dados['cont_logradouro']      = sanitize_text_field($_POST['cont_logradouro'] ?? '');
        $dados['cont_numero']          = sanitize_text_field($_POST['cont_numero'] ?? '');
        $dados['cont_complemento']     = sanitize_text_field($_POST['cont_complemento'] ?? '');
        $dados['cont_bairro']          = sanitize_text_field($_POST['cont_bairro'] ?? '');
        $dados['cont_cidade']          = sanitize_text_field($_POST['cont_cidade'] ?? '');
        $dados['cont_estado']          = strtoupper(sanitize_text_field($_POST['cont_estado'] ?? 'RJ'));
        $dados['cont_cep']             = sanitize_text_field($_POST['cont_cep'] ?? '');

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

        wp_redirect(add_query_arg('pm_precadastro', 'enviado', get_permalink()));
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
