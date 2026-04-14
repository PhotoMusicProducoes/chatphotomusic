<?php
// includes/core/class-photomusic-admin-menu.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Admin_Menu {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_submenus']);
        add_action('admin_init', [__CLASS__, 'process_contrato_actions']);
        add_action('admin_init', [__CLASS__, 'process_evento_actions']);
        add_action('admin_post_pm_salvar_galeria_links', [__CLASS__, 'handle_salvar_galeria_links']);
        add_action('admin_post_pm_add_galeria_servico',  [__CLASS__, 'handle_add_galeria_servico']);
        add_action('admin_post_pm_del_galeria_servico',  [__CLASS__, 'handle_del_galeria_servico']);
    }

    public static function label_status($status) {
        $labels = [
            'rascunho'                         => 'Rascunho',
            'aguardando_assinatura_admin'       => 'Aguardando assinatura do Representante Legal',
            'assinado_admin'                    => 'Assinado pelo Representante Legal',
            'aguardando_assinatura_contratante' => 'Aguardando assinatura do Cliente',
            'assinado_contratante'              => 'Assinado pelo Cliente',
            'assinado'                          => 'Contrato totalmente assinado',
            'dispensado'                        => 'Dispensado',
            'cancelado'                         => 'Cancelado',
        ];
        return $labels[$status] ?? $status;
    }

    /* ============================================================
       PROCESSA AÇÕES DO CONTRATO (antes do HTML ser enviado)
    ============================================================ */
    public static function process_contrato_actions() {

        if (!isset($_GET['page']) || $_GET['page'] !== 'photomusic-contrato-detalhes') {
            return;
        }

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            return;
        }

        /* ---- ENVIAR PDF POR WHATSAPP ---- */
        $enviar_whatsapp = isset($_GET['enviar_whatsapp']) ? intval($_GET['enviar_whatsapp']) : 0;
        if ($enviar_whatsapp > 0) {
            $redirect_base = admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $enviar_whatsapp);

            try {
                $contrato = class_exists('PhotoMusic_Contratos') ? PhotoMusic_Contratos::get($enviar_whatsapp) : null;

                if (!$contrato) {
                    wp_redirect($redirect_base . '&whatsapp_erro=' . urlencode('Contrato não encontrado.'));
                    exit;
                }

                // PDF ainda não gerado — tenta gerar agora
                if (empty($contrato->pdf_final)) {
                    if (class_exists('PhotoMusic_Contratos_PDF')) {
                        PhotoMusic_Contratos_PDF::gerar_pdf($contrato);
                        $contrato = PhotoMusic_Contratos::get($enviar_whatsapp); // recarrega com pdf_final atualizado
                    }
                }

                if (empty($contrato->pdf_final)) {
                    wp_redirect($redirect_base . '&whatsapp_erro=' . urlencode('PDF ainda não gerado. Gere o PDF primeiro.'));
                    exit;
                }

                // Busca telefone — tenta tabela contratantes primeiro, depois evento diretamente
                $telefone = '';
                if (class_exists('PhotoMusic_Contratantes')) {
                    $contratante_obj = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
                    if ($contratante_obj) {
                        $telefone = preg_replace('/\D/', '', $contratante_obj->telefone ?? '');
                    }
                }

                // Fallback: telefone direto no evento (eucaristia, formulário público)
                if (empty($telefone) && !empty($contrato->id_evento)) {
                    global $wpdb;
                    $tel_ev = $wpdb->get_var($wpdb->prepare(
                        "SELECT telefone_contratante FROM {$wpdb->prefix}pm_eventos WHERE id = %d LIMIT 1",
                        $contrato->id_evento
                    ));
                    $telefone = preg_replace('/\D/', '', $tel_ev ?? '');
                }

                if (empty($telefone)) {
                    wp_redirect($redirect_base . '&whatsapp_erro=' . urlencode('Telefone do contratante não encontrado.'));
                    exit;
                }

                $result = PhotoMusic_WhatsApp::send_pdf_zapi(
                    $telefone,
                    "✅ Segue o PDF do contrato assinado do seu evento. Qualquer dúvida, estamos à disposição!",
                    $contrato->pdf_final
                );

                // Se send_pdf_zapi falhou (ex: Z-API não configurado), tenta fallback via texto com link
                if (is_wp_error($result)) {
                    if (class_exists('PhotoMusic_Logs')) {
                        PhotoMusic_Logs::add('wpp_pdf_fallback', null, $contrato->id_evento ?? null, $enviar_whatsapp, 'send_pdf_zapi falhou: ' . $result->get_error_message() . ' — tentando fallback texto');
                    }
                    $result = PhotoMusic_WhatsApp::send(
                        $telefone,
                        "✅ Segue o PDF do contrato assinado do seu evento:\n" . $contrato->pdf_final,
                        ['id_evento' => $contrato->id_evento ?? null]
                    );
                }

                if (is_wp_error($result)) {
                    wp_redirect($redirect_base . '&whatsapp_erro=' . urlencode('Erro ao enviar: ' . $result->get_error_message()));
                    exit;
                }

                wp_redirect($redirect_base . '&whatsapp_ok=1');
                exit;

            } catch (\Throwable $e) {
                if (class_exists('PhotoMusic_Logs')) {
                    PhotoMusic_Logs::add('erro_envio_pdf_wpp', null, null, $enviar_whatsapp, $e->getMessage());
                }
                wp_redirect($redirect_base . '&whatsapp_erro=' . urlencode('Erro ao enviar: ' . $e->getMessage()));
                exit;
            }
        }

        /* ---- REGERAR PDF ---- */
        $regerar_pdf = isset($_GET['regerar_pdf']) ? intval($_GET['regerar_pdf']) : 0;
        if ($regerar_pdf > 0) {
            $contrato = PhotoMusic_Contratos::get($regerar_pdf);
            if ($contrato) {
                PhotoMusic_Contratos_PDF::gerar_pdf($contrato);
                PhotoMusic_Contratos::registrar_log($contrato->id, 'pdf_regenerado', 'PDF regenerado manualmente.');
                wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $regerar_pdf . '&pdf_ok=1'));
                exit;
            }
        }

        /* ---- LIMPAR CONTRATO ---- */
        $limpar_contrato = isset($_GET['limpar_contrato']) ? intval($_GET['limpar_contrato']) : 0;
        if ($limpar_contrato > 0) {
            global $wpdb;
            $wpdb->update(
                $wpdb->prefix . 'pm_contratos',
                ['conteudo' => '', 'status_contrato' => 'rascunho'],
                ['id' => $limpar_contrato]
            );
            wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $limpar_contrato . '&limpo=1'));
            exit;
        }

        /* ---- GERAR CONTRATO ---- */
        $gerar_contrato = isset($_GET['gerar_contrato']) ? intval($_GET['gerar_contrato']) : 0;
        if ($gerar_contrato > 0) {
            try {
                $id_contrato  = $gerar_contrato;
                $contrato_tmp = PhotoMusic_Contratos::get($id_contrato);

                if ($contrato_tmp) {
                    $id_ev        = $contrato_tmp->id_evento;
                    $evento_tmp   = PhotoMusic_Events::get_event($id_ev);
                    $servicos_tmp = PhotoMusic_Servicos::get_evento_servicos($id_ev);

                    $tags = [];
                    if (!empty($evento_tmp->tipo_celebracao)) $tags[] = $evento_tmp->tipo_celebracao;
                    if (!empty($evento_tmp->tipo_evento))     $tags[] = strtolower($evento_tmp->tipo_evento);

                    if (!empty($servicos_tmp) && is_array($servicos_tmp)) {
                        foreach ($servicos_tmp as $s) {
                            if (!empty($s['slug_servico'])) $tags[] = $s['slug_servico'];
                            if (!empty($s['slug_pacote']))  $tags[] = $s['slug_pacote'];
                        }
                    }
                    if (!is_array($tags)) $tags = [];

                    $data_fmt = $evento_tmp->data_evento ? date('d/m/Y', strtotime($evento_tmp->data_evento)) : '';
                    $hi = $evento_tmp->horario_inicio  ? substr($evento_tmp->horario_inicio, 0, 5)  : '';
                    $hf = $evento_tmp->horario_fim     ? substr($evento_tmp->horario_fim, 0, 5)     : '';
                    $hs = $evento_tmp->horario_servico ? substr($evento_tmp->horario_servico, 0, 5) : $hi;

                    $tem_som = in_array('som-dj', $tags);
                    $chegada_minutes = strtotime('1970-01-01 ' . $hi . ':00') - ($tem_som ? 7200 : 3600);
                    $horario_chegada = date('H:i', $chegada_minutes);

                    $endereco_partes = array_filter([
                        $evento_tmp->local_logradouro,
                        $evento_tmp->local_numero     ? 'nº ' . $evento_tmp->local_numero         : null,
                        $evento_tmp->local_complemento,
                        $evento_tmp->local_bairro     ? 'bairro: ' . $evento_tmp->local_bairro    : null,
                        $evento_tmp->local_cidade     ? 'cidade: ' . $evento_tmp->local_cidade    : null,
                        $evento_tmp->local_estado     ? 'estado: ' . $evento_tmp->local_estado    : null,
                        $evento_tmp->cep_evento       ? 'CEP: '    . $evento_tmp->cep_evento      : null,
                    ]);
                    $endereco_local = implode(', ', $endereco_partes);
                    if (empty($endereco_local)) $endereco_local = $evento_tmp->endereco_evento ?? '';

                    $lista_html = '<ul>';
                    $total = 0;
                    $total_base = 0;
                    $total_adicional = 0;
                    if (!empty($servicos_tmp) && is_array($servicos_tmp)) {
                        foreach ($servicos_tmp as $s) {
                            $nome      = $s['nome_servico'] ?? '';
                            $pac       = $s['nome_pacote']  ?? '';
                            $hrs       = $s['horas_contratadas'] ?? '';
                            $val_base  = floatval($s['valor_base'] ?? 0);
                            $val_adic  = floatval($s['valor_adicional'] ?? 0);
                            $val       = floatval($s['valor_final']);
                            $obs       = $s['observacoes']        ?? '';
                            $descricao = $s['descricao_catalogo'] ?? ($s['descricao'] ?? '');
                            $total       += $val;
                            $total_base  += $val_base;
                            $total_adicional += $val_adic;
                            $lista_html .= '<li><strong>' . esc_html($nome);
                            if ($pac) $lista_html .= ' - ' . esc_html($pac);
                            if ($hrs) $lista_html .= ' - ' . $hrs . 'h';
                            $lista_html .= '</strong>';
                            if ($descricao) $lista_html .= '<br><span style="font-size:0.95em;">' . nl2br(esc_html($descricao)) . '</span>';
                            if ($val_adic > 0) {
                                $label_adic = !empty($s['label_adicional']) ? $s['label_adicional'] : 'Deslocamento';
                                $lista_html .= '<ul>';
                                $lista_html .= '<li>Serviço: R$ ' . number_format($val_base, 2, ',', '.') . '</li>';
                                $lista_html .= '<li>' . esc_html($label_adic) . ': R$ ' . number_format($val_adic, 2, ',', '.') . '</li>';
                                $lista_html .= '<li><strong>Subtotal: R$ ' . number_format($val, 2, ',', '.') . '</strong></li>';
                                $lista_html .= '</ul>';
                            } else {
                                $lista_html .= ' - R$ ' . number_format($val, 2, ',', '.');
                            }
                            if ($obs) {
                                $lista_html .= '<p style="margin:4px 0 0 0; font-size:0.95em;">' . nl2br(esc_html($obs)) . '</p>';
                            }
                            $lista_html .= '</li>';
                        }
                    }
                    $lista_html .= '</ul>';

                    // ── Cálculo financeiro com descontos do pagamento_config ──
                    $pgto_cfg = [];
                    if (!empty($evento_tmp->pagamento_config)) {
                        $pgto_cfg = json_decode($evento_tmp->pagamento_config, true) ?: [];
                    }
                    $pgto_forma_ct = $pgto_cfg['forma'] ?? '';

                    // Descontos que incidem ANTES do desconto PIX
                    $total_desc_ct = 0;
                    $linhas_desc_ct = [];
                    if (!empty($pgto_cfg['desc_segundo_servico']) && !empty($pgto_cfg['desc_segundo_exibir'])) {
                        $total_desc_ct -= 100.00;
                        $linhas_desc_ct[] = 'Desconto 2º serviço: − R$ 100,00';
                    }
                    if (!empty($pgto_cfg['desc_guestbook']) && !empty($pgto_cfg['desc_guestbook_exibir'])) {
                        $v = floatval($pgto_cfg['desc_guestbook']);
                        $total_desc_ct -= $v;
                        $linhas_desc_ct[] = 'Desconto Guestbook: − R$ ' . number_format($v, 2, ',', '.');
                    }
                    $base_ct = $total + $total_desc_ct;

                    // Desconto PIX à vista (não incide sobre deslocamento)
                    $pct_pix_ct    = 0;
                    $desc_pix_ct   = 0;
                    if ($pgto_forma_ct === 'pix_avista') {
                        $pct_pix_ct  = intval($pgto_cfg['pix_desconto_pct'] ?? 0);
                        $desc_pix_ct = $base_ct * ($pct_pix_ct / 100);
                    }

                    // Deslocamento somado DEPOIS do desconto PIX
                    $desloc_ct = 0;
                    if (isset($pgto_cfg['desc_deslocamento']) && $pgto_cfg['desc_deslocamento'] !== '' && !empty($pgto_cfg['desc_deslocamento_exibir'])) {
                        $desloc_ct = floatval($pgto_cfg['desc_deslocamento']);
                    }

                    $total_final_ct = $base_ct - $desc_pix_ct + $desloc_ct;

                    // Bloco de horários individuais por serviço
                    $linhas_horario = [];
                    if (!empty($servicos_tmp) && is_array($servicos_tmp)) {
                        foreach ($servicos_tmp as $s) {
                            if (!empty($s['horario_inicio'])) {
                                $hr_fmt = substr($s['horario_inicio'], 0, 5);
                                $linhas_horario[] = esc_html($s['nome_servico'] ?? '') . ': ' . $hr_fmt . ' horas';
                            }
                        }
                    }
                    if (!empty($linhas_horario)) {
                        $lista_html .= '<p><strong>Horário de início do(s) serviço(s):</strong><br>'
                                     . implode('<br>', $linhas_horario) . '</p>';
                    }

                    // ── Resumo Financeiro (aparece no contrato junto com {lista_servicos}) ──
                    $lista_html .= '<br><table style="border-collapse:collapse;font-size:0.95em;min-width:280px;">';
                    $lista_html .= '<tr>'
                        . '<td style="padding:2px 24px 2px 0;">Subtotal dos serviços</td>'
                        . '<td style="text-align:right;padding:2px 0;">R$ ' . number_format($total, 2, ',', '.') . '</td>'
                        . '</tr>';

                    if (!empty($pgto_cfg['desc_segundo_servico']) && !empty($pgto_cfg['desc_segundo_exibir'])) {
                        $lista_html .= '<tr>'
                            . '<td style="padding:2px 24px 2px 0;color:#555;">Desconto 2º serviço</td>'
                            . '<td style="text-align:right;padding:2px 0;color:#555;">− R$ 100,00</td>'
                            . '</tr>';
                    }
                    if (!empty($pgto_cfg['desc_guestbook']) && !empty($pgto_cfg['desc_guestbook_exibir'])) {
                        $v_gb = floatval($pgto_cfg['desc_guestbook']);
                        $lista_html .= '<tr>'
                            . '<td style="padding:2px 24px 2px 0;color:#555;">Desconto Guestbook</td>'
                            . '<td style="text-align:right;padding:2px 0;color:#555;">− R$ ' . number_format($v_gb, 2, ',', '.') . '</td>'
                            . '</tr>';
                    }
                    if ($desc_pix_ct > 0) {
                        $lista_html .= '<tr>'
                            . '<td style="padding:2px 24px 2px 0;color:#555;">Desconto PIX (' . $pct_pix_ct . '%)</td>'
                            . '<td style="text-align:right;padding:2px 0;color:#555;">− R$ ' . number_format($desc_pix_ct, 2, ',', '.') . '</td>'
                            . '</tr>';
                    }
                    if (isset($pgto_cfg['desc_deslocamento']) && $pgto_cfg['desc_deslocamento'] !== '' && !empty($pgto_cfg['desc_deslocamento_exibir'])) {
                        $desloc_show = floatval($pgto_cfg['desc_deslocamento']);
                        $desloc_txt  = $desloc_show == 0
                            ? 'Grátis'
                            : 'R$ ' . number_format($desloc_show, 2, ',', '.');
                        $lista_html .= '<tr>'
                            . '<td style="padding:2px 24px 2px 0;color:#555;">Deslocamento</td>'
                            . '<td style="text-align:right;padding:2px 0;color:#555;">' . $desloc_txt . '</td>'
                            . '</tr>';
                    }
                    $lista_html .= '<tr style="border-top:1px solid #333;">'
                        . '<td style="padding:5px 24px 2px 0;font-weight:bold;">Valor Total</td>'
                        . '<td style="text-align:right;padding:5px 0 2px;font-weight:bold;">R$ ' . number_format($total_final_ct, 2, ',', '.') . '</td>'
                        . '</tr>';
                    $lista_html .= '</table>';

                    // ── Descrição de Pagamento ──────────────────────────────────────────────
                    $desc_pgto_contrato = trim($pgto_cfg['descricao_pagamento'] ?? '');
                    if (!empty($desc_pgto_contrato)) {
                        $lista_html .= '<p style="margin-top:10px;">' . nl2br(esc_html($desc_pgto_contrato)) . '</p>';
                    }

                    $contato = $evento_tmp->contato_responsavel ?: $evento_tmp->contato_cerimonialista ?: '';

                    $vars = [
                        '{lista_servicos}'         => $lista_html,
                        '{data_evento}'            => $data_fmt,
                        '{horario_inicio}'         => $hi,
                        '{horario_fim}'            => $hf,
                        '{horario_servico}'        => $hs,
                        '{horario_chegada}'        => $horario_chegada,
                        '{local_evento}'           => ($evento_tmp->local_evento ?? '') . ($endereco_local ? ', situado na ' . $endereco_local : ''),
                        '{valor_total_final}'      => 'R$ ' . number_format($total_final_ct, 2, ',', '.'),
                        '{valor_servicos}'         => 'R$ ' . number_format($total_base, 2, ',', '.'),
                        '{valor_adicional}'        => $total_adicional > 0 ? 'R$ ' . number_format($total_adicional, 2, ',', '.') : '',
                        '{valor_deslocamento}'     => $desloc_ct > 0 ? 'R$ ' . number_format($desloc_ct, 2, ',', '.') : 'Incluso',
                        '{forma_pagamento}'        => (function() use ($pgto_forma_ct, $pgto_cfg, $total_final_ct, $base_ct, $desc_pix_ct, $pct_pix_ct, $desloc_ct) {
                            switch ($pgto_forma_ct) {
                                case 'pix_avista':
                                    $txt = 'PIX à vista';
                                    if ($pct_pix_ct > 0) $txt .= " com {$pct_pix_ct}% de desconto — R$ " . number_format($base_ct - $desc_pix_ct, 2, ',', '.');
                                    else $txt .= ' — R$ ' . number_format($total_final_ct, 2, ',', '.');
                                    if ($desloc_ct > 0) $txt .= ' + R$ ' . number_format($desloc_ct, 2, ',', '.') . ' deslocamento';
                                    return $txt;
                                case 'pix_parcelado':
                                    $p1 = floatval($pgto_cfg['pix_p_1_valor'] ?? 0);
                                    $p2 = floatval($pgto_cfg['pix_p_2_valor'] ?? 0);
                                    $txt = 'PIX parcelado — Total: R$ ' . number_format($total_final_ct, 2, ',', '.');
                                    if ($p1 > 0) $txt .= ' | 1ª parcela: R$ ' . number_format($p1, 2, ',', '.');
                                    if ($p2 > 0) {
                                        $txt .= ' | 2ª parcela: R$ ' . number_format($p2, 2, ',', '.');
                                        if (!empty($pgto_cfg['pix_p_2_data'])) $txt .= ' até ' . date('d/m/Y', strtotime($pgto_cfg['pix_p_2_data']));
                                    }
                                    return $txt;
                                case 'cartao':
                                    $p = intval($pgto_cfg['cartao_parcelas'] ?? 1);
                                    $juros = $p > 3 ? 'com juros' : 'sem juros';
                                    return 'Cartão de Crédito — R$ ' . number_format($total_final_ct, 2, ',', '.') . " em {$p}x {$juros}";
                                case 'dinheiro':
                                    return 'Dinheiro — R$ ' . number_format($total_final_ct, 2, ',', '.');
                                case 'transferencia':
                                    return 'Transferência Bancária — R$ ' . number_format($total_final_ct, 2, ',', '.');
                                case 'misto':
                                    $mv = floatval($pgto_cfg['misto_valor'] ?? 0);
                                    $mp = intval($pgto_cfg['misto_parcelas'] ?? 1);
                                    $mc = $total_final_ct - $mv;
                                    $juros = $mp > 3 ? 'com juros' : 'sem juros';
                                    return "Misto — R$ " . number_format($mv, 2, ',', '.') . " em PIX/Dinheiro + R$ " . number_format($mc, 2, ',', '.') . " em {$mp}x no cartão {$juros}";
                                default:
                                    return 'A combinar';
                            }
                        })(),
                        '{descricao_pagamento}'    => $pgto_cfg['descricao_pagamento'] ?? '',
                        '{contato_salao}'          => $evento_tmp->contato_salao ?? '',
                        '{contato_cerimonialista}' => $evento_tmp->contato_cerimonialista ?? '',
                        '{contato_responsavel}'    => $contato,
                        '{nome_aniversariante}'    => $evento_tmp->nome_aniversariante ?? '',
                        '{nome_pais}'              => $evento_tmp->nome_pais ?? '',
                        '{tema_festa}'             => $evento_tmp->tema_festa ?? '',
                        '{cores_festa}'            => $evento_tmp->cores_festa ?? '',
                        '{idade_aniversariante}'   => $evento_tmp->idade_aniversariante ?? '',
                        '{modelo_foto}'            => $evento_tmp->modelo_foto ?? '',
                        '{nome_noivos}'            => $evento_tmp->nome_noivos ?? '',
                        '{nome_cliente}'           => $evento_tmp->nome_contratante ?: ($evento_tmp->razao_social ?? ''),
                        '{documento_cliente}'      => $evento_tmp->cpf ?: ($evento_tmp->cnpj ?? ''),
                        '{nome_empresa_evento}'    => $evento_tmp->razao_social ?? ($evento_tmp->nome_fantasia ?? ''),
                        '{responsaveis_evento}'    => $evento_tmp->responsavel ?? ($evento_tmp->contato_responsavel ?? ''),
                        '{contato_evento}'         => $evento_tmp->contato_responsavel ?? ($evento_tmp->contato_cerimonialista ?? ''),
                        '{cep_evento}'             => $evento_tmp->cep_evento ? 'CEP: ' . $evento_tmp->cep_evento : '',

                        // 1ª Eucaristia
                        '{nome_catequista}'            => $evento_tmp->nome_catequista ?? '',
                        '{horario_catequese}'          => $evento_tmp->horario_catequese ?? '',
                        '{nome_paroquia}'              => $evento_tmp->nome_paroquia ?? '',
                        '{nome_capela}'                => $evento_tmp->nome_capela ?? '',
                        '{forma_pagamento_eucaristia}' => (function() use ($evento_tmp) {
                            $fp = $evento_tmp->forma_pagamento_eucaristia ?? '';
                            if ($fp === 'pix') {
                                $v = get_option('pm_eucaristia_valor_pix', '150,00');
                                return "PIX - R$ {$v} à vista";
                            }
                            if ($fp === 'cartao') {
                                $v = get_option('pm_eucaristia_valor_cartao', '170,00');
                                $p = number_format(floatval(str_replace(',', '.', $v)) / 3, 2, ',', '.');
                                return "Cartão de Crédito - R$ {$v} em 3x de R$ {$p} sem juros";
                            }
                            return '';
                        })(),
                    ];

                    $categoria = strtolower($evento_tmp->tipo_evento ?? 'pf') === 'pj' ? 'pj' : 'pf';
                    $clausulas  = PhotoMusic_Clausulas::buscar_por_tags($tags, $categoria);

                    global $wpdb;

                    // Monta lista de catequizandos para uso nas cláusulas
                    $cat_rows = $wpdb->get_results($wpdb->prepare(
                        "SELECT nome, data_nascimento, grau_parentesco FROM {$wpdb->prefix}pm_eucaristia_catequizandos WHERE id_evento = %d ORDER BY ordem ASC",
                        $id_ev
                    ));
                    if (!empty($cat_rows)) {
                        $itens = [];
                        foreach ($cat_rows as $r) {
                            $linha = esc_html($r->nome);
                            if ($r->data_nascimento) $linha .= ', nascido(a) em ' . date('d/m/Y', strtotime($r->data_nascimento));
                            if ($r->grau_parentesco) $linha .= ' (' . esc_html($r->grau_parentesco) . ')';
                            $itens[] = $linha;
                        }
                        $vars['{nome_catequizando_lista}'] = implode('; ', $itens);
                        // Também preenche {nome_aniversariante} com o primeiro catequizando
                        if (empty($vars['{nome_aniversariante}'])) {
                            $vars['{nome_aniversariante}'] = esc_html($cat_rows[0]->nome);
                        }
                    } else {
                        $vars['{nome_catequizando_lista}'] = $evento_tmp->nome_aniversariante ?? '';
                    }
                    $tbl_cl = $wpdb->prefix . 'pm_clausulas';
                    $clausulas_comuns = $wpdb->get_results(
                        "SELECT * FROM $tbl_cl WHERE ativo = 1 AND (tags IS NULL OR tags = '') ORDER BY ordem ASC"
                    );

                    $ids_ja = array_map(fn($c) => $c->id, $clausulas);
                    foreach ($clausulas_comuns as $cc) {
                        if (!in_array($cc->id, $ids_ja)) $clausulas[] = $cc;
                    }

                    usort($clausulas, fn($a, $b) => $a->ordem <=> $b->ordem);

                    // ---- NÚMERO DO CONTRATO ----
                    $empresa = PhotoMusic_Empresa::get();
                    $num_contrato = intval($contrato_tmp->numero_contrato ?? 0);
                    if ($num_contrato <= 0) {
                        $num_contrato = intval(get_option('pm_contrato_proximo_numero', 1));
                        update_option('pm_contrato_proximo_numero', $num_contrato + 1);
                        $wpdb->update($wpdb->prefix . 'pm_contratos', ['numero_contrato' => $num_contrato], ['id' => $id_contrato]);
                    }

                    // ---- DADOS DO CONTRATANTE (tabela pm_contratantes) ----
                    $contratante_tb = null;
                    if (!empty($contrato_tmp->id_contratante)) {
                        $contratante_tb = $wpdb->get_row($wpdb->prepare(
                            "SELECT * FROM {$wpdb->prefix}pm_contratantes WHERE id = %d",
                            intval($contrato_tmp->id_contratante)
                        ));
                    }

                    // ---- DEBUG TEMPORÁRIO: registra dados da empresa no log PHP ----
                    error_log('[PhotoMusic DEBUG] empresa keys: ' . implode(', ', array_keys($empresa)));
                    error_log('[PhotoMusic DEBUG] logradouro=' . ($empresa['logradouro'] ?? 'VAZIO'));
                    error_log('[PhotoMusic DEBUG] celular='    . ($empresa['celular']    ?? 'VAZIO'));
                    error_log('[PhotoMusic DEBUG] tipo_empresa=' . ($empresa['tipo_empresa'] ?? 'VAZIO'));
                    error_log('[PhotoMusic DEBUG] ie=' . ($empresa['ie'] ?? 'VAZIO'));

                    // ---- ENDEREÇO DA EMPRESA ----
                    // Prioridade: campos separados (novo form). Fallback: campo único 'endereco' (form antigo).
                    if (!empty($empresa['logradouro'])) {
                        $e_end_arr = array_filter([
                            $empresa['logradouro'],
                            !empty($empresa['numero'])      ? 'nº ' . $empresa['numero']       : '',
                            $empresa['complemento']  ?? '',
                            !empty($empresa['bairro'])      ? 'bairro: ' . $empresa['bairro']  : '',
                            !empty($empresa['cidade'])      ? 'cidade: ' . $empresa['cidade']  : '',
                            !empty($empresa['estado'])      ? 'estado: ' . $empresa['estado']  : '',
                            !empty($empresa['cep'])         ? 'CEP: '    . $empresa['cep']     : '',
                        ]);
                        $e_endereco = implode(', ', $e_end_arr);
                    } else {
                        $e_endereco = $empresa['endereco'] ?? '';
                    }

                    // ---- ENDEREÇO DO CONTRATANTE ----
                    $ct_end_arr = array_filter([
                        !empty($evento_tmp->cont_logradouro)  ? 'Rua: ' . $evento_tmp->cont_logradouro       : '',
                        !empty($evento_tmp->cont_numero)      ? 'nº: '  . $evento_tmp->cont_numero           : '',
                        $evento_tmp->cont_complemento ?? '',
                        !empty($evento_tmp->cont_bairro)      ? 'bairro: ' . $evento_tmp->cont_bairro        : '',
                        !empty($evento_tmp->cont_cidade)      ? 'cidade: ' . $evento_tmp->cont_cidade        : '',
                        !empty($evento_tmp->cont_estado)      ? 'estado: ' . $evento_tmp->cont_estado        : '',
                        !empty($evento_tmp->cont_cep)         ? 'CEP: '    . $evento_tmp->cont_cep           : '',
                    ]);
                    $ct_endereco = implode(', ', $ct_end_arr);
                    if (!$ct_endereco && $contratante_tb) {
                        $ct_end_arr2 = array_filter([
                            !empty($contratante_tb->logradouro)  ? 'Rua: ' . $contratante_tb->logradouro       : '',
                            !empty($contratante_tb->numero)      ? 'nº: '  . $contratante_tb->numero           : '',
                            $contratante_tb->complemento ?? '',
                            !empty($contratante_tb->bairro)      ? 'bairro: ' . $contratante_tb->bairro        : '',
                            !empty($contratante_tb->cidade)      ? 'cidade: ' . $contratante_tb->cidade        : '',
                            !empty($contratante_tb->estado)      ? 'estado: ' . $contratante_tb->estado        : '',
                            !empty($contratante_tb->cep)         ? 'CEP: '    . $contratante_tb->cep           : '',
                        ]);
                        $ct_endereco = implode(', ', $ct_end_arr2);
                    }

                    // ---- LINHA DO CONTRATANTE ----
                    $tipo_cont = strtoupper($evento_tmp->tipo_evento ?? 'PF');
                    if ($tipo_cont === 'PJ') {
                        $ct_nf  = $evento_tmp->nome_fantasia ?: ($evento_tmp->razao_social ?? '');
                        $ct_rs  = $evento_tmp->razao_social ?? '';
                        $ct_rep_nome  = $evento_tmp->responsavel ?? ($contratante_tb->representante_nome ?? '');
                        $ct_rep_cel   = $evento_tmp->telefone_contratante ?? ($contratante_tb->representante_celular ?? '');
                        $ct_rep_email = $evento_tmp->email_contratante ?? ($contratante_tb->email ?? '');
                        $ct_rep_cpf   = $evento_tmp->cpf_responsavel ?? ($contratante_tb->representante_cpf ?? '');
                        $ct_rep_rg    = $contratante_tb->representante_rg ?? '';
                        $ct_rep_dob   = '';
                        if ($contratante_tb && !empty($contratante_tb->representante_data_nascimento)) {
                            $ct_rep_dob = date('d/m/Y', strtotime($contratante_tb->representante_data_nascimento));
                        }
                        $ct_linha = esc_html($ct_nf);
                        if ($ct_rs && $ct_rs !== $ct_nf) $ct_linha .= ', Razão Social ' . esc_html($ct_rs);
                        if ($ct_endereco) $ct_linha .= ', residente e domiciliado(a) na ' . esc_html($ct_endereco);
                        if (!empty($evento_tmp->cnpj)) $ct_linha .= ', CNPJ: ' . esc_html($evento_tmp->cnpj);
                        if ($ct_rep_nome)  $ct_linha .= ', representada por: ' . esc_html($ct_rep_nome);
                        if ($ct_rep_cel)   $ct_linha .= ', telefone: ' . esc_html($ct_rep_cel);
                        if ($ct_rep_email) $ct_linha .= ', e-mail: ' . esc_html($ct_rep_email);
                        if ($ct_rep_cpf)   $ct_linha .= ', CPF: ' . esc_html($ct_rep_cpf);
                        if ($ct_rep_rg)    $ct_linha .= ', RG: ' . esc_html($ct_rep_rg);
                        if ($ct_rep_dob)   $ct_linha .= ', data de nascimento: ' . esc_html($ct_rep_dob);
                    } else {
                        $ct_nome  = $evento_tmp->nome_contratante ?? '';
                        $ct_cpf   = $evento_tmp->cpf  ?? ($contratante_tb->cpf ?? '');
                        $ct_rg    = $evento_tmp->rg   ?? ($contratante_tb->rg  ?? '');
                        $ct_rg_o  = $contratante_tb->rg_orgao ?? '';
                        $ct_dob   = '';
                        $dob_raw  = $evento_tmp->data_nascimento ?? ($contratante_tb->data_nascimento ?? '');
                        if ($dob_raw) $ct_dob = date('d/m/Y', strtotime($dob_raw));
                        $ct_tel   = $evento_tmp->telefone_contratante ?? ($contratante_tb->telefone ?? '');
                        $ct_email = $evento_tmp->email_contratante    ?? ($contratante_tb->email    ?? '');
                        $ct_linha = esc_html($ct_nome);
                        if ($ct_endereco) $ct_linha .= ', residente e domiciliado(a) na ' . esc_html($ct_endereco);
                        if ($ct_cpf)   $ct_linha .= ', CPF: ' . esc_html($ct_cpf);
                        if ($ct_rg)    $ct_linha .= ', RG: ' . esc_html($ct_rg) . ($ct_rg_o ? ' ' . esc_html($ct_rg_o) : '');
                        if ($ct_dob)   $ct_linha .= ', data de nascimento: ' . $ct_dob;
                        if ($ct_tel)   $ct_linha .= ', telefone: ' . esc_html($ct_tel);
                        if ($ct_email) $ct_linha .= ', e-mail: ' . esc_html($ct_email);
                    }

                    // ---- LOGO ----
                    $logo_url = trim($empresa['logo'] ?? '');
                    $logo_html = $logo_url
                        ? '<img src="' . esc_url($logo_url) . '" alt="Logo" style="max-height:80px; max-width:200px;">'
                        : '<span></span>';

                    // ---- MONTA O CABEÇALHO ----
                    $header_html  = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:2px solid #333;">';
                    $header_html .=   $logo_html;
                    $header_html .=   '<span style="font-size:18px; font-weight:bold; letter-spacing:1px;">CONTRATO N&ordm; ' . $num_contrato . '</span>';
                    $header_html .= '</div>';
                    $header_html .= '<div style="text-align:center; margin:15px 0 20px;">';
                    $header_html .=   '<div style="font-size:17px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">' . esc_html($empresa['nome_fantasia'] ?? '') . '</div>';
                    if (!empty($empresa['slogan'])) {
                        $header_html .= '<div style="font-style:italic; font-size:13px;">' . esc_html($empresa['slogan']) . '</div>';
                    }
                    $header_html .= '<div style="font-weight:bold; margin-top:8px; text-transform:uppercase;">CONTRATO DE PRESTA&Ccedil;&Atilde;O DE SERVI&Ccedil;OS PROFISSIONAIS</div>';
                    $header_html .= '</div>';
                    $header_html .= '<p style="text-align:justify; margin-bottom:15px;">';
                    $header_html .= 'Pelo presente instrumento particular, a ' . esc_html(mb_strtoupper($empresa['nome_fantasia'] ?? 'CONTRATADA'));
                    if (!empty($empresa['razao_social']))       $header_html .= ', Razão Social ' . esc_html($empresa['razao_social']);
                    if ($e_endereco)                           $header_html .= ', situada na ' . esc_html($e_endereco);
                    if (!empty($empresa['celular']))            $header_html .= ', celular: ' . esc_html($empresa['celular']);
                    if (!empty($empresa['email']))              $header_html .= ', e-mail: ' . esc_html($empresa['email']);
                    if (!empty($empresa['tipo_empresa']))       $header_html .= ', inscrita no ' . esc_html($empresa['tipo_empresa']);
                    if (!empty($empresa['cnpj']))               $header_html .= ', sob o CNPJ: ' . esc_html($empresa['cnpj']);
                    if (!empty($empresa['ie']))                  $header_html .= ', Inscrição Municipal: ' . esc_html($empresa['ie']);
                    // Representante: usa dados da empresa; se vazio, busca via user meta do WordPress
                    $rep_nome = $empresa['representante_nome'] ?? '';
                    $rep_cpf  = $empresa['representante_cpf']  ?? '';
                    $rep_rg   = $empresa['representante_rg']   ?? '';
                    if (empty($rep_nome)) {
                        $users_rep = get_users([
                            'meta_key'   => PhotoMusic_Representantes::META_FLAG,
                            'meta_value' => 1,
                            'number'     => 1,
                        ]);
                        if (!empty($users_rep)) {
                            $rep_user = $users_rep[0];
                            $rep_nome = $rep_user->display_name;
                            if (empty($rep_cpf)) {
                                $rep_cpf = get_user_meta($rep_user->ID, PhotoMusic_Representantes::META_CPF, true);
                            }
                            if (empty($rep_rg)) {
                                $rep_rg = get_user_meta($rep_user->ID, PhotoMusic_Representantes::META_RG, true);
                            }
                        }
                    }
                    // Formata CPF: 91257115987 → 912.571.159-87
                    $fmt_cpf = function($cpf) {
                        $c = preg_replace('/\D/', '', $cpf);
                        if (strlen($c) === 11) {
                            return substr($c,0,3).'.'.substr($c,3,3).'.'.substr($c,6,3).'-'.substr($c,9,2);
                        }
                        return $cpf;
                    };
                    if ($rep_nome) $header_html .= ', representada por: ' . esc_html($rep_nome);
                    if ($rep_cpf)  $header_html .= ', CPF: ' . esc_html($fmt_cpf($rep_cpf));
                    if ($rep_rg)   $header_html .= ', RG: ' . esc_html($rep_rg);
                    $header_html .= ', doravante denominada como CONTRATADA e ' . $ct_linha;
                    $header_html .= ', doravante denominado(a) CONTRATANTE.</p>';
                    $header_html .= '<p style="text-align:justify; margin-bottom:20px;">As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços de Profissionais, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente.</p>';
                    $header_html .= '<hr style="margin:20px 0; border:1px solid #ccc;">';

                    // ---- MONTA O CONTEÚDO DAS CLÁUSULAS ----
                    $html_contrato = '';
                    if (!empty($clausulas) && is_array($clausulas)) {
                        foreach ($clausulas as $cl) {
                            $texto = str_replace(array_keys($vars), array_values($vars), $cl->texto);
                            $texto = PhotoMusic_Clausulas::processar_condicionais($texto, $tags);
                            $texto = preg_replace('/^(\s*<br\s*\/?>\s*)+/i', '', $texto); // remove <br> após título
                            $texto = preg_replace("/\n{3,}/", "\n\n", trim($texto));
                            $html_contrato .= '<h3>' . esc_html($cl->titulo) . '</h3>' . "\n" . $texto . "\n\n";
                        }
                    } else {
                        $html_contrato = '<p><strong>⚠ Nenhuma cláusula encontrada.</strong></p>';
                    }

                    $html_contrato = $header_html . $html_contrato;

                    $wpdb->update(
                        $wpdb->prefix . 'pm_contratos',
                        ['conteudo' => $html_contrato, 'tipo_contrato' => 'completo'],
                        ['id' => $id_contrato]
                    );

                    PhotoMusic_Contratos::registrar_log($id_contrato, 'contrato_gerado', 'Conteúdo gerado pelo sistema.');
                    delete_transient('pm_motivo_devolucao_' . $id_contrato);
                }

            } catch (Exception $e) {
                wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $gerar_contrato . '&erro=' . urlencode($e->getMessage())));
                exit;
            }

            wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $gerar_contrato . '&gerado=1'));
            exit;
        }
    }

    /* ============================================================
       PROCESSA AÇÕES DO EVENTO (admin_init — antes do HTML)
    ============================================================ */
    public static function process_evento_actions() {

        if (!isset($_GET['page']) || $_GET['page'] !== 'photomusic-evento-detalhes') {
            return;
        }

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            return;
        }

        $id_evento = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id_evento <= 0) return;

        /* ---- CONFIRMAR PAGAMENTO ---- */
        if (!empty($_GET['confirmar_pagamento'])) {
            check_admin_referer('pm_confirmar_pagamento_' . $id_evento);

            global $wpdb;
            $wpdb->update(
                $wpdb->prefix . 'pm_eventos',
                [
                    'pagamento_confirmado'    => 1,
                    'pagamento_confirmado_em' => current_time('mysql'),
                ],
                ['id' => $id_evento]
            );

            // Conclui tarefa de pagamento pendente
            if (class_exists('PhotoMusic_Tarefas')) {
                $tarefa_pgto = PhotoMusic_Tarefas::get_pendente_por_tipo($id_evento, 'aguardar_pagamento');
                if ($tarefa_pgto) {
                    PhotoMusic_Tarefas::concluir($tarefa_pgto->id, wp_get_current_user()->display_name);
                }
            }

            if (class_exists('PhotoMusic_Logs')) {
                PhotoMusic_Logs::add('pagamento_confirmado', null, $id_evento, null, 'Pagamento confirmado por ' . wp_get_current_user()->display_name);
            }

            wp_redirect(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&pagamento_ok=1'));
            exit;
        }
    }

    public static function register_submenus() {

        // Lista de contratos (página de retorno após excluir/cancelar)
        add_submenu_page(
            'photomusic-eventos',
            'Contratos',
            'Contratos',
            'pm_ver_eventos',
            'photomusic-contratos',
            [__CLASS__, 'render_contratos_page']
        );

        add_submenu_page(
            'photomusic-eventos',
            'Banco de Pagamentos',
            '💳 Banco de Pagamentos',
            'manage_options',
            'photomusic-links-pagamento',
            function() {
                if (class_exists('PhotoMusic_Links_Pagamento_Admin')) {
                    PhotoMusic_Links_Pagamento_Admin::render();
                }
            }
        );

        add_submenu_page(
            'photomusic-eventos',
            'Contas Bancárias',
            '🏦 Contas Bancárias',
            'manage_options',
            'photomusic-contas-bancarias',
            function() {
                if (class_exists('PhotoMusic_Contas_Bancarias_Admin')) {
                    PhotoMusic_Contas_Bancarias_Admin::render();
                }
            }
        );

        add_submenu_page(
            'photomusic-eventos',
            'Tabela de Preços',
            '💰 Tabela de Preços',
            'manage_options',
            'photomusic-tabela-precos',
            function() {
                if (class_exists('PhotoMusic_Tabela_Precos_Admin')) {
                    PhotoMusic_Tabela_Precos_Admin::render();
                }
            }
        );

        add_submenu_page(
            'photomusic-eventos',
            '1ª Eucaristia — Links',
            'Eucaristia',
            'pm_ver_eventos',
            'photomusic-eucaristia-links',
            [__CLASS__, 'render_eucaristia_links_page']
        );

        add_submenu_page(
            null,
            'Detalhes do Contrato',
            'Detalhes do Contrato',
            'pm_ver_eventos',
            'photomusic-contrato-detalhes',
            [__CLASS__, 'render_contrato_detalhes_page']
        );

        add_submenu_page(
            null,
            'Enviar WhatsApp — Contrato',
            'Enviar WhatsApp',
            'pm_ver_eventos',
            'photomusic-wpp-contrato',
            [__CLASS__, 'render_wpp_contrato_page']
        );

        add_submenu_page(
            null,
            'Editar Contrato',
            'Editar Contrato',
            'pm_ver_eventos',
            'photomusic-contrato-editar',
            function() {
                if (class_exists('PhotoMusic_Contratos_Edit')) {
                    PhotoMusic_Contratos_Edit::render();
                }
            }
        );

        add_submenu_page(
            null,
            'Detalhes do Evento',
            'Detalhes do Evento',
            'pm_ver_eventos',
            'photomusic-evento-detalhes',
            [__CLASS__, 'render_evento_detalhes_page']
        );

        add_submenu_page(
            null,
            'Operador do Evento',
            'Operador do Evento',
            'pm_ver_eventos',
            'photomusic-evento-operador',
            [__CLASS__, 'render_evento_operador_page']
        );


        if (PhotoMusic_Users::can_create_event()) {
            add_submenu_page(
                'photomusic-eventos',
                'Convites',
                'Convites',
                'pm_criar_eventos',
                'photomusic-convites',
                [__CLASS__, 'render_convites_page']
            );
        }

        if (PhotoMusic_Users::is_user()) {
            add_submenu_page(
                'photomusic-eventos',
                'Aceites',
                'Aceites',
                'pm_ver_eventos',
                'photomusic-aceites',
                [__CLASS__, 'render_aceites_page']
            );
        }

        if (PhotoMusic_Users::can_view_logs()) {
            add_submenu_page(
                'photomusic-eventos',
                'Relatório de Aceites',
                'Relatório de Aceites',
                'pm_ver_logs',
                'photomusic-relatorio-aceites',
                ['PhotoMusic_Aceites', 'render_relatorio']
            );
        }

        if (PhotoMusic_Users::can_view_logs()) {
            add_submenu_page(
                'photomusic-eventos',
                'Logs do Sistema',
                'Logs',
                'pm_ver_logs',
                'photomusic-logs',
                [__CLASS__, 'render_logs_page']
            );
        }

        if (PhotoMusic_Users::is_admin()) {
            add_submenu_page(
                'photomusic-eventos',
                'Configurações',
                'Configurações',
                'pm_gerenciar_usuarios',
                'photomusic-config',
                ['PhotoMusic_Config', 'render_page']
            );
        }
    }

    /* ============================================================
       LISTAGEM DE CONTRATOS
    ============================================================ */
    /* ============================================================
       PÁGINA: LINKS E PAGAMENTOS — 1ª EUCARISTIA
    ============================================================ */
    public static function render_eucaristia_links_page() {

        $form_url        = get_option('pm_eucaristia_form_url', '');
        $valor_pix       = get_option('pm_eucaristia_valor_pix', '150,00');
        $pix_chave       = get_option('pm_eucaristia_pix_chave', '');
        $pix_banco       = get_option('pm_eucaristia_pix_banco', '');
        $pix_benefic     = get_option('pm_eucaristia_pix_beneficiario', '');
        $pix_payload     = get_option('pm_eucaristia_pix_payload', '');
        $valor_cartao    = get_option('pm_eucaristia_valor_cartao', '170,00');
        $link_cartao     = get_option('pm_eucaristia_link_cartao', '');
        $wpp_comprovante = get_option('pm_eucaristia_whatsapp_comprovante', '');

        // Links diretos para a tela de pagamento (sem cadastro, sem mensagem de sucesso)
        $link_pix_direto    = $form_url ? rtrim($form_url, '/') . '/?pm_eucaristia=direto&fp=pix'    : '';
        $link_cartao_direto = $form_url ? rtrim($form_url, '/') . '/?pm_eucaristia=direto&fp=cartao' : '';

        $config_url = admin_url('admin.php?page=photomusic_config');

        // Salva a URL do formulário diretamente nesta página
        if (!empty($_POST['pm_salvar_euc_url']) && check_admin_referer('pm_euc_url_nonce')) {
            $nova_url = esc_url_raw(trim($_POST['pm_eucaristia_form_url'] ?? ''));
            update_option('pm_eucaristia_form_url', $nova_url);
            $form_url = $nova_url;
            $link_pix_direto    = $form_url ? rtrim($form_url, '/') . '/?fp=pix'    : '';
            $link_cartao_direto = $form_url ? rtrim($form_url, '/') . '/?fp=cartao' : '';
            echo '<div class="notice notice-success is-dismissible"><p>✅ URL salva com sucesso!</p></div>';
        }
        ?>
        <div class="wrap">
            <h1>🥖 1ª Eucaristia — Links e Pagamentos</h1>
            <p style="color:#666;">Copie os links abaixo para inserir no Sistema ChatBot PhotoMusic Pro.</p>

            <style>
                .pm-link-card { background:#fff; border:1px solid #ddd; border-radius:6px; padding:20px 24px; margin-bottom:20px; max-width:720px; }
                .pm-link-card h2 { margin-top:0; font-size:1.1em; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px; }
                .pm-link-row { display:flex; align-items:center; gap:10px; margin-top:8px; }
                .pm-link-row input[type=text], .pm-link-row textarea { flex:1; font-family:monospace; font-size:13px; background:#f8f8f8; border:1px solid #ccc; border-radius:4px; padding:8px 10px; }
                .pm-link-row textarea { resize:vertical; min-height:60px; }
                .pm-copy-btn { white-space:nowrap; }
                .pm-qr { margin-top:12px; }
                .pm-link-visivel { display:block; font-size:13px; color:#0073aa; word-break:break-all; margin-top:6px; }
                .pm-link-visivel:hover { text-decoration:underline; }
                .pm-label { font-size:12px; color:#666; margin:12px 0 2px; font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
            </style>

            <!-- FORMULÁRIO DE INSCRIÇÃO -->
            <div class="pm-link-card">
                <h2>📋 Link do Formulário de Inscrição</h2>
                <?php if ($form_url): ?>
                    <p class="pm-label">Link</p>
                    <a href="<?php echo esc_url($form_url); ?>" target="_blank" class="pm-link-visivel">
                        <?php echo esc_html($form_url); ?>
                    </a>
                    <div class="pm-link-row">
                        <input type="text" id="pm-url-form" value="<?php echo esc_attr($form_url); ?>" readonly>
                        <button class="button button-primary pm-copy-btn" onclick="pmCopiar('pm-url-form', this)">📋 Copiar</button>
                    </div>
                    <p style="margin:8px 0 0; font-size:12px; color:#888;">Shortcode da página: <code>[photomusic_formulario_eucaristia]</code></p>
                    <details style="margin-top:12px;">
                        <summary style="cursor:pointer; font-size:12px; color:#0073aa;">✏️ Alterar URL do formulário</summary>
                        <form method="post" style="margin-top:8px;">
                            <?php wp_nonce_field('pm_euc_url_nonce'); ?>
                            <input type="hidden" name="pm_salvar_euc_url" value="1">
                            <div class="pm-link-row">
                                <input type="url" name="pm_eucaristia_form_url"
                                       value="<?php echo esc_attr($form_url); ?>"
                                       style="flex:1; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:13px;"
                                       required>
                                <button type="submit" class="button button-primary pm-copy-btn">💾 Salvar</button>
                            </div>
                        </form>
                    </details>
                <?php else: ?>
                    <p style="color:#a00; margin-bottom:12px;">⚠️ URL do formulário não configurada. Informe abaixo:</p>
                    <form method="post">
                        <?php wp_nonce_field('pm_euc_url_nonce'); ?>
                        <input type="hidden" name="pm_salvar_euc_url" value="1">
                        <div class="pm-link-row">
                            <input type="url" name="pm_eucaristia_form_url"
                                   placeholder="https://photomusic.com.br/eucaristia/"
                                   style="flex:1; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:13px;"
                                   required>
                            <button type="submit" class="button button-primary pm-copy-btn">💾 Salvar URL</button>
                        </div>
                    </form>
                <?php endif; ?>
            </div>

            <!-- LINK DIRETO PIX -->
            <div class="pm-link-card" style="border-left:4px solid #00a651;">
                <h2>💚 Pagamento via PIX — R$ <?php echo esc_html($valor_pix); ?></h2>

                <?php if ($link_pix_direto): ?>
                    <p class="pm-label">Link direto para pagamento PIX (sem cadastro)</p>
                    <a href="<?php echo esc_url($link_pix_direto); ?>" target="_blank" class="pm-link-visivel">
                        <?php echo esc_html($link_pix_direto); ?>
                    </a>
                    <div class="pm-link-row">
                        <input type="text" id="pm-link-pix" value="<?php echo esc_attr($link_pix_direto); ?>" readonly>
                        <button class="button button-primary pm-copy-btn" onclick="pmCopiar('pm-link-pix', this)">📋 Copiar</button>
                    </div>
                    <hr style="margin:16px 0; border:none; border-top:1px solid #eee;">
                <?php endif; ?>

                <p class="pm-label">Dados PIX</p>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <tr><td style="padding:4px 0; color:#666; width:110px;">Banco</td><td><strong><?php echo esc_html($pix_banco); ?></strong></td></tr>
                    <tr><td style="padding:4px 0; color:#666;">Beneficiário</td><td><strong><?php echo esc_html($pix_benefic); ?></strong></td></tr>
                    <tr><td style="padding:4px 0; color:#666;">Chave PIX</td><td><strong><?php echo esc_html($pix_chave); ?></strong></td></tr>
                </table>

                <?php if ($pix_payload): ?>
                    <p class="pm-label">PIX Copia e Cola</p>
                    <div class="pm-link-row">
                        <textarea id="pm-pix-payload" readonly><?php echo esc_textarea($pix_payload); ?></textarea>
                        <button class="button button-primary pm-copy-btn" onclick="pmCopiar('pm-pix-payload', this)">📋 Copiar PIX</button>
                    </div>
                    <div class="pm-qr">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=<?php echo urlencode($pix_payload); ?>"
                             alt="QR Code PIX" style="border:1px solid #ddd; border-radius:4px; display:block;">
                        <span style="font-size:11px; color:#888;">QR Code PIX</span>
                    </div>
                <?php else: ?>
                    <p style="color:#a00; margin-top:10px;">⚠️ PIX Copia e Cola não configurado. <a href="<?php echo esc_url($config_url); ?>">Configurar agora</a></p>
                <?php endif; ?>
            </div>

            <!-- LINK DIRETO CARTÃO -->
            <div class="pm-link-card" style="border-left:4px solid #0073aa;">
                <h2>💳 Pagamento via Cartão — R$ <?php echo esc_html($valor_cartao); ?></h2>

                <?php if ($link_cartao_direto): ?>
                    <p class="pm-label">Link direto para pagamento Cartão (sem cadastro)</p>
                    <a href="<?php echo esc_url($link_cartao_direto); ?>" target="_blank" class="pm-link-visivel">
                        <?php echo esc_html($link_cartao_direto); ?>
                    </a>
                    <div class="pm-link-row">
                        <input type="text" id="pm-link-cartao-direto" value="<?php echo esc_attr($link_cartao_direto); ?>" readonly>
                        <button class="button button-primary pm-copy-btn" onclick="pmCopiar('pm-link-cartao-direto', this)">📋 Copiar</button>
                    </div>
                    <hr style="margin:16px 0; border:none; border-top:1px solid #eee;">
                <?php endif; ?>

                <?php if ($link_cartao): ?>
                    <p class="pm-label">Link do gateway de pagamento (InfinitePay / etc.)</p>
                    <a href="<?php echo esc_url($link_cartao); ?>" target="_blank" class="pm-link-visivel">
                        <?php echo esc_html($link_cartao); ?>
                    </a>
                    <div class="pm-link-row">
                        <input type="text" id="pm-url-cartao" value="<?php echo esc_attr($link_cartao); ?>" readonly>
                        <button class="button button-primary pm-copy-btn" onclick="pmCopiar('pm-url-cartao', this)">📋 Copiar</button>
                    </div>
                <?php else: ?>
                    <p style="color:#a00;">⚠️ Link de cartão não configurado. <a href="<?php echo esc_url($config_url); ?>">Configurar agora</a></p>
                <?php endif; ?>
            </div>

            <!-- WHATSAPP COMPROVANTE -->
            <?php if ($wpp_comprovante): ?>
            <div class="pm-link-card" style="border-left:4px solid #25D366;">
                <h2>📲 WhatsApp para envio de Comprovante</h2>
                <div class="pm-link-row">
                    <input type="text" id="pm-wpp" value="<?php echo esc_attr($wpp_comprovante); ?>" readonly>
                    <button class="button pm-copy-btn" onclick="pmCopiar('pm-wpp', this)">📋 Copiar Número</button>
                </div>
            </div>
            <?php endif; ?>

            <p style="margin-top:10px;">
                <a href="<?php echo esc_url($config_url); ?>" class="button">⚙️ Editar Configurações da Eucaristia</a>
            </p>
        </div>

        <script>
        function pmCopiar(id, btn) {
            var el = document.getElementById(id);
            el.select();
            el.setSelectionRange(0, 99999);
            var orig = btn.textContent;
            try {
                navigator.clipboard.writeText(el.value).then(function() {
                    btn.textContent = '✅ Copiado!';
                    btn.disabled = true;
                    setTimeout(function() { btn.textContent = orig; btn.disabled = false; }, 2000);
                });
            } catch(e) {
                document.execCommand('copy');
                btn.textContent = '✅ Copiado!';
                setTimeout(function() { btn.textContent = orig; }, 2000);
            }
        }
        </script>
        <?php
    }

    public static function render_contratos_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Você não tem permissão para acessar esta página.');
        }

        echo '<div class="wrap"><h1>Contratos dos Eventos</h1>';

        if (!empty($_GET['excluido'])) {
            echo '<div class="updated notice is-dismissible"><p>🗑️ Contrato excluído com sucesso!</p></div>';
        }

        global $wpdb;

        $contratos = $wpdb->get_results("
            SELECT c.*, e.motivo_evento, e.data_evento
            FROM {$wpdb->prefix}pm_contratos c
            LEFT JOIN {$wpdb->prefix}pm_eventos e ON e.id = c.id_evento
            ORDER BY c.id DESC
        ");

        if (!$contratos) {
            echo '<p>Nenhum contrato encontrado.</p></div>';
            return;
        }

        echo '<table class="widefat striped" style="margin-top:20px;">';
        echo '<thead><tr>
                <th>ID</th>
                <th>Evento</th>
                <th>Data</th>
                <th>Status</th>
                <th>Assinaturas</th>
                <th>PDF</th>
                <th>Ações</th>
              </tr></thead><tbody>';

        foreach ($contratos as $c) {

            $assinaturas =
                ($c->assinatura_admin_data ? 'Admin ✔' : 'Admin ✖') . '<br>' .
                ($c->assinatura_contratante_data ? 'Contratante ✔' : 'Contratante ✖');

            $pdf_btn = $c->pdf_final
                ? '<a class="button" target="_blank" href="' . esc_url($c->pdf_final) . '">Baixar PDF</a>'
                : '<em>Não gerado</em>';

            $link_publico = home_url('/contrato/' . $c->token);

            echo '<tr>';
            echo '<td>' . intval($c->id) . '</td>';
            echo '<td>' . esc_html($c->motivo_evento) . '</td>';
            echo '<td>' . esc_html($c->data_evento) . '</td>';
            echo '<td>' . esc_html(self::label_status($c->status_contrato)) . '</td>';
            echo '<td>' . $assinaturas . '</td>';
            echo '<td>' . $pdf_btn . '</td>';
            echo '<td>
                    <a class="button" target="_blank" href="' . esc_url($link_publico) . '">Ver Contrato</a>
                    <a class="button button-secondary" href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $c->id) . '">Detalhes</a>
                    <a class="button button-secondary" href="' . admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $c->id_evento) . '">Ver Evento</a>
                    <a class="button" style="background:#25d366;border-color:#1da851;color:#fff;" href="' . admin_url('admin.php?page=photomusic-wpp-contrato&id=' . $c->id) . '">📲 WhatsApp</a>
                  </td>';
            echo '</tr>';
        }

        echo '</tbody></table></div>';
    }

    /* ============================================================
       DETALHES DO CONTRATO
    ============================================================ */
    public static function render_contrato_detalhes_page() {

        $notice_msg = '';

        if (!empty($_GET['whatsapp_ok'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>✅ PDF enviado por WhatsApp com sucesso!</p></div>';
        }

        if (!empty($_GET['whatsapp_erro'])) {
            $notice_msg = '<div class="notice notice-error is-dismissible"><p>❌ Erro ao enviar WhatsApp: ' . esc_html(urldecode($_GET['whatsapp_erro'])) . '</p></div>';
        }

        if (!empty($_GET['pdf_ok'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>PDF regenerado com sucesso!</p></div>';
        }

        if (!empty($_GET['criado'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>📄 Contrato criado! Clique em "⚙️ Gerar Contrato" para montar o conteúdo.</p></div>';
        }

        if (!empty($_GET['gerado'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>✅ Conteúdo gerado com sucesso!</p></div>';
        }

        if (!empty($_GET['assinado_empresa']) || !empty($_GET['assinado_representante'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>✍️ Contrato assinado pelo representante legal com sucesso!</p></div>';
        }

        if (!empty($_GET['encaminhado'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>📤 Contrato encaminhado para assinatura. Representante notificado via WhatsApp.</p></div>';
        }

        if (!empty($_GET['enviado_cliente'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>📩 Contrato enviado ao cliente via WhatsApp com sucesso!</p></div>';
        }

        if (!empty($_GET['reenviado'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>🔄 Contrato reenviado ao cliente com sucesso!</p></div>';
        }

        if (!empty($_GET['assinatura_cancelada'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>↩️ Assinatura do representante cancelada. Contrato voltou para rascunho.</p></div>';
        }

        if (!empty($_GET['devolvido'])) {
            $notice_msg = '<div class="notice notice-warning is-dismissible"><p>↩️ Contrato devolvido pelo representante legal para correção.</p></div>';
        }

        if (!empty($_GET['encaminhamento_cancelado'])) {
            $notice_msg = '<div class="notice notice-warning is-dismissible"><p>🚫 Encaminhamento cancelado. Contrato voltou para Rascunho.</p></div>';
        }

        if (!empty($_GET['retirado_cliente'])) {
            $notice_msg = '<div class="notice notice-warning is-dismissible"><p>↩️ Contrato retirado do cliente. Voltou para <strong>Assinado pelo Representante</strong>. O cliente não receberá mais mensagens para assinar.</p></div>';
        }

        if (!empty($_GET['limpo'])) {
            $notice_msg = '<div class="updated notice is-dismissible"><p>🗑️ Conteúdo apagado com sucesso!</p></div>';
        }

        if (!empty($_GET['erro'])) {
            $notice_msg = '<div class="notice notice-error"><p>❌ Erro: ' . esc_html(urldecode($_GET['erro'])) . '</p></div>';
        }

        /* -------------------------
           CARREGAR CONTRATO
        -------------------------- */
        $id_contrato = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id_contrato <= 0) {
            echo '<div class="wrap"><h1>Contrato não encontrado</h1></div>';
            return;
        }

        $contrato = PhotoMusic_Contratos::get($id_contrato);

        if (!$contrato) {
            echo '<div class="wrap"><h1>Contrato não encontrado</h1></div>';
            return;
        }

        $id_evento = $contrato->id_evento;
        $core = new PhotoMusic_Events_Core();
        $evento = $core->get_evento_completo($id_evento);

        echo '<div class="wrap">';
        if ($notice_msg) echo $notice_msg;

        // Motivo de devolução pendente (salvo como transient)
        $motivo_devolucao = get_transient('pm_motivo_devolucao_' . $id_contrato);
        if ($motivo_devolucao) {
            echo '<div class="notice notice-error" style="padding:12px 15px;">';
            echo '<strong>⚠️ Motivo da devolução pelo Representante Legal:</strong><br>';
            echo '<span style="font-size:14px;">' . esc_html($motivo_devolucao) . '</span>';
            echo '</div>';
        }

        echo '<h1>Contrato #' . $contrato->id . '</h1>';
        echo '<a class="button" href="' . admin_url('admin.php?page=photomusic-contratos') . '">← Voltar</a>';
        if (current_user_can('administrator')) {
            echo ' &nbsp; <a class="button button-secondary" href="' . admin_url('admin.php?page=photomusic-contrato-editar&id=' . $contrato->id) . '">🔢 Alterar Nº do Contrato</a>';
        }
        echo '<hr>';

        echo '<h2>Contrato</h2>';
        echo '<table class="widefat striped">';
        echo '<tr><th>Status</th><td>' . esc_html(self::label_status($contrato->status_contrato)) . '</td></tr>';
        echo '<tr><th>Token</th><td>' . esc_html($contrato->token) . '</td></tr>';
        echo '<tr><th>PDF</th><td>';

        if ($contrato->pdf_final) {
            echo '<a class="button button-primary" target="_blank" href="' . esc_url($contrato->pdf_final) . '">📄 Baixar PDF</a> ';
            echo '<a class="button button-secondary" href="' . esc_url(admin_url('admin.php?page=photomusic-contrato-detalhes&regerar_pdf=' . intval($contrato->id) . '&id=' . intval($contrato->id))) . '"'
               . ' onclick="return confirm(\'Regerar o PDF do contrato #' . $contrato->id . '?\');">🔄 Regerar PDF</a> ';
            echo '<a class="button" href="' . esc_url(admin_url('admin.php?page=photomusic-contrato-detalhes&enviar_whatsapp=' . intval($contrato->id) . '&id=' . intval($contrato->id))) . '"'
               . ' onclick="return confirm(\'Enviar o PDF por WhatsApp para o contratante?\');">📲 Enviar por WhatsApp</a>';
        } else {
            echo '<em>PDF não gerado</em> &nbsp; ';
            echo '<a class="button button-secondary" href="' . esc_url(admin_url('admin.php?page=photomusic-contrato-detalhes&regerar_pdf=' . intval($contrato->id) . '&id=' . intval($contrato->id))) . '">🔄 Gerar PDF</a>';
        }

        echo '</td></tr></table>';

        echo '<hr>';

        echo '<h2>Conteúdo do Contrato</h2>';

        // 🔥 =============================
        // 🔥 NOVO BLOCO DE AÇÕES DO CONTRATO
        // 🔥 =============================

        echo '<div style="margin:15px 0; padding:12px; background:#f8f8f8; border:1px solid #ddd; border-radius:4px;">';

        $status = $contrato->status_contrato;

        if ($status === 'rascunho') {
            if (!empty($contrato->conteudo)) {
                echo '<a class="button button-primary" href="' . wp_nonce_url(
                    admin_url('admin-post.php?action=pm_encaminhar_assinatura&contrato_id=' . $contrato->id),
                    'pm_encaminhar_assinatura'
                ) . '">📤 Encaminhar para Assinatura</a>';
            } else {
                echo '<span style="color:#666;">Gere o conteúdo do contrato antes de encaminhar.</span>';
            }
        }

        elseif ($status === 'aguardando_assinatura_admin') {
            echo '<span style="display:inline-block; padding:5px 12px; background:#fff3cd; color:#856404; border-radius:3px; font-weight:bold;">⏳ Aguardando assinatura do Representante Legal</span>';

            // Representante legal: pode assinar ou devolver
            if (PhotoMusic_Helpers_Representantes::usuario_pode_assinar(get_current_user_id())) {
                echo ' &nbsp; <a class="button button-primary" href="' . wp_nonce_url(
                    admin_url('admin-post.php?action=pm_assinar_representante&contrato_id=' . $contrato->id),
                    'pm_assinar_representante'
                ) . '">✍️ Assinar como Representante Legal</a>';
                echo ' &nbsp; <a class="button button-secondary" style="color:#a00;" href="#" onclick="'
                    . 'var m=prompt(\'Descreva o que precisa ser corrigido:\');'
                    . 'if(m){window.location=\'' . wp_nonce_url(admin_url('admin-post.php?action=pm_devolver_contrato&contrato_id=' . $contrato->id), 'pm_devolver_contrato') . '&motivo=\'+encodeURIComponent(m);}return false;'
                    . '">↩️ Devolver para Correção</a>';
            }

            // Admin/operador com permissão: pode cancelar o encaminhamento e voltar para rascunho
            if (PhotoMusic_Contratos_Permissoes::pode_editar() && !PhotoMusic_Helpers_Representantes::usuario_pode_assinar(get_current_user_id())) {
                echo ' &nbsp; <a class="button button-secondary" style="color:#a00;" href="' . wp_nonce_url(
                    admin_url('admin-post.php?action=pm_cancelar_encaminhamento&contrato_id=' . $contrato->id),
                    'pm_cancelar_encaminhamento'
                ) . '" onclick="return confirm(\'Cancelar encaminhamento e voltar para Rascunho?\')">🚫 Cancelar Encaminhamento</a>';
            }
        }

        elseif ($status === 'assinado_admin') {
            echo '<span style="display:inline-block; padding:5px 12px; background:#d4edda; color:#155724; border-radius:3px; font-weight:bold;">✅ Assinado pelo Representante: ' . esc_html($contrato->assinatura_admin_nome) . '</span>';
            echo ' &nbsp; <a class="button button-primary" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_enviar_cliente&contrato_id=' . $contrato->id),
                'pm_enviar_cliente'
            ) . '">📩 Enviar para o Cliente</a>';
            echo ' &nbsp; <a class="button button-secondary" style="color:#a00;" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_resetar_assinatura_representante&contrato_id=' . $contrato->id),
                'pm_resetar_assinatura_representante'
            ) . '" onclick="return confirm(\'Cancelar a assinatura do representante e voltar para rascunho?\')">↩️ Cancelar Assinatura do Representante</a>';
        }

        elseif ($status === 'aguardando_assinatura_contratante') {
            echo '<span style="display:inline-block; padding:5px 12px; background:#fff3cd; color:#856404; border-radius:3px; font-weight:bold;">⏳ Aguardando assinatura do Cliente</span>';
            echo ' &nbsp; <a class="button button-secondary" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_reenviar_contrato&contrato_id=' . $contrato->id),
                'pm_reenviar_contrato'
            ) . '">🔄 Reenviar para o Cliente</a>';
            if (PhotoMusic_Contratos_Permissoes::pode_editar()) {
                echo ' &nbsp; <a class="button button-secondary" style="color:#a00;" href="' . wp_nonce_url(
                    admin_url('admin-post.php?action=pm_retirar_contrato_cliente&contrato_id=' . $contrato->id),
                    'pm_retirar_contrato_cliente'
                ) . '" onclick="return confirm(\'Retirar o contrato do cliente e voltar para Assinado pelo Representante?\nO cliente não receberá mais mensagens para assinar.\')">↩️ Retirar do Cliente</a>';
            }
        }

        elseif ($status === 'assinado') {
            echo '<span style="display:inline-block; padding:5px 12px; background:#d4edda; color:#155724; border-radius:3px; font-weight:bold;">🎉 Contrato totalmente assinado!</span>';
            if (!empty($contrato->os_path)) {
                echo ' &nbsp; <a class="button button-primary" target="_blank" href="' . esc_url($contrato->os_path) . '">📄 Baixar Ordem de Serviço</a>';
            }
            echo ' &nbsp; <a class="button button-secondary" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_reenviar_contrato&contrato_id=' . $contrato->id),
                'pm_reenviar_contrato'
            ) . '">🔄 Reenviar Contrato ao Cliente</a>';
        }

        elseif ($status === 'cancelado') {
            echo '<span style="display:inline-block; padding:5px 12px; background:#f8d7da; color:#721c24; border-radius:3px; font-weight:bold;">❌ Contrato cancelado</span>';
        }

        // Botão excluir — disponível para admin em qualquer status exceto assinado pelo cliente
        $status_nao_excluiveis = ['assinado_contratante', 'assinado'];
        if (!in_array($status, $status_nao_excluiveis) && PhotoMusic_Contratos_Permissoes::pode_editar()) {
            echo ' &nbsp; <a class="button" style="color:#a00; margin-left:20px;" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_excluir_contrato&contrato_id=' . $contrato->id),
                'pm_excluir_contrato'
            ) . '" onclick="return confirm(\'Excluir este contrato permanentemente? Esta ação não pode ser desfeita.\')">🗑️ Excluir Contrato</a>';
        }

        echo '</div>';

        // ── Ordem de Serviço — disponível para qualquer status ───
        echo '<div style="margin-top:10px;">';
        $url_gerar_os = wp_nonce_url(
            admin_url('admin-post.php?action=pm_gerar_os&contrato_id=' . $contrato->id),
            'pm_gerar_os'
        );
        if (!empty($contrato->os_path)) {
            // OS já gerada: botão baixar + botão regenerar
            echo '<a class="button button-primary" target="_blank" href="' . esc_url($contrato->os_path) . '">📋 Baixar Ordem de Serviço</a>';
            echo ' &nbsp; <a class="button button-secondary" target="_blank" href="' . esc_url($url_gerar_os) . '" title="Regera o PDF com os dados atuais">🔄 Regenerar OS</a>';
        } else {
            echo '<a class="button button-secondary" target="_blank" href="' . esc_url($url_gerar_os) . '">📋 Gerar Ordem de Serviço</a>';
        }
        if (!empty($_GET['os_erro'])) {
            echo ' <span style="color:#a00; margin-left:8px;">⚠ Erro ao gerar OS. Verifique se a biblioteca TCPDF está instalada.</span>';
        }
        echo '</div>';

        // Botões de edição de conteúdo — disponíveis para quem pode editar, em qualquer status antes de assinado
        $status_editaveis = ['rascunho', 'aguardando_assinatura_admin', 'aguardando_assinatura_contratante'];
        if (in_array($status, $status_editaveis) && PhotoMusic_Contratos_Permissoes::pode_editar()) {
            echo '<p>';
            if (empty($contrato->conteudo)) {
                echo '<a class="button button-primary"
                href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&gerar_contrato=' . $contrato->id) . '">
                ⚙️ Gerar Contrato
                </a>';
            } else {
                echo '<a class="button button-secondary"
                href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&gerar_contrato=' . $contrato->id) . '">
                🔄 Regerar Conteúdo
                </a>';
                echo '<a class="button"
                style="margin-left:10px;"
                href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&limpar_contrato=' . $contrato->id) . '">
                🗑️ Limpar Conteúdo
                </a>';
            }
            echo '</p>';
        }

        if (!empty($contrato->conteudo)) {
            echo '<div style="background:#fff; padding:20px; border:1px solid #ccc; margin-top:10px;">';
            echo wp_kses_post($contrato->conteudo);
            echo '</div>';
        } else {
            echo '<p><em>Nenhum conteúdo gerado ainda. Clique em "Gerar Contrato" para montar o contrato com as cláusulas cadastradas.</em></p>';
        }

        echo '<hr>';

        if ($contrato->pdf_final) {
            echo '<h2>Visualização do PDF</h2>';
            echo '<iframe src="' . esc_url($contrato->pdf_final) . '" style="width:100%; height:600px;"></iframe>';
        }

        echo '</div>';
    }

    /* ============================================================
       DETALHES DO EVENTO
    ============================================================ */
    public static function render_evento_detalhes_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        if (empty($_GET['id'])) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        $id_evento = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id_evento <= 0) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        $core = new PhotoMusic_Events_Core();
        $evento = $core->get_evento_completo($id_evento);

        if (!$evento) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        if (!$evento) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        echo '<div class="wrap">';
        echo '<h1>Evento #' . $evento['id'] . '</h1>';
        echo '<a class="button" href="' . admin_url('admin.php?page=photomusic-eventos') . '">← Voltar</a>';
        echo '<hr>';

        echo '<h2>Informações</h2>';
        echo '<table class="widefat striped">';
        echo '<tr><th>ID</th><td>' . $evento['id'] . '</td></tr>';
        echo '<tr><th>Motivo</th><td>' . esc_html($evento['motivo_evento']) . '</td></tr>';
        echo '<tr><th>Data</th><td>' . ($evento['data_evento'] ? date('d/m/Y', strtotime($evento['data_evento'])) : '—') . '</td></tr>';
        echo '<tr><th>Status</th><td>' . esc_html($evento['status_evento']) . '</td></tr>';
        echo '</table>';

        echo '<hr>';

        /* ============================================================
           SERVIÇOS DO EVENTO
        ============================================================ */
        echo '<h2>Serviços do Evento</h2>';

        echo '<a class="button button-primary" 
                    href="' . admin_url('admin.php?page=photomusic-add-servico&id=' . $id_evento) . '">
                    + Adicionar Serviço
                </a><br><br>';

        $servicos_evento = PhotoMusic_Servicos::get_evento_servicos($id_evento);

        if (empty($servicos_evento)) {
            echo '<p><em>Nenhum serviço adicionado ainda.</em></p>';
        } else {

            echo '<table class="widefat striped">';
            echo '<thead>
                    <tr>
                        <th>Serviço</th>
                        <th>Horas</th>
                        <th>Pacote</th>
                        <th>Valor Base</th>
                        <th>Adicional</th>
                        <th>Total</th>
                    </tr>
                </thead><tbody>';

            $total_evento = 0;
            foreach ($servicos_evento as $s) {
                $total_evento += floatval($s['valor_final']);
                $nome_servico = $s['nome_servico'] ?? ('Serviço #' . $s['id_servico']);
                $nome_pacote  = $s['nome_pacote']  ?? '—';

                echo '<tr>';
                echo '<td><strong>' . esc_html($nome_servico) . '</strong></td>';
                echo '<td>' . esc_html($s['horas_contratadas']) . 'h</td>';
                echo '<td>' . esc_html($nome_pacote) . '</td>';
                echo '<td>R$ ' . number_format($s['valor_base'], 2, ',', '.') . '</td>';
                echo '<td>R$ ' . number_format($s['valor_adicional'], 2, ',', '.') . '</td>';
                echo '<td><strong>R$ ' . number_format($s['valor_final'], 2, ',', '.') . '</strong></td>';
                echo '</tr>';
            }
            echo '<tr style="background:#f0f0f0;">';
            echo '<td colspan="5" style="text-align:right;"><strong>Total do Evento:</strong></td>';
            echo '<td><strong>R$ ' . number_format($total_evento, 2, ',', '.') . '</strong></td>';
            echo '</tr>';

            echo '</tbody></table>';
        }

        echo '<hr>';

        echo '<h2>Contrato</h2>';

        $contrato = PhotoMusic_Contratos::get_by_event($id_evento);

        if ($contrato) {
            echo '<a class="button" href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $contrato->id) . '">Ver Contrato</a>';
        } else {
            echo '<a class="button button-primary" href="' . wp_nonce_url(
                admin_url('admin-post.php?action=pm_criar_contrato&id_evento=' . $id_evento),
                'pm_criar_contrato'
            ) . '">📄 Criar Contrato</a>';
        }

        /* ============================================================
           SEÇÃO: PAGAMENTO
        ============================================================ */
        echo '<hr>';
        echo '<h2>💰 Pagamento</h2>';

        if (!empty($_GET['pagamento_ok'])) {
            echo '<div class="notice notice-success is-dismissible"><p>✅ Pagamento confirmado com sucesso!</p></div>';
        }

        global $wpdb;
        $pgto_confirmado    = (bool) ($wpdb->get_var($wpdb->prepare(
            "SELECT pagamento_confirmado FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
            $id_evento
        )) ?? 0);
        $pgto_confirmado_em = $wpdb->get_var($wpdb->prepare(
            "SELECT pagamento_confirmado_em FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
            $id_evento
        ));

        if ($pgto_confirmado) {
            echo '<p><span style="color:#2a7a2a;font-weight:600;font-size:15px;">✅ Pagamento confirmado'
               . ($pgto_confirmado_em ? ' em ' . date('d/m/Y \à\s H:i', strtotime($pgto_confirmado_em)) : '')
               . '</span></p>';
        } else {
            echo '<p><span style="color:#c07000;font-weight:600;">⏳ Pagamento pendente</span></p>';
            $url_confirmar = wp_nonce_url(
                admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&confirmar_pagamento=1'),
                'pm_confirmar_pagamento_' . $id_evento
            );
            echo '<a class="button button-primary" href="' . esc_url($url_confirmar) . '" '
               . 'onclick="return confirm(\'Confirmar que o pagamento deste evento foi recebido?\');">'
               . '✅ Confirmar Pagamento</a>';
            echo '<p class="description" style="margin-top:6px;">Ao confirmar, a tarefa de pagamento será concluída automaticamente e o cliente não receberá instruções de pagamento ao assinar o contrato.</p>';
        }

        /* ============================================================
           SEÇÃO: FORMULÁRIO DE PRÉ-CADASTRO
        ============================================================ */
        echo '<hr>';
        echo '<h2>📋 Pré-Cadastro do Cliente</h2>';

        $tipo_cel_pc = $evento['tipo_celebracao'] ?? '';
        $token_pc    = $evento['token_evento']    ?? '';
        $tel_pc      = preg_replace('/\D/', '', $evento['telefone_contratante'] ?? '');
        if ($tel_pc && strlen($tel_pc) <= 11) {
            $tel_pc = '55' . $tel_pc;
        }

        if ($tipo_cel_pc === '1eucaristia') {

            $url_eucaristia = get_option('pm_eucaristia_form_url', '');

            if (empty($url_eucaristia)) {
                echo '<div class="notice notice-warning inline"><p>'
                    . '⚠️ URL do formulário de 1ª Eucaristia não configurada. '
                    . 'Acesse <strong>Configurações → Geral</strong> e informe a URL da página do formulário.'
                    . '</p></div>';
            } else {
                echo '<p>Envie o link abaixo para o cliente preencher o formulário de <strong>1ª Eucaristia</strong>:</p>';
                echo '<p>';
                echo '<code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;font-size:13px;">'
                    . esc_html($url_eucaristia) . '</code>&nbsp;';
                echo '<button type="button" class="button button-small" '
                    . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_eucaristia) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                    . '📋 Copiar Link</button>';
                if ($tel_pc) {
                    $msg_euc = rawurlencode(
                        "Olá! Segue o link para preencher o formulário de pré-cadastro da 1ª Eucaristia:\n"
                        . $url_eucaristia
                    );
                    echo ' <a class="button button-primary" target="_blank" rel="noopener"'
                        . ' href="https://wa.me/' . esc_attr($tel_pc) . '?text=' . $msg_euc . '">'
                        . '📱 Enviar via WhatsApp</a>';
                }
                echo '</p>';
            }

        } elseif ($token_pc) {

            $url_precadastro = home_url('/pre-cadastro/?t=' . $token_pc);
            $status_pc       = $evento['pre_cadastro_status'] ?? '';

            $status_labels = [
                'pendente'   => '<span style="color:#e67e00;font-weight:600;">⏳ Aguardando preenchimento</span>',
                'confirmado' => '<span style="color:#2a7a2a;font-weight:600;">✅ Preenchido pelo cliente</span>',
                'cancelado'  => '<span style="color:#c00;font-weight:600;">❌ Cancelado</span>',
            ];
            if (!empty($status_pc) && isset($status_labels[$status_pc])) {
                echo '<p>Status: ' . $status_labels[$status_pc] . '</p>';
            }

            echo '<p>Envie o link abaixo para o cliente preencher os dados pessoais e confirmar o contrato:</p>';
            echo '<p>';
            echo '<code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;font-size:13px;">'
                . esc_html($url_precadastro) . '</code>&nbsp;';
            echo '<button type="button" class="button button-small" '
                . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_precadastro) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                . '📋 Copiar Link</button>';
            if ($tel_pc) {
                $msg_pc = rawurlencode(
                    "Olá! Segue o link para preencher o formulário de pré-cadastro do seu evento:\n"
                    . $url_precadastro
                );
                echo ' <a class="button button-primary" target="_blank" rel="noopener"'
                    . ' href="https://wa.me/' . esc_attr($tel_pc) . '?text=' . $msg_pc . '">'
                    . '📱 Enviar via WhatsApp</a>';
            }
            echo '</p>';

        } else {
            echo '<div class="notice notice-warning inline"><p>'
                . '⚠️ Token do evento não encontrado. Salve o evento novamente para gerar o link.'
                . '</p></div>';
        }

        /* ============================================================
           SEÇÃO: GALERIA DE FOTOS
        ============================================================ */
        echo '<hr>';
        echo '<h2>🖼️ Galeria de Fotos</h2>';

        // Notificações
        if (!empty($_GET['galeria_salva']))   echo '<div class="notice notice-success is-dismissible"><p>✅ Links da galeria salvos.</p></div>';
        if (!empty($_GET['servico_adicionado'])) echo '<div class="notice notice-success is-dismissible"><p>✅ Serviço adicionado.</p></div>';
        if (!empty($_GET['servico_removido']))   echo '<div class="notice notice-success is-dismissible"><p>🗑️ Serviço removido.</p></div>';

        $codigo_interno = $evento['codigo_interno'] ?? '';
        $token_evento   = $evento['token_evento']   ?? '';

        // --- Link de aceite com token do evento (novo formato) ---
        if ($token_evento) {
            $url_base_aceite = home_url('/aceite-de-fotos-e-videos/?t=' . $token_evento . '&tel=');
            echo '<p><strong>🔗 Link de aceite para convidados (WhatsApp/QR Code):</strong><br>';
            echo '<code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;font-size:13px;">'
                . esc_html($url_base_aceite) . '<em>TELEFONE</em></code> ';
            echo '<button type="button" class="button button-small" '
                . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_base_aceite) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                . 'Copiar base</button></p>';
            echo '<p style="color:#666;font-size:0.85em;margin-top:-8px;">'
                . 'O bot substitui <strong>TELEFONE</strong> pelo número do convidado. '
                . 'O sistema verifica automaticamente se já fez aceite e redireciona para a galeria.'
                . '</p>';

            // --- Link do contratante (token gerado ou aceite inicial) ---
            if ($codigo_interno) {
                global $wpdb;

                // Busca o token mais recente do contratante para este evento
                $token_cont = $wpdb->get_var($wpdb->prepare(
                    "SELECT token_acesso FROM {$wpdb->prefix}pm_aceites_evento
                     WHERE id_evento = %d AND tipo_aceite = 'contratante'
                       AND token_acesso IS NOT NULL AND token_acesso != ''
                     ORDER BY id DESC LIMIT 1",
                    $id_evento
                ));

                if ($token_cont) {
                    // Contratante já aceitou → mostra link direto da galeria com token
                    $url_cont = home_url('/galeria/' . $codigo_interno . '/?token=' . $token_cont);
                    echo '<p><strong>🔑 Link da galeria para o contratante:</strong><br>';
                    echo '<code style="background:#e8f5e9;padding:3px 8px;border-radius:4px;font-size:13px;">'
                        . esc_html($url_cont) . '</code> ';
                    echo '<button type="button" class="button button-small" '
                        . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_cont) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                        . '📋 Copiar</button></p>';
                    echo '<p style="color:#666;font-size:0.85em;margin-top:-8px;">'
                        . 'Contratante já aceitou os termos. Este link abre a galeria diretamente (celular e computador, sem limite de acessos).'
                        . '</p>';
                } else {
                    // Contratante ainda não aceitou → mostra link de primeiro acesso
                    $url_aceite_cont = home_url('/galeria/' . $codigo_interno . '/aceite/?tipo=contratante');
                    echo '<p><strong>🔑 Link de primeiro acesso do contratante:</strong><br>';
                    echo '<code style="background:#fff8e1;padding:3px 8px;border-radius:4px;font-size:13px;">'
                        . esc_html($url_aceite_cont) . '</code> ';
                    echo '<button type="button" class="button button-small" '
                        . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_aceite_cont) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                        . '📋 Copiar</button></p>';
                    echo '<p style="color:#666;font-size:0.85em;margin-top:-8px;">'
                        . 'Contratante ainda não aceitou os termos. Após o aceite, este painel exibirá o link definitivo com token.'
                        . '</p>';
                }
            }
        } elseif ($codigo_interno) {
            echo '<div class="notice notice-warning inline"><p>⚠️ Token do evento não gerado. Acesse <strong>Configurações → Ferramentas → Executar Atualizações</strong> para gerar.</p></div>';
        } else {
            echo '<div class="notice notice-warning inline"><p>⚠️ Evento sem <em>código interno</em>. Salve o evento novamente para gerar o código.</p></div>';
        }

        // --- CRUD de links por serviço ---
        echo '<hr style="margin:20px 0;">';
        echo '<h3>📋 Links por Serviço</h3>';
        echo '<p style="color:#555;font-size:0.9em;">Cada serviço do evento (Foto Cabine, Plataforma 360, Paparazzi, etc.) tem seu próprio link fotoshare. '
            . 'O ChatBot usa estes links para enviar aos convidados. Um mesmo tipo de serviço pode ter mais de um link.</p>';

        // Labels e ícones por tipo
        $tipo_labels = [
            'foto_cabine'      => '📸 Foto Cabine',
            'totem'            => '🏛️ Totem Fotográfico',
            '360'              => '🎡 Plataforma 360º',
            'paparazzi_digital'=> '🎭 Foto Paparazzi Digital',
            'paparazzi'        => '📷 Foto Paparazzi (em breve)',
            'lembranca'        => '🖼️ Foto Lembrança',
            'video'            => '🎥 Vídeo',
            'gif'              => '🎞️ GIF Animado',
            'outro'            => '📎 Outro',
        ];

        // Busca serviços já cadastrados para este evento
        global $wpdb;
        $servicos_cadastrados = $wpdb->get_results($wpdb->prepare(
            "SELECT id, nome_servico, tipo, link_convidado, link_contratante, status_servico
             FROM {$wpdb->prefix}pm_event_services
             WHERE id_evento = %d
             ORDER BY id ASC",
            $id_evento
        ));

        if (!empty($servicos_cadastrados)) {
            echo '<table class="widefat striped" style="max-width:900px;">';
            echo '<thead><tr><th>Tipo</th><th>Nome</th><th>Link Fotoshare (convidados/contratante)</th><th>Status</th><th></th></tr></thead><tbody>';

            foreach ($servicos_cadastrados as $sv) {
                $tipo_label = $tipo_labels[$sv->tipo] ?? $sv->tipo;
                $status_badge = $sv->status_servico === 'ativo'
                    ? '<span style="color:green;">● Ativo</span>'
                    : '<span style="color:#999;">● Inativo</span>';

                echo '<tr>';
                echo '<td>' . esc_html($tipo_label) . '</td>';
                echo '<td><strong>' . esc_html($sv->nome_servico) . '</strong></td>';
                echo '<td style="font-size:12px;">';
                if ($sv->link_convidado) {
                    echo '<a href="' . esc_url($sv->link_convidado) . '" target="_blank" style="word-break:break-all;">'
                        . esc_html(substr($sv->link_convidado, 0, 60)) . (strlen($sv->link_convidado) > 60 ? '…' : '') . '</a> ';
                    echo '<button type="button" class="button button-small" '
                        . 'onclick="navigator.clipboard.writeText(\'' . esc_js($sv->link_convidado) . '\').then(()=>this.textContent=\'✅\').catch(()=>{})">'
                        . '📋</button>';
                } else {
                    echo '<em style="color:#aaa;">sem link</em>';
                }
                echo '</td>';
                echo '<td>' . $status_badge . '</td>';
                echo '<td>';
                echo '<a class="button button-small" style="color:#a00;" '
                    . 'href="' . wp_nonce_url(
                        admin_url('admin-post.php?action=pm_del_galeria_servico&id=' . $sv->id . '&id_evento=' . $id_evento),
                        'pm_del_galeria_servico_' . $sv->id
                    ) . '" '
                    . 'onclick="return confirm(\'Remover este serviço?\')">🗑️ Remover</a>';
                echo '</td>';
                echo '</tr>';
            }

            echo '</tbody></table><br>';
        } else {
            echo '<p><em>Nenhum serviço cadastrado ainda para este evento.</em></p>';
        }

        // Formulário para adicionar novo serviço
        echo '<h4>➕ Adicionar Link de Serviço</h4>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        echo '<input type="hidden" name="action" value="pm_add_galeria_servico">';
        echo '<input type="hidden" name="id_evento" value="' . intval($id_evento) . '">';
        wp_nonce_field('pm_add_galeria_servico', 'pm_servico_nonce');

        echo '<table class="form-table" style="max-width:680px;">';

        echo '<tr>';
        echo '<th scope="row"><label for="pm_sv_tipo">Tipo de serviço:</label></th>';
        echo '<td><select id="pm_sv_tipo" name="tipo" style="min-width:200px;">';
        foreach ($tipo_labels as $val => $label) {
            echo '<option value="' . esc_attr($val) . '">' . esc_html($label) . '</option>';
        }
        echo '</select></td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="pm_sv_nome">Nome (ex: Foto Cabine, Plataforma 360 #2):</label></th>';
        echo '<td><input type="text" id="pm_sv_nome" name="nome_servico" required '
            . 'class="regular-text" placeholder="Ex: Plataforma 360 #2"></td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="pm_sv_link">Link Fotoshare (convidados/contratante):</label></th>';
        echo '<td><input type="url" id="pm_sv_link" name="link_convidado" required '
            . 'class="regular-text" style="width:100%;" placeholder="https://fotoshare.co/e/..."></td>';
        echo '</tr>';

        echo '</table>';
        echo '<p><button type="submit" class="button button-primary">➕ Adicionar Serviço</button></p>';
        echo '</form>';

        echo '</div>';
    }

    /* ============================================================
       SALVA OS LINKS DA GALERIA DO EVENTO
    ============================================================ */
    public static function handle_salvar_galeria_links() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        if (!isset($_POST['pm_galeria_nonce']) ||
            !wp_verify_nonce($_POST['pm_galeria_nonce'], 'pm_salvar_galeria_links')) {
            wp_die('Falha de segurança.');
        }

        $id_evento = intval($_POST['id_evento'] ?? 0);

        if ($id_evento <= 0) {
            wp_die('ID de evento inválido.');
        }

        $link_conv = esc_url_raw(sanitize_text_field($_POST['link_galeria_convidado']   ?? ''));
        $link_cont = esc_url_raw(sanitize_text_field($_POST['link_galeria_contratante'] ?? ''));

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_eventos',
            [
                'link_galeria_convidado'   => $link_conv,
                'link_galeria_contratante' => $link_cont,
            ],
            ['id' => $id_evento]
        );

        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add(
                'galeria_links_salvos',
                null,
                $id_evento,
                null,
                'Links da galeria atualizados pelo admin.'
            );
        }

        wp_redirect(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&galeria_salva=1'));
        exit;
    }

    /* ============================================================
       ADICIONA UM LINK DE SERVIÇO (pm_event_services)
    ============================================================ */
    public static function handle_add_galeria_servico() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        if (!isset($_POST['pm_servico_nonce']) ||
            !wp_verify_nonce($_POST['pm_servico_nonce'], 'pm_add_galeria_servico')) {
            wp_die('Falha de segurança.');
        }

        $id_evento = intval($_POST['id_evento'] ?? 0);
        if ($id_evento <= 0) wp_die('ID de evento inválido.');

        $tipos_validos = ['foto_cabine', 'totem', '360', 'paparazzi_digital', 'paparazzi', 'lembranca', 'video', 'gif', 'outro'];
        $tipo          = sanitize_text_field($_POST['tipo'] ?? 'foto');
        if (!in_array($tipo, $tipos_validos)) $tipo = 'outro';

        $nome_servico   = sanitize_text_field(substr($_POST['nome_servico']   ?? '', 0, 255));
        $link_convidado = esc_url_raw(sanitize_text_field($_POST['link_convidado']  ?? ''));
        $link_contrat   = esc_url_raw(sanitize_text_field($_POST['link_contratante'] ?? ''));

        if (!$nome_servico || !$link_convidado) {
            wp_die('Nome e link são obrigatórios.');
        }

        $slug = sanitize_title($nome_servico . '-' . $id_evento . '-' . time());

        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'pm_event_services',
            [
                'id_evento'       => $id_evento,
                'nome_servico'    => $nome_servico,
                'slug_servico'    => $slug,
                'tipo'            => $tipo,
                'status_servico'  => 'ativo',
                'link_convidado'  => $link_convidado,
                'link_contratante'=> $link_contrat,
                'regras_acesso'   => '',
                'pasta_protegida' => '',
                'criado_em'       => current_time('mysql'),
            ]
        );

        wp_redirect(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&servico_adicionado=1'));
        exit;
    }

    /* ============================================================
       REMOVE UM LINK DE SERVIÇO (pm_event_services)
    ============================================================ */
    public static function handle_del_galeria_servico() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        $id_servico = intval($_GET['id']       ?? 0);
        $id_evento  = intval($_GET['id_evento'] ?? 0);

        if (!$id_servico || !$id_evento) wp_die('Parâmetros inválidos.');

        if (!isset($_GET['_wpnonce']) ||
            !wp_verify_nonce($_GET['_wpnonce'], 'pm_del_galeria_servico_' . $id_servico)) {
            wp_die('Falha de segurança.');
        }

        global $wpdb;
        $wpdb->delete(
            $wpdb->prefix . 'pm_event_services',
            ['id' => $id_servico, 'id_evento' => $id_evento]
        );

        wp_redirect(admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento . '&servico_removido=1'));
        exit;
    }

    public static function render_evento_operador_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        if (empty($_GET['id'])) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        $id_evento = intval($_GET['id']);

        echo '<div class="wrap">';
        echo '<h1>Painel do Operador — Evento #' . $id_evento . '</h1>';
        echo '<a class="button" href="' . admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento) . '">← Voltar</a>';
        echo '<hr>';

        // Aqui entra o HTML da tela
        include dirname(__FILE__) . '/../admin/views/evento-operador-view.php';

        echo '</div>';
    }

    /* ============================================================
       PÁGINA: ENVIAR WHATSAPP MANUAL — CONTRATO
    ============================================================ */
    public static function render_wpp_contrato_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Sem permissão.');
        }

        $id = intval($_GET['id'] ?? 0);
        if (!$id) {
            echo '<div class="wrap"><p>Contrato não informado.</p></div>';
            return;
        }

        $contrato = class_exists('PhotoMusic_Contratos') ? PhotoMusic_Contratos::get($id) : null;
        if (!$contrato) {
            echo '<div class="wrap"><p>Contrato não encontrado.</p></div>';
            return;
        }

        // Busca telefone e nome do cliente
        global $wpdb;
        $telefone = '';
        $nome     = '';

        if (class_exists('PhotoMusic_Contratantes')) {
            $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
            if ($contratante) {
                $telefone = preg_replace('/\D/', '', $contratante->telefone ?? '');
                $nome     = trim(($contratante->nome ?? '') ?: ($contratante->nome_completo ?? ''));
            }
        }

        if (empty($telefone) && !empty($contrato->id_evento)) {
            $ev = $wpdb->get_row($wpdb->prepare(
                "SELECT telefone_contratante, nome_contratante FROM {$wpdb->prefix}pm_eventos WHERE id = %d LIMIT 1",
                $contrato->id_evento
            ));
            if ($ev) {
                $telefone = preg_replace('/\D/', '', $ev->telefone_contratante ?? '');
                if (empty($nome)) $nome = $ev->nome_contratante ?? '';
            }
        }

        $link_assinatura = PhotoMusic_Contratos_Actions::get_link_assinatura($contrato->token);
        $voltar_url      = admin_url('admin.php?page=photomusic-contratos');

        // Mensagem padrão inteligente
        $nao_assinou = empty($contrato->assinatura_contratante_data);
        $default_msg = $nao_assinou
            ? "📋 Olá" . ($nome ? ", {$nome}" : '') . "! Passando para lembrar que seu contrato ainda está aguardando sua assinatura.\n\nAcesse o link para visualizar e assinar:\n{$link_assinatura}"
            : "Olá" . ($nome ? ", {$nome}" : '') . "! Tudo bem? Sou da PhotoMusic Produções. ";

        // Processa envio
        $sucesso = false;
        $erro    = '';

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pm_wpp_nonce'])) {
            if (!wp_verify_nonce($_POST['pm_wpp_nonce'], 'pm_wpp_contrato_' . $id)) {
                $erro = 'Token de segurança inválido. Recarregue e tente novamente.';
            } else {
                $mensagem_envio = sanitize_textarea_field($_POST['mensagem'] ?? '');
                if (empty($mensagem_envio)) {
                    $erro = 'Digite uma mensagem antes de enviar.';
                } elseif (empty($telefone)) {
                    $erro = 'Telefone do cliente não encontrado neste contrato.';
                } else {
                    $result = PhotoMusic_WhatsApp::send($telefone, $mensagem_envio, ['id_evento' => $contrato->id_evento ?? null]);
                    if (is_wp_error($result)) {
                        $erro = 'Erro ao enviar: ' . $result->get_error_message();
                    } else {
                        $sucesso = true;
                        if (class_exists('PhotoMusic_Contratos')) {
                            PhotoMusic_Contratos::registrar_log($id, 'wpp_manual', "Mensagem manual enviada para {$telefone}");
                        }
                    }
                }
            }
        }

        echo '<div class="wrap">';
        echo '<h1>📲 Enviar WhatsApp — Contrato #' . intval($id) . '</h1>';
        echo '<p><a class="button" href="' . esc_url($voltar_url) . '">← Voltar</a></p>';

        if ($sucesso) {
            echo '<div class="notice notice-success"><p>✅ Mensagem enviada com sucesso para <strong>' . esc_html($nome ?: $telefone) . '</strong>!</p></div>';
        }
        if ($erro) {
            echo '<div class="notice notice-error"><p>⚠️ ' . esc_html($erro) . '</p></div>';
        }

        // Info do contrato
        echo '<table class="widefat" style="max-width:600px;margin-bottom:16px;">';
        echo '<tr><th>Cliente</th><td>' . esc_html($nome ?: '—') . '</td></tr>';
        echo '<tr><th>Telefone</th><td>' . esc_html($telefone ? '+55 ' . $telefone : '⚠️ Não encontrado') . '</td></tr>';
        echo '<tr><th>Evento</th><td>' . esc_html($contrato->motivo_evento ?? '—') . '</td></tr>';
        echo '<tr><th>Status</th><td>' . esc_html(self::label_status($contrato->status_contrato)) . '</td></tr>';
        echo '<tr><th>Assinatura cliente</th><td>' . ($nao_assinou ? '⏳ Pendente' : '✅ Assinado em ' . esc_html($contrato->assinatura_contratante_data)) . '</td></tr>';
        echo '</table>';

        if (empty($telefone)) {
            echo '<div class="notice notice-warning"><p>⚠️ Não foi possível encontrar o telefone deste cliente. Cadastre o telefone no evento para habilitar o envio.</p></div>';
        } else {
            // Formulário de envio
            echo '<form method="post" style="max-width:600px;">';
            wp_nonce_field('pm_wpp_contrato_' . $id, 'pm_wpp_nonce');
            echo '<input type="hidden" name="id" value="' . intval($id) . '">';
            echo '<table class="form-table">';
            echo '<tr><th><label for="pm_wpp_mensagem">Mensagem</label></th>';
            echo '<td>';
            echo '<textarea id="pm_wpp_mensagem" name="mensagem" rows="8" style="width:100%;font-family:monospace;font-size:13px;">'
               . esc_textarea($default_msg)
               . '</textarea>';
            echo '<p class="description">Use *texto* para negrito no WhatsApp. O link de assinatura já está na mensagem padrão.</p>';
            echo '</td></tr>';
            echo '</table>';
            echo '<p><button type="submit" class="button button-primary" style="background:#25d366;border-color:#1da851;">📲 Enviar pelo WhatsApp</button></p>';
            echo '</form>';
        }

        echo '</div>';
    }

    /* ============================================================
        ENFILEIRAR JS DA TELA DO OPERADOR
    ============================================================ */
    public static function enqueue_scripts($hook) {

        if ($hook !== 'photomusic_page_photomusic-evento-operador') {
            return;
        }

        wp_enqueue_script(
            'pm-operador-evento',
            plugins_url('../../assets/js/pm-operador-evento.js', __FILE__),
            ['jquery'],
            '1.0',
            true
        );

        wp_localize_script('pm-operador-evento', 'PM_OPERADOR', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('pm_operador_nonce'),
        ]);
    }

}

add_action('admin_enqueue_scripts', ['PhotoMusic_Admin_Menu', 'enqueue_scripts']);
