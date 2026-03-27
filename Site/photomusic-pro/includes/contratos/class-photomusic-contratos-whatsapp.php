<?php
// includes/contratos/class-photomusic-contratos-whatsapp.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_WhatsApp {

    /* ============================================================
       INICIALIZA HOOKS
       ============================================================ */
    public static function init() {

        // Contrato enviado para assinatura
        add_action('photomusic_contrato_enviado', [__CLASS__, 'enviar_para_contratante'], 10, 2);

        // Cliente assinou → notificar admin
        add_action('photomusic_contrato_assinado_contratante', [__CLASS__, 'notificar_admin'], 10, 2);

        // Contrato finalizado → enviar PDF
        add_action('photomusic_contrato_finalizado', [__CLASS__, 'enviar_pdf_final'], 10, 2);
    }

    /* ============================================================
       ENVIA LINK DO CONTRATO PARA O CONTRATANTE
       ============================================================ */
    public static function enviar_para_contratante($contrato, $link_publico) {

        if (empty($contrato->telefone_contratante)) {
            return;
        }

        $template = get_option('pm_msg_convite',
            "Olá {nome}, seu contrato está disponível para assinatura: {link}"
        );

        $mensagem = PhotoMusic_WhatsApp::build_message($template, [
            'nome' => $contrato->nome_contratante,
            'link' => $link_publico
        ]);

        PhotoMusic_WhatsApp::send($contrato->telefone_contratante, $mensagem, [
            'id_evento' => $contrato->id_evento
        ]);

        PhotoMusic_Contratos_Logs::registrar(
            $contrato->id,
            'whatsapp_envio_contrato',
            "WhatsApp enviado para o contratante ({$contrato->telefone_contratante})"
        );
    }

    /* ============================================================
       NOTIFICA ADMIN APÓS ASSINATURA DO CLIENTE
       ============================================================ */
    public static function notificar_admin($contrato, $link_publico) {

        $telefone_admin = get_option('pm_whatsapp_admin');

        if (empty($telefone_admin)) {
            return;
        }

        $mensagem = "O cliente {$contrato->assinatura_contratante_nome} assinou o contrato. Acesse: {$link_publico}";

        PhotoMusic_WhatsApp::send($telefone_admin, $mensagem, [
            'id_evento' => $contrato->id_evento
        ]);

        PhotoMusic_Contratos_Logs::registrar(
            $contrato->id,
            'whatsapp_envio_admin',
            "WhatsApp enviado para o admin ({$telefone_admin})"
        );
    }

    /* ============================================================
       ENVIA PDF FINAL PARA O CONTRATANTE (Z-API)
       ============================================================ */
    public static function enviar_pdf_final($contrato, $pdf_url) {

        if (empty($contrato->telefone_contratante)) {
            return;
        }

        $mensagem = "Seu contrato foi finalizado. Aqui está o PDF:";

        PhotoMusic_WhatsApp::send_pdf_zapi(
            $contrato->telefone_contratante,
            $mensagem,
            $pdf_url
        );

        PhotoMusic_Contratos_Logs::registrar(
            $contrato->id,
            'whatsapp_envio_pdf',
            "PDF final enviado via WhatsApp para {$contrato->telefone_contratante}"
        );
    }

    /* ============================================================
       GERAR LINK MANUAL PARA BOTÕES NO ADMIN
       ============================================================ */
    public static function gerar_link($telefone, $mensagem) {

        $telefone = preg_replace('/\D/', '', $telefone);
        $mensagem = urlencode($mensagem);

        return "https://wa.me/55{$telefone}?text={$mensagem}";
    }
}
