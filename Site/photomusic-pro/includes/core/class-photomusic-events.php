<?php
// includes/core/class-photomusic-events.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Events {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_post_pm_salvar_evento', [__CLASS__, 'handle_salvar_evento']);
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

        echo '<a href="' . esc_url(add_query_arg(['page' => 'photomusic-eventos', 'acao' => 'novo'], admin_url('admin.php'))) . '" class="button button-primary">+ Criar Novo Evento</a>';

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
            echo '<td>' . esc_html($e->status_evento) . '</td>';
            echo '<td>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-eventos', 'acao' => 'editar', 'id' => $e->id], admin_url('admin.php'))) . '" class="button">Editar</a>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-evento-detalhes', 'id' => $e->id], admin_url('admin.php'))) . '" class="button">Detalhes</a>
                    <a href="' . esc_url(add_query_arg(['page' => 'photomusic-add-servico', 'id' => $e->id], admin_url('admin.php'))) . '" class="button button-primary">Serviços</a>
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

        ?>
        <div class="wrap">
            <h1><?php echo esc_html($titulo); ?></h1>
            <a href="<?php echo admin_url('admin.php?page=photomusic-eventos'); ?>" class="button">← Voltar</a>
            <hr>

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
                            <th><label>Nome Completo *</label></th>
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
                            <th><label>Telefone *</label></th>
                            <td><input type="text" name="telefone_contratante" class="regular-text pm-telefone"
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
                        <tr>
                            <th><label>Grau de Parentesco</label></th>
                            <td>
                                <input type="text" name="grau_parentesco" class="regular-text"
                                       value="<?php echo esc_attr($evento->grau_parentesco ?? ''); ?>"
                                       placeholder="Ex: Mãe do aniversariante">
                                <p class="description">Relação do contratante com o evento.</p>
                            </td>
                        </tr>
                    </table>
                    <h3 style="margin-top:20px;">Endereço do Contratante</h3>
                    <?php self::render_campos_endereco('cont', $evento, $estados); ?>
                </div>

                <!-- ============================================
                     CONTRATANTE PJ
                ============================================ -->
                <div id="bloco-pj" <?php echo $tipo_atual === 'PF' ? 'style="display:none"' : ''; ?>>
                    <h2>Dados do Contratante — Pessoa Jurídica</h2>
                    <table class="form-table">
                        <tr>
                            <th><label>Razão Social *</label></th>
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
                            <th><label>Telefone *</label></th>
                            <td><input type="text" name="telefone_contratante" class="regular-text pm-telefone"
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
                    <?php self::render_campos_endereco('cont', $evento, $estados); ?>
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
                    <tr id="campo-grau-aniversariante" style="display:none">
                        <th><label>Grau de Parentesco com o(a) Aniversariante</label></th>
                        <td>
                            <input type="text" name="grau_parentesco_aniversariante" class="regular-text"
                                   value="<?php echo esc_attr($evento->grau_parentesco_aniversariante ?? ''); ?>"
                                   placeholder="Ex: Filho(a), Sobrinho(a)...">
                            <p class="description">Grau de parentesco do(a) aniversariante com o contratante.</p>
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
                        <td><input type="text" name="modelo_foto" class="regular-text"
                                   value="<?php echo esc_attr($evento->modelo_foto ?? ''); ?>"
                                   placeholder="Ex: Horizontal 10x15 ou Tirinha"></td>
                    </tr>

                    <tr>
                        <th><label>Data do Evento *</label></th>
                        <td><input type="date" name="data_evento"
                                   value="<?php echo esc_attr($evento->data_evento ?? ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th><label>Horário de Início *</label></th>
                        <td><input type="time" name="horario_inicio"
                                   value="<?php echo esc_attr($evento->horario_inicio ? substr($evento->horario_inicio, 0, 5) : ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th><label>Horário de Fim *</label></th>
                        <td><input type="time" name="horario_fim"
                                   value="<?php echo esc_attr($evento->horario_fim ? substr($evento->horario_fim, 0, 5) : ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th><label>Horário de Início do Serviço</label></th>
                        <td>
                            <input type="time" name="horario_servico"
                                   value="<?php echo esc_attr($evento->horario_servico ? substr($evento->horario_servico, 0, 5) : ''); ?>">
                            <p class="description">Preencha somente se o serviço começar após o início do evento. Ex: Plataforma 360° inicia 30min depois.</p>
                        </td>
                    </tr>
                </table>

                <!-- ============================================
                     LOCAL DO EVENTO
                ============================================ -->
                <h2>Local do Evento</h2>
                <table class="form-table">
                    <tr>
                        <th><label>Nome do Local *</label></th>
                        <td><input type="text" name="local_evento" class="regular-text"
                                   value="<?php echo esc_attr($evento->local_evento ?? ''); ?>"
                                   placeholder="Ex: Salão de Festas XYZ / BASC - Base Aérea de Santa Cruz"
                                   required></td>
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

                <?php if ($id_evento > 0 && class_exists('PhotoMusic_Servicos')): ?>
                    <?php $servicos_evento = PhotoMusic_Servicos::get_evento_servicos($id_evento); ?>

                    <?php if (!empty($servicos_evento)): ?>
                        <table class="widefat striped" style="max-width:780px; margin-top:12px;">
                            <thead>
                                <tr>
                                    <th style="width:220px;">Serviço</th>
                                    <th>Link da Galeria</th>
                                    <th style="width:80px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($servicos_evento as $se): ?>
                                <tr>
                                    <td>
                                        <strong><?php echo esc_html($se['nome_servico'] ?? '—'); ?></strong>
                                        <?php if (!empty($se['observacoes']) && strpos($se['observacoes'], 'Brinde') !== false): ?>
                                            <br><span style="color:#2a7a2a; font-size:11px;">🎁 Brinde</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?php if (!empty($se['link_galeria'])): ?>
                                            <a href="<?php echo esc_url($se['link_galeria']); ?>" target="_blank"
                                               style="color:#2a7a2a;">
                                                ✅ <?php echo esc_html(mb_strimwidth($se['link_galeria'], 0, 55, '...')); ?>
                                            </a>
                                        <?php else: ?>
                                            <span style="color:#999; font-style:italic;">— sem link cadastrado —</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <a href="<?php echo esc_url(add_query_arg([
                                            'page'   => 'photomusic-add-servico',
                                            'id'     => $id_evento,
                                            'editar' => $se['id'],
                                        ], admin_url('admin.php'))); ?>"
                                           class="button button-small">✏️ Link</a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                        <p class="description" style="margin-top:8px;">
                            Para alterar um link, clique em <strong>✏️ Link</strong> ao lado do serviço.
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

                <?php submit_button($acao === 'novo' ? 'Criar Evento' : 'Salvar Alterações'); ?>
            </form>
        </div>

        <script>
        // ── Campos por tipo de celebração
        var camposPorCelebracao = {
            'aniversario': ['campo-tema','campo-cores','campo-aniversariante','campo-pais','campo-idade','campo-nascimento-aniversariante','campo-grau-aniversariante','campo-modelo-foto'],
            'casamento':   ['campo-noivos','campo-grau-noivos','campo-cores','campo-modelo-foto'],
            'bodas':       ['campo-noivos','campo-grau-noivos','campo-cores','campo-modelo-foto'],
            'corporativo': ['campo-tema','campo-cores','campo-modelo-foto'],
            'formatura':   ['campo-tema','campo-cores','campo-aniversariante','campo-modelo-foto'],
            '1eucaristia': ['campo-tema','campo-cores','campo-aniversariante','campo-pais','campo-nascimento-aniversariante','campo-grau-aniversariante','campo-modelo-foto'],
            'outro':       ['campo-tema','campo-cores','campo-modelo-foto'],
        };

        function toggleCelebracao(val) {
            var todos = ['campo-tema','campo-cores','campo-aniversariante','campo-pais','campo-idade','campo-nascimento-aniversariante','campo-grau-aniversariante','campo-noivos','campo-grau-noivos','campo-modelo-foto'];
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

        // ── Toggle PF/PJ
        function toggleTipo(tipo) {
            document.getElementById('bloco-pf').style.display = tipo === 'PF' ? '' : 'none';
            document.getElementById('bloco-pj').style.display = tipo === 'PJ' ? '' : 'none';
        }

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
            <?php if ($com_cep): ?>
            <tr>
                <th><label>CEP</label></th>
                <td>
                    <input type="text" name="cep_evento" class="regular-text"
                           value="<?php echo esc_attr($cep); ?>"
                           placeholder="00000-000" maxlength="9" style="max-width:120px;">
                    <p class="description">Opcional — aparece no contrato somente se preenchido.</p>
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
            'razao_social'            => sanitize_text_field($_POST['razao_social'] ?? '') ?: null,
            'cnpj'                    => $cnpj ?: null,
            'responsavel'             => sanitize_text_field($_POST['responsavel'] ?? '') ?: null,
            'cpf_responsavel'         => $cpf_responsavel ?: null,
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
            'data_evento'            => sanitize_text_field($_POST['data_evento'] ?? ''),
            'horario_inicio'         => sanitize_text_field($_POST['horario_inicio'] ?? ''),
            'horario_fim'            => sanitize_text_field($_POST['horario_fim'] ?? ''),
            'horario_servico'        => sanitize_text_field($_POST['horario_servico'] ?? '') ?: null,

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

        wp_redirect(admin_url('admin.php?page=photomusic-eventos&saved=1'));
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
        $wpdb->insert($table, [
            'tipo_evento'    => $tipo_evento,
            'motivo_evento'  => substr(sanitize_text_field($data['motivo_evento']), 0, 200),
            'data_evento'    => $data_evento,
            'codigo_interno' => PhotoMusic_Helpers::generate_code('EVT'),
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
}