<?php
// includes/contratos/class-photomusic-contratos-list.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_List {

    public static function render() {

        $contratos = PhotoMusic_Contratos::get_all();
        ?>

        <div class="wrap">
            <h1>Contratos</h1>

            <!-- BOTÃO: NOVO CONTRATO -->
            <?php if (apply_filters('photomusic_contratos_show_btn_criar', false)) : ?>
                <a href="<?php echo admin_url('admin.php?page=photomusic_contratos&action=novo'); ?>"
                   class="button button-primary">
                    Novo Contrato
                </a>
            <?php endif; ?>

            <table class="widefat striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Evento</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>

                <tbody>
                    <?php foreach ($contratos as $c): ?>
                        <tr>
                            <td><?php echo $c->id; ?></td>
                            <td><?php echo esc_html($c->evento_nome); ?></td>
                            <td><?php echo esc_html($c->cliente_nome); ?></td>
                            <td><?php echo esc_html($c->status_contrato); ?></td>

                            <td>

                                <!-- BOTÃO: EDITAR -->
                                <?php if (apply_filters('photomusic_contratos_show_btn_editar', false)) : ?>
                                    <a href="<?php echo admin_url('admin.php?page=photomusic_contratos&action=editar&id=' . $c->id); ?>"
                                       class="button">
                                        Editar
                                    </a>
                                <?php endif; ?>

                                <!-- BOTÃO: ENVIAR PARA ASSINATURA INTERNA -->
                                <?php if ($c->status_contrato === 'rascunho' &&
                                          apply_filters('photomusic_contratos_show_btn_enviar', false)) : ?>
                                    <a href="<?php echo wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_enviar_assinatura&contrato_id=' . $c->id),
                                        'pm_enviar_assinatura'
                                    ); ?>"
                                       class="button button-primary">
                                        Enviar para Assinatura Interna
                                    </a>
                                <?php endif; ?>

                                <!-- BOTÃO: CANCELAR -->
                                <?php if ($c->status_contrato !== 'assinado' &&
                                          apply_filters('photomusic_contratos_show_btn_cancelar', false)) : ?>
                                    <a href="<?php echo wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_cancelar_contrato&contrato_id=' . $c->id),
                                        'pm_cancelar_contrato'
                                    ); ?>"
                                       class="button button-danger"
                                       onclick="return confirm('Tem certeza que deseja cancelar este contrato?');">
                                        Cancelar
                                    </a>
                                <?php endif; ?>

                                <!-- BOTÃO: ASSINAR COMO EMPRESA -->
                                <?php if ($c->status_contrato === 'aguardando_assinatura_admin' &&
                                          apply_filters('photomusic_contratos_show_btn_assinar', false)) : ?>
                                    <a href="<?php echo wp_nonce_url(
                                        admin_url('admin-post.php?action=pm_assinar_empresa&contrato_id=' . $c->id),
                                        'pm_assinar_empresa'
                                    ); ?>"
                                       class="button button-primary">
                                        Assinar como Empresa
                                    </a>
                                <?php endif; ?>

                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>

            </table>
        </div>

        <?php
    }
}
