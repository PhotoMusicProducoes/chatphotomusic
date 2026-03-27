<?php
// includes/contratos/class-photomusic-contratos-edit.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Edit {

    /* ============================================================
       RENDERIZA A TELA DE EDIÇÃO DO CONTRATO
       ============================================================ */
    public static function render() {

        if (!isset($_GET['id'])) {
            wp_die('Contrato inválido.');
        }

        $contrato_id = intval($_GET['id']);
        $contrato = PhotoMusic_Contratos::get($contrato_id);

        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        // Validação de status + permissão
        PhotoMusic_Contratos_Permissoes::validar_status_para_edicao($contrato);
        ?>

        <div class="wrap">
            <h1>Editar Contrato #<?php echo $contrato->id; ?></h1>

            <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">

                <?php wp_nonce_field('pm_editar_contrato'); ?>
                <input type="hidden" name="action" value="pm_editar_contrato">
                <input type="hidden" name="contrato_id" value="<?php echo $contrato->id; ?>">

                <h2>Número do Contrato</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nº do Contrato</label></th>
                        <td>
                            <input type="number" min="1" name="numero_contrato"
                                   value="<?php echo esc_attr($contrato->numero_contrato ?? ''); ?>"
                                   style="width:120px;">
                            <p class="description">Deixe em branco para gerar automaticamente na hora de gerar o contrato.</p>
                        </td>
                    </tr>
                </table>

                <h2>Informações do Evento</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nome do Evento</label></th>
                        <td><input type="text" name="evento_nome" value="<?php echo esc_attr($contrato->evento_nome); ?>" class="regular-text"></td>
                    </tr>

                    <tr>
                        <th><label>Data do Evento</label></th>
                        <td><input type="date" name="evento_data" value="<?php echo esc_attr($contrato->evento_data); ?>"></td>
                    </tr>
                </table>

                <h2>Informações do Cliente</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nome do Cliente</label></th>
                        <td><input type="text" name="cliente_nome" value="<?php echo esc_attr($contrato->cliente_nome); ?>" class="regular-text"></td>
                    </tr>

                    <tr>
                        <th><label>Email do Cliente</label></th>
                        <td><input type="email" name="cliente_email" value="<?php echo esc_attr($contrato->cliente_email); ?>" class="regular-text"></td>
                    </tr>
                </table>

                <h2>Informações Financeiras</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Valor Total</label></th>
                        <td><input type="number" step="0.01" name="valor_total" value="<?php echo esc_attr($contrato->valor_total); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Forma de Pagamento</label></th>
                        <td>
                            <select name="forma_pagamento">
                                <option value="">— Selecione —</option>
                                <?php
                                $formas = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária', 'Boleto Bancário', 'Cheque', 'A combinar'];
                                foreach ($formas as $f) {
                                    $sel = (($contrato->forma_pagamento ?? '') === $f) ? ' selected' : '';
                                    echo '<option value="' . esc_attr($f) . '"' . $sel . '>' . esc_html($f) . '</option>';
                                }
                                ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label>Observações de Pagamento</label></th>
                        <td>
                            <textarea name="obs_pagamento" rows="3" class="large-text"><?php echo esc_textarea($contrato->obs_pagamento ?? ''); ?></textarea>
                            <p class="description">Ex: Sinal pago R$ 500. Restante (R$ 1.000) a pagar no evento via Pix.</p>
                        </td>
                    </tr>
                </table>

                <hr>

                <!-- BOTÃO: SALVAR ALTERAÇÕES -->
                <?php if (apply_filters('photomusic_contratos_show_btn_editar', false)) : ?>
                    <button type="submit" class="button button-primary">
                        Salvar Alterações
                    </button>
                <?php endif; ?>

            </form>

            <hr>

            <!-- BOTÃO: ENVIAR PARA ASSINATURA INTERNA -->
            <?php if ($contrato->status_contrato === 'rascunho' &&
                      apply_filters('photomusic_contratos_show_btn_enviar', false)) : ?>

                <a href="<?php echo wp_nonce_url(
                    admin_url('admin-post.php?action=pm_enviar_assinatura&contrato_id=' . $contrato->id),
                    'pm_enviar_assinatura'
                ); ?>"
                   class="button button-primary">
                    Enviar para Assinatura Interna
                </a>

            <?php endif; ?>

            <!-- BOTÃO: CANCELAR CONTRATO -->
            <?php if ($contrato->status_contrato !== 'assinado' &&
                      apply_filters('photomusic_contratos_show_btn_cancelar', false)) : ?>

                <a href="<?php echo wp_nonce_url(
                    admin_url('admin-post.php?action=pm_cancelar_contrato&contrato_id=' . $contrato->id),
                    'pm_cancelar_contrato'
                ); ?>"
                   class="button button-danger"
                   onclick="return confirm('Tem certeza que deseja cancelar este contrato?');">
                    Cancelar Contrato
                </a>

            <?php endif; ?>

            <!-- BOTÃO: ASSINAR COMO EMPRESA -->
            <?php if ($contrato->status_contrato === 'aguardando_assinatura_admin' &&
                      apply_filters('photomusic_contratos_show_btn_assinar', false)) : ?>

                <a href="<?php echo wp_nonce_url(
                    admin_url('admin-post.php?action=pm_assinar_empresa&contrato_id=' . $contrato->id),
                    'pm_assinar_empresa'
                ); ?>"
                   class="button button-primary">
                    Assinar como Empresa
                </a>

            <?php endif; ?>

        </div>

        <?php
    }
}
