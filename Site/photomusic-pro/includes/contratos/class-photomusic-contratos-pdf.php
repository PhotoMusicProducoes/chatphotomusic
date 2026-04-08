<?php
// includes/contratos/class-photomusic-contratos-pdf.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_PDF {

    /* ============================================================
       GERAR PDF FINAL DO CONTRATO
    ============================================================ */
    public static function gerar_pdf($contrato) {

        // Verifica se o TCPDF está disponível
        if (!class_exists('TCPDF')) {
            require_once PHOTOMUSIC_PRO_PATH . 'libs/tcpdf/tcpdf.php';
        }

        if (!class_exists('TCPDF')) {
            wp_die('Biblioteca TCPDF não encontrada. Verifique se o arquivo libs/tcpdf/tcpdf.php existe.');
        }

        // Dados da empresa para o footer
        $empresa = PhotoMusic_Empresa::get();

        // Link público do contrato
        $link_publico = home_url('/contrato/' . $contrato->token);

        // Diretório onde o PDF será salvo
        $upload_dir = wp_upload_dir();
        $dir        = $upload_dir['basedir'] . '/contratos';

        if (!file_exists($dir)) {
            wp_mkdir_p($dir);
        }

        // Caminho físico do arquivo (usa token para segurança — token é único e não previsível)
        $token_pdf = !empty($contrato->token) ? $contrato->token : $contrato->id;
        $arquivo   = $dir . '/contrato-' . $token_pdf . '.pdf';

        // URL pública do PDF
        $url_publica = $upload_dir['baseurl'] . '/contratos/contrato-' . $token_pdf . '.pdf';

        /* ============================================================
           CRIAR INSTÂNCIA DO TCPDF
        ============================================================ */
        $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);

        // Metadados do documento
        $pdf->SetCreator('PhotoMusic Pro');
        $pdf->SetAuthor($empresa['razao_social'] ?? 'PhotoMusic Produções');
        $pdf->SetTitle('Contrato de Prestação de Serviços #' . $contrato->id);
        $pdf->SetSubject('Contrato PhotoMusic');
        $pdf->SetKeywords('contrato, photomusic, serviços');

        // Margens
        $pdf->SetMargins(20, 20, 20);
        $pdf->SetHeaderMargin(10);
        $pdf->SetFooterMargin(15);

        // Quebra automática de página
        $pdf->SetAutoPageBreak(true, 25);

        // Fonte padrão
        $pdf->SetFont('dejavusans', '', 11);

        /* ============================================================
           HEADER DO PDF
        ============================================================ */
        $pdf->SetHeaderData('', 0, '', '');
        $pdf->setPrintHeader(false);

        /* ============================================================
           FOOTER DO PDF — dados da empresa
        ============================================================ */
        $pdf->setPrintFooter(true);

        // Classe anônima para o footer customizado
        $razao  = $empresa['razao_social'] ?? 'PhotoMusic Produções';
        $cnpj   = $empresa['cnpj']         ?? '';
        $tel    = $empresa['telefone']      ?? '';
        $site   = $empresa['site']          ?? '';

        // TCPDF não suporta closures no footer — usamos setFooterFont e writeHTMLCell
        // O footer é configurado abaixo via classe estendida

        /* ============================================================
           ADICIONAR PÁGINA
        ============================================================ */
        $pdf->AddPage();

        /* ============================================================
           CONTEÚDO HTML DO PDF
        ============================================================ */
        $html = self::template_html($contrato, $link_publico, $empresa);

        $pdf->writeHTML($html, true, false, true, false, '');

        /* ============================================================
           SALVAR O PDF
        ============================================================ */
        $pdf->Output($arquivo, 'F');

        // Salvar URL no banco
        PhotoMusic_Contratos::salvar_pdf($contrato->id, $url_publica);

        return $url_publica;
    }

    /* ============================================================
       TEMPLATE HTML DO CONTRATO
    ============================================================ */
    protected static function template_html($contrato, $link_publico, $empresa) {

        // Dados da empresa
        $razao  = esc_html($empresa['razao_social'] ?? 'PhotoMusic Produções');
        $cnpj   = esc_html($empresa['cnpj']         ?? '');
        $tel    = esc_html($empresa['telefone']      ?? '');
        $site   = esc_html($empresa['site']          ?? '');

        // Logo da empresa
        $logo_path = PHOTOMUSIC_PRO_PATH . 'assets/logo.png';
        $logo_html = '';
        if (file_exists($logo_path)) {
            $logo_url  = PHOTOMUSIC_PRO_URL . 'assets/logo.png';
            $logo_html = '<img src="' . esc_url($logo_url) . '" style="max-width:180px; margin-bottom:10px;" />';
        }

        // Formatar datas
        $data_contratante = !empty($contrato->assinatura_contratante_data)
            ? date('d/m/Y H:i', strtotime($contrato->assinatura_contratante_data))
            : '—';

        $data_admin = !empty($contrato->assinatura_admin_data)
            ? date('d/m/Y H:i', strtotime($contrato->assinatura_admin_data))
            : '—';

        // Hash abreviado para exibição
        $hash_curto = !empty($contrato->hash_contrato)
            ? substr($contrato->hash_contrato, 0, 32) . '...'
            : '—';

        ob_start();
        ?>

        <!-- CONTEÚDO DO CONTRATO (já inclui cabeçalho com logo, número e identificação das partes) -->
        <div style="font-size:11px; line-height:1.7; text-align:justify; margin-bottom:30px;">
            <?php echo html_entity_decode(wp_kses_post($contrato->conteudo), ENT_QUOTES | ENT_HTML5, 'UTF-8'); ?>
        </div>

        <!-- ASSINATURAS -->
        <table style="width:100%; margin-top:40px; border-top:1px solid #000; padding-top:10px;">
            <tr>

                <!-- Assinatura do Contratante -->
                <td style="width:48%; vertical-align:top; padding-right:10px;">
                    <p style="font-size:11px; font-weight:bold; margin-bottom:5px;">Assinatura do Contratante:</p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>Nome:</strong> <?php echo esc_html($contrato->assinatura_contratante_nome ?? '—'); ?>
                    </p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>Data:</strong> <?php echo $data_contratante; ?>
                    </p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>IP:</strong> <?php echo esc_html($contrato->assinatura_contratante_ip ?? '—'); ?>
                    </p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>Dispositivo:</strong> <?php echo esc_html($contrato->assinatura_contratante_useragent ? self::resumir_useragent($contrato->assinatura_contratante_useragent) : '—'); ?>
                    </p>
                </td>

                <!-- Espaço -->
                <td style="width:4%;"></td>

                <!-- Assinatura do Representante Legal -->
                <td style="width:48%; vertical-align:top; padding-left:10px; border-left:1px solid #ccc;">
                    <p style="font-size:11px; font-weight:bold; margin-bottom:5px;">Assinatura do Representante Legal:</p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>Nome:</strong> <?php echo esc_html($contrato->assinatura_admin_nome ?? '—'); ?>
                    </p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>Data:</strong> <?php echo $data_admin; ?>
                    </p>
                    <p style="font-size:11px; margin:3px 0;">
                        <strong>IP:</strong> <?php echo esc_html($contrato->assinatura_admin_ip ?? '—'); ?>
                    </p>
                </td>

            </tr>
        </table>

        <!-- VERIFICAÇÃO DE AUTENTICIDADE -->
        <table style="width:100%; margin-top:30px; background:#f9f9f9; border:1px solid #ddd; padding:12px;">
            <tr>
                <td style="text-align:center;">
                    <p style="font-size:10px; font-weight:bold; margin-bottom:6px; color:#333;">
                        Verificar autenticidade deste contrato:
                    </p>
                    <p style="font-size:10px; margin:4px 0;">
                        <a href="<?php echo esc_url($link_publico); ?>" style="color:#2271b1;">
                            <?php echo esc_html($link_publico); ?>
                        </a>
                    </p>
                    <p style="font-size:9px; color:#777; margin-top:6px;">
                        Hash: <?php echo esc_html($hash_curto); ?>
                    </p>
                </td>
            </tr>
        </table>

        <!-- FOOTER DA EMPRESA -->
        <table style="width:100%; margin-top:20px; border-top:1px solid #ccc; padding-top:8px;">
            <tr>
                <td style="text-align:center; font-size:9px; color:#555;">
                    <?php echo $razao; ?>
                    <?php if ($cnpj): ?> — CNPJ <?php echo $cnpj; ?><?php endif; ?>
                    <?php if ($tel):  ?> — <?php echo $tel; ?><?php endif; ?>
                    <?php if ($site): ?> — <?php echo $site; ?><?php endif; ?>
                </td>
            </tr>
        </table>

        <?php
        return ob_get_clean();
    }

    /* ============================================================
       RESUMIR USER AGENT PARA EXIBIÇÃO
    ============================================================ */
    protected static function resumir_useragent($ua) {
        if (stripos($ua, 'iPhone') !== false)  return 'iPhone';
        if (stripos($ua, 'iPad') !== false)    return 'iPad';
        if (stripos($ua, 'Android') !== false) return 'Android';
        if (stripos($ua, 'Windows') !== false) return 'Windows';
        if (stripos($ua, 'Mac') !== false)     return 'Mac';
        return 'Navegador web';
    }
}