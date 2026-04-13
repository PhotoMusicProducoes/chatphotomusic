<?php
// includes/contratos/class-photomusic-os.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_OS {

    /* ============================================================
       GERA A ORDEM DE SERVIÇO EM PDF — PAISAGEM, FOLHA ÚNICA
       ------------------------------------------------------------
       Layout em duas colunas para caber em uma folha A4 deitada.
       NÃO contém dados pessoais sensíveis do contratante
       (CPF, e-mail, endereço do contratante).
    ============================================================ */
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

        /* ── Dados básicos ──────────────────────────────────────── */
        $nome_empresa = get_bloginfo('name');
        $data_fmt     = $evento->data_evento ? date('d/m/Y', strtotime($evento->data_evento)) : '—';
        $dia_semana   = $evento->data_evento ? date_i18n('l', strtotime($evento->data_evento)) : '';
        $hi           = $evento->horario_inicio  ? substr($evento->horario_inicio, 0, 5)  : '—';
        $hf           = $evento->horario_fim     ? substr($evento->horario_fim, 0, 5)     : '—';
        $hs           = $evento->horario_servico ? substr($evento->horario_servico, 0, 5) : null;

        // Endereço do evento
        $end_partes = array_filter([
            $evento->local_logradouro  ?? null,
            !empty($evento->local_numero)     ? 'nº ' . $evento->local_numero     : null,
            $evento->local_complemento ?? null,
            $evento->local_bairro      ?? null,
            $evento->local_cidade      ?? null,
            $evento->local_estado      ?? null,
        ]);
        $endereco = implode(', ', $end_partes) ?: ($evento->endereco_evento ?? '—');

        /* ── Pagamento ──────────────────────────────────────────── */
        $pgto = [];
        if (!empty($evento->pagamento_config)) {
            $pgto = json_decode($evento->pagamento_config, true) ?: [];
        }

        $pgto_forma      = $pgto['forma'] ?? ($contrato->forma_pagamento ?? '');
        $pgto_descricao  = trim($pgto['descricao_pagamento'] ?? ($contrato->obs_pagamento ?? ''));
        $pgto_p1_valor   = !empty($pgto['pix_p_1_valor']) ? floatval($pgto['pix_p_1_valor']) : 0;
        $pgto_p2_valor   = !empty($pgto['pix_p_2_valor']) ? floatval($pgto['pix_p_2_valor']) : 0;
        $pgto_p2_data    = $pgto['pix_p_2_data'] ?? '';

        // Total
        $total_servicos = 0;
        foreach ((array) $servicos as $s) $total_servicos += floatval($s['valor_final']);

        $desc_segundo   = !empty($pgto['desc_segundo_servico']) ? 100.00 : 0;
        $desc_guestbook = !empty($pgto['desc_guestbook'])       ? floatval($pgto['desc_guestbook']) : 0;
        $desc_deslocam  = !empty($pgto['desc_deslocamento'])    ? floatval($pgto['desc_deslocamento']) : 0;
        $pix_desc_pct   = !empty($pgto['pix_desconto_pct'])     ? floatval($pgto['pix_desconto_pct']) : 0;
        $base_pix       = $total_servicos - $desc_segundo - $desc_guestbook;
        $pix_desc_val   = ($pgto_forma === 'pix_avista' && $pix_desc_pct > 0) ? $base_pix * ($pix_desc_pct / 100) : 0;
        $total_final    = $base_pix - $pix_desc_val + $desc_deslocam;

        // Saldo a receber no evento
        $valor_na_festa      = 0;
        $forma_na_festa      = '';
        $entrada_paga        = 0;
        $tem_pagamento_local = false;

        if ($pgto_forma === 'pix_parcelado' && $pgto_p1_valor > 0) {
            $entrada_paga        = $pgto_p1_valor;
            $valor_na_festa      = $pgto_p2_valor > 0 ? $pgto_p2_valor : max(0, $total_final - $pgto_p1_valor);
            $forma_na_festa      = 'PIX / Transferência';
            $tem_pagamento_local = $valor_na_festa > 0;
        } elseif ($pgto_forma === 'dinheiro') {
            $valor_na_festa      = $total_final;
            $forma_na_festa      = 'Dinheiro';
            $tem_pagamento_local = true;
        } elseif ($pgto_forma === 'misto') {
            $misto_val           = !empty($pgto['misto_valor']) ? floatval($pgto['misto_valor']) : 0;
            $entrada_paga        = $total_final - $misto_val;
            $valor_na_festa      = $misto_val;
            $forma_na_festa      = 'Dinheiro / PIX';
            $tem_pagamento_local = $valor_na_festa > 0;
        }

        $formas_label = [
            'pix_avista'    => 'PIX à vista',
            'pix_parcelado' => 'PIX parcelado',
            'cartao'        => 'Cartão de crédito',
            'dinheiro'      => 'Dinheiro',
            'transferencia' => 'Transferência bancária',
            'misto'         => 'Dinheiro/PIX + Cartão',
        ];
        $pgto_forma_label = $formas_label[$pgto_forma] ?? $pgto_forma;

        // Contato
        $nome_resp = $evento->tipo_evento === 'PJ'
            ? ($evento->nome_fantasia ?: ($evento->responsavel ?: ''))
            : ($evento->nome_contratante ?? '');
        $tel_resp = $evento->telefone_contratante ?? '';

        // Logo — width em pixels é o único atributo que o TCPDF respeita em <img>
        $logo_path  = PHOTOMUSIC_PRO_PATH . 'assets/logo.png';
        $logo_width_px = 160; // largura em px — ajuste aqui para mudar o tamanho

        /* ── PDF — Paisagem A4 ──────────────────────────────────── */
        $pdf = new TCPDF('L', 'mm', 'A4', true, 'UTF-8', false);
        $pdf->SetCreator('PhotoMusic Pro');
        $pdf->SetTitle('OS #' . $contrato->id . ' — ' . ($evento->motivo_evento ?? ''));
        $pdf->SetMargins(8, 8, 8);
        $pdf->SetAutoPageBreak(false);
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        $pdf->SetFont('helvetica', '', 8);

        // Prepara img tag com width fixo em pixels (TCPDF respeita width/height mas não max-width/max-height)
        $logo_html_cell = '';
        if (file_exists($logo_path)) {
            $logo_url       = PHOTOMUSIC_PRO_URL . 'assets/logo.png';
            $logo_html_cell = '<img src="' . esc_url($logo_url) . '" width="' . intval($logo_width_px) . '" />';
        }

        /* ── HTML ───────────────────────────────────────────────── */
        $h = '';   // html acumulado

        /* === CABEÇALHO — linha única sem vertical-align === */
        $h .= '<table border="0" cellpadding="2" width="100%">';
        $h .= '<tr>';

        // Célula esquerda: logo ou nome
        $h .= '<td width="40%">';
        $h .= $logo_html_cell ?: esc_html($nome_empresa);
        $h .= '</td>';

        // Célula central: título
        $h .= '<td width="35%" style="text-align:center; font-size:16pt;">';
        $h .= '<strong>ORDEM DE SERVICO</strong>';
        $h .= '</td>';

        // Célula direita: número e data
        $h .= '<td width="25%" style="text-align:right;">';
        $h .= '<strong>OS N. ' . intval($contrato->id) . '</strong><br/>';
        if (!empty($contrato->numero_contrato)) {
            $h .= 'Contrato: <strong>' . intval($contrato->numero_contrato) . '/' . intval($contrato->id) . '</strong><br/>';
        }
        $h .= 'Emissão: ' . date_i18n('d/m/Y H:i');
        $h .= '</td>';

        $h .= '</tr>';
        $h .= '</table>';
        $h .= '<hr/>';

        /* === ALERTA RECEBER NA FESTA === */
        if ($tem_pagamento_local && $valor_na_festa > 0) {
            $h .= '<table border="0" cellpadding="5" width="100%" cellspacing="0" style="margin-bottom:4px;">';
            $h .= '<tr><td bgcolor="#c0392b" style="text-align:center;">';
            $h .= '<font color="#ffffff"><b>*** RECEBER NA FESTA: R$ '
                . number_format($valor_na_festa, 2, ',', '.')
                . ($forma_na_festa ? '  -  ' . esc_html($forma_na_festa) : '')
                . '</b></font>';
            $h .= '</td></tr></table>';
        }

        /* === CORPO: DUAS COLUNAS === */
        $h .= '<table border="0" cellpadding="0" cellspacing="4" width="100%"><tr>';

        /* ─── COLUNA ESQUERDA ─── */
        $h .= '<td width="48%" style="vertical-align:top; padding-right:6px;">';

        // Dados do evento
        $h .= self::bloco_titulo('DADOS DO EVENTO');
        $h .= '<table border="0" cellpadding="2" width="100%">';
        $h .= self::linha('Evento', $evento->motivo_evento ?? '—', true);
        $h .= self::linha('Data', $data_fmt . ($dia_semana ? ' — ' . $dia_semana : ''));
        $h .= self::linha('Horário', $hi . ' às ' . $hf);
        if ($hs) $h .= self::linha('Início do serviço', $hs);
        $h .= self::linha('Local', $evento->local_evento ?? '—');
        $h .= self::linha('Endereço', $endereco);
        if (!empty($evento->contato_salao))          $h .= self::linha('Contato salão', $evento->contato_salao);
        if (!empty($evento->contato_cerimonialista)) $h .= self::linha('Cerimonialista', $evento->contato_cerimonialista);
        if (!empty($evento->contato_responsavel))    $h .= self::linha('Responsável', $evento->contato_responsavel);
        $h .= '</table>';

        // Contato do contratante
        if ($nome_resp || $tel_resp) {
            $h .= self::bloco_titulo('CONTATO');
            $h .= '<table border="0" cellpadding="2" width="100%">';
            if ($nome_resp) $h .= self::linha('Responsável', $nome_resp);
            if ($tel_resp)  $h .= self::linha('WhatsApp', $tel_resp);
            $h .= '</table>';
        }

        // Dados da celebração
        $tem_cel = !empty($evento->tipo_celebracao) || !empty($evento->nome_aniversariante)
                || !empty($evento->nome_noivos)     || !empty($evento->tema_festa)
                || !empty($evento->nome_pais);
        if ($tem_cel) {
            $h .= self::bloco_titulo('CELEBRACAO');
            $h .= '<table border="0" cellpadding="2" width="100%">';
            if (!empty($evento->tipo_celebracao))     $h .= self::linha('Tipo', $evento->tipo_celebracao);
            if (!empty($evento->tema_festa))          $h .= self::linha('Tema', $evento->tema_festa);
            if (!empty($evento->cores_festa))         $h .= self::linha('Cores', $evento->cores_festa);
            if (!empty($evento->nome_aniversariante)) {
                $aniv = $evento->nome_aniversariante;
                if (!empty($evento->idade_aniversariante)) $aniv .= ' — ' . intval($evento->idade_aniversariante) . ' anos';
                $h .= self::linha('Aniversariante', $aniv);
            }
            if (!empty($evento->nome_pais))   $h .= self::linha('Pais', $evento->nome_pais);
            if (!empty($evento->nome_noivos)) $h .= self::linha('Noivos', $evento->nome_noivos);
            if (!empty($evento->modelo_foto)) $h .= self::linha('Modelo de foto', $evento->modelo_foto);
            $h .= '</table>';
        }

        // Observações
        if (!empty($evento->observacoes_evento)) {
            $h .= self::bloco_titulo('OBSERVACOES');
            $h .= '<p style="font-size:9pt; margin:2px 0; border:1px solid #ccc; padding:4px;">';
            $h .= nl2br(esc_html(self::sem_emoji($evento->observacoes_evento)));
            $h .= '</p>';
        }

        $h .= '</td>'; // fim col esquerda

        /* ─── SEPARADOR VERTICAL ─── */
        $h .= '<td width="1" style="border-left:1px solid #bbb;">&nbsp;</td>';

        /* ─── COLUNA DIREITA ─── */
        $h .= '<td width="50%" style="vertical-align:top; padding-left:6px;">';

        // Serviços
        $h .= self::bloco_titulo('SERVICOS CONTRATADOS');
        $h .= '<table border="1" cellpadding="3" width="100%" style="border-collapse:collapse; font-size:10pt;">';
        $h .= '<tr>';
        $h .= '<td bgcolor="#cccccc"><strong>Servico</strong></td>';
        $h .= '<td bgcolor="#cccccc"><strong>Pacote</strong></td>';
        $h .= '<td bgcolor="#cccccc" width="45" style="text-align:center;"><strong>Inicio</strong></td>';
        $h .= '<td bgcolor="#cccccc" width="40" style="text-align:center;"><strong>Horas</strong></td>';
        $h .= '<td bgcolor="#cccccc"><strong>Observacoes</strong></td>';
        $h .= '</tr>';
        if (!empty($servicos)) {
            $zebra = false;
            foreach ($servicos as $s) {
                $bg = $zebra ? ' bgcolor="#f5f5f5"' : '';
                $h .= '<tr' . $bg . '>';
                $h .= '<td><strong>' . esc_html(self::sem_emoji($s['nome_servico'] ?? '—')) . '</strong></td>';
                $h .= '<td>' . esc_html(self::sem_emoji($s['nome_pacote'] ?? '—')) . '</td>';
                $h .= '<td style="text-align:center;">' . (!empty($s['horario_inicio']) ? substr($s['horario_inicio'], 0, 5) : '—') . '</td>';
                $h .= '<td style="text-align:center;">' . ($s['horas_contratadas'] ? $s['horas_contratadas'] . 'h' : '—') . '</td>';
                $h .= '<td>' . esc_html(self::sem_emoji($s['observacoes'] ?? '')) . '</td>';
                $h .= '</tr>';
                $zebra = !$zebra;
            }
        } else {
            $h .= '<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum serviço cadastrado</td></tr>';
        }
        $h .= '</tbody></table>';

        // Pagamento — exibe conforme regra:
        // - PJ (corporativo): sempre mostra (pagamento pode ser pós-evento)
        // - Tem saldo a receber no evento: mostra só o saldo
        // - Totalmente pago: não mostra nada
        $eh_corporativo = ($evento->tipo_evento === 'PJ');
        $exibir_pgto    = $eh_corporativo || ($tem_pagamento_local && $valor_na_festa > 0);

        if ($exibir_pgto) {
            $h .= self::bloco_titulo('PAGAMENTO');
            $h .= '<table border="0" cellpadding="3" width="100%">';

            if ($eh_corporativo) {
                // Corporativo: exibe total e forma completa
                if ($total_final > 0) {
                    $h .= '<tr bgcolor="#eeeeee">';
                    $h .= '<td><strong>Valor total:</strong></td>';
                    $h .= '<td style="text-align:right;"><strong>R$ ' . number_format($total_final, 2, ',', '.') . '</strong></td>';
                    $h .= '</tr>';
                }
                if ($pgto_forma_label) {
                    $h .= '<tr><td>Forma de pagamento:</td><td style="text-align:right;">' . esc_html($pgto_forma_label) . '</td></tr>';
                }
                if ($entrada_paga > 0) {
                    $h .= '<tr bgcolor="#d4edda">';
                    $h .= '<td><strong>Entrada ja paga:</strong></td>';
                    $h .= '<td style="text-align:right;"><strong>R$ ' . number_format($entrada_paga, 2, ',', '.') . '</strong></td>';
                    $h .= '</tr>';
                }
                if ($tem_pagamento_local && $valor_na_festa > 0) {
                    $data_p2_fmt = !empty($pgto_p2_data) ? ' (' . date('d/m/Y', strtotime($pgto_p2_data)) . ')' : '';
                    $h .= '<tr bgcolor="#f8d7da">';
                    $h .= '<td><strong>SALDO NO EVENTO' . esc_html($data_p2_fmt) . ':</strong></td>';
                    $h .= '<td style="text-align:right;"><strong>R$ ' . number_format($valor_na_festa, 2, ',', '.') . '</strong></td>';
                    $h .= '</tr>';
                    if ($forma_na_festa) {
                        $h .= '<tr bgcolor="#f8d7da"><td>Forma no local:</td><td style="text-align:right;">' . esc_html($forma_na_festa) . '</td></tr>';
                    }
                }
            } else {
                // Não corporativo com saldo: exibe apenas o que falta receber
                $data_p2_fmt = !empty($pgto_p2_data) ? ' (' . date('d/m/Y', strtotime($pgto_p2_data)) . ')' : '';
                $h .= '<tr bgcolor="#f8d7da">';
                $h .= '<td><strong>RECEBER NO EVENTO' . esc_html($data_p2_fmt) . ':</strong></td>';
                $h .= '<td style="text-align:right;"><strong>R$ ' . number_format($valor_na_festa, 2, ',', '.') . '</strong></td>';
                $h .= '</tr>';
                if ($forma_na_festa) {
                    $h .= '<tr bgcolor="#f8d7da"><td>Forma:</td><td style="text-align:right;">' . esc_html($forma_na_festa) . '</td></tr>';
                }
            }

            $h .= '</table>';

            if (!empty($pgto_descricao)) {
                $h .= '<p style="background:#fffde7; border:1px solid #ffe082; padding:4px; margin-top:4px;">';
                $h .= nl2br(esc_html(self::sem_emoji($pgto_descricao)));
                $h .= '</p>';
            }
        }

        $h .= '</td>'; // fim col direita
        $h .= '</tr></table>';

        /* === RODAPÉ === */
        $h .= '<table border="0" cellpadding="3" width="100%" style="border-top:1px solid #bbb; margin-top:6px;">';
        $h .= '<tr><td style="text-align:center; color:#888; font-size:8pt;">';
        $h .= 'Documento de uso interno — ' . esc_html($nome_empresa) . ' — Gerado em ' . date_i18n('d/m/Y \a\s H:i');
        $h .= '</td></tr></table>';

        /* ── Renderiza ─────────────────────────────────────────── */
        $pdf->writeHTML($h, true, false, true, false, '');

        /* ── Salva PDF ─────────────────────────────────────────── */
        $upload_dir = wp_upload_dir();
        $pasta    = $upload_dir['basedir'] . '/photomusic/os/';
        if (!file_exists($pasta)) wp_mkdir_p($pasta);

        $filename = 'os-' . intval($contrato->id) . '-' . time() . '.pdf';
        $filepath = $pasta . $filename;
        $fileurl  = $upload_dir['baseurl'] . '/photomusic/os/' . $filename;

        $pdf->Output($filepath, 'F');

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['os_path' => $fileurl],
            ['id' => intval($contrato->id)]
        );

        return $fileurl;
    }

    /* ── Helpers de HTML ────────────────────────────────────────── */

    /**
     * Remove emojis e caracteres Unicode acima de U+00FF que a fonte
     * Helvetica do TCPDF não suporta (renderizaria como "?").
     */
    private static function sem_emoji($texto) {
        if (empty($texto)) return '';
        // Remove qualquer caractere fora do Latin-1 (acima de U+00FF)
        return preg_replace('/[^\x00-\xFF]/u', '', $texto);
    }

    private static function bloco_titulo($texto) {
        // TCPDF ignora background CSS em <p>; usa tabela com bgcolor que é suportado
        return '<table width="100%" cellpadding="3" cellspacing="0" style="margin:5px 0 2px 0;">'
             . '<tr><td bgcolor="#444444"><font color="#ffffff"><b>' . self::sem_emoji($texto) . '</b></font></td></tr>'
             . '</table>';
    }

    private static function linha($label, $valor, $negrito = false) {
        $valor = self::sem_emoji($valor);
        $v = $negrito ? '<strong>' . esc_html($valor) . '</strong>' : esc_html($valor);
        return '<tr><td width="38%">' . esc_html($label) . ':</td>'
             . '<td>' . $v . '</td></tr>';
    }
}
