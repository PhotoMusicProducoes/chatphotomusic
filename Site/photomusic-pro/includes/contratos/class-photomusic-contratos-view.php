<?php
// includes/contratos/class-photomusic-contratos-view.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_View {

    /* ============================================================
       RENDERIZA A VISUALIZAÇÃO PÚBLICA DO CONTRATO
       ============================================================ */
    public static function render() {

        if (!isset($_GET['token'])) {
            wp_die('Token inválido.');
        }

        $token = sanitize_text_field($_GET['token']);
        $contrato = PhotoMusic_Contratos::get_by_token($token);

        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        ?>

        <div class="pm-contrato-view">

            <h1>Contrato #<?php echo $contrato->id; ?></h1>

            <p><strong>Status:</strong> <?php echo esc_html($contrato->status_contrato); ?></p>

            <hr>

            <div class="pm-contrato-conteudo">
                <?php echo wp_kses_post($contrato->conteudo); ?>
            </div>

            <hr>

            <!-- FORMULÁRIO DE ASSINATURA DO CONTRATANTE -->
            <?php if ($contrato->status_contrato === 'aguardando_assinatura_contratante') : ?>

                <h2>Assinar Contrato</h2>

                <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">

                    <?php wp_nonce_field('pm_assinar_contratante'); ?>

                    <input type="hidden" name="action" value="pm_assinar_contratante">
                    <input type="hidden" name="contrato_id" value="<?php echo $contrato->id; ?>">

                    <p>
                        <label>Seu Nome Completo</label><br>
                        <input type="text" name="nome" required class="regular-text">
                    </p>

                    <p>
                        <button type="submit" class="button button-primary">
                            Assinar Contrato
                        </button>
                    </p>

                </form>

            <?php elseif ($contrato->status_contrato === 'assinado' || $contrato->status_contrato === 'assinado_contratante') : ?>

                <p><strong>Este contrato já foi assinado.</strong></p>

            <?php endif; ?>

        </div>

        <?php
    }
}
