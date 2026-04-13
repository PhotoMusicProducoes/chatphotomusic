<?php
// includes/core/class-photomusic-events.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Events {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_post_pm_salvar_evento',           [__CLASS__, 'handle_salvar_evento']);
        add_action('admin_post_pm_excluir_evento',          [__CLASS__, 'handle_excluir_evento']);
        add_action('admin_post_pm_concluir_evento',         [__CLASS__, 'handle_concluir_evento']);
        add_action('admin_post_pm_confirmar_pagamento',     [__CLASS__, 'handle_confirmar_pagamento']);
        add_action('admin_post_pm_desativar_chatbot_todos', [__CLASS__, 'handle_desativar_chatbot_todos']);
        add_action('admin_post_pm_chatbot_on',              [__CLASS__, 'handle_chatbot_on']);
        add_action('admin_post_pm_chatbot_off',             [__CLASS__, 'handle_chatbot_off']);
        add_action('wp_ajax_pm_buscar_link_pagamento',      [__CLASS__, 'ajax_buscar_link_pagamento']);
    }

    /* ============================================================
       AJAX — BUSCAR LINK INFINITEPAY POR VALOR + FORMA + TIPO
    ============================================================ */
    public static function ajax_buscar_link_pagamento() {
        check_ajax_referer('pm_buscar_link_pagamento', 'nonce');

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_send_json_error('Sem permissão.');
        }

        $valor      = floatval(str_replace(',', '.', $_POST['valor'] ?? 0));
        $forma      = sanitize_key($_POST['forma'] ?? '');
        $tipo_ev    = sanitize_key($_POST['tipo_evento'] ?? 'social');

        if ($valor <= 0 || empty($forma)) {
            wp_send_json_error('Valor ou forma inválidos.');
        }

        if (!class_exists('PhotoMusic_Links_Pagamento')) {
            wp_send_json_error('Módulo de links não disponível.');
        }

        $link = PhotoMusic_Links_Pagamento::buscar($valor, $forma, $tipo_ev);

        if ($link) {
            wp_send_json_success([
                'link'         => $link->link,
                'parcelas_max' => $link->parcelas_max,
                'descricao'    => $link->descricao,
            ]);
        } else {
            wp_send_json_error('Nenhum link cadastrado para R$ ' . number_format($valor, 2, ',', '.') . ' em ' . $forma . '.');
        }
    }

    /* ============================================================
       MENU PRINCIPAL
    ============================================================ */
    public static function register_menu() {

        add_menu_page(
            'PhotoMusic Eventos',
            'PhotoMusic',
            'pm_ver_eventos',
            'photomusic-eventos',
            [__CLASS__, 'render_eventos_page'],
            'dashicons-camera',
            26
        );

        add_submenu_page(
            'photomusic-eventos',
            'Eventos',
            'Eventos',
            'pm_ver_eventos',
            'photomusic-eventos',
            [__CLASS__, 'render_eventos_page']
        );
    }

    /* ============================================================
       TELA PRINCIPAL — LISTAGEM / FORMULÁRIO
    ============================================================ */
    public static function render_eventos_page() {

        if (!PhotoMusic_Users::current_user_can('pm_ver_eventos')) {
            wp_die('Você não tem permissão para acessar esta página.');
        }

        $acao      = sanitize_text_field($_GET['acao'] ?? '');
        $id_evento = intval($_GET['id'] ?? 0);

        if (in_array($acao, ['novo', 'editar'], true)) {
            self::render_form_evento($acao, $id_evento);
            return;
        }

        self::render_lista_eventos();
    }

    /* ============================================================
       LISTAGEM DE EVENTOS
    ============================================================ */
    private static function render_lista_eventos() {

        $saved   = intval($_GET['saved'] ?? 0);
        $eventos = self::get_events();

        echo '<div class="wrap">';
        echo '<h1>Eventos PhotoMusic</h1>';

        if ($saved) {
            echo '<div class="notice notice-success is-dismissible"><p>✅ Evento salvo com sucesso!</p></div>';
        }

        if (!empty($_GET['excluido'])) {
            echo '<div class="notice notice-success is-dismissible"><p>🗑️ Evento excluído com sucesso.</p></div>';
        }

        if (!empty($_GET['concluido'])) {
            echo '<div class="notice notice-success is-dismissible"><p>✅ Evento marcado como concluído.</p></div>';
        }

        // Conta quantos eventos estão ativos no ChatBot
        $ativos_chatbot = array_filter((array)$eventos, fn($e) => !empty($e->chatbot_ativo));

        echo '<a href="' . esc_url(add_query_arg(['page' => 'photomusic-eventos', 'acao' => 'novo'], admin_url('admin.php'))) . '" class="button button-primary">+ Criar Novo Evento</a>';

        if (!empty($ativos_chatbot)) {
            $url_desativar = wp_nonce_url(
                admin_url('admin-post.php?action=pm_desativar_chatbot_todos'),
                'pm_desativar_chatbot_todos'
            );
            echo ' <a href="' . esc_url($url_desativar) . '" class="button" style="background:#c0392b; color:#fff; border-color:#a93226;"'
               . ' onclick="return confirm(\'Desativar visibilidade no ChatBot de TODOS os ' . count($ativos_chatbot) . ' evento(s) ativos?\nEsta ação não remove os eventos, apenas os oculta do ChatBot.\');">'
               . '🤖 Desativar todos no ChatBot (' . count($ativos_chatbot) . ')</a>';
        }

        if (isset($_GET['chatbot_desativados'])) {
            $n = intval($_GET['chatbot_desativados']);
            echo '<div class="notice notice-success is-dismissible" style="margin-top:10px;"><p>✅ ' . $n . ' evento(s) desativado(s) no ChatBot.</p></div>';
        }

        if (empty($eventos)) {
            echo '<p style="margin-top:20px;">Nenhum evento encontrado.</p></div>';
            return;
        }

        echo '<table class="widefat striped" style="margin-top:20px;">';
        echo '<thead><tr>
                <th>ID</th>
                <th>Motivo</th>
                <th>Data</th>
                <th>Horário</th>
                <th>Local</th>
                <th>Contratante</th>
                <th>Tipo</th>
                <th>Status</th>
                <th style="text-align:center;">ChatBot</th>
                <th>Ações</th>
            </tr></thead><tbody>';

        foreach ($eventos as $e) {

            $contratante_nome = $e->nome_contratante ?: ($e->razao_social ?: '—');

            $horario = '';
            if ($e->horario_inicio) {
                $horario = substr($e->horario_inicio, 0, 5);
                if ($e->horario_fim) $horario .= ' às ' . substr($e->horario_fim, 0, 5);
            }

            $data_fmt = $e->data_evento ? date('d/m/Y', strtotime($e->data_evento)) : '—';

            echo '<tr>';
            echo '<td>' . intval($e->id) . '</td>';
            echo '<td><strong>' . esc_html($e->motivo_evento) . '</strong></td>';
            echo '<td>' . esc_html($data_fmt) . '</td>';
            echo '<td>' . esc_html($horario) . '</td>';
            echo '<td>' . esc_html($e->local_evento ?? '—') . '</td>';
            echo '<td>' . esc_html($contratante_nome) . '</td>';
            echo '<td>' . esc_html($e->tipo_evento) . '</td>';
            if ($e->status_evento === 'concluido') {
                $status_label = '<span style="color:#2e7d32;font-weight:600;">✅ Concluído</span>';
            } elseif ($e->status_evento === 'desativado') {
                $status_label = '<span style="color:#888;">Desativado</span>';
            } else {
                $status_label = '<span style="color:#2271b1;">Ativo</span>';
            }
            echo '<td>' . $status_label . '</td>';

            // Coluna ChatBot — toggle individual
            $chatbot_on  = !empty($e->chatbot_ativo);
            $toggle_acao = $chatbot_on ? 'pm_chatbot_off' : 'pm_chatbot_on';
            $toggle_url  = wp_nonce_url(
                admin_url('admin-post.php?action=' . $toggle_acao . '&id=' . $e->id),
                $toggle_acao . '_' . $e->id
            );
            if ($chatbot_on) {
                echo '<td style="text-align:center;"><a href="' . esc_url($toggle_url) . '" title="Clique para ocultar do ChatBot" style="text-decoration:none; font-size:18px;">✅</a></td>';
            } else {
                echo '<td style="text-align:center;"><a href="' . esc_url($toggle_url) . '" title="Clique para ativar no ChatBot" style="text-decoration:none; font-size:18px; opacity:0.3;">🤖</a></td>';
            }

            $excluir_url = wp_nonce_url(
                admin_url('admin-post.php?action=pm_excluir_evento&id=' . $e->id),
                'pm_excluir_evento_' . $e->id
            );
            $concluir_url = wp_nonce_url(
                admin_url('admin-post.php?action=pm_concluir_evento&id=' . $e->id),
                'pm_concluir_evento_' . $e->id
            );
            $btn_concluir = $e->status_evento === 'ativo'
                ? '<a href="' . esc_url($concluir_url) . '" class="button" style="color:#2e7d32;"
                     onclick="return confirm(\'Marcar evento #' . $e->id . ' como concluído?\')">✅ Concluir</a>'
                : '';
            echo '<td>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-eventos', 'acao' => 'editar', 'id' => $e->id], admin_url('admin.php'))) . '" class="button">Editar</a>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-evento-detalhes', 'id' => $e->id], admin_url('admin.php'))) . '" class="button">Detalhes</a>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-add-servico', 'id' => $e->id], admin_url('admin.php'))) . '" class="button button-primary">Serviços</a>
                    ' . $btn_concluir . '
                    <a href="' . esc_url($excluir_url) . '" class="button" style="color:#a00;"
                       onclick="return confirm(\'Excluir o evento #' . $e->id . ' — ' . esc_js($e->motivo_evento) . '?\nEsta ação não pode ser desfeita e removerá o evento e seus serviços.\');">🗑️ Excluir</a>
                </td>';
            echo '</tr>';
        }

        echo '</tbody></table></div>';
    }

    /* ============================================================
       FORMULÁRIO CRIAR / EDITAR EVENTO
    ============================================================ */
    private static function render_form_evento($acao, $id_evento) {

        $evento = null;

        if ($acao === 'editar' && $id_evento > 0) {
            $evento = self::get_event($id_evento);
            if (!$evento) {
                echo '<div class="wrap"><div class="notice notice-error"><p>Evento não encontrado.</p></div></div>';
                return;
            }
        }

        $titulo     = $acao === 'novo' ? 'Novo Evento' : 'Editar Evento #' . $id_evento;
        $tipo_atual = $evento->tipo_evento ?? 'PF';

        $celebracoes = [
            'aniversario' => 'Aniversário',
            'casamento'   => 'Casamento',
            'corporativo' => 'Corporativo',
            'formatura'   => 'Formatura',
            'bodas'       => 'Bodas',
            '1eucaristia' => '1ª Eucaristia',
            'outro'       => 'Outro',
        ];

        $estados = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

        $cpf_fmt      = self::formatar_cpf($evento->cpf ?? '');
        $cnpj_fmt     = self::formatar_cnpj($evento->cnpj ?? '');
        $cpf_resp_fmt = self::formatar_cpf($evento->cpf_responsavel ?? '');

        // Carrega config de pagamento
        $pgto = [];
        if (!empty($evento->pagamento_config)) {
            $pgto = json_decode($evento->pagamento_config, true) ?: [];
        }
        $pgto_forma             = $pgto['forma'] ?? '';
        $link_pagamento_cartao  = esc_attr($evento->link_pagamento_cartao ?? '');
        $token_evento           = esc_attr($evento->token_evento ?? '');
        $pgto_pix_desconto      = $pgto['pix_desconto_pct'] ?? 5;
        $pgto_cartao_parcelas   = $pgto['cartao_parcelas'] ?? 3;
        $pgto_misto_valor       = $pgto['misto_valor'] ?? '';
        $pgto_misto_parcelas    = $pgto['misto_parcelas'] ?? 3;
        $pgto_pix_payload       = $pgto['pix_payload'] ?? '';
        $pgto_pix_p1_valor      = $pgto['pix_p_1_valor'] ?? '';
        $pgto_pix_p2_valor      = $pgto['pix_p_2_valor'] ?? '';
        $pgto_pix_p2_data       = $pgto['pix_p_2_data'] ?? '';
        $desc_segundo           = $pgto['desc_segundo_servico'] ?? false;
        $desc_segundo_exibir    = $pgto['desc_segundo_exibir'] ?? true;
        $desc_deslocamento      = $pgto['desc_deslocamento'] ?? '';
        $desc_deslocamento_exibir = $pgto['desc_deslocamento_exibir'] ?? true;
        $desc_guestbook         = $pgto['desc_guestbook'] ?? '';
        $desc_guestbook_exibir  = $pgto['desc_guestbook_exibir'] ?? false;
        $pgto_descricao         = $pgto['descricao_pagamento'] ?? '';

        // Contas bancárias para auto-geração de descrição
        $js_conta_pix    = '';
        $js_conta_transf = '';
        if (class_exists('PhotoMusic_Contas_Bancarias')) {
            $cp = PhotoMusic_Contas_Bancarias::get_principal('pix');
            if (!$cp) $cp = PhotoMusic_Contas_Bancarias::get_principal('ambos');
            if ($cp) $js_conta_pix = PhotoMusic_Contas_Bancarias::texto_pix($cp);

            $ct = PhotoMusic_Contas_Bancarias::get_principal('transferencia');
            if (!$ct) $ct = PhotoMusic_Contas_Bancarias::get_principal('ambos');
            if ($ct) $js_conta_transf = PhotoMusic_Contas_Bancarias::texto_transferencia($ct);
        }
        $js_tipo_evento     = ($evento->tipo_evento ?? 'PF') === 'PJ' ? 'corporativo' : 'social';
        $nonce_link_busca   = wp_create_nonce('pm_buscar_link_pagamento');
        $rf_total_final_js  = 0; // preenchido dentro do bloco de resumo financeiro

        ?>
        <div class="wrap">
            <h1><?php echo esc_html($titulo);

            // Badge de status
            if ($acao === 'editar' && $evento):
                $st = $evento->status_evento ?? 'ativo';
                if ($st === 'concluido')       echo ' &nbsp;<span style="background:#e8f5e9;color:#2e7d32;font-size:0.75rem;padding:3px 10px;border-radius:12px;font-weight:600;vertical-align:middle;">✅ Concluído</span>';
                elseif ($st === 'desativado')  echo ' &nbsp;<span style="background:#f5f5f5;color:#888;font-size:0.75rem;padding:3px 10px;border-radius:12px;font-weight:600;vertical-align:middle;">Desativado</span>';
                else                           echo ' &nbsp;<span style="background:#e3f2fd;color:#1565c0;font-size:0.75rem;padding:3px 10px;border-radius:12px;font-weight:600;vertical-align:middle;">● Ativo</span>';
            endif;
            ?></h1>

            <!-- Botões de ação -->
            <a href="<?php echo admin_url('admin.php?page=photomusic-eventos'); ?>" class="button">← Voltar</a>
            <?php if ($acao === 'editar' && $evento): ?>
            &nbsp;
            <a href="<?php echo esc_url(add_query_arg(['page' => 'photomusic-evento-detalhes', 'id' => $id_evento], admin_url('admin.php'))); ?>"
               class="button">Detalhes</a>
            <a href="<?php echo esc_url(add_query_arg(['page' => 'photomusic-add-servico', 'id' => $id_evento], admin_url('admin.php'))); ?>"
               class="button button-primary">Serviços</a>
            <?php
            // Botão Ver Contrato — busca o contrato vinculado ao evento
            if (class_exists('PhotoMusic_Contratos')) {
                $contrato_evento = PhotoMusic_Contratos::get_by_event($id_evento);
                if ($contrato_evento) {
                    $url_contrato = add_query_arg(['page' => 'photomusic-contrato-detalhes', 'id' => $contrato_evento->id], admin_url('admin.php'));
                    echo '<a href="' . esc_url($url_contrato) . '" class="button" style="background:#1565c0; color:#fff; border-color:#1565c0;">📄 Ver Contrato</a>';
                }
            }
            ?>
            <?php if (($evento->status_evento ?? '') === 'ativo'):
                $concluir_url = wp_nonce_url(
                    admin_url('admin-post.php?action=pm_concluir_evento&id=' . $id_evento . '&redirect_id=' . $id_evento),
                    'pm_concluir_evento_' . $id_evento
                ); ?>
            <a href="<?php echo esc_url($concluir_url); ?>" class="button"
               style="color:#2e7d32;"
               onclick="return confirm('Marcar evento #<?php echo $id_evento; ?> como concluído?')">✅ Concluir</a>
            <?php endif; ?>
            <?php
            $excluir_url = wp_nonce_url(
                admin_url('admin-post.php?action=pm_excluir_evento&id=' . $id_evento),
                'pm_excluir_evento_' . $id_evento
            ); ?>
            <a href="<?php echo esc_url($excluir_url); ?>" class="button"
               style="color:#a00;"
               onclick="return confirm('Excluir o evento #<?php echo $id_evento; ?> — <?php echo esc_js($evento->motivo_evento ?? ''); ?>?\nEsta ação não pode ser desfeita.')">🗑️ Excluir</a>
            <?php endif; ?>
            <hr>

            <?php if (!empty($_GET['saved'])): ?>
            <div class="notice notice-success is-dismissible" style="margin:12px 0;">
                <p>✅ <strong>Alterações salvas com sucesso!</strong></p>
            </div>
            <?php endif; ?>
            <?php if (!empty($_GET['concluido'])): ?>
            <div class="notice notice-success is-dismissible" style="margin:12px 0;">
                <p>✅ <strong>Evento marcado como concluído!</strong></p>
            </div>
            <?php endif; ?>
            <?php if (!empty($_GET['pgto_confirmado'])): ?>
            <div class="notice notice-success is-dismissible" style="margin:12px 0;">
                <p>✅ <strong>Pagamento confirmado!</strong> O cliente verá a tela de pagamento concluído ao acessar o link.</p>
            </div>
            <?php endif; ?>

            <div id="pm-erros" style="display:none;" class="notice notice-error is-dismissible">
                <p id="pm-erros-msg"></p>
            </div>

            <form method="post" action="<?php echo admin_url('admin-post.php'); ?>" id="form-evento" onsubmit="return validarFormulario()">
                <?php wp_nonce_field('pm_salvar_evento', 'pm_evento_nonce'); ?>
                <input type="hidden" name="action" value="pm_salvar_evento">
                <input type="hidden" name="id_evento" value="<?php echo $id_evento; ?>">

                <!-- ============================================
                     TIPO DO CONTRATANTE
                ============================================ -->
                <h2>Tipo de Contratante</h2>
                <table class="form-table">
                    <tr>
                        <th>Tipo *</th>
                        <td>
                            <label style="margin-right:20px;">
                                <input type="radio" name="tipo_evento" value="PF"
                                    <?php checked($tipo_atual, 'PF'); ?> onchange="toggleTipo('PF')">
                                Pessoa Física
                            </label>
                            <label>
                                <input type="radio" name="tipo_evento" value="PJ"
                                    <?php checked($tipo_atual, 'PJ'); ?> onchange="toggleTipo('PJ')">
                                Pessoa Jurídica
                            </label>
                        </td>
                    </tr>
                </table>

                <!-- ============================================
                     CONTRATANTE PF
                ============================================ -->
                <div id="bloco-pf" <?php echo $tipo_atual === 'PJ' ? 'style="display:none"' : ''; ?>>
                    <h2>Dados do Contratante — Pessoa Física</h2>
                    <table class="form-table">
                        <tr>
                            <th><label>Nome Completo</label></th>
                            <td><input type="text" name="nome_contratante" class="regular-text"
                                       value="<?php echo esc_attr($evento->nome_contratante ?? ''); ?>"></td>
                        </tr>
                        <tr>
                            <th><label>CPF</label></th>
                            <td>
                                <input type="text" name="cpf" id="cpf" class="regular-text"
                                       value="<?php echo esc_attr($cpf_fmt); ?>"
                                       placeholder="000.000.000-00" maxlength="14">
                                <span id="cpf-status" style="margin-left:8px; font-weight:bold;"></span>
                            </td>
                        </tr>
                        <tr>
                            <th><label>RG</label></th>
                            <td><input type="text" name="rg" class="regular-text"
                                       value="<?php echo esc_attr($evento->rg ?? ''); ?>"></td>
                        </tr>
                        <tr>
                            <th><label>Data de Nascimento</label></th>
                            <td><input type="date" name="data_nascimento" class="regular-text"
                                       value="<?php echo esc_attr($evento->data_nascimento ?? ''); ?>"></td>
                        </tr>
                        <tr>
                            <th><label>Telefone / WhatsApp *</label></th>
                            <td><input type="text" name="telefone_contratante" id="telefone_contratante" class="regular-text pm-telefone"
                                       value="<?php echo esc_attr($evento->telefone_contratante ?? ''); ?>"
                                       placeholder="(21) 99999-9999"></td>
                        </tr>
                        <tr>
                            <th><label>E-mail</label></th>
                            <td><input type="email" name="email_contratante" class="regular-text"
                                       value="<?php echo esc_attr($evento->email_contratante ?? ''); ?>"></td>
                        </tr>
                        <tr>
                            <th><label>Instagram</label></th>
                            <td><input type="text" name="instagram_contratante" class="regular-text"
                                       value="<?php echo esc_attr($evento->instagram_contratante ?? ''); ?>"
                                       placeholder="@usuario"></td>
                        </tr>
                        <tr id="row-grau-parentesco" style="display:none">
                            <th><label>Grau de Parentesco</label></th>
                            <td>
                                <input type="text" name="grau_parentesco" class="regular-text"
                                       value="<?php echo esc_attr($evento->grau_parentesco ?? ''); ?>"
                                       placeholder="Ex: Mãe do aniversariante, Pai da noiva...">
                                <p class="description">Relação do contratante com o evento.</p>
                            </td>
                        </tr>
                    </table>
                    <h3 style="margin-top:20px;">Endereço do Contratante</h3>
                    <?php self::render_campos_endereco('cont', $evento, $estados, true); ?>
                </div>

                <!-- ============================================
                     CONTRATANTE PJ
                ============================================ -->
                <div id="bloco-pj" <?php echo $tipo_atual === 'PF' ? 'style="display:none"' : ''; ?>>
                    <h2>Dados do Contratante — Pessoa Jurídica</h2>
                    <table class="form-table">
                        <tr>
                            <th><label>Nome Fantasia</label></th>
                            <td><input type="text" name="nome_fantasia" class="regular-text"
                                       value="<?php echo esc_attr($evento->nome_fantasia ?? ''); ?>"
                                       placeholder="Como a empresa é conhecida"></td>
                        </tr>
                        <tr>
                            <th><label>Razão Social</label></th>
                            <td><input type="text" name="razao_social" class="regular-text"
                                       value="<?php echo esc_attr($evento->razao_social ?? ''); ?>"></td>
                        </tr>
                        <tr>
                            <th><label>CNPJ</label></th>
                            <td>
                                <input type="text" name="cnpj" id="cnpj" class="regular-text"
                                       value="<?php echo esc_attr($cnpj_fmt); ?>"
                                       placeholder="00.000.000/0001-00" maxlength="18">
                                <span id="cnpj-status" style="margin-left:8px; font-weight:bold;"></span>
                            </td>
                        </tr>
                        <tr>
                            <th><label>Representante Legal *</label></th>
                            <td><input type="text" name="responsavel" class="regular-text"
                                       value="<?php echo esc_attr($evento->responsavel ?? ''); ?>"
                                       placeholder="Nome completo"></td>
                        </tr>
                        <tr>
                            <th><label>CPF do Representante</label></th>
                            <td>
                                <input type="text" name="cpf_responsavel" id="cpf_responsavel" class="regular-text"
                                       value="<?php echo esc_attr($cpf_resp_fmt); ?>"
                                       placeholder="000.000.000-00" maxlength="14">
                                <span id="cpf_responsavel-status" style="margin-left:8px; font-weight:bold;"></span>
                            </td>
                        </tr>
                        <tr>
                            <th><label>Telefone / WhatsApp *</label></th>
                            <td><input type="text" name="telefone_contratante" id="telefone_contratante" class="regular-text pm-telefone"
                                       value="<?php echo esc_attr($evento->telefone_contratante ?? ''); ?>"
                                       placeholder="(21) 99999-9999"></td>
                        </tr>
                        <tr>
                            <th><label>E-mail</label></th>
                            <td><input type="email" name="email_contratante" class="regular-text"
                                       value="<?php echo esc_attr($evento->email_contratante ?? ''); ?>"></td>
                        </tr>
                    </table>
                    <h3 style="margin-top:20px;">Endereço do Contratante</h3>
                    <?php self::render_campos_endereco('cont', $evento, $estados, true); ?>
                </div>

                <!-- ============================================
                     DADOS DO EVENTO
                ============================================ -->
                <h2>Dados do Evento</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nome / Motivo *</label></th>
                        <td><input type="text" name="motivo_evento" class="regular-text"
                                   value="<?php echo esc_attr($evento->motivo_evento ?? ''); ?>"
                                   placeholder="Ex: Baile do Especialista da FAB" required></td>
                    </tr>
                    <tr>
                        <th><label>Tipo de Celebração</label></th>
                        <td>
                            <select name="tipo_celebracao" id="select-celebracao" onchange="toggleCelebracao(this.value)">
                                <option value="">— Selecione —</option>
                                <?php foreach ($celebracoes as $k => $v): ?>
                                    <option value="<?php echo $k; ?>" <?php selected($evento->tipo_celebracao ?? '', $k); ?>>
                                        <?php echo esc_html($v); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <!-- CAMPOS POR TIPO DE CELEBRAÇÃO -->
                    <tr id="campo-tema" style="display:none">
                        <th><label>Tema da Festa</label></th>
                        <td><input type="text" name="tema_festa" class="regular-text"
                                   value="<?php echo esc_attr($evento->tema_festa ?? ''); ?>"
                                   placeholder="Ex: Frozen, Super-Herói, Boteco..."></td>
                    </tr>
                    <tr id="campo-cores" style="display:none">
                        <th><label>Cores da Festa</label></th>
                        <td><input type="text" name="cores_festa" class="regular-text"
                                   value="<?php echo esc_attr($evento->cores_festa ?? ''); ?>"
                                   placeholder="Ex: Azul e Dourado"></td>
                    </tr>
                    <tr id="campo-aniversariante" style="display:none">
                        <th><label>Nome do(a) Aniversariante</label></th>
                        <td><input type="text" name="nome_aniversariante" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_aniversariante ?? ''); ?>"></td>
                    </tr>
                    <tr id="campo-pais" style="display:none">
                        <th><label>Nome dos Pais</label></th>
                        <td>
                            <input type="text" name="nome_pais" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_pais ?? ''); ?>">
                            <p class="description">Para menores de 18 anos.</p>
                        </td>
                    </tr>
                    <tr id="campo-idade" style="display:none">
                        <th><label>Idade do(a) Aniversariante</label></th>
                        <td><input type="text" name="idade_aniversariante" class="regular-text"
                                   value="<?php echo esc_attr($evento->idade_aniversariante ?? ''); ?>"
                                   placeholder="Ex: 15 anos"></td>
                    </tr>
                    <tr id="campo-nascimento-aniversariante" style="display:none">
                        <th><label>Data de Nascimento do(a) Aniversariante</label></th>
                        <td><input type="date" name="data_nascimento_aniversariante"
                                   value="<?php echo esc_attr($evento->data_nascimento_aniversariante ?? ''); ?>"></td>
                    </tr>

                    <!-- ============================================
                         CAMPOS EXCLUSIVOS: 1ª EUCARISTIA
                    ============================================ -->
                    <tr id="campo-eucaristia-catequizandos" style="display:none">
                        <th><label>Catequizando(s)</label></th>
                        <td>
                            <div id="pm-catequizandos-lista">
                                <?php
                                global $wpdb;
                                $catequizandos = [];
                                if ($id_evento > 0) {
                                    $catequizandos = $wpdb->get_results($wpdb->prepare(
                                        "SELECT * FROM {$wpdb->prefix}pm_eucaristia_catequizandos WHERE id_evento = %d ORDER BY ordem ASC",
                                        $id_evento
                                    ), ARRAY_A);
                                }
                                if (empty($catequizandos)) {
                                    $catequizandos = [['id' => '', 'nome' => '', 'data_nascimento' => '', 'grau_parentesco' => '', 'ordem' => 1]];
                                }
                                foreach ($catequizandos as $i => $cat):
                                ?>
                                <div class="pm-catequizando-linha" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                                    <input type="hidden" name="catequizando_id[]" value="<?php echo esc_attr($cat['id']); ?>">
                                    <input type="text" name="catequizando_nome[]" class="regular-text"
                                           value="<?php echo esc_attr($cat['nome']); ?>"
                                           placeholder="Nome completo" style="flex:2;">
                                    <input type="date" name="catequizando_nascimento[]"
                                           value="<?php echo esc_attr($cat['data_nascimento'] ?? ''); ?>"
                                           title="Data de nascimento" style="width:140px;">
                                    <input type="text" name="catequizando_parentesco[]"
                                           value="<?php echo esc_attr($cat['grau_parentesco'] ?? ''); ?>"
                                           placeholder="Parentesco (ex: Filho)" style="width:150px;">
                                    <?php if ($i > 0): ?>
                                    <button type="button" class="button pm-remover-catequizando" style="color:red;">✕</button>
                                    <?php endif; ?>
                                </div>
                                <?php endforeach; ?>
                            </div>
                            <button type="button" class="button" id="pm-add-catequizando">+ Adicionar catequizando</button>
                            <p class="description">Adicione um catequizando por linha. Para irmãos/primos no mesmo contrato, clique em "+ Adicionar".</p>
                        </td>
                    </tr>
                    <tr id="campo-catequista" style="display:none">
                        <th><label>Nome do(a) Catequista</label></th>
                        <td><input type="text" name="nome_catequista" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_catequista ?? ''); ?>"
                                   placeholder="Ex: Maria da Silva"></td>
                    </tr>
                    <tr id="campo-horario-catequese" style="display:none">
                        <th><label>Dia e Horário da Catequese</label></th>
                        <td><input type="text" name="horario_catequese" class="regular-text"
                                   value="<?php echo esc_attr($evento->horario_catequese ?? ''); ?>"
                                   placeholder="Ex: Sábado às 09h00"></td>
                    </tr>
                    <tr id="campo-paroquia" style="display:none">
                        <th><label>Nome da Paróquia</label></th>
                        <td><input type="text" name="nome_paroquia" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_paroquia ?? ''); ?>"
                                   placeholder="Ex: Paróquia São José"></td>
                    </tr>
                    <tr id="campo-capela" style="display:none">
                        <th><label>Nome da Capela</label></th>
                        <td><input type="text" name="nome_capela" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_capela ?? ''); ?>"
                                   placeholder="Ex: Capela Nossa Senhora de Fátima"></td>
                    </tr>
                    <tr id="campo-pagamento-eucaristia" style="display:none">
                        <th><label>Forma de Pagamento</label></th>
                        <td>
                            <?php
                            $fp = $evento->forma_pagamento_eucaristia ?? '';
                            $vp = get_option('pm_eucaristia_valor_pix', '150,00');
                            $vc = get_option('pm_eucaristia_valor_cartao', '170,00');
                            ?>
                            <label style="margin-right:20px;">
                                <input type="radio" name="forma_pagamento_eucaristia" value="pix"
                                       <?php checked($fp, 'pix'); ?>>
                                PIX — R$ <?php echo esc_html($vp); ?> à vista
                            </label>
                            <label>
                                <input type="radio" name="forma_pagamento_eucaristia" value="cartao"
                                       <?php checked($fp, 'cartao'); ?>>
                                Cartão — R$ <?php echo esc_html($vc); ?> (3x sem juros)
                            </label>
                            <p class="description">Valores configuráveis em <strong>Configurações → PhotoMusic → Valores 1ª Eucaristia</strong>.</p>
                        </td>
                    </tr>
                    <tr id="campo-noivos" style="display:none">
                        <th><label>Nome dos Noivos / Casal</label></th>
                        <td><input type="text" name="nome_noivos" class="regular-text"
                                   value="<?php echo esc_attr($evento->nome_noivos ?? ''); ?>"
                                   placeholder="Ex: Maria e João"></td>
                    </tr>
                    <tr id="campo-grau-noivos" style="display:none">
                        <th><label>Grau de Parentesco com os Noivos</label></th>
                        <td>
                            <input type="text" name="grau_parentesco_noivos" class="regular-text"
                                   value="<?php echo esc_attr($evento->grau_parentesco_noivos ?? ''); ?>"
                                   placeholder="Ex: Pai da noiva, Irmão do noivo...">
                        </td>
                    </tr>
                    <tr id="campo-modelo-foto" style="display:none">
                        <th><label>Modelo da Foto</label></th>
                        <td>
                            <?php
                            $modelos = [
                                'Foto Tirinha',
                                'Foto Retrato 10x15',
                                'Foto Tirinha e Foto Retrato 10x15 (O convidado escolhe o modelo que deseja receber)',
                            ];
                            $modelo_atual = $evento->modelo_foto ?? '';
                            ?>
                            <select name="modelo_foto" class="regular-text">
                                <option value="">— Selecione —</option>
                                <?php foreach ($modelos as $m): ?>
                                    <option value="<?php echo esc_attr($m); ?>" <?php selected($modelo_atual, $m); ?>>
                                        <?php echo esc_html($m); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description">Foto Cabine ou Totem Fotográfico.</p>
                        </td>
                    </tr>

                    <tr>
                        <th><label>Data do Evento *</label></th>
                        <td><input type="date" name="data_evento"
                                   value="<?php echo esc_attr($evento->data_evento ?? ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th><label>Horário de Início</label></th>
                        <td><input type="time" name="horario_inicio"
                                   value="<?php echo esc_attr($evento->horario_inicio ? substr($evento->horario_inicio, 0, 5) : ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Horário de Fim</label></th>
                        <td><input type="time" name="horario_fim"
                                   value="<?php echo esc_attr($evento->horario_fim ? substr($evento->horario_fim, 0, 5) : ''); ?>"></td>
                    </tr>
                </table>

                <!-- ============================================
                     LOCAL DO EVENTO
                ============================================ -->
                <h2>Local do Evento</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nome do Local</label></th>
                        <td><input type="text" name="local_evento" class="regular-text"
                                   value="<?php echo esc_attr($evento->local_evento ?? ''); ?>"
                                   placeholder="Ex: Salão de Festas XYZ / BASC - Base Aérea de Santa Cruz"></td>
                    </tr>
                    <tr>
                        <th><label>Contato do Salão</label></th>
                        <td><input type="text" name="contato_salao" class="regular-text pm-telefone-livre"
                                   value="<?php echo esc_attr($evento->contato_salao ?? ''); ?>"
                                   placeholder="(21) 99999-9999 - Nome"></td>
                    </tr>
                    <tr>
                        <th><label>Cerimonialista</label></th>
                        <td>
                            <input type="text" name="contato_cerimonialista" class="regular-text pm-telefone-livre"
                                   value="<?php echo esc_attr($evento->contato_cerimonialista ?? ''); ?>"
                                   placeholder="(21) 99999-9999 - Nome">
                            <p class="description">Eventos sociais: aniversário, casamento, formatura.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label>Responsável pelo Evento</label></th>
                        <td>
                            <input type="text" name="contato_responsavel" class="regular-text pm-telefone-livre"
                                   value="<?php echo esc_attr($evento->contato_responsavel ?? ''); ?>"
                                   placeholder="(21) 99999-9999 - Nome">
                            <p class="description">Eventos corporativos.</p>
                        </td>
                    </tr>
                </table>

                <h3>Endereço do Local</h3>
                <?php self::render_campos_endereco('local', $evento, $estados, true); ?>

                <!-- ============================================
                     CHATBOT — LINKS DE GALERIA
                ============================================ -->
                <h2>📱 ChatBot — Links de Galeria</h2>
                <p class="description" style="margin-bottom:12px;">
                    Ative o <strong>toggle</strong> para que este evento apareça no menu
                    <em>"Baixar minha foto"</em> do ChatBot. Os links são cadastrados
                    <strong>por serviço</strong> na página de serviços do evento.
                </p>
                <table class="form-table">
                    <tr>
                        <th><label>Visível no ChatBot</label></th>
                        <td>
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                                <input type="checkbox" name="chatbot_ativo" value="1"
                                    <?php checked(intval($evento->chatbot_ativo ?? 0), 1); ?>
                                    style="width:18px;height:18px;">
                                <strong>Ativar este evento no ChatBot</strong>
                            </label>
                            <p class="description">
                                Quando marcado, o evento aparece no menu do ChatBot independente da data.
                                Desmarque para ocultar (ex: fotos ainda não entregues).
                            </p>
                        </td>
                    </tr>
                </table>

                <?php
                $servicos_evento = [];
                if ($id_evento > 0 && class_exists('PhotoMusic_Servicos')) {
                    $servicos_evento = PhotoMusic_Servicos::get_evento_servicos($id_evento);
                }
                ?>
                <?php if ($id_evento > 0): ?>
                    <?php if (!empty($servicos_evento)): ?>
                        <?php
                        $total_servicos_edit = 0;
                        foreach ($servicos_evento as $se) $total_servicos_edit += floatval($se['valor_final']);
                        ?>
                        <table class="widefat striped" style="max-width:820px; margin-top:12px;">
                            <thead>
                                <tr>
                                    <th>Serviço</th>
                                    <th>Pacote</th>
                                    <th style="width:50px;">Horas</th>
                                    <th style="width:60px;">Início</th>
                                    <th style="width:110px;">Valor</th>
                                    <th style="width:120px;">Galeria</th>
                                    <th style="width:40px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($servicos_evento as $se): ?>
                                <tr <?php echo !empty($se['observacoes']) && strpos($se['observacoes'], 'Brinde') !== false ? 'style="background:#f0fff0;"' : ''; ?>>
                                    <td>
                                        <strong><?php echo esc_html($se['nome_servico'] ?? '—'); ?></strong>
                                        <?php if (!empty($se['observacoes']) && strpos($se['observacoes'], 'Brinde') !== false): ?>
                                            <br><span style="color:#2a7a2a; font-size:11px;">🎁 Brinde</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($se['nome_pacote'] ?? '—'); ?></td>
                                    <td><?php echo intval($se['horas_contratadas']); ?>h</td>
                                    <td><?php echo !empty($se['horario_inicio']) ? substr($se['horario_inicio'], 0, 5) : '—'; ?></td>
                                    <td><strong>R$ <?php echo number_format(floatval($se['valor_final']), 2, ',', '.'); ?></strong></td>
                                    <td>
                                        <?php if (!empty($se['link_galeria'])): ?>
                                            <a href="<?php echo esc_url($se['link_galeria']); ?>" target="_blank"
                                               style="color:#2a7a2a;font-size:12px;">✅ Link</a>
                                        <?php else: ?>
                                            <span style="color:#bbb;font-size:12px;">—</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <a href="<?php echo esc_url(add_query_arg([
                                            'page'   => 'photomusic-add-servico',
                                            'id'     => $id_evento,
                                            'editar' => $se['id'],
                                        ], admin_url('admin.php'))); ?>"
                                           class="button button-small" title="Editar serviço">✏️</a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                            <tfoot>
                                <tr style="background:#f9f9f9;">
                                    <td colspan="4" style="text-align:right;padding:8px 4px;"><strong>Total dos serviços:</strong></td>
                                    <td style="padding:8px 4px;"><strong style="font-size:1.05em;">R$ <?php echo number_format($total_servicos_edit, 2, ',', '.'); ?></strong></td>
                                    <td colspan="2"></td>
                                </tr>
                            </tfoot>
                        </table>
                        <p style="margin-top:8px;">
                            <a href="<?php echo esc_url(add_query_arg(['page' => 'photomusic-add-servico', 'id' => $id_evento], admin_url('admin.php'))); ?>"
                               class="button button-primary">+ Adicionar / Gerenciar Serviços</a>
                        </p>

                    <?php else: ?>
                        <p style="margin-top:8px; color:#666;">
                            ⚠️ Nenhum serviço adicionado ainda.
                            <a href="<?php echo esc_url(add_query_arg(['page' => 'photomusic-add-servico', 'id' => $id_evento], admin_url('admin.php'))); ?>">
                                + Adicionar serviço
                            </a>
                        </p>
                    <?php endif; ?>

                <?php else: ?>
                    <p style="margin-top:8px; color:#666; font-style:italic;">
                        Salve o evento primeiro, depois adicione os serviços para cadastrar os links da galeria.
                    </p>
                <?php endif; ?>

                <!-- ============================================
                     PAGAMENTO E DESCONTOS
                ============================================ -->
                <h2>💰 Pagamento e Descontos</h2>

                <h3>Descontos</h3>
                <table class="form-table">
                    <tr>
                        <th>Desconto 2º Serviço</th>
                        <td>
                            <label>
                                <input type="checkbox" name="desc_segundo_servico" value="1"
                                       <?php checked($desc_segundo); ?>>
                                Aplicar desconto de <strong>R$ 100,00</strong> no 2º serviço
                            </label>
                            &nbsp;&nbsp;
                            <label>
                                <input type="checkbox" name="desc_segundo_exibir" value="1"
                                       <?php checked($desc_segundo_exibir); ?>>
                                Exibir ao cliente
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th>Deslocamento</th>
                        <td>
                            <input type="number" name="desc_deslocamento" step="0.01" min="0"
                                   value="<?php echo esc_attr($desc_deslocamento); ?>"
                                   placeholder="0,00 = Grátis / deixe vazio = não se aplica"
                                   style="width:200px;">
                            <p class="description">Use <strong>0</strong> para "Grátis (Niterói)". Deixe vazio se não há deslocamento.</p>
                            <label style="margin-top:6px;display:inline-block;">
                                <input type="checkbox" name="desc_deslocamento_exibir" value="1"
                                       <?php checked($desc_deslocamento_exibir); ?>>
                                Exibir ao cliente
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th>Desconto Guestbook</th>
                        <td>
                            <input type="number" name="desc_guestbook" step="0.01" min="0"
                                   value="<?php echo esc_attr($desc_guestbook); ?>"
                                   placeholder="Valor do desconto em R$"
                                   style="width:200px;">
                            <p class="description">Deixe vazio se não há desconto no guestbook.</p>
                            <label style="margin-top:6px;display:inline-block;">
                                <input type="checkbox" name="desc_guestbook_exibir" value="1"
                                       <?php checked($desc_guestbook_exibir); ?>>
                                Exibir ao cliente
                            </label>
                        </td>
                    </tr>
                </table>

                <h3>Forma de Pagamento</h3>
                <table class="form-table">
                    <tr>
                        <th>Opção</th>
                        <td>
                            <div style="display:flex;flex-direction:column;gap:18px;">

                                <!-- PIX À VISTA -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="pix_avista"
                                           <?php checked($pgto_forma, 'pix_avista'); ?>
                                           onchange="pmPgtoToggle()">
                                    💸 PIX à vista
                                </label>
                                <div id="pgto-pix-avista" style="margin-left:24px;<?php echo $pgto_forma !== 'pix_avista' ? 'display:none;' : ''; ?>">
                                    <p style="margin:6px 0 4px;">
                                        <label style="font-weight:600;">Link PIX (Copia e Cola) <span style="font-weight:400;color:#777;">— opcional</span></label><br>
                                        <textarea name="pgto_pix_payload" rows="3"
                                                  style="width:100%;max-width:600px;font-family:monospace;font-size:0.85em;"
                                                  placeholder="Cole aqui o código PIX Copia e Cola gerado pelo banco (opcional). Se em branco, o cliente verá só a chave PIX."><?php echo esc_textarea($pgto_pix_payload); ?></textarea>
                                    </p>
                                    <label>Desconto:
                                        <select name="pgto_pix_desconto">
                                            <option value="0"  <?php selected($pgto_pix_desconto, 0);  ?>>Sem desconto</option>
                                            <option value="5"  <?php selected($pgto_pix_desconto, 5);  ?>>5%</option>
                                            <option value="10" <?php selected($pgto_pix_desconto, 10); ?>>10%</option>
                                        </select>
                                    </label>
                                    <p class="description">O valor com desconto será calculado automaticamente na página de pagamento.</p>
                                </div>

                                <!-- PIX PARCELADO -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="pix_parcelado"
                                           <?php checked($pgto_forma, 'pix_parcelado'); ?>
                                           onchange="pmPgtoToggle()">
                                    📅 PIX parcelado
                                </label>
                                <div id="pgto-pix-parcelado" style="margin-left:24px;<?php echo $pgto_forma !== 'pix_parcelado' ? 'display:none;' : ''; ?>">
                                    <p style="margin:6px 0 4px;">
                                        <label style="font-weight:600;">Link PIX (Copia e Cola) <span style="font-weight:400;color:#777;">— opcional</span></label><br>
                                        <textarea name="pgto_pix_payload" rows="3"
                                                  style="width:100%;max-width:600px;font-family:monospace;font-size:0.85em;"
                                                  placeholder="Cole aqui o código PIX Copia e Cola gerado pelo banco (opcional). Se em branco, o cliente verá só a chave PIX."><?php echo esc_textarea($pgto_pix_payload); ?></textarea>
                                    </p>
                                    <table style="border-collapse:collapse;">
                                        <tr>
                                            <td style="padding:4px 12px 4px 0;font-weight:600;">1ª parcela</td>
                                            <td>R$ <input type="number" name="pgto_pix_p1_valor" step="0.01" min="0"
                                                          value="<?php echo esc_attr($pgto_pix_p1_valor); ?>"
                                                          style="width:120px;" placeholder="0,00">
                                                <span style="color:#666;margin-left:8px;">na assinatura do contrato</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding:4px 12px 4px 0;font-weight:600;">2ª parcela</td>
                                            <td>R$ <input type="number" name="pgto_pix_p2_valor" step="0.01" min="0"
                                                          value="<?php echo esc_attr($pgto_pix_p2_valor); ?>"
                                                          style="width:120px;" placeholder="0,00">
                                                <span style="color:#666;margin-left:8px;">até</span>
                                                <input type="date" name="pgto_pix_p2_data"
                                                       value="<?php echo esc_attr($pgto_pix_p2_data); ?>"
                                                       style="margin-left:6px;">
                                                <span style="color:#888;font-size:12px;margin-left:6px;">(opcional)</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding:4px 12px 4px 0;font-weight:600;">3ª parcela</td>
                                            <td><span style="color:#555;">Restante calculado automaticamente até a data do evento</span></td>
                                        </tr>
                                    </table>
                                </div>

                                <!-- CARTÃO -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="cartao"
                                           <?php checked($pgto_forma, 'cartao'); ?>
                                           onchange="pmPgtoToggle()">
                                    💳 Cartão de crédito
                                </label>
                                <div id="pgto-cartao" style="margin-left:24px;<?php echo $pgto_forma !== 'cartao' ? 'display:none;' : ''; ?>">
                                    <label>Parcelas:
                                        <select name="pgto_cartao_parcelas" onchange="pmCartaoJuros(this.value)">
                                            <?php for ($i = 1; $i <= 12; $i++): ?>
                                                <option value="<?php echo $i; ?>" <?php selected($pgto_cartao_parcelas, $i); ?>>
                                                    <?php echo $i; ?>x <?php echo $i <= 3 ? '(sem juros)' : '(com juros)'; ?>
                                                </option>
                                            <?php endfor; ?>
                                        </select>
                                    </label>
                                    <span id="pgto-cartao-juros" style="margin-left:10px;color:#d63638;font-weight:600;<?php echo $pgto_cartao_parcelas <= 3 ? 'display:none;' : ''; ?>">
                                        ⚠️ Parcelamento com juros — informe ao cliente
                                    </span>
                                </div>

                                <!-- DINHEIRO -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="dinheiro"
                                           <?php checked($pgto_forma, 'dinheiro'); ?>
                                           onchange="pmPgtoToggle()">
                                    💵 Dinheiro
                                </label>

                                <!-- TRANSFERÊNCIA -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="transferencia"
                                           <?php checked($pgto_forma, 'transferencia'); ?>
                                           onchange="pmPgtoToggle()">
                                    🏦 Transferência bancária
                                </label>

                                <!-- MISTO -->
                                <label style="font-weight:600;">
                                    <input type="radio" name="pgto_forma" value="misto"
                                           <?php checked($pgto_forma, 'misto'); ?>
                                           onchange="pmPgtoToggle()">
                                    🔀 Misto (dinheiro/PIX + cartão)
                                </label>
                                <div id="pgto-misto" style="margin-left:24px;<?php echo $pgto_forma !== 'misto' ? 'display:none;' : ''; ?>">
                                    <p style="margin:6px 0 4px;">
                                        <label style="font-weight:600;">Link PIX (Copia e Cola) <span style="font-weight:400;color:#777;">— opcional</span></label><br>
                                        <textarea name="pgto_pix_payload" rows="3"
                                                  style="width:100%;max-width:600px;font-family:monospace;font-size:0.85em;"
                                                  placeholder="Cole aqui o código PIX Copia e Cola gerado pelo banco (opcional). Se em branco, o cliente verá só a chave PIX."><?php echo esc_textarea($pgto_pix_payload); ?></textarea>
                                    </p>
                                    <label>R$ <input type="number" name="pgto_misto_valor" step="0.01" min="0"
                                                     value="<?php echo esc_attr($pgto_misto_valor); ?>"
                                                     style="width:130px;" placeholder="0,00">
                                        em dinheiro ou PIX
                                    </label>
                                    &nbsp;+&nbsp;
                                    <label>restante em
                                        <select name="pgto_misto_parcelas">
                                            <?php for ($i = 1; $i <= 12; $i++): ?>
                                                <option value="<?php echo $i; ?>" <?php selected($pgto_misto_parcelas, $i); ?>>
                                                    <?php echo $i; ?>x <?php echo $i <= 3 ? '(sem juros)' : '(com juros)'; ?>
                                                </option>
                                            <?php endfor; ?>
                                        </select>
                                        no cartão
                                    </label>
                                </div>

                            </div>
                        </td>
                    </tr>
                </table>

                <h3>Link de Pagamento para o Cliente</h3>

                <?php if ($id_evento > 0 && !empty($servicos_evento)):
                    $rf_total          = array_sum(array_column($servicos_evento, 'valor_final'));
                    $rf_desc_segundo   = $desc_segundo ? 100.00 : 0;
                    $rf_desc_guestbook = ($desc_guestbook !== '') ? floatval($desc_guestbook) : 0;
                    $rf_base_pix       = $rf_total - $rf_desc_segundo - $rf_desc_guestbook;
                    $rf_desc_pix       = ($pgto_forma === 'pix_avista' && $pgto_pix_desconto > 0)
                                            ? $rf_base_pix * ($pgto_pix_desconto / 100) : 0;
                    $rf_desloc         = ($desc_deslocamento !== '') ? floatval($desc_deslocamento) : 0;
                    $rf_total_final    = $rf_base_pix - $rf_desc_pix + $rf_desloc;
                    $rf_total_final_js = $rf_total_final; // expor para JS
                ?>
                <div style="background:#f0f7ff;border:1px solid #90caf9;border-radius:6px;padding:14px 18px;margin-bottom:18px;max-width:540px;">
                    <strong style="font-size:0.95em;display:block;margin-bottom:10px;color:#1565c0;">💰 Resumo Financeiro</strong>
                    <table style="border-collapse:collapse;width:100%;font-size:0.92em;">
                        <tr>
                            <td style="padding:3px 0;">Total dos serviços</td>
                            <td style="text-align:right;padding:3px 0;">R$ <?php echo number_format($rf_total, 2, ',', '.'); ?></td>
                        </tr>
                        <?php if ($rf_desc_segundo > 0): ?>
                        <tr>
                            <td style="padding:3px 0;color:#555;">− Desconto 2º Serviço</td>
                            <td style="text-align:right;padding:3px 0;color:#555;">− R$ <?php echo number_format($rf_desc_segundo, 2, ',', '.'); ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if ($rf_desc_guestbook > 0): ?>
                        <tr>
                            <td style="padding:3px 0;color:#555;">− Desconto Guestbook</td>
                            <td style="text-align:right;padding:3px 0;color:#555;">− R$ <?php echo number_format($rf_desc_guestbook, 2, ',', '.'); ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if ($rf_desc_pix > 0): ?>
                        <tr>
                            <td style="padding:3px 0;color:#555;">− Desconto PIX (<?php echo intval($pgto_pix_desconto); ?>%)</td>
                            <td style="text-align:right;padding:3px 0;color:#555;">− R$ <?php echo number_format($rf_desc_pix, 2, ',', '.'); ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if ($desc_deslocamento !== ''): ?>
                        <tr>
                            <td style="padding:3px 0;color:#555;"><?php echo $rf_desloc == 0.0 ? '🚗 Deslocamento' : '+ Deslocamento'; ?></td>
                            <td style="text-align:right;padding:3px 0;color:#555;"><?php echo $rf_desloc == 0.0 ? 'Grátis' : 'R$ ' . number_format($rf_desloc, 2, ',', '.'); ?></td>
                        </tr>
                        <?php endif; ?>
                        <tr style="border-top:2px solid #90caf9;">
                            <td style="padding:8px 0 4px;font-weight:700;font-size:1.1em;">Valor Final</td>
                            <td style="text-align:right;padding:8px 0 4px;font-weight:700;font-size:1.15em;color:#1565c0;">R$ <?php echo number_format($rf_total_final, 2, ',', '.'); ?></td>
                        </tr>
                    </table>
                    <?php if ($rf_total_final > 0): ?>
                    <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <button type="button" class="button button-small"
                                onclick="navigator.clipboard.writeText('<?php echo number_format($rf_total_final, 2, '.', ''); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(function(){ this.textContent='📋 Copiar valor'; }.bind(this),2500); }.bind(this))">
                            📋 Copiar valor
                        </button>
                        <span style="color:#666;font-size:12px;">Use ao gerar o link de pagamento no cartão</span>
                    </div>
                    <?php endif; ?>
                    <!-- Botão confirmar pagamento -->
                    <?php
                    $pgto_confirmado = intval($evento->pagamento_confirmado ?? 0);
                    if ($pgto_confirmado):
                    ?>
                    <div style="margin-top:12px;padding:8px 12px;background:#e8f5e9;border-radius:4px;color:#2e7d32;font-weight:600;">
                        ✅ Pagamento confirmado pelo operador
                    </div>
                    <?php else: ?>
                    <div style="margin-top:12px;">
                        <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=pm_confirmar_pagamento&id=' . $id_evento), 'pm_confirmar_pgto_' . $id_evento)); ?>"
                           class="button button-primary"
                           onclick="return confirm('Confirmar que o pagamento deste evento foi recebido? O cliente verá a tela de pagamento concluído.');">
                            ✅ Confirmar Pagamento Recebido
                        </a>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <table class="form-table">
                    <tr id="pgto-row-link-cartao" style="<?php echo !in_array($pgto_forma, ['cartao','misto'], true) ? 'display:none;' : ''; ?>">
                        <th><label>Link para Cartão</label></th>
                        <td>
                            <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;">
                                <input type="url" id="link_pagamento_cartao" name="link_pagamento_cartao" style="flex:1;min-width:260px;"
                                       value="<?php echo $link_pagamento_cartao; ?>"
                                       placeholder="Cole aqui o link InfinitePay ou outro link de pagamento…">
                                <button type="button" id="pm-btn-buscar-link" class="button"
                                        onclick="pmBuscarLinkInfinitePay()"
                                        title="Busca automaticamente no banco de links InfinitePay pelo valor total do evento">
                                    🔍 Buscar Link InfinitePay
                                </button>
                            </div>
                            <p id="pm-link-status" style="margin-top:4px;font-size:12px;color:#555;"></p>
                            <p class="description">Aparece como botão "Pagar com Cartão" na página de pagamento do cliente.</p>
                        </td>
                    </tr>
                    <?php if (!empty($token_evento)): ?>
                    <tr>
                        <td colspan="2">
                            <?php
                            $pgto_page_id = get_option('pm_pagamento_page_id');
                            $pagamento_url = $pgto_page_id
                                ? add_query_arg('t', $token_evento, get_permalink($pgto_page_id))
                                : home_url('/pagamento/?t=' . $token_evento);
                            ?>
                            <strong>Link de pagamento para enviar ao cliente:</strong><br>
                            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
                                <code style="background:#f0f0f0;padding:6px 10px;border-radius:4px;font-size:0.85em;word-break:break-all;flex:1;">
                                    <?php echo esc_html($pagamento_url); ?>
                                </code>
                                <button type="button"
                                        onclick="navigator.clipboard.writeText('<?php echo esc_js($pagamento_url); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{this.textContent='📋 Copiar link';},2500); }.bind(this))"
                                        class="button">
                                    📋 Copiar link
                                </button>
                                <a href="<?php echo esc_url($pagamento_url); ?>" target="_blank" class="button">
                                    👁 Visualizar
                                </a>
                            </div>
                            <p class="description">Crie uma página WordPress com o shortcode <code>[photomusic_pagamento_evento]</code> e configure o ID dela em <em>Configurações → PhotoMusic → ID da página de pagamento</em>.</p>
                        </td>
                    </tr>
                    <?php endif; ?>
                </table>

                <script>
                function pmPgtoToggle() {
                    const forma = document.querySelector('[name="pgto_forma"]:checked')?.value;
                    ['pix_avista','pix_parcelado','cartao','misto'].forEach(f => {
                        // IDs dos divs usam hífen; valores do radio usam underscore
                        const el = document.getElementById('pgto-' + f.replace(/_/g, '-'));
                        if (el) el.style.display = (forma === f) ? '' : 'none';
                    });
                    // Mostra campo Link para Cartão só quando cartão ou misto
                    const rowCartao = document.getElementById('pgto-row-link-cartao');
                    if (rowCartao) rowCartao.style.display = (forma === 'cartao' || forma === 'misto') ? '' : 'none';
                }
                document.addEventListener('DOMContentLoaded', pmPgtoToggle);
                function pmCartaoJuros(val) {
                    const el = document.getElementById('pgto-cartao-juros');
                    if (el) el.style.display = parseInt(val) > 3 ? '' : 'none';
                }

                // ── Dados do evento passados do PHP ──────────────────────
                const pmTotalFinal  = <?php echo json_encode($rf_total_final_js); ?>;
                const pmContaPix    = <?php echo json_encode($js_conta_pix); ?>;
                const pmContaTransf = <?php echo json_encode($js_conta_transf); ?>;
                const pmTipoEvento  = <?php echo json_encode($js_tipo_evento); ?>;
                const pmNonceLinkBusca = <?php echo json_encode($nonce_link_busca); ?>;
                const pmAjaxUrl     = <?php echo json_encode(admin_url('admin-ajax.php')); ?>;

                // ── Formata número como R$ X.XXX,XX ─────────────────────
                function pmFmt(v) {
                    return 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                }
                function pmFmtDate(y_m_d) {
                    if (!y_m_d) return '';
                    const p = y_m_d.split('-');
                    return p[2] + '/' + p[1] + '/' + p[0];
                }

                // ── Gerar descrição automaticamente ──────────────────────
                function pmGerarDescricaoPagamento() {
                    const forma       = document.querySelector('[name="pgto_forma"]:checked')?.value || '';
                    const total       = pmTotalFinal;
                    const descPct     = parseFloat(document.querySelector('[name="pgto_pix_desconto"]')?.value || 0);
                    const p1          = parseFloat(document.querySelector('[name="pgto_pix_p1_valor"]')?.value || 0);
                    const p2          = parseFloat(document.querySelector('[name="pgto_pix_p2_valor"]')?.value || 0);
                    const p2Data      = pmFmtDate(document.querySelector('[name="pgto_pix_p2_data"]')?.value || '');
                    const cartParc    = parseInt(document.querySelector('[name="pgto_cartao_parcelas"]')?.value || 3);
                    const mistoValor  = parseFloat(document.querySelector('[name="pgto_misto_valor"]')?.value || 0);
                    const mistoParc   = parseInt(document.querySelector('[name="pgto_misto_parcelas"]')?.value || 3);

                    let texto = '';
                    const contaPix   = pmContaPix   ? ' – na conta da empresa (' + pmContaPix + ')' : '';
                    const contaTransf= pmContaTransf? ' para a conta da empresa (' + pmContaTransf + ')' : '';

                    if (forma === 'pix_avista') {
                        const totalDesc = descPct > 0 ? total * (1 - descPct / 100) : total;
                        texto  = 'O pagamento de ' + pmFmt(totalDesc);
                        if (descPct > 0) texto += ' (com ' + descPct + '% de desconto à vista no PIX)';
                        texto += ' será realizado à vista por PIX' + contaPix + '.';

                    } else if (forma === 'pix_parcelado') {
                        texto = 'O pagamento de ' + pmFmt(total) + ' será parcelado em PIX' + contaPix + ': ';
                        const partes = [];
                        if (p1 > 0) partes.push('1ª parcela de ' + pmFmt(p1) + ' na assinatura do contrato');
                        if (p2 > 0) {
                            let s2 = '2ª parcela de ' + pmFmt(p2);
                            if (p2Data) s2 += ' até ' + p2Data;
                            partes.push(s2);
                        }
                        partes.push('restante até a data do evento');
                        texto += partes.join(', ') + '.';

                    } else if (forma === 'cartao') {
                        const semJuros = cartParc <= 3 ? ' sem juros' : ' com juros';
                        const parcVal  = total > 0 && cartParc > 0 ? ' (' + pmFmt(total / cartParc) + '/parcela)' : '';
                        texto = 'O pagamento de ' + pmFmt(total) + ' será realizado em ' + cartParc + 'x no cartão de crédito' + semJuros + parcVal + ' via link de pagamento.';

                    } else if (forma === 'dinheiro') {
                        texto = 'O pagamento de ' + pmFmt(total) + ' será realizado em dinheiro no dia do evento.';

                    } else if (forma === 'transferencia') {
                        texto = 'O pagamento de ' + pmFmt(total) + ' será realizado por transferência bancária' + contaTransf + '.';

                    } else if (forma === 'misto') {
                        const semJuros = mistoParc <= 3 ? ' sem juros' : ' com juros';
                        texto  = 'O pagamento de ' + pmFmt(total) + ' será realizado sendo ' + pmFmt(mistoValor);
                        texto += ' em dinheiro ou PIX' + (pmContaPix ? ' (' + pmContaPix + ')' : '');
                        texto += ' e o restante em ' + mistoParc + 'x no cartão de crédito' + semJuros + ' via link de pagamento.';
                    } else {
                        alert('Selecione uma forma de pagamento primeiro.');
                        return;
                    }

                    document.getElementById('pgto_descricao_pagamento').value = texto;
                }

                // ── Buscar link InfinitePay ───────────────────────────────
                function pmBuscarLinkInfinitePay() {
                    const forma  = document.querySelector('[name="pgto_forma"]:checked')?.value || '';
                    const total  = pmTotalFinal;
                    const status = document.getElementById('pm-link-status');

                    if (total <= 0) {
                        if (status) status.innerHTML = '<span style="color:#c00;">⚠️ Adicione serviços ao evento para calcular o valor total.</span>';
                        return;
                    }
                    if (!forma || forma === 'pix_avista' || forma === 'pix_parcelado' || forma === 'dinheiro' || forma === 'transferencia') {
                        if (status) status.innerHTML = '<span style="color:#c00;">⚠️ A busca de link InfinitePay só se aplica a Cartão ou Misto.</span>';
                        return;
                    }

                    const formaApi = 'cartao'; // InfinitePay sempre cartão
                    if (status) status.innerHTML = '⏳ Buscando link...';

                    const btn = document.getElementById('pm-btn-buscar-link');
                    if (btn) btn.disabled = true;

                    const data = new FormData();
                    data.append('action', 'pm_buscar_link_pagamento');
                    data.append('nonce',  pmNonceLinkBusca);
                    data.append('valor',  total.toFixed(2));
                    data.append('forma',  formaApi);
                    data.append('tipo_evento', pmTipoEvento);

                    fetch(pmAjaxUrl, { method: 'POST', body: data })
                        .then(r => r.json())
                        .then(res => {
                            if (btn) btn.disabled = false;
                            if (res.success) {
                                document.getElementById('link_pagamento_cartao').value = res.data.link;
                                if (status) status.innerHTML = '<span style="color:#2a7a2a;">✅ Link encontrado: até ' + res.data.parcelas_max + 'x' + (res.data.descricao ? ' — ' + res.data.descricao : '') + '</span>';
                            } else {
                                if (status) status.innerHTML = '<span style="color:#c00;">⚠️ ' + res.data + '</span>';
                            }
                        })
                        .catch(() => {
                            if (btn) btn.disabled = false;
                            if (status) status.innerHTML = '<span style="color:#c00;">⚠️ Erro ao comunicar com o servidor.</span>';
                        });
                }
                </script>

                <!-- ============================================
                     DESCRIÇÃO DE PAGAMENTO (aparece no contrato)
                ============================================ -->
                <h2>Descrição de Pagamento</h2>
                <table class="form-table">
                    <tr>
                        <th><label for="pgto_descricao_pagamento">Texto do Contrato</label></th>
                        <td>
                            <div style="margin-bottom:8px;">
                                <button type="button" class="button" onclick="pmGerarDescricaoPagamento()"
                                        title="Gera automaticamente o texto com base na forma de pagamento e contas cadastradas">
                                    ⚡ Gerar Automaticamente
                                </button>
                                <span style="margin-left:8px;font-size:12px;color:#666;">Preenche o texto abaixo com base nas configurações de pagamento.</span>
                            </div>
                            <textarea name="pgto_descricao_pagamento" id="pgto_descricao_pagamento"
                                      rows="5" class="large-text"
                                      placeholder="Ex: O pagamento de 100% do valor do serviço será realizado à vista por PIX com 5% de desconto na conta da empresa..."><?php echo esc_textarea($pgto_descricao); ?></textarea>
                            <p class="description">
                                Descreva as condições de pagamento conforme aparecerá no contrato. Use a variável <code>{descricao_pagamento}</code> no modelo de contrato.
                                <?php if ($js_conta_pix): ?>
                                <br><strong>Conta PIX principal:</strong> <?php echo esc_html($js_conta_pix); ?>
                                <?php endif; ?>
                                <?php if ($js_conta_transf): ?>
                                <br><strong>Conta Transferência principal:</strong> <?php echo esc_html($js_conta_transf); ?>
                                <?php endif; ?>
                                <?php if (!$js_conta_pix && !$js_conta_transf): ?>
                                <br><span style="color:#c00;">⚠️ Nenhuma conta bancária cadastrada. <a href="<?php echo admin_url('admin.php?page=photomusic-contas-bancarias'); ?>">Cadastrar agora</a></span>
                                <?php endif; ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <?php submit_button($acao === 'novo' ? 'Criar Evento' : 'Salvar Alterações'); ?>
            </form>
        </div>

        <script>
        // ── Campos por tipo de celebração
        var camposPorCelebracao = {
            'aniversario': ['campo-tema','campo-cores','campo-aniversariante','campo-pais','campo-idade','campo-nascimento-aniversariante','row-grau-parentesco','campo-modelo-foto'],
            'casamento':   ['campo-noivos','campo-grau-noivos','campo-cores','row-grau-parentesco','campo-modelo-foto'],
            'bodas':       ['campo-noivos','campo-grau-noivos','campo-cores','campo-modelo-foto'],
            'corporativo': ['campo-tema','campo-cores','campo-modelo-foto'],
            'formatura':   ['campo-tema','campo-cores','campo-aniversariante','campo-modelo-foto'],
            '1eucaristia': ['campo-eucaristia-catequizandos','campo-catequista','campo-horario-catequese','campo-paroquia','campo-capela','campo-pagamento-eucaristia','campo-pais','row-grau-parentesco','campo-modelo-foto'],
            'outro':       ['campo-tema','campo-cores','campo-modelo-foto'],
        };

        function toggleCelebracao(val) {
            var todos = ['campo-tema','campo-cores','campo-aniversariante','campo-pais','campo-idade','campo-nascimento-aniversariante','row-grau-parentesco','campo-noivos','campo-grau-noivos','campo-modelo-foto','campo-eucaristia-catequizandos','campo-catequista','campo-horario-catequese','campo-paroquia','campo-capela','campo-pagamento-eucaristia'];
            todos.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            if (val && camposPorCelebracao[val]) {
                camposPorCelebracao[val].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) el.style.display = '';
                });
            }
        }

        // ── Catequizandos dinâmicos (1ª Eucaristia)
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('pm-add-catequizando') && document.getElementById('pm-add-catequizando').addEventListener('click', function() {
                var lista = document.getElementById('pm-catequizandos-lista');
                var div = document.createElement('div');
                div.className = 'pm-catequizando-linha';
                div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
                div.innerHTML = '<input type="hidden" name="catequizando_id[]" value="">'
                    + '<input type="text" name="catequizando_nome[]" class="regular-text" placeholder="Nome completo" style="flex:2;">'
                    + '<input type="date" name="catequizando_nascimento[]" title="Data de nascimento" style="width:140px;">'
                    + '<input type="text" name="catequizando_parentesco[]" placeholder="Parentesco (ex: Filho)" style="width:150px;">'
                    + '<button type="button" class="button pm-remover-catequizando" style="color:red;">✕</button>';
                lista.appendChild(div);
            });
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('pm-remover-catequizando')) {
                    e.target.closest('.pm-catequizando-linha').remove();
                }
            });
        });

        // ── Toggle PF/PJ
        function toggleTipo(tipo) {
            var pfBloco = document.getElementById('bloco-pf');
            var pjBloco = document.getElementById('bloco-pj');
            pfBloco.style.display = tipo === 'PF' ? '' : 'none';
            pjBloco.style.display = tipo === 'PJ' ? '' : 'none';
            // Desabilita campos do bloco oculto para não serem enviados pelo form
            pfBloco.querySelectorAll('input,select,textarea').forEach(function(el) {
                el.disabled = (tipo !== 'PF');
            });
            pjBloco.querySelectorAll('input,select,textarea').forEach(function(el) {
                el.disabled = (tipo !== 'PJ');
            });
        }
        // Inicializa disabled corretamente ao carregar a página
        document.addEventListener('DOMContentLoaded', function() {
            var tipoChecked = document.querySelector('[name="tipo_evento"]:checked');
            if (tipoChecked) toggleTipo(tipoChecked.value);
        });

        // ── Máscaras
        function mascaraCPF(v) {
            v = v.replace(/\D/g,'').substring(0,11);
            v = v.replace(/(\d{3})(\d)/,'$1.$2');
            v = v.replace(/(\d{3})(\d)/,'$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
            return v;
        }
        function mascaraCNPJ(v) {
            v = v.replace(/\D/g,'').substring(0,14);
            v = v.replace(/^(\d{2})(\d)/,'$1.$2');
            v = v.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
            v = v.replace(/\.(\d{3})(\d)/,'.$1/$2');
            v = v.replace(/(\d{4})(\d)/,'$1-$2');
            return v;
        }
        function mascaraTelefone(v) {
            v = v.replace(/\D/g,'').substring(0,11);
            if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
            else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
            return v;
        }

        // ── Validações
        function validarCPF(cpf) {
            cpf = cpf.replace(/\D/g,'');
            if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
            let s=0,r;
            for(let i=1;i<=9;i++) s+=parseInt(cpf[i-1])*(11-i);
            r=(s*10)%11; if(r===10||r===11) r=0; if(r!==parseInt(cpf[9])) return false;
            s=0;
            for(let i=1;i<=10;i++) s+=parseInt(cpf[i-1])*(12-i);
            r=(s*10)%11; if(r===10||r===11) r=0;
            return r===parseInt(cpf[10]);
        }
        function validarCNPJ(cnpj) {
            cnpj = cnpj.replace(/\D/g,'');
            if (cnpj.length!==14 || /^(\d)\1+$/.test(cnpj)) return false;
            function calc(c,len){
                let s=0,p=len-7;
                for(let i=len;i>=1;i--){s+=parseInt(c[len-i])*p--;if(p<2)p=9;}
                let r=s%11<2?0:11-(s%11);
                return r===parseInt(c[len]);
            }
            return calc(cnpj,12)&&calc(cnpj,13);
        }

        // ── Status visual
        function setStatus(id, valido, vazio) {
            const el = document.getElementById(id+'-status');
            if (!el) return;
            if (vazio) { el.textContent=''; return; }
            el.textContent = valido ? '✅ Válido' : '❌ Inválido';
            el.style.color  = valido ? 'green' : 'red';
        }

        // ── Bind eventos
        document.addEventListener('DOMContentLoaded', function() {
            // Inicializa campos de celebração ao editar
            var selCeleb = document.getElementById('select-celebracao');
            if (selCeleb && selCeleb.value) toggleCelebracao(selCeleb.value);

            const cpfEl = document.getElementById('cpf');
            if (cpfEl) cpfEl.addEventListener('input', function() {
                this.value = mascaraCPF(this.value);
                const d = this.value.replace(/\D/g,'');
                setStatus('cpf', validarCPF(d), d.length===0);
            });

            const cpfRespEl = document.getElementById('cpf_responsavel');
            if (cpfRespEl) cpfRespEl.addEventListener('input', function() {
                this.value = mascaraCPF(this.value);
                const d = this.value.replace(/\D/g,'');
                setStatus('cpf_responsavel', validarCPF(d), d.length===0);
            });

            const cnpjEl = document.getElementById('cnpj');
            if (cnpjEl) cnpjEl.addEventListener('input', function() {
                this.value = mascaraCNPJ(this.value);
                const d = this.value.replace(/\D/g,'');
                setStatus('cnpj', validarCNPJ(d), d.length===0);
            });

            document.querySelectorAll('.pm-telefone').forEach(function(el) {
                el.addEventListener('input', function() { this.value = mascaraTelefone(this.value); });
            });
        });

        // ── Validação ao submeter
        function validarFormulario() {
            const tipo = document.querySelector('[name="tipo_evento"]:checked')?.value;
            const erros = [];

            // Telefone obrigatório — pega o campo visível (PF ou PJ)
            const telCampos = document.querySelectorAll('[name="telefone_contratante"]');
            let tel = '';
            telCampos.forEach(el => {
                if (el.offsetParent !== null) tel = el.value.trim(); // offsetParent null = oculto
            });
            if (!tel) erros.push('Telefone / WhatsApp é obrigatório.');

            if (tipo === 'PF') {
                const cpf = document.getElementById('cpf')?.value.replace(/\D/g,'');
                if (cpf && cpf.length > 0 && !validarCPF(cpf))
                    erros.push('CPF inválido — verifique os números digitados.');
            }
            if (tipo === 'PJ') {
                const cnpj = document.getElementById('cnpj')?.value.replace(/\D/g,'');
                if (cnpj && cnpj.length > 0 && !validarCNPJ(cnpj))
                    erros.push('CNPJ inválido — verifique os números digitados.');
                const cpfR = document.getElementById('cpf_responsavel')?.value.replace(/\D/g,'');
                if (cpfR && cpfR.length > 0 && !validarCPF(cpfR))
                    erros.push('CPF do Representante inválido — verifique os números digitados.');
            }

            if (erros.length > 0) {
                const div = document.getElementById('pm-erros');
                document.getElementById('pm-erros-msg').textContent = erros.join(' | ');
                div.style.display = '';
                div.scrollIntoView({behavior:'smooth'});
                return false;
            }
            return true;
        }
        </script>
        <?php
    }

    /* ============================================================
       HELPER — CAMPOS DE ENDEREÇO
    ============================================================ */
    private static function render_campos_endereco($prefixo, $evento, $estados, $com_cep = false) {

        $f = function($campo) use ($prefixo, $evento) {
            return esc_attr($evento ? ($evento->{$prefixo . '_' . $campo} ?? '') : '');
        };

        $estado_atual = $evento ? ($evento->{$prefixo . '_estado'} ?? 'RJ') : 'RJ';
        $cep          = $evento ? ($evento->cep_evento ?? '') : '';

        ?>
        <table class="form-table">
            <tr>
                <th><label>Logradouro</label></th>
                <td>
                    <input type="text" name="<?php echo $prefixo; ?>_logradouro" class="large-text"
                           value="<?php echo $f('logradouro'); ?>"
                           placeholder="Rua, Avenida, Travessa, Alameda...">
                </td>
            </tr>
            <tr>
                <th><label>Número</label></th>
                <td>
                    <input type="text" name="<?php echo $prefixo; ?>_numero" class="regular-text"
                           value="<?php echo $f('numero'); ?>" placeholder="123 ou S/Nº">
                </td>
            </tr>
            <tr>
                <th><label>Complemento</label></th>
                <td>
                    <input type="text" name="<?php echo $prefixo; ?>_complemento" class="regular-text"
                           value="<?php echo $f('complemento'); ?>"
                           placeholder="Apto, Bloco, Quadra, Lote...">
                </td>
            </tr>
            <tr>
                <th><label>Bairro</label></th>
                <td>
                    <input type="text" name="<?php echo $prefixo; ?>_bairro" class="regular-text"
                           value="<?php echo $f('bairro'); ?>">
                </td>
            </tr>
            <tr>
                <th><label>Cidade</label></th>
                <td>
                    <input type="text" name="<?php echo $prefixo; ?>_cidade" class="regular-text"
                           value="<?php echo $f('cidade'); ?>">
                </td>
            </tr>
            <tr>
                <th><label>Estado</label></th>
                <td>
                    <select name="<?php echo $prefixo; ?>_estado">
                        <?php foreach ($estados as $uf): ?>
                            <option value="<?php echo $uf; ?>" <?php selected($estado_atual, $uf); ?>>
                                <?php echo $uf; ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <?php if ($com_cep):
                // Para o endereço do local usa cep_evento; para contratante usa {prefixo}_cep
                $cep_name  = ($prefixo === 'local') ? 'cep_evento' : $prefixo . '_cep';
                $cep_value = ($prefixo === 'local')
                    ? esc_attr($evento ? ($evento->cep_evento ?? '') : '')
                    : esc_attr($evento ? ($evento->{$prefixo . '_cep'} ?? '') : '');
            ?>
            <tr>
                <th><label>CEP</label></th>
                <td>
                    <input type="text" name="<?php echo $cep_name; ?>" class="regular-text"
                           value="<?php echo $cep_value; ?>"
                           placeholder="00000-000" maxlength="9" style="max-width:120px;">
                </td>
            </tr>
            <?php endif; ?>
        </table>
        <?php
    }

    /* ============================================================
       HANDLER — SALVAR EVENTO
    ============================================================ */
    public static function handle_salvar_evento() {

        if (!current_user_can('pm_criar_eventos') && !current_user_can('pm_editar_eventos')) {
            wp_die('Acesso negado.');
        }
        if (!wp_verify_nonce($_POST['pm_evento_nonce'] ?? '', 'pm_salvar_evento')) {
            wp_die('Nonce inválido.');
        }

        $id_evento   = intval($_POST['id_evento'] ?? 0);
        $tipo_evento = strtoupper(sanitize_text_field($_POST['tipo_evento'] ?? 'PF'));

        // Remove máscaras
        $cpf             = preg_replace('/\D/', '', $_POST['cpf'] ?? '');
        $cnpj            = preg_replace('/\D/', '', $_POST['cnpj'] ?? '');
        $cpf_responsavel = preg_replace('/\D/', '', $_POST['cpf_responsavel'] ?? '');

        // Validação backend
        if ($cpf && !self::validar_cpf($cpf)) {
            wp_die('❌ CPF inválido. Volte e corrija antes de salvar.');
        }
        if ($cnpj && !self::validar_cnpj($cnpj)) {
            wp_die('❌ CNPJ inválido. Volte e corrija antes de salvar.');
        }
        if ($cpf_responsavel && !self::validar_cpf($cpf_responsavel)) {
            wp_die('❌ CPF do Representante inválido. Volte e corrija antes de salvar.');
        }

        global $wpdb;
        $tbl = $wpdb->prefix . 'pm_eventos';

        $dados = [
            // Contratante
            'tipo_evento'             => $tipo_evento,
            'nome_contratante'        => sanitize_text_field($_POST['nome_contratante'] ?? '') ?: null,
            'cpf'                     => $cpf ?: null,
            'nome_fantasia'           => sanitize_text_field($_POST['nome_fantasia'] ?? '') ?: null,
            'razao_social'            => sanitize_text_field($_POST['razao_social'] ?? '') ?: null,
            'cnpj'                    => $cnpj ?: null,
            'responsavel'             => sanitize_text_field($_POST['responsavel'] ?? '') ?: null,
            'cpf_responsavel'         => $cpf_responsavel ?: null,
            'rg'                      => sanitize_text_field($_POST['rg'] ?? '') ?: null,
            'data_nascimento'         => sanitize_text_field($_POST['data_nascimento'] ?? '') ?: null,
            'email_contratante'       => sanitize_email($_POST['email_contratante'] ?? '') ?: null,
            'telefone_contratante'    => sanitize_text_field($_POST['telefone_contratante'] ?? '') ?: null,
            'instagram_contratante'   => sanitize_text_field($_POST['instagram_contratante'] ?? '') ?: null,
            'grau_parentesco'         => sanitize_text_field($_POST['grau_parentesco'] ?? '') ?: null,

            // Endereço contratante
            'cont_logradouro'  => sanitize_text_field($_POST['cont_logradouro'] ?? '') ?: null,
            'cont_numero'      => sanitize_text_field($_POST['cont_numero'] ?? '') ?: null,
            'cont_complemento' => sanitize_text_field($_POST['cont_complemento'] ?? '') ?: null,
            'cont_bairro'      => sanitize_text_field($_POST['cont_bairro'] ?? '') ?: null,
            'cont_cidade'      => sanitize_text_field($_POST['cont_cidade'] ?? '') ?: null,
            'cont_estado'      => sanitize_text_field($_POST['cont_estado'] ?? 'RJ'),
            'cont_cep'         => sanitize_text_field($_POST['cont_cep'] ?? '') ?: null,

            // Evento
            'motivo_evento'          => sanitize_text_field($_POST['motivo_evento'] ?? ''),
            'tipo_celebracao'        => sanitize_text_field($_POST['tipo_celebracao'] ?? '') ?: null,
            'tema_festa'             => sanitize_text_field($_POST['tema_festa'] ?? '') ?: null,
            'cores_festa'            => sanitize_text_field($_POST['cores_festa'] ?? '') ?: null,
            'nome_aniversariante'    => sanitize_text_field($_POST['nome_aniversariante'] ?? '') ?: null,
            'nome_pais'              => sanitize_text_field($_POST['nome_pais'] ?? '') ?: null,
            'idade_aniversariante'   => sanitize_text_field($_POST['idade_aniversariante'] ?? '') ?: null,
            'nome_noivos'                      => sanitize_text_field($_POST['nome_noivos'] ?? '') ?: null,
            'grau_parentesco_noivos'           => sanitize_text_field($_POST['grau_parentesco_noivos'] ?? '') ?: null,
            'data_nascimento_aniversariante'   => sanitize_text_field($_POST['data_nascimento_aniversariante'] ?? '') ?: null,
            'grau_parentesco_aniversariante'   => sanitize_text_field($_POST['grau_parentesco_aniversariante'] ?? '') ?: null,
            'modelo_foto'                      => sanitize_text_field($_POST['modelo_foto'] ?? '') ?: null,

            // 1ª Eucaristia
            'nome_catequista'            => sanitize_text_field($_POST['nome_catequista'] ?? '') ?: null,
            'horario_catequese'          => sanitize_text_field($_POST['horario_catequese'] ?? '') ?: null,
            'nome_paroquia'              => sanitize_text_field($_POST['nome_paroquia'] ?? '') ?: null,
            'nome_capela'                => sanitize_text_field($_POST['nome_capela'] ?? '') ?: null,
            'forma_pagamento_eucaristia' => in_array($_POST['forma_pagamento_eucaristia'] ?? '', ['pix','cartao'])
                                            ? $_POST['forma_pagamento_eucaristia'] : null,

            'data_evento'            => sanitize_text_field($_POST['data_evento'] ?? ''),
            'horario_inicio'         => sanitize_text_field($_POST['horario_inicio'] ?? '') ?: null,
            'horario_fim'            => sanitize_text_field($_POST['horario_fim'] ?? '') ?: null,

            // Local
            'local_evento'           => sanitize_text_field($_POST['local_evento'] ?? ''),
            'local_logradouro'       => sanitize_text_field($_POST['local_logradouro'] ?? '') ?: null,
            'local_numero'           => sanitize_text_field($_POST['local_numero'] ?? '') ?: null,
            'local_complemento'      => sanitize_text_field($_POST['local_complemento'] ?? '') ?: null,
            'local_bairro'           => sanitize_text_field($_POST['local_bairro'] ?? '') ?: null,
            'local_cidade'           => sanitize_text_field($_POST['local_cidade'] ?? '') ?: null,
            'local_estado'           => sanitize_text_field($_POST['local_estado'] ?? 'RJ'),
            'cep_evento'             => sanitize_text_field($_POST['cep_evento'] ?? '') ?: null,
            'contato_salao'          => sanitize_text_field($_POST['contato_salao'] ?? '') ?: null,
            'contato_cerimonialista' => sanitize_text_field($_POST['contato_cerimonialista'] ?? '') ?: null,
            'contato_responsavel'    => sanitize_text_field($_POST['contato_responsavel'] ?? '') ?: null,

            // ChatBot — Link único da galeria + visibilidade
            // O mesmo link serve para convidados (celular) e contratante (celular + computador)
            'chatbot_ativo'          => isset($_POST['chatbot_ativo']) ? 1 : 0,
            'link_galeria_convidado' => esc_url_raw(trim($_POST['link_galeria_convidado'] ?? '')) ?: null,
        ];

        // Montar pagamento_config JSON
        $pgto_json = [
            'forma'                  => sanitize_key($_POST['pgto_forma'] ?? ''),
            'pix_payload'            => sanitize_textarea_field($_POST['pgto_pix_payload'] ?? ''),
            'pix_desconto_pct'       => intval($_POST['pgto_pix_desconto'] ?? 0),
            'cartao_parcelas'        => intval($_POST['pgto_cartao_parcelas'] ?? 3),
            'misto_valor'            => sanitize_text_field($_POST['pgto_misto_valor'] ?? ''),
            'misto_parcelas'         => intval($_POST['pgto_misto_parcelas'] ?? 3),
            'pix_p_1_valor'          => sanitize_text_field($_POST['pgto_pix_p1_valor'] ?? ''),
            'pix_p_2_valor'          => sanitize_text_field($_POST['pgto_pix_p2_valor'] ?? ''),
            'pix_p_2_data'           => sanitize_text_field($_POST['pgto_pix_p2_data'] ?? ''),
            'desc_segundo_servico'   => !empty($_POST['desc_segundo_servico']),
            'desc_segundo_exibir'    => !empty($_POST['desc_segundo_exibir']),
            'desc_deslocamento'      => sanitize_text_field($_POST['desc_deslocamento'] ?? ''),
            'desc_deslocamento_exibir' => !empty($_POST['desc_deslocamento_exibir']),
            'desc_guestbook'         => sanitize_text_field($_POST['desc_guestbook'] ?? ''),
            'desc_guestbook_exibir'  => !empty($_POST['desc_guestbook_exibir']),
            'descricao_pagamento'    => sanitize_textarea_field($_POST['pgto_descricao_pagamento'] ?? ''),
        ];
        $dados['pagamento_config']      = wp_json_encode($pgto_json);
        $dados['link_pagamento_cartao'] = esc_url_raw($_POST['link_pagamento_cartao'] ?? '') ?: null;

        if ($id_evento > 0) {
            $dados['atualizado_em'] = current_time('mysql');
            $wpdb->update($tbl, $dados, ['id' => $id_evento]);
            PhotoMusic_Events::registrar_historico($id_evento, 'Evento atualizado.');
        } else {
            $dados['codigo_interno'] = PhotoMusic_Helpers::generate_code('EVT');
            $dados['status_evento']  = 'ativo';
            $dados['criado_por']     = get_current_user_id();
            $dados['criado_em']      = current_time('mysql');
            $wpdb->insert($tbl, $dados);
            $id_evento = $wpdb->insert_id;

            if ($id_evento && class_exists('PhotoMusic_Contratos')) {
                PhotoMusic_Contratos::criar_contrato_simplificado($id_evento, 0);
            }
            PhotoMusic_Events::registrar_historico($id_evento, 'Evento criado.');
        }

        // ── Salva catequizandos (1ª Eucaristia)
        if (($dados['tipo_celebracao'] ?? '') === '1eucaristia' || isset($_POST['catequizando_nome'])) {
            $tbl_cat   = $wpdb->prefix . 'pm_eucaristia_catequizandos';
            $nomes     = array_map('sanitize_text_field', (array)($_POST['catequizando_nome'] ?? []));
            $nascimentos = array_map('sanitize_text_field', (array)($_POST['catequizando_nascimento'] ?? []));
            $parentescos = array_map('sanitize_text_field', (array)($_POST['catequizando_parentesco'] ?? []));
            $ids_enviados = array_map('intval', (array)($_POST['catequizando_id'] ?? []));

            // Remove registros que foram deletados (não vieram no POST)
            $ids_validos = array_filter($ids_enviados);
            if (!empty($ids_validos)) {
                $placeholders = implode(',', array_fill(0, count($ids_validos), '%d'));
                $wpdb->query($wpdb->prepare(
                    "DELETE FROM {$tbl_cat} WHERE id_evento = %d AND id NOT IN ({$placeholders})",
                    array_merge([$id_evento], $ids_validos)
                ));
            } else {
                $wpdb->delete($tbl_cat, ['id_evento' => $id_evento]);
            }

            foreach ($nomes as $ordem => $nome) {
                if (empty(trim($nome))) continue;
                $row_id = $ids_enviados[$ordem] ?? 0;
                $row_data = [
                    'nome'            => $nome,
                    'data_nascimento' => $nascimentos[$ordem] ?: null,
                    'grau_parentesco' => $parentescos[$ordem] ?: null,
                    'ordem'           => $ordem + 1,
                ];
                if ($row_id > 0) {
                    $wpdb->update($tbl_cat, $row_data, ['id' => $row_id, 'id_evento' => $id_evento]);
                } else {
                    $row_data['id_evento'] = $id_evento;
                    $row_data['criado_em'] = current_time('mysql');
                    $wpdb->insert($tbl_cat, $row_data);
                }
            }
        }

        $redirect = admin_url('admin.php?page=photomusic-eventos&acao=editar&id=' . $id_evento . '&saved=1');
        wp_redirect($redirect);
        exit;
    }

    /* ============================================================
       VALIDAÇÃO CPF — PHP
    ============================================================ */
    public static function validar_cpf($cpf) {
        $cpf = preg_replace('/\D/', '', $cpf);
        if (strlen($cpf) !== 11 || preg_match('/^(\d)\1+$/', $cpf)) return false;
        $soma = 0;
        for ($i = 0; $i < 9; $i++) $soma += intval($cpf[$i]) * (10 - $i);
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) $resto = 0;
        if ($resto !== intval($cpf[9])) return false;
        $soma = 0;
        for ($i = 0; $i < 10; $i++) $soma += intval($cpf[$i]) * (11 - $i);
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) $resto = 0;
        return $resto === intval($cpf[10]);
    }

    /* ============================================================
       VALIDAÇÃO CNPJ — PHP
    ============================================================ */
    public static function validar_cnpj($cnpj) {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1+$/', $cnpj)) return false;
        $calc = function($cnpj, $len) {
            $soma = 0; $pos = $len - 7;
            for ($i = $len; $i >= 1; $i--) {
                $soma += intval($cnpj[$len - $i]) * $pos--;
                if ($pos < 2) $pos = 9;
            }
            $res = $soma % 11 < 2 ? 0 : 11 - ($soma % 11);
            return $res === intval($cnpj[$len]);
        };
        return $calc($cnpj, 12) && $calc($cnpj, 13);
    }

    /* ============================================================
       FORMATADORES
    ============================================================ */
    public static function formatar_cpf($cpf) {
        $cpf = preg_replace('/\D/', '', $cpf);
        if (strlen($cpf) !== 11) return $cpf;
        return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $cpf);
    }

    public static function formatar_cnpj($cnpj) {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        if (strlen($cnpj) !== 14) return $cnpj;
        return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $cnpj);
    }

    /* ============================================================
       MÉTODOS LEGADOS
    ============================================================ */
    public static function create_event($data) {
        global $wpdb;
        $table       = $wpdb->prefix . 'pm_eventos';
        $tipo_evento = strtoupper(trim($data['tipo_evento'] ?? ''));
        if (!in_array($tipo_evento, ['PF', 'PJ'], true)) return new WP_Error('tipo_evento_invalido', 'Tipo inválido.');
        if (empty($data['motivo_evento'])) return new WP_Error('motivo_obrigatorio', 'Motivo obrigatório.');
        $data_evento = sanitize_text_field($data['data_evento'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_evento)) return new WP_Error('data_invalida', 'Data inválida.');
        $codigo_interno = PhotoMusic_Helpers::generate_code('EVT');
        $wpdb->insert($table, [
            'tipo_evento'    => $tipo_evento,
            'motivo_evento'  => substr(sanitize_text_field($data['motivo_evento']), 0, 200),
            'data_evento'    => $data_evento,
            'codigo_interno' => $codigo_interno,
            'token_evento'   => hash('sha256', $codigo_interno . '|' . time() . '|' . wp_generate_uuid4()),
            'status_evento'  => 'ativo',
            'criado_por'     => get_current_user_id(),
            'criado_em'      => current_time('mysql'),
        ]);
        $id_evento = $wpdb->insert_id;
        if (!$id_evento) return new WP_Error('erro_criar_evento', 'Erro ao criar.');
        if (class_exists('PhotoMusic_Contratos')) PhotoMusic_Contratos::criar_contrato_simplificado($id_evento, 0);
        PhotoMusic_Events::registrar_historico($id_evento, 'Evento criado.');
        return $id_evento;
    }

    public static function update_event($id_evento, $data) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_eventos';
        $id_evento = (int) $id_evento;
        if ($id_evento <= 0) return new WP_Error('id_invalido', 'ID inválido.');
        $update = [];
        if (isset($data['motivo_evento'])) $update['motivo_evento'] = substr(sanitize_text_field($data['motivo_evento']), 0, 200);
        if (isset($data['data_evento'])) {
            $dt = sanitize_text_field($data['data_evento']);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dt)) return new WP_Error('data_invalida', 'Data inválida.');
            $update['data_evento'] = $dt;
        }
        if (isset($data['status_evento'])) $update['status_evento'] = sanitize_text_field($data['status_evento']);
        if (!empty($update)) { $update['atualizado_em'] = current_time('mysql'); $wpdb->update($table, $update, ['id' => $id_evento]); }
        PhotoMusic_Events::registrar_historico($id_evento, 'Evento atualizado.');
        return true;
    }

    public static function get_events($args = []) {
        global $wpdb;
        $table = $wpdb->prefix . 'pm_eventos';
        $where = ['1=1']; $params = [];
        if (!empty($args['status_evento'])) { $where[] = 'status_evento = %s'; $params[] = sanitize_text_field($args['status_evento']); }
        if (!empty($args['tipo_evento']))   { $where[] = 'tipo_evento = %s';   $params[] = sanitize_text_field($args['tipo_evento']); }
        $sql = "SELECT * FROM $table WHERE " . implode(' AND ', $where) . " ORDER BY data_evento DESC, id DESC";
        return !empty($params) ? $wpdb->get_results($wpdb->prepare($sql, ...$params)) : $wpdb->get_results($sql);
    }

    public static function get_event($id_evento) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d", intval($id_evento)));
    }

    public static function update_status($id_evento, $status) {
        $core = new PhotoMusic_Events_Core();
        return $core->update_status($id_evento, $status);
    }

    public static function registrar_historico($id_evento, $acao, $detalhes = null) {
        $core = new PhotoMusic_Events_Core();
        return $core->registrar_historico($id_evento, $acao, $detalhes);
    }

    /* ============================================================
       HANDLER — EXCLUIR EVENTO
    ============================================================ */
    public static function handle_excluir_evento() {

        if (!current_user_can('administrator')) {
            wp_die('Apenas administradores podem excluir eventos.');
        }

        $id = intval($_GET['id'] ?? 0);

        if (!$id || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'pm_excluir_evento_' . $id)) {
            wp_die('Requisição inválida.');
        }

        global $wpdb;

        // Remove serviços do evento
        $wpdb->delete($wpdb->prefix . 'pm_eventos_servicos', ['id_evento' => $id], ['%d']);

        // Remove contratos vinculados
        $wpdb->delete($wpdb->prefix . 'pm_contratos', ['id_evento' => $id], ['%d']);

        // Remove logs do evento
        $wpdb->delete($wpdb->prefix . 'pm_logs_sistema', ['id_evento' => $id], ['%d']);

        // Remove o evento principal
        $wpdb->delete($wpdb->prefix . 'pm_eventos', ['id' => $id], ['%d']);

        wp_redirect(admin_url('admin.php?page=photomusic-eventos&excluido=1'));
        exit;
    }

    /* ============================================================
       HANDLER: CONCLUIR EVENTO
    ============================================================ */
    public static function handle_concluir_evento() {

        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }

        $id = intval($_GET['id'] ?? 0);

        if (!$id || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'pm_concluir_evento_' . $id)) {
            wp_die('Requisição inválida.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_eventos',
            ['status_evento' => 'concluido'],
            ['id' => $id],
            ['%s'],
            ['%d']
        );

        // Se veio da tela de edição, volta para lá com mensagem
        $redirect_id = intval($_GET['redirect_id'] ?? 0);
        if ($redirect_id > 0) {
            wp_redirect(admin_url('admin.php?page=photomusic-eventos&acao=editar&id=' . $redirect_id . '&concluido=1'));
        } else {
            wp_redirect(admin_url('admin.php?page=photomusic-eventos&concluido=1'));
        }
        exit;
    }

    /* ============================================================
       HANDLER: DESATIVAR CHATBOT EM TODOS OS EVENTOS
    ============================================================ */
    public static function handle_desativar_chatbot_todos() {

        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }

        if (!wp_verify_nonce($_GET['_wpnonce'] ?? '', 'pm_desativar_chatbot_todos')) {
            wp_die('Requisição inválida.');
        }

        global $wpdb;
        $n = $wpdb->query(
            "UPDATE {$wpdb->prefix}pm_eventos SET chatbot_ativo = 0 WHERE chatbot_ativo = 1"
        );

        wp_redirect(admin_url('admin.php?page=photomusic-eventos&chatbot_desativados=' . intval($n)));
        exit;
    }

    /* ============================================================
       HANDLER: TOGGLE CHATBOT — LIGAR / DESLIGAR POR EVENTO
    ============================================================ */
    public static function handle_chatbot_toggle($novo_valor) {

        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }

        $id   = intval($_GET['id'] ?? 0);
        $acao = $novo_valor ? 'pm_chatbot_on' : 'pm_chatbot_off';

        if (!$id || !wp_verify_nonce($_GET['_wpnonce'] ?? '', $acao . '_' . $id)) {
            wp_die('Requisição inválida.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_eventos',
            ['chatbot_ativo' => $novo_valor],
            ['id' => $id],
            ['%d'],
            ['%d']
        );

        wp_redirect(admin_url('admin.php?page=photomusic-eventos'));
        exit;
    }

    /* Wrappers registrados no init() */
    public static function handle_chatbot_on()  { self::handle_chatbot_toggle(1); }
    public static function handle_chatbot_off() { self::handle_chatbot_toggle(0); }

    /* ============================================================
       HANDLER: CONFIRMAR PAGAMENTO
    ============================================================ */
    public static function handle_confirmar_pagamento() {

        if (!current_user_can('pm_criar_eventos')) {
            wp_die('Acesso negado.');
        }

        $id = intval($_GET['id'] ?? 0);

        if (!$id || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'pm_confirmar_pgto_' . $id)) {
            wp_die('Requisição inválida.');
        }

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'pm_eventos',
            ['pagamento_confirmado' => 1],
            ['id' => $id],
            ['%d'],
            ['%d']
        );

        wp_redirect(admin_url('admin.php?page=photomusic-eventos&acao=editar&id=' . $id . '&pgto_confirmado=1'));
        exit;
    }
}