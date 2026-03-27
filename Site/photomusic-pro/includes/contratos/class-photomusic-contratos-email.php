<?php
// includes/contratos/class-photomusic-contratos-email.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Email {

    /* ============================================================
       INICIALIZA OS HOOKS
       ============================================================ */
    public static function init() {

        // Enviar contrato para o cliente
        add_action('photomusic_contrato_enviado', [__CLASS__, 'enviar_para_cliente'], 10, 2);

        // Cliente assinou → enviar para admin
        add_action('photomusic_contrato_assinado_contratante', [__CLASS__, 'enviar_para_admin'], 10, 2);

        // Contrato finalizado → enviar PDF final
        add_action('photomusic_contrato_finalizado', [__CLASS__, 'enviar_pdf_final'], 10, 2);
    }

    /* ============================================================
       ENVIAR CONTRATO PARA O CLIENTE
       ============================================================ */
    public static function enviar_para_cliente($contrato, $link_publico) {

        $email = sanitize_email($contrato->email_contratante);

        if (empty($email)) {
            return;
        }

        $assunto = "Seu contrato está disponível para assinatura";
        $mensagem = self::template_email_cliente($contrato, $link_publico);

        wp_mail($email, $assunto, $mensagem, ['Content-Type: text/html; charset=UTF-8']);

        // Log
        if (class_exists('PhotoMusic_Contratos_Logs')) {
            PhotoMusic_Contratos_Logs::registrar(
                $contrato->id,
                'email_enviado_cliente',
                "Contrato enviado para o cliente: {$email}"
            );
        }
    }

    /* ============================================================
       ENVIAR NOTIFICAÇÃO PARA O ADMIN APÓS ASSINATURA
       ============================================================ */
    public static function enviar_para_admin($contrato, $link_publico) {

        $email_admin = get_option('admin_email');

        $assunto = "Contrato assinado pelo cliente";
        $mensagem = self::template_email_admin($contrato, $link_publico);

        wp_mail($email_admin, $assunto, $mensagem, ['Content-Type: text/html; charset=UTF-8']);

        // Log
        if (class_exists('PhotoMusic_Contratos_Logs')) {
            PhotoMusic_Contratos_Logs::registrar(
                $contrato->id,
                'email_enviado_admin',
                "Admin notificado sobre assinatura do contrato."
            );
        }
    }

    /* ============================================================
       ENVIAR PDF FINAL PARA O CLIENTE
       ============================================================ */
    public static function enviar_pdf_final($contrato, $pdf_url) {

        $email = sanitize_email($contrato->email_contratante);

        if (empty($email)) {
            return;
        }

        $assunto = "Contrato finalizado — PDF disponível";
        $mensagem = self::template_email_pdf($contrato, $pdf_url);

        // Anexo físico (opcional)
        $upload_dir = wp_upload_dir();
        $arquivo_fisico = $upload_dir['basedir'] . '/contratos/contrato-' . $contrato->id . '.pdf';

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        if (file_exists($arquivo_fisico)) {
            wp_mail($email, $assunto, $mensagem, $headers, [$arquivo_fisico]);
        } else {
            wp_mail($email, $assunto, $mensagem, $headers);
        }

        // Log
        if (class_exists('PhotoMusic_Contratos_Logs')) {
            PhotoMusic_Contratos_Logs::registrar(
                $contrato->id,
                'email_pdf_final',
                "PDF final enviado para o cliente."
            );
        }
    }

    /* ============================================================
       TEMPLATE — E-MAIL PARA CLIENTE
       ============================================================ */
    protected static function template_email_cliente($contrato, $link_publico) {

        ob_start();
        ?>

        <p>Olá <?php echo esc_html($contrato->nome_contratante); ?>,</p>

        <p>Seu contrato está disponível para leitura e assinatura:</p>

        <p><a href="<?php echo esc_url($link_publico); ?>" target="_blank">
            Clique aqui para acessar o contrato
        </a></p>

        <p>Atenciosamente,<br>PhotoMusic Produções</p>

        <?php
        return ob_get_clean();
    }

    /* ============================================================
       TEMPLATE — E-MAIL PARA ADMIN
       ============================================================ */
    protected static function template_email_admin($contrato, $link_publico) {

        ob_start();
        ?>

        <p>O cliente <strong><?php echo esc_html($contrato->assinatura_contratante_nome); ?></strong> assinou o contrato.</p>

        <p>Contrato disponível em:<br>
        <a href="<?php echo esc_url($link_publico); ?>" target="_blank">
            <?php echo esc_html($link_publico); ?>
        </a></p>

        <p>PhotoMusic Produções</p>

        <?php
        return ob_get_clean();
    }

    /* ============================================================
       TEMPLATE — E-MAIL COM PDF FINAL
       ============================================================ */
    protected static function template_email_pdf($contrato, $pdf_url) {

        ob_start();
        ?>

        <p>Olá <?php echo esc_html($contrato->nome_contratante); ?>,</p>

        <p>Seu contrato foi finalizado e está disponível em PDF:</p>

        <p><a href="<?php echo esc_url($pdf_url); ?>" target="_blank">
            Baixar contrato em PDF
        </a></p>

        <p>O arquivo também foi anexado a este e-mail.</p>

        <p>Atenciosamente,<br>PhotoMusic Produções</p>

        <?php
        return ob_get_clean();
    }
}
