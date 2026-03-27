<?php
// includes/core/class-photomusic-admin-menu.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Admin_Menu {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_submenus']);
        add_action('admin_init', [__CLASS__, 'process_contrato_actions']);
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
            $contrato = PhotoMusic_Contratos::get($enviar_whatsapp);
            if ($contrato && $contrato->pdf_final) {
                $contratante_obj = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
                $telefone = $contratante_obj
                    ? preg_replace('/\D/', '', $contratante_obj->telefone ?? '')
                    : '';
                PhotoMusic_WhatsApp::send_pdf(
                    $telefone,
                    "Olá! Segue o contrato do seu evento.",
                    $contrato->pdf_final,
                    ['id_evento' => $contrato->id_evento]
                );
                wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $enviar_whatsapp . '&whatsapp_ok=1'));
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
                            $obs       = $s['observacoes'] ?? '';
                            $total       += $val;
                            $total_base  += $val_base;
                            $total_adicional += $val_adic;
                            $lista_html .= '<li><strong>' . esc_html($nome);
                            if ($pac) $lista_html .= ' — ' . esc_html($pac);
                            if ($hrs) $lista_html .= ' — ' . $hrs . 'h';
                            $lista_html .= '</strong>';
                            if ($val_adic > 0) {
                                $lista_html .= '<ul>';
                                $lista_html .= '<li>Serviço: R$ ' . number_format($val_base, 2, ',', '.') . '</li>';
                                $label_adic = $obs ? esc_html($obs) : 'Adicional (deslocamento/horas extras)';
                                $lista_html .= '<li>' . $label_adic . ': R$ ' . number_format($val_adic, 2, ',', '.') . '</li>';
                                $lista_html .= '<li><strong>Subtotal: R$ ' . number_format($val, 2, ',', '.') . '</strong></li>';
                                $lista_html .= '</ul>';
                            } else {
                                $lista_html .= ' — R$ ' . number_format($val, 2, ',', '.');
                            }
                            $lista_html .= '</li>';
                        }
                    }
                    $lista_html .= '</ul>';

                    $contato = $evento_tmp->contato_responsavel ?: $evento_tmp->contato_cerimonialista ?: '';

                    $vars = [
                        '{lista_servicos}'         => $lista_html,
                        '{data_evento}'            => $data_fmt,
                        '{horario_inicio}'         => $hi,
                        '{horario_fim}'            => $hf,
                        '{horario_servico}'        => $hs,
                        '{horario_chegada}'        => $horario_chegada,
                        '{local_evento}'           => ($evento_tmp->local_evento ?? '') . ($endereco_local ? ', situado na ' . $endereco_local : ''),
                        '{valor_total_final}'      => 'R$ ' . number_format($total, 2, ',', '.'),
                        '{valor_servicos}'         => 'R$ ' . number_format($total_base, 2, ',', '.'),
                        '{valor_adicional}'        => $total_adicional > 0 ? 'R$ ' . number_format($total_adicional, 2, ',', '.') : '',
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
                    ];

                    $categoria = strtolower($evento_tmp->tipo_evento ?? 'pf') === 'pj' ? 'pj' : 'pf';
                    $clausulas  = PhotoMusic_Clausulas::buscar_por_tags($tags, $categoria);

                    global $wpdb;
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
                        $ct_linha = esc_html($ct_nome);
                        if ($ct_endereco) $ct_linha .= ', residente e domiciliado(a) na ' . esc_html($ct_endereco);
                        if ($ct_cpf) $ct_linha .= ', CPF: ' . esc_html($ct_cpf);
                        if ($ct_rg)  $ct_linha .= ', RG: ' . esc_html($ct_rg) . ($ct_rg_o ? ' ' . esc_html($ct_rg_o) : '');
                        if ($ct_dob) $ct_linha .= ', data de nascimento: ' . $ct_dob;
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
            null,
            'Detalhes do Contrato',
            'Detalhes do Contrato',
            'pm_ver_eventos',
            'photomusic-contrato-detalhes',
            [__CLASS__, 'render_contrato_detalhes_page']
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
            $notice_msg = '<div class="updated notice is-dismissible"><p>PDF enviado por WhatsApp com sucesso!</p></div>';
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
        if ($contrato->status_contrato === 'rascunho' && PhotoMusic_Contratos_Permissoes::pode_editar()) {
            echo ' &nbsp; <a class="button button-secondary" href="' . admin_url('admin.php?page=photomusic_contratos&action=editar&id=' . $contrato->id) . '">✏️ Editar Contrato</a>';
        }
        echo '<hr>';

        echo '<h2>Contrato</h2>';
        echo '<table class="widefat striped">';
        echo '<tr><th>Status</th><td>' . esc_html(self::label_status($contrato->status_contrato)) . '</td></tr>';
        echo '<tr><th>Token</th><td>' . esc_html($contrato->token) . '</td></tr>';
        echo '<tr><th>PDF</th><td>';

        if ($contrato->pdf_final) {
            echo '<a class="button button-primary" target="_blank" href="' . esc_url($contrato->pdf_final) . '">Baixar PDF</a> ';
            echo '<a class="button button-secondary" href="' . esc_url(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . intval($contrato->id))) . '">Regerar PDF</a> ';
            echo '<a class="button" href="' . admin_url('admin.php?page=photomusic-contrato-detalhes&enviar_whatsapp=' . $contrato->id) . '">Enviar por WhatsApp</a>';
        } else {
            echo '<em>PDF não gerado</em>';
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
           SEÇÃO: GALERIA DE FOTOS
        ============================================================ */
        echo '<hr>';
        echo '<h2>🖼️ Galeria de Fotos</h2>';

        // Notificações
        if (!empty($_GET['galeria_salva']))   echo '<div class="notice notice-success is-dismissible"><p>✅ Links da galeria salvos.</p></div>';
        if (!empty($_GET['servico_adicionado'])) echo '<div class="notice notice-success is-dismissible"><p>✅ Serviço adicionado.</p></div>';
        if (!empty($_GET['servico_removido']))   echo '<div class="notice notice-success is-dismissible"><p>🗑️ Serviço removido.</p></div>';

        $codigo_interno = $evento['codigo_interno'] ?? '';

        // --- Link de aceite (para convidados) ---
        if ($codigo_interno) {
            $url_aceite = home_url('/galeria/' . $codigo_interno . '/aceite/');
            echo '<p><strong>🔗 Link de aceite para convidados (enviar via WhatsApp/QR Code):</strong><br>';
            echo '<code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;font-size:13px;">' . esc_html($url_aceite) . '</code> ';
            echo '<button type="button" class="button button-small" '
                . 'onclick="navigator.clipboard.writeText(\'' . esc_js($url_aceite) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                . 'Copiar</button></p>';
            echo '<p style="color:#666;font-size:0.85em;margin-top:-8px;">Ao acessar este link, o convidado preenche nome e telefone e é redirecionado para ver as fotos no site.</p>';
        } else {
            echo '<div class="notice notice-warning inline"><p>⚠️ Evento sem <em>código interno</em>. Salve o evento novamente para gerar o código.</p></div>';
        }

        // --- Link direto para o contratante ---
        $link_cont = $evento['link_galeria_contratante'] ?? '';

        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="margin-top:12px;">';
        echo '<input type="hidden" name="action" value="pm_salvar_galeria_links">';
        echo '<input type="hidden" name="id_evento" value="' . intval($id_evento) . '">';
        wp_nonce_field('pm_salvar_galeria_links', 'pm_galeria_nonce');
        echo '<table class="form-table" style="max-width:680px;">';
        echo '<tr>';
        echo '<th scope="row"><label for="pm_link_cont">🔑 Link do contratante (acesso completo):</label></th>';
        echo '<td>';
        echo '<input type="url" id="pm_link_cont" name="link_galeria_contratante" '
            . 'value="' . esc_attr($link_cont) . '" class="regular-text" style="width:100%;" placeholder="https://...">';
        echo '<p class="description">Link com acesso total à galeria (download, PC). Diferente do link para convidados.</p>';
        echo '</td>';
        echo '</tr>';
        echo '</table>';
        echo '<p><button type="submit" class="button button-primary">💾 Salvar</button>';
        if ($link_cont) {
            echo ' &nbsp;<button type="button" class="button button-small" '
                . 'onclick="navigator.clipboard.writeText(\'' . esc_js($link_cont) . '\').then(()=>this.textContent=\'✅ Copiado!\').catch(()=>{})">'
                . '📋 Copiar link contratante</button>';
        }
        echo '</p>';
        echo '</form>';

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
            echo '<thead><tr><th>Tipo</th><th>Nome</th><th>Link para convidados (Fotoshare)</th><th>Status</th><th></th></tr></thead><tbody>';

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
        echo '<th scope="row"><label for="pm_sv_link">Link Fotoshare (convidados):</label></th>';
        echo '<td><input type="url" id="pm_sv_link" name="link_convidado" required '
            . 'class="regular-text" style="width:100%;" placeholder="https://fotoshare.co/e/..."></td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="pm_sv_link_cont">Link completo (contratante):</label></th>';
        echo '<td><input type="url" id="pm_sv_link_cont" name="link_contratante" '
            . 'class="regular-text" style="width:100%;" placeholder="https://... (opcional)"></td>';
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
