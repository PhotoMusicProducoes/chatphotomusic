<?php
// includes/contratos/class-photomusic-contratos-actions.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Actions {

    /* ============================================================
       REGISTRA TODAS AS AÇÕES admin-post
       ============================================================ */
    /**
     * Retorna o link público de assinatura do contrato.
     * Busca a página com o shortcode [photomusic_contrato] pelo slug conhecido.
     */
    public static function get_link_assinatura($token) {
        // Tenta pela opção configurada manualmente
        $page_id = (int) get_option('photomusic_contrato_page');
        if ($page_id && get_post($page_id)) {
            return get_permalink($page_id) . '?token=' . $token;
        }
        // Tenta pelos slugs conhecidos
        foreach (['assinatura-de-contrato', 'assinatura-de-contrato-2'] as $slug) {
            $page = get_page_by_path($slug);
            if ($page) {
                return get_permalink($page->ID) . '?token=' . $token;
            }
        }
        // Fallback: rota via rewrite
        return home_url('/contrato/' . $token);
    }

    public static function init() {
        add_action('admin_post_pm_editar_contrato',       [__CLASS__, 'editar_contrato']);
        add_action('admin_post_pm_cancelar_contrato',     [__CLASS__, 'cancelar_contrato']);
        add_action('admin_post_pm_encaminhar_assinatura', [__CLASS__, 'encaminhar_assinatura']);
        add_action('admin_post_pm_assinar_representante', [__CLASS__, 'assinar_representante']);
        add_action('admin_post_pm_enviar_cliente',        [__CLASS__, 'enviar_cliente']);
        add_action('admin_post_pm_reenviar_contrato',     [__CLASS__, 'reenviar_contrato']);
        add_action('admin_post_nopriv_pm_assinar_contratante', [__CLASS__, 'assinar_contratante']);
        add_action('admin_post_pm_assinar_contratante',        [__CLASS__, 'assinar_contratante']);
        add_action('admin_post_pm_resetar_assinatura_representante', [__CLASS__, 'resetar_assinatura_representante']);
        add_action('admin_post_pm_devolver_contrato',               [__CLASS__, 'devolver_contrato']);
        add_action('admin_post_pm_cancelar_encaminhamento',         [__CLASS__, 'cancelar_encaminhamento']);
        add_action('admin_post_pm_excluir_contrato',                [__CLASS__, 'excluir_contrato']);
        add_action('admin_post_pm_criar_contrato',                  [__CLASS__, 'criar_contrato']);
        add_action('admin_post_pm_gerar_os',                        [__CLASS__, 'gerar_os']);
    }

    /* ============================================================
       GERAR ORDEM DE SERVIÇO MANUALMENTE
       ============================================================ */
    public static function gerar_os() {

        if (!current_user_can('administrator')) {
            wp_die('Acesso negado.');
        }

        $contrato_id = intval($_GET['contrato_id'] ?? 0);
        if (!$contrato_id || !check_admin_referer('pm_gerar_os')) {
            wp_die('Requisição inválida.');
        }

        $contrato = PhotoMusic_Contratos::get($contrato_id);
        if (!$contrato) {
            wp_die('Contrato não encontrado.');
        }

        require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-os.php';
        $url_os = PhotoMusic_OS::gerar_os($contrato);

        if ($url_os) {
            // Redireciona direto para o PDF gerado
            wp_redirect($url_os);
        } else {
            wp_redirect(add_query_arg(
                ['page' => 'photomusic-contrato-detalhes', 'id' => $contrato_id, 'os_erro' => 1],
                admin_url('admin.php')
            ));
        }
        exit;
    }

    /* ============================================================
       EDITAR CONTRATO (ADMIN)
       ============================================================ */
    public static function editar_contrato() {

        if (!check_admin_referer('pm_editar_contrato')) {
            wp_die('Falha na validação de segurança.');
        }

        if (!current_user_can('administrator') && !PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_die('Você não tem permissão para editar contratos.');
        }

        $id = intval($_POST['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);

        if (!$contrato) wp_die('Contrato não encontrado.');

        $num_raw = intval($_POST['numero_contrato'] ?? 0);

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['numero_contrato' => $num_raw > 0 ? $num_raw : null],
            ['id' => $id],
            ['%d'],
            ['%d']
        );

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-editar&id=' . $id . '&updated=1'));
        exit;
    }

    /* ============================================================
       CANCELAR CONTRATO (ADMIN)
       ============================================================ */
    public static function cancelar_contrato() {

        if (!check_admin_referer('pm_cancelar_contrato')) {
            wp_die('Falha na validação de segurança.');
        }

        PhotoMusic_Contratos_Permissoes::validar_cancelar();

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);

        if (!$contrato) wp_die('Contrato não encontrado.');

        PhotoMusic_Contratos_Permissoes::validar_status_para_cancelar($contrato);

        PhotoMusic_Contratos::set_status($id, 'cancelado');

        wp_redirect(admin_url('admin.php?page=photomusic-contratos&cancelado=1'));
        exit;
    }

    /* ENCAMINHAR PARA ASSINATURA DO REPRESENTANTE */
    public static function encaminhar_assinatura() {
        check_admin_referer('pm_encaminhar_assinatura');

        if (!PhotoMusic_Contratos_Permissoes::pode_enviar()) {
            wp_die('Sem permissão para encaminhar contratos.');
        }

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if (empty($contrato->conteudo)) {
            wp_die('O contrato precisa ter conteúdo antes de ser encaminhado.');
        }
        if ($contrato->status_contrato !== 'rascunho') {
            wp_die('Apenas contratos em rascunho podem ser encaminhados para assinatura.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['status_contrato' => 'aguardando_assinatura_admin', 'atualizado_em' => current_time('mysql')],
            ['id' => $id]
        );

        PhotoMusic_Contratos::registrar_log($id, 'encaminhado_assinatura', 'Encaminhado para assinatura do representante legal.');

        // Notifica representantes autorizados via WhatsApp
        if (class_exists('PhotoMusic_Helpers_Representantes') && class_exists('PhotoMusic_Representantes')) {
            $representantes = PhotoMusic_Helpers_Representantes::get_todos();
            foreach ($representantes as $rep) {
                if (PhotoMusic_Helpers_Representantes::usuario_pode_assinar($rep->ID)) {
                    $tel = preg_replace('/\D/', '', get_user_meta($rep->ID, PhotoMusic_Representantes::META_TEL, true) ?? '');
                    if ($tel) {
                        $link = admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id);
                        if (class_exists('PhotoMusic_WhatsApp')) {
                            try {
                                PhotoMusic_WhatsApp::send(
                                    $tel,
                                    "📋 *Contrato #{$id}* aguardando sua assinatura como representante legal.\n\nAcesse o painel para visualizar e assinar:\n{$link}",
                                    ['id_evento' => $contrato->id_evento]
                                );
                            } catch (Exception $e) {
                                error_log('[PhotoMusic] Falha ao enviar WhatsApp para representante: ' . $e->getMessage());
                            }
                        }
                    }
                }
            }
        }

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&encaminhado=1'));
        exit;
    }

    /* ASSINAR COMO REPRESENTANTE LEGAL */
    public static function assinar_representante() {
        check_admin_referer('pm_assinar_representante');

        $user_id = get_current_user_id();

        if (!PhotoMusic_Helpers_Representantes::usuario_pode_assinar($user_id)) {
            wp_die('Você não está autorizado a assinar contratos como representante da empresa.');
        }

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if ($contrato->status_contrato !== 'aguardando_assinatura_admin') {
            wp_die('Este contrato não está disponível para assinatura do representante.');
        }

        $ip        = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $useragent = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $nome      = get_userdata($user_id)->display_name;
        $hash      = hash('sha256', $id . $nome . $ip . microtime(true));

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            [
                'assinatura_admin_nome'      => $nome,
                'assinatura_admin_data'      => current_time('mysql'),
                'assinatura_admin_ip'        => $ip,
                'assinatura_admin_useragent' => $useragent,
                'assinatura_admin_hash'      => $hash,
                'status_contrato'            => 'assinado_admin',
                'atualizado_em'              => current_time('mysql'),
            ],
            ['id' => $id]
        );

        PhotoMusic_Contratos::registrar_log($id, 'assinado_representante', "Contrato assinado pelo representante: {$nome}");

        // Gera PDF pré-assinado
        if (class_exists('PhotoMusic_Contratos_PDF')) {
            $contrato_atualizado = PhotoMusic_Contratos::get($id);
            PhotoMusic_Contratos_PDF::gerar_pdf($contrato_atualizado);
        }

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&assinado_representante=1'));
        exit;
    }

    /* ENVIAR PARA O CLIENTE */
    public static function enviar_cliente() {
        check_admin_referer('pm_enviar_cliente');

        if (!PhotoMusic_Contratos_Permissoes::pode_enviar()) {
            wp_die('Sem permissão para enviar contrato ao cliente.');
        }

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if ($contrato->status_contrato !== 'assinado_admin') {
            wp_die('O contrato precisa estar assinado pelo representante antes de ser enviado ao cliente.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            [
                'status_contrato'        => 'aguardando_assinatura_contratante',
                'enviado_contratante_em' => current_time('mysql'),
                'atualizado_em'          => current_time('mysql'),
            ],
            ['id' => $id]
        );

        PhotoMusic_Contratos::registrar_log($id, 'enviado_cliente', 'Contrato enviado para assinatura do cliente.');

        // Envia link ao cliente via WhatsApp
        if (class_exists('PhotoMusic_WhatsApp')) {
            $tel_raw = '';

            // 1ª tentativa: tabela pm_contratantes vinculada ao contrato
            if (class_exists('PhotoMusic_Contratantes')) {
                $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
                error_log('[PM Contrato] enviar_cliente → contratante=' . ($contratante ? 'encontrado id=' . $contratante->id : 'NÃO ENCONTRADO'));
                if ($contratante) {
                    $tel_raw = $contratante->telefone ?? $contratante->celular ?? '';
                }
            }

            // 2ª tentativa: telefone direto do evento
            if (empty($tel_raw) && class_exists('PhotoMusic_Events')) {
                global $wpdb;
                $evento_row = $wpdb->get_row($wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
                    $contrato->id_evento
                ));
                if ($evento_row) {
                    $tel_raw = $evento_row->telefone_contratante
                             ?? $evento_row->telefone
                             ?? $evento_row->celular
                             ?? '';
                    error_log('[PM Contrato] enviar_cliente → telefone do evento: ' . $tel_raw);
                }
            }

            $tel = preg_replace('/\D/', '', $tel_raw);
            error_log('[PM Contrato] enviar_cliente → telefone_final=' . ($tel ?: 'VAZIO'));

            if ($tel) {
                $link = self::get_link_assinatura($contrato->token);
                try {
                    PhotoMusic_WhatsApp::send(
                        $tel,
                        "📋 Olá! Seu contrato está pronto para assinatura.\n\nAcesse o link abaixo para visualizar e assinar:\n{$link}",
                        ['id_evento' => $contrato->id_evento]
                    );
                    error_log('[PM Contrato] enviar_cliente → WhatsApp enviado para ' . $tel);
                } catch (Exception $e) {
                    error_log('[PM Contrato] enviar_cliente → ERRO WhatsApp: ' . $e->getMessage());
                }
            } else {
                error_log('[PM Contrato] enviar_cliente → telefone não encontrado, WhatsApp não enviado.');
            }
        }

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&enviado_cliente=1'));
        exit;
    }

    /* REENVIAR CONTRATO AO CLIENTE */
    public static function reenviar_contrato() {
        check_admin_referer('pm_reenviar_contrato');

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if (class_exists('PhotoMusic_WhatsApp')) {
            $tel_raw = '';

            // 1ª tentativa: tabela pm_contratantes
            if (class_exists('PhotoMusic_Contratantes')) {
                $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
                if ($contratante) {
                    $tel_raw = $contratante->telefone ?? $contratante->celular ?? '';
                }
            }

            // 2ª tentativa: telefone direto do evento
            if (empty($tel_raw)) {
                global $wpdb;
                $evento_row = $wpdb->get_row($wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
                    $contrato->id_evento
                ));
                if ($evento_row) {
                    $tel_raw = $evento_row->telefone_contratante
                             ?? $evento_row->telefone
                             ?? $evento_row->celular
                             ?? '';
                }
            }

            $tel = preg_replace('/\D/', '', $tel_raw);
            if ($tel) {
                if ($contrato->status_contrato === 'assinado' && $contrato->pdf_final) {
                    PhotoMusic_WhatsApp::send_pdf_zapi(
                        $tel,
                        "✅ Segue o contrato assinado do seu evento.",
                        $contrato->pdf_final
                    );
                } else {
                    $link = self::get_link_assinatura($contrato->token);
                    PhotoMusic_WhatsApp::send(
                        $tel,
                        "📋 Segue o link para assinatura do seu contrato:\n{$link}",
                        ['id_evento' => $contrato->id_evento]
                    );
                }
            }
        }

        PhotoMusic_Contratos::registrar_log($id, 'contrato_reenviado', 'Contrato reenviado ao cliente.');

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&reenviado=1'));
        exit;
    }

    /* ============================================================
       ASSINATURA DO CONTRATANTE (PÚBLICA)
       ============================================================ */
    public static function assinar_contratante() {

        if (!check_admin_referer('pm_assinar_contratante')) {
            wp_die('Falha na validação de segurança.');
        }

        $id = intval($_POST['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);

        if (!$contrato) wp_die('Contrato não encontrado.');

        if ($contrato->status_contrato !== 'aguardando_assinatura_contratante') {
            wp_die('Este contrato não está disponível para assinatura.');
        }

        $nome = sanitize_text_field($_POST['nome']);

        PhotoMusic_Contratos::registrar_assinatura_contratante(
            $id,
            $nome,
            $_SERVER['REMOTE_ADDR'],
            $_SERVER['HTTP_USER_AGENT']
        );

        wp_redirect(add_query_arg('assinado', '1', wp_get_referer()));
        exit;
    }

    /* ============================================================
       CANCELAR ASSINATURA DO REPRESENTANTE (VOLTA PARA RASCUNHO)
       ============================================================ */
    public static function resetar_assinatura_representante() {
        check_admin_referer('pm_resetar_assinatura_representante');

        PhotoMusic_Contratos_Permissoes::validar_cancelar();

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if ($contrato->status_contrato !== 'assinado_admin') {
            wp_die('Este contrato não está no status correto para cancelar a assinatura do representante.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            [
                'status_contrato'            => 'rascunho',
                'assinatura_admin_nome'      => null,
                'assinatura_admin_data'      => null,
                'assinatura_admin_ip'        => null,
                'assinatura_admin_useragent' => null,
                'assinatura_admin_hash'      => null,
                'atualizado_em'              => current_time('mysql'),
            ],
            ['id' => $id]
        );

        PhotoMusic_Contratos::registrar_log($id, 'assinatura_cancelada', 'Assinatura do representante cancelada. Contrato voltou para rascunho.');

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&assinatura_cancelada=1'));
        exit;
    }

    /* ============================================================
       DEVOLVER CONTRATO PARA CORREÇÃO (REPRESENTANTE → ADMIN)
       ============================================================ */
    public static function devolver_contrato() {
        check_admin_referer('pm_devolver_contrato');

        if (!PhotoMusic_Helpers_Representantes::usuario_pode_assinar(get_current_user_id())) {
            wp_die('Sem permissão para devolver contratos.');
        }

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        if ($contrato->status_contrato !== 'aguardando_assinatura_admin') {
            wp_die('Este contrato não está disponível para devolução.');
        }

        $motivo = sanitize_textarea_field($_GET['motivo'] ?? '');
        $nome   = get_userdata(get_current_user_id())->display_name;

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['status_contrato' => 'rascunho', 'atualizado_em' => current_time('mysql')],
            ['id' => $id]
        );

        $log_msg = "Contrato devolvido para correção pelo representante: {$nome}.";
        if ($motivo) $log_msg .= " Motivo: {$motivo}";
        PhotoMusic_Contratos::registrar_log($id, 'contrato_devolvido', $log_msg);

        // Salva motivo como transient para exibir na tela até o conteúdo ser regerado
        if ($motivo) {
            set_transient('pm_motivo_devolucao_' . $id, $motivo, DAY_IN_SECONDS);
        }

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&devolvido=1'));
        exit;
    }

    /* ============================================================
       CANCELAR ENCAMINHAMENTO (ADMIN → volta para rascunho)
       ============================================================ */
    public static function cancelar_encaminhamento() {
        check_admin_referer('pm_cancelar_encaminhamento');

        if (!PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_die('Sem permissão.');
        }

        $id = intval($_GET['contrato_id']);
        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) wp_die('Contrato não encontrado.');

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_contratos',
            ['status_contrato' => 'rascunho', 'atualizado_em' => current_time('mysql')],
            ['id' => $id]
        );

        PhotoMusic_Contratos::registrar_log($id, 'encaminhamento_cancelado', 'Encaminhamento cancelado pelo admin. Contrato voltou para rascunho.');

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&encaminhamento_cancelado=1'));
        exit;
    }

    /* ============================================================
       EXCLUIR CONTRATO
       ============================================================ */
    public static function excluir_contrato() {
        check_admin_referer('pm_excluir_contrato');

        $id = intval($_GET['contrato_id'] ?? 0);

        if (!PhotoMusic_Contratos_Permissoes::pode_editar()) {
            wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&erro=' . urlencode('Sem permissão para excluir contratos.')));
            exit;
        }

        if ($id <= 0) {
            wp_redirect(admin_url('admin.php?page=photomusic-contratos&erro=' . urlencode('Contrato inválido.')));
            exit;
        }

        $contrato = PhotoMusic_Contratos::get($id);
        if (!$contrato) {
            wp_redirect(admin_url('admin.php?page=photomusic-contratos&erro=' . urlencode('Contrato não encontrado.')));
            exit;
        }

        $status_bloqueados = ['assinado_contratante', 'assinado'];
        if (in_array($contrato->status_contrato, $status_bloqueados)) {
            wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id . '&erro=' . urlencode('Não é possível excluir um contrato já assinado pelo cliente.')));
            exit;
        }

        global $wpdb;
        $wpdb->delete($wpdb->prefix . 'pm_contratos', ['id' => $id]);
        $wpdb->delete($wpdb->prefix . 'pm_contratos_logs', ['id_contrato' => $id]);

        wp_redirect(admin_url('admin.php?page=photomusic-contratos&excluido=1'));
        exit;
    }

    /* ============================================================
       CRIAR CONTRATO PARA EVENTO
       ============================================================ */
    public static function criar_contrato() {
        check_admin_referer('pm_criar_contrato');

        if (!PhotoMusic_Contratos_Permissoes::pode_criar()) {
            wp_die('Sem permissão para criar contratos.');
        }

        $id_evento = intval($_GET['id_evento'] ?? 0);
        if ($id_evento <= 0) wp_die('Evento inválido.');

        // Verifica se já existe contrato para esse evento
        $existente = PhotoMusic_Contratos::get_by_event($id_evento);
        if ($existente) {
            wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $existente->id));
            exit;
        }

        $id_contrato = PhotoMusic_Contratos::criar_contrato_simplificado($id_evento);

        wp_redirect(admin_url('admin.php?page=photomusic-contrato-detalhes&id=' . $id_contrato . '&criado=1'));
        exit;
    }
}
