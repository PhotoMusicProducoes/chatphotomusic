<?php
// includes/contratos/class-photomusic-os.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_OS {

    public static function gerar_os($contrato) {
        if (!$contrato) return null;

        $evento = PhotoMusic_Events::get_event($contrato->id_evento);
        if (!$evento) return null;

        $servicos = PhotoMusic_Servicos::get_evento_servicos($contrato->id_evento);

        if (!class_exists('TCPDF')) {
            if (file_exists(PHOTOMUSIC_PRO_PATH . 'libs/tcpdf/tcpdf.php')) {
                require_once PHOTOMUSIC_PRO_PATH . 'libs/tcpdf/tcpdf.php';
            } else {
                return null;
            }
        }

        // Nome da empresa
        $nome_empresa = get_bloginfo('name');

        $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
        $pdf->SetCreator('PhotoMusic Pro');
        $pdf->SetTitle('Ordem de Serviço - Contrato #' . $contrato->id);
        $pdf->SetMargins(15, 15, 15);
        $pdf->SetAutoPageBreak(true, 15);
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();

        $data_fmt = $evento->data_evento ? date('d/m/Y', strtotime($evento->data_evento)) : '—';
        $hi = $evento->horario_inicio ? substr($evento->horario_inicio, 0, 5) : '—';
        $hf = $evento->horario_fim    ? substr($evento->horario_fim, 0, 5)    : '—';

        $endereco_partes = array_filter([
            $evento->local_logradouro,
            $evento->local_numero     ? 'nº ' . $evento->local_numero     : null,
            $evento->local_complemento,
            $evento->local_bairro     ? 'Bairro: ' . $evento->local_bairro : null,
            $evento->local_cidade,
            $evento->local_estado,
            $evento->cep_evento       ? 'CEP: ' . $evento->cep_evento      : null,
        ]);
        $endereco = implode(', ', $endereco_partes) ?: ($evento->endereco_evento ?? '—');

        $html = '';

        // Cabeçalho
        $html .= '<table border="0" cellpadding="5" width="100%">';
        $html .= '<tr><td style="text-align:center;">';
        $html .= '<h2>' . esc_html($nome_empresa) . '</h2>';
        $html .= '<h1>ORDEM DE SERVIÇO</h1>';
        $html .= '<p><strong>Contrato Nº:</strong> ' . intval($contrato->id) . ' &nbsp;|&nbsp; <strong>Emissão:</strong> ' . date('d/m/Y') . '</p>';
        $html .= '</td></tr></table>';
        $html .= '<hr/>';

        // Dados do evento
        $html .= '<h3 style="background:#eeeeee; padding:4px;">DADOS DO EVENTO</h3>';
        $html .= '<table border="0" cellpadding="4" width="100%">';
        $html .= '<tr><td width="35%"><strong>Evento:</strong></td><td>' . esc_html($evento->motivo_evento) . '</td></tr>';
        $html .= '<tr><td><strong>Data:</strong></td><td>' . $data_fmt . '</td></tr>';
        $html .= '<tr><td><strong>Horário:</strong></td><td>' . $hi . ' às ' . $hf . '</td></tr>';
        if ($evento->horario_servico) {
            $html .= '<tr><td><strong>Início do serviço:</strong></td><td>' . substr($evento->horario_servico, 0, 5) . '</td></tr>';
        }
        $html .= '<tr><td><strong>Local:</strong></td><td>' . esc_html($evento->local_evento ?? '—') . '</td></tr>';
        $html .= '<tr><td><strong>Endereço:</strong></td><td>' . esc_html($endereco) . '</td></tr>';
        if ($evento->contato_salao)          $html .= '<tr><td><strong>Contato do Salão:</strong></td><td>' . esc_html($evento->contato_salao) . '</td></tr>';
        if ($evento->contato_cerimonialista) $html .= '<tr><td><strong>Cerimonialista:</strong></td><td>' . esc_html($evento->contato_cerimonialista) . '</td></tr>';
        if ($evento->contato_responsavel)    $html .= '<tr><td><strong>Responsável:</strong></td><td>' . esc_html($evento->contato_responsavel) . '</td></tr>';
        $html .= '</table>';

        // Dados da celebração
        if (!empty($evento->tipo_celebracao) || !empty($evento->nome_aniversariante) || !empty($evento->nome_noivos)) {
            $html .= '<h3 style="background:#eeeeee; padding:4px;">DADOS DA CELEBRAÇÃO</h3>';
            $html .= '<table border="0" cellpadding="4" width="100%">';
            if (!empty($evento->tipo_celebracao))    $html .= '<tr><td width="35%"><strong>Tipo:</strong></td><td>' . esc_html($evento->tipo_celebracao) . '</td></tr>';
            if (!empty($evento->tema_festa))         $html .= '<tr><td><strong>Tema:</strong></td><td>' . esc_html($evento->tema_festa) . '</td></tr>';
            if (!empty($evento->cores_festa))        $html .= '<tr><td><strong>Cores:</strong></td><td>' . esc_html($evento->cores_festa) . '</td></tr>';
            if (!empty($evento->nome_aniversariante)) {
                $html .= '<tr><td><strong>Aniversariante:</strong></td><td>' . esc_html($evento->nome_aniversariante);
                if (!empty($evento->idade_aniversariante)) $html .= ' — ' . esc_html($evento->idade_aniversariante) . ' anos';
                $html .= '</td></tr>';
            }
            if (!empty($evento->nome_pais))          $html .= '<tr><td><strong>Pais:</strong></td><td>' . esc_html($evento->nome_pais) . '</td></tr>';
            if (!empty($evento->nome_noivos))        $html .= '<tr><td><strong>Noivos:</strong></td><td>' . esc_html($evento->nome_noivos) . '</td></tr>';
            if (!empty($evento->modelo_foto))        $html .= '<tr><td><strong>Modelo de foto:</strong></td><td>' . esc_html($evento->modelo_foto) . '</td></tr>';
            $html .= '</table>';
        }

        // Dados do contratante
        $html .= '<h3 style="background:#eeeeee; padding:4px;">DADOS DO CONTRATANTE</h3>';
        $html .= '<table border="0" cellpadding="4" width="100%">';
        if ($evento->tipo_evento === 'PJ') {
            if (!empty($evento->nome_fantasia))  $html .= '<tr><td width="35%"><strong>Nome Fantasia:</strong></td><td>' . esc_html($evento->nome_fantasia) . '</td></tr>';
            if (!empty($evento->razao_social))   $html .= '<tr><td><strong>Razão Social:</strong></td><td>' . esc_html($evento->razao_social) . '</td></tr>';
            if (!empty($evento->cnpj))           $html .= '<tr><td><strong>CNPJ:</strong></td><td>' . esc_html($evento->cnpj) . '</td></tr>';
            if (!empty($evento->responsavel))    $html .= '<tr><td><strong>Responsável:</strong></td><td>' . esc_html($evento->responsavel) . '</td></tr>';
        } else {
            if (!empty($evento->nome_contratante)) $html .= '<tr><td width="35%"><strong>Nome:</strong></td><td>' . esc_html($evento->nome_contratante) . '</td></tr>';
            if (!empty($evento->cpf))              $html .= '<tr><td><strong>CPF:</strong></td><td>' . esc_html($evento->cpf) . '</td></tr>';
        }
        if (!empty($evento->telefone_contratante)) $html .= '<tr><td><strong>Telefone:</strong></td><td>' . esc_html($evento->telefone_contratante) . '</td></tr>';
        if (!empty($evento->email_contratante))    $html .= '<tr><td><strong>E-mail:</strong></td><td>' . esc_html($evento->email_contratante) . '</td></tr>';
        if (!empty($evento->grau_parentesco))      $html .= '<tr><td><strong>Parentesco:</strong></td><td>' . esc_html($evento->grau_parentesco) . '</td></tr>';
        $html .= '</table>';

        // Serviços contratados
        $html .= '<h3 style="background:#eeeeee; padding:4px;">SERVIÇOS CONTRATADOS</h3>';
        $html .= '<table border="1" cellpadding="5" width="100%">';
        $html .= '<thead><tr style="background:#dddddd;"><th>Serviço</th><th>Pacote</th><th>Horas</th><th>Observações</th><th>Valor</th></tr></thead><tbody>';
        $total = 0;
        if (!empty($servicos)) {
            foreach ($servicos as $s) {
                $val = floatval($s['valor_final']);
                $total += $val;
                $html .= '<tr>';
                $html .= '<td>' . esc_html($s['nome_servico'] ?? '—') . '</td>';
                $html .= '<td>' . esc_html($s['nome_pacote'] ?? '—') . '</td>';
                $html .= '<td style="text-align:center;">' . ($s['horas_contratadas'] ? $s['horas_contratadas'] . 'h' : '—') . '</td>';
                $html .= '<td>' . esc_html($s['observacoes'] ?? '') . '</td>';
                $html .= '<td style="text-align:right;">R$ ' . number_format($val, 2, ',', '.') . '</td>';
                $html .= '</tr>';
            }
        }
        $html .= '<tr style="background:#eeeeee;"><td colspan="4" style="text-align:right;"><strong>TOTAL</strong></td>';
        $html .= '<td style="text-align:right;"><strong>R$ ' . number_format($total, 2, ',', '.') . '</strong></td></tr>';
        $html .= '</tbody></table>';

        // Informações de pagamento
        $forma_pag = $contrato->forma_pagamento ?? '';
        $obs_pag   = $contrato->obs_pagamento   ?? '';
        if ($forma_pag || $obs_pag) {
            $alerta = (!$forma_pag || stripos($obs_pag, 'evento') !== false || stripos($obs_pag, 'local') !== false)
                ? ' style="background:#fff3cd; border:2px solid #f0ad4e;"'
                : ' style="background:#d4edda; border:2px solid #28a745;"';
            $html .= '<h3' . $alerta . ' style="padding:6px;">💰 PAGAMENTO</h3>';
            $html .= '<table border="0" cellpadding="4" width="100%">';
            if ($forma_pag) $html .= '<tr><td width="35%"><strong>Forma de Pagamento:</strong></td><td>' . esc_html($forma_pag) . '</td></tr>';
            if ($obs_pag)   $html .= '<tr><td><strong>Observações:</strong></td><td>' . nl2br(esc_html($obs_pag)) . '</td></tr>';
            $html .= '</table>';
        } elseif ($total > 0) {
            $html .= '<h3 style="background:#f8d7da; border:2px solid #dc3545; padding:6px;">⚠️ PAGAMENTO — FORMA NÃO INFORMADA</h3>';
            $html .= '<p style="color:#721c24;">Verificar forma de pagamento com o contratante.</p>';
        }

        // Assinaturas
        $html .= '<br/><br/>';
        $html .= '<table border="0" cellpadding="8" width="100%">';
        $html .= '<tr>';
        $html .= '<td width="50%" style="text-align:center; border-top:1px solid #333;">';
        $html .= esc_html($nome_empresa);
        if ($contrato->assinatura_admin_nome) {
            $html .= '<br/><small>' . esc_html($contrato->assinatura_admin_nome) . '</small>';
            if ($contrato->assinatura_admin_data) {
                $html .= '<br/><small>' . date('d/m/Y H:i', strtotime($contrato->assinatura_admin_data)) . '</small>';
            }
        }
        $html .= '</td>';
        $html .= '<td width="50%" style="text-align:center; border-top:1px solid #333;">';
        $html .= 'Contratante';
        if ($contrato->assinatura_contratante_nome) {
            $html .= '<br/><small>' . esc_html($contrato->assinatura_contratante_nome) . '</small>';
            if ($contrato->assinatura_contratante_data) {
                $html .= '<br/><small>' . date('d/m/Y H:i', strtotime($contrato->assinatura_contratante_data)) . '</small>';
            }
        }
        $html .= '</td>';
        $html .= '</tr></table>';

        $pdf->writeHTML($html, true, false, true, false, '');

        // Salvar PDF
        $upload_dir = wp_upload_dir();
        $pasta = $upload_dir['basedir'] . '/photomusic/os/';
        if (!file_exists($pasta)) {
            wp_mkdir_p($pasta);
        }

        $filename = 'os-contrato-' . intval($contrato->id) . '-' . time() . '.pdf';
        $filepath = $pasta . $filename;
        $fileurl  = $upload_dir['baseurl'] . '/photomusic/os/' . $filename;

        $pdf->Output($filepath, 'F');

        // Salvar caminho no banco
        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['os_path' => $fileurl],
            ['id' => intval($contrato->id)]
        );

        return $fileurl;
    }
}
