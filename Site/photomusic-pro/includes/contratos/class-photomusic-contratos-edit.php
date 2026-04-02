<?php
// includes/contratos/class-photomusic-contratos-edit.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Edit {

    /* ============================================================
       RENDERIZA A TELA DE EDIÇÃO (apenas número do contrato)
       ============================================================ */
    public static function render() {

        if (!isset($_GET['id'])) {
            wp_die('Contrato inválido.');
        }

        $contrato_id = intval($_GET['id']);
        $contrato    = PhotoMusic_Contratos::get($contrato_id);

        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        if (!current_user_can('administrator') && !PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_die('Você não tem permissão para editar contratos.');
        }

        $id_evento   = $contrato->id_evento;
        $voltar_url  = admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $contrato_id);
        $updated     = !empty($_GET['updated']);
        ?>

        <div class="wrap">
            <h1>Alterar Número do Contrato #<?php echo $contrato->id; ?></h1>

            <p>
                <a class="button" href="<?php echo esc_url($voltar_url); ?>">← Voltar ao Contrato</a>
            </p>

            <?php if ($updated): ?>
                <div class="notice notice-success is-dismissible">
                    <p>✅ Número do contrato atualizado com sucesso!</p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo admin_url('admin-post.php'); ?>" style="margin-top:20px;">

                <?php wp_nonce_field('pm_editar_contrato'); ?>
                <input type="hidden" name="action"      value="pm_editar_contrato">
                <input type="hidden" name="contrato_id" value="<?php echo $contrato->id; ?>">

                <table class="form-table">
                    <tr>
                        <th><label for="numero_contrato">Nº do Contrato</label></th>
                        <td>
                            <input type="number" id="numero_contrato" name="numero_contrato" min="1"
                                   value="<?php echo esc_attr($contrato->numero_contrato ?? ''); ?>"
                                   style="width:140px; font-size:1.2em;">
                            <p class="description">Informe o número que deve aparecer neste contrato.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Salvar Número'); ?>

            </form>
        </div>

        <?php
    }
}
