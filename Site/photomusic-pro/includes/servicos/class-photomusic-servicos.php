<?php
// includes/servicos/class-photomusic-servicos.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Servicos {

    private static $tbl_servicos;
    private static $tbl_subtipos;
    private static $tbl_pacotes;
    private static $tbl_regras;
    private static $tbl_eventos_servicos;

    public static function init() {
        global $wpdb;

        self::$tbl_servicos         = $wpdb->prefix . 'pm_servicos';
        self::$tbl_subtipos         = $wpdb->prefix . 'pm_servicos_subtipos';
        self::$tbl_pacotes          = $wpdb->prefix . 'pm_servicos_pacotes';
        self::$tbl_regras           = $wpdb->prefix . 'pm_servicos_regras';
        self::$tbl_eventos_servicos = $wpdb->prefix . 'pm_eventos_servicos';

        add_action('admin_menu', [__CLASS__, 'register_menus']);
        add_action('admin_post_pm_salvar_servico',  [__CLASS__, 'handle_salvar_servico']);
        add_action('admin_post_pm_salvar_pacote',   [__CLASS__, 'handle_salvar_pacote']);
        add_action('admin_post_pm_add_evento_servico', [__CLASS__, 'handle_add_evento_servico']);
        add_action('admin_post_pm_remove_evento_servico', [__CLASS__, 'handle_remove_evento_servico']);
    }

    /* ============================================================
       MENUS
    ============================================================ */
    public static function register_menus() {

        if (!PhotoMusic_Users::is_admin()) return;

        // Catálogo de serviços — visível no menu
        add_submenu_page(
            'photomusic-eventos',
            'Catálogo de Serviços',
            'Serviços',
            'pm_gerenciar_usuarios',
            'photomusic-servicos',
            [__CLASS__, 'render_catalogo_page']
        );

        // Página de adicionar serviço ao evento — oculta (null)
        add_submenu_page(
            null,
            'Adicionar Serviço ao Evento',
            'Adicionar Serviço',
            'pm_criar_eventos',
            'photomusic-add-servico',
            [__CLASS__, 'render_add_servico_page']
        );
    }

    /* ============================================================
       CATÁLOGO — SERVIÇOS
    ============================================================ */
    public static function listar_servicos($apenas_ativos = true) {
        global $wpdb;

        $sql = "SELECT * FROM " . self::$tbl_servicos;
        if ($apenas_ativos) $sql .= " WHERE ativo = 1";
        $sql .= " ORDER BY ordem ASC, nome ASC";

        return $wpdb->get_results($sql, ARRAY_A);
    }

    public static function get_servico($id) {
        global $wpdb;
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM " . self::$tbl_servicos . " WHERE id = %d", $id),
            ARRAY_A
        );
    }

    /* ============================================================
       CATÁLOGO — PACOTES
    ============================================================ */
    public static function listar_pacotes($id_servico, $id_subtipo = null) {
        global $wpdb;

        $sql    = "SELECT * FROM " . self::$tbl_pacotes . " WHERE id_servico = %d AND ativo = 1";
        $params = [$id_servico];

        if (!empty($id_subtipo)) {
            $sql    .= " AND id_subtipo = %d";
            $params[] = $id_subtipo;
        }

        $sql .= " ORDER BY ordem ASC";

        return $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A);
    }

    public static function get_pacote($id) {
        global $wpdb;
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM " . self::$tbl_pacotes . " WHERE id = %d", $id),
            ARRAY_A
        );
    }

    /* ============================================================
       SUBTIPOS
    ============================================================ */
    public static function listar_subtipos($id_servico) {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::$tbl_subtipos . " WHERE id_servico = %d AND ativo = 1 ORDER BY ordem ASC",
                $id_servico
            ),
            ARRAY_A
        );
    }

    public static function get_subtipo($id) {
        global $wpdb;
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM " . self::$tbl_subtipos . " WHERE id = %d", $id),
            ARRAY_A
        );
    }

    /* ============================================================
       REGRAS POR CELEBRAÇÃO
    ============================================================ */
    public static function get_regras_por_celebracao($id_servico, $celebracao) {
        global $wpdb;
        $celebracao = sanitize_text_field($celebracao);
        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM " . self::$tbl_regras . " WHERE id_servico = %d AND celebracao = %s AND ativo = 1",
                $id_servico, $celebracao
            ),
            ARRAY_A
        );
    }

    public static function calcular_horas_permitidas($id_servico, $celebracao) {
        $regras = self::get_regras_por_celebracao($id_servico, $celebracao);
        if (!$regras) return ['min' => 1, 'max' => 12];
        return [
            'min' => intval($regras['horas_min'] ?? 1),
            'max' => intval($regras['horas_max'] ?? 12),
        ];
    }

    /* ============================================================
       SERVIÇOS CONTRATADOS DO EVENTO
    ============================================================ */
    public static function salvar_evento_servicos($id_evento, $servicos) {
        global $wpdb;

        $wpdb->delete(self::$tbl_eventos_servicos, ['id_evento' => $id_evento]);

        foreach ($servicos as $s) {
            $id_servico = intval($s['id_servico'] ?? 0);
            if (!self::get_servico($id_servico)) continue;

            $wpdb->insert(self::$tbl_eventos_servicos, [
                'id_evento'         => $id_evento,
                'id_servico'        => $id_servico,
                'id_subtipo'        => intval($s['id_subtipo'] ?? 0),
                'id_pacote'         => intval($s['id_pacote'] ?? 0),
                'horas_contratadas' => intval($s['horas'] ?? 0),
                'fotos_contratadas' => intval($s['fotos'] ?? 0),
                'valor_base'        => floatval($s['valor_base'] ?? 0),
                'valor_adicional'   => floatval($s['valor_adicional'] ?? 0),
                'valor_final'       => floatval($s['valor_final'] ?? 0),
                'observacoes'       => substr(sanitize_textarea_field($s['obs'] ?? ''), 0, 2000),
            ]);
        }

        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add('evento_servicos_atualizados', null, $id_evento, null, 'Serviços do evento atualizados.');
        }
    }

    public static function get_evento_servicos($id_evento) {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT es.*, s.nome as nome_servico, s.slug as slug_servico,
                        s.descricao as descricao_catalogo,
                        p.titulo as nome_pacote, p.slug as slug_pacote,
                        p.valor_base as pacote_valor_base, p.valor_hora_extra
                 FROM " . self::$tbl_eventos_servicos . " es
                 LEFT JOIN " . self::$tbl_servicos . " s ON s.id = es.id_servico
                 LEFT JOIN " . self::$tbl_pacotes  . " p ON p.id = es.id_pacote
                 WHERE es.id_evento = %d ORDER BY es.id ASC",
                $id_evento
            ),
            ARRAY_A
        );
    }

    /* ============================================================
       RENDER — CATÁLOGO DE SERVIÇOS
    ============================================================ */
    public static function render_catalogo_page() {

        if (!PhotoMusic_Users::is_admin()) wp_die('Acesso negado.');

        $acao       = sanitize_text_field($_GET['acao'] ?? '');
        $id_servico = intval($_GET['servico'] ?? 0);
        $saved      = intval($_GET['saved'] ?? 0);
        $deleted    = intval($_GET['deleted'] ?? 0);

        $servico_edit = $id_servico ? self::get_servico($id_servico) : null;
        $servicos     = self::listar_servicos(false);

        ?>
        <div class="wrap">
            <h1>Catálogo de Serviços</h1>

            <?php if ($saved): ?>
                <div class="notice notice-success is-dismissible"><p>✅ Serviço salvo com sucesso!</p></div>
            <?php endif; ?>
            <?php if ($deleted): ?>
                <div class="notice notice-success is-dismissible"><p>🗑️ Serviço removido.</p></div>
            <?php endif; ?>

            <div style="display:flex; gap:30px; align-items:flex-start;">

                <!-- FORMULÁRIO SERVIÇO -->
                <div style="flex:1; min-width:320px;">
                    <h2><?php echo $servico_edit ? 'Editar Serviço' : 'Novo Serviço'; ?></h2>
                    <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
                        <?php wp_nonce_field('pm_salvar_servico', 'pm_servico_nonce'); ?>
                        <input type="hidden" name="action" value="pm_salvar_servico">
                        <input type="hidden" name="id" value="<?php echo intval($servico_edit['id'] ?? 0); ?>">

                        <table class="form-table">
                            <tr>
                                <th><label>Nome *</label></th>
                                <td><input type="text" name="nome" class="regular-text"
                                           value="<?php echo esc_attr($servico_edit['nome'] ?? ''); ?>" required></td>
                            </tr>
                            <tr>
                                <th><label>Slug *</label></th>
                                <td>
                                    <input type="text" name="slug" class="regular-text"
                                           value="<?php echo esc_attr($servico_edit['slug'] ?? ''); ?>"
                                           placeholder="foto-cabine" required>
                                    <p class="description">Identificador único. Use letras minúsculas e hífens. Ex: foto-cabine, som-dj</p>
                                </td>
                            </tr>
                            <tr>
                                <th><label>Descrição</label></th>
                                <td><textarea name="descricao" rows="3" class="large-text"><?php echo esc_textarea($servico_edit['descricao'] ?? ''); ?></textarea></td>
                            </tr>
                            <tr>
                                <th><label>Ordem</label></th>
                                <td><input type="number" name="ordem" class="small-text"
                                           value="<?php echo intval($servico_edit['ordem'] ?? 0); ?>"></td>
                            </tr>
                            <tr>
                                <th><label>Ativo</label></th>
                                <td><label>
                                    <input type="checkbox" name="ativo" value="1"
                                        <?php checked($servico_edit['ativo'] ?? 1, 1); ?>>
                                    Serviço ativo
                                </label></td>
                            </tr>
                        </table>

                        <?php submit_button($servico_edit ? 'Salvar Alterações' : 'Criar Serviço'); ?>
                        <?php if ($servico_edit): ?>
                            <a href="<?php echo admin_url('admin.php?page=photomusic-servicos'); ?>" class="button">Novo Serviço</a>
                        <?php endif; ?>
                    </form>

                    <?php if ($servico_edit): ?>
                        <hr>
                        <h2>Pacotes de "<?php echo esc_html($servico_edit['nome']); ?>"</h2>
                        <?php self::render_form_pacote($servico_edit); ?>
                        <?php self::render_lista_pacotes($servico_edit['id']); ?>
                    <?php endif; ?>
                </div>

                <!-- LISTA DE SERVIÇOS -->
                <div style="flex:1;">
                    <h2>Serviços Cadastrados</h2>
                    <?php if (empty($servicos)): ?>
                        <p>Nenhum serviço cadastrado ainda.</p>
                    <?php else: ?>
                        <table class="widefat striped">
                            <thead>
                                <tr>
                                    <th>Ord</th>
                                    <th>Nome</th>
                                    <th>Slug</th>
                                    <th>Ativo</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($servicos as $s): ?>
                                <tr>
                                    <td><?php echo intval($s['ordem']); ?></td>
                                    <td><strong><?php echo esc_html($s['nome']); ?></strong></td>
                                    <td><code><?php echo esc_html($s['slug']); ?></code></td>
                                    <td><?php echo $s['ativo'] ? '✅' : '❌'; ?></td>
                                    <td>
                                        <a href="<?php echo admin_url('admin.php?page=photomusic-servicos&servico=' . $s['id']); ?>">
                                            Editar / Pacotes
                                        </a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </div>

            </div>
        </div>
        <?php
    }

    /* ============================================================
       RENDER — FORMULÁRIO DE PACOTE
    ============================================================ */
    private static function render_form_pacote($servico) {

        $id_pacote   = intval($_GET['pacote'] ?? 0);
        $pacote_edit = $id_pacote ? self::get_pacote($id_pacote) : null;
        ?>
        <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
            <?php wp_nonce_field('pm_salvar_pacote', 'pm_pacote_nonce'); ?>
            <input type="hidden" name="action" value="pm_salvar_pacote">
            <input type="hidden" name="id_servico" value="<?php echo intval($servico['id']); ?>">
            <input type="hidden" name="id" value="<?php echo intval($pacote_edit['id'] ?? 0); ?>">

            <table class="form-table">
                <tr>
                    <th><label>Título do Pacote *</label></th>
                    <td>
                        <input type="text" name="titulo" class="regular-text"
                               value="<?php echo esc_attr($pacote_edit['titulo'] ?? ''); ?>"
                               placeholder="Ex: Pacote Premium, Pacote Gold, Tirinha" required>
                    </td>
                </tr>
                <tr>
                    <th><label>Slug *</label></th>
                    <td>
                        <input type="text" name="slug" class="regular-text"
                               value="<?php echo esc_attr($pacote_edit['slug'] ?? ''); ?>"
                               placeholder="Ex: premium, gold, tirinha" required>
                        <p class="description">Usado nas tags das cláusulas. Ex: foto-cabine-<strong>premium</strong></p>
                    </td>
                </tr>
                <tr>
                    <th><label>Valor Base (R$) *</label></th>
                    <td>
                        <input type="number" name="valor_base" class="regular-text" step="0.01" min="0"
                               value="<?php echo esc_attr($pacote_edit['valor_base'] ?? '0.00'); ?>" required>
                    </td>
                </tr>
                <tr>
                    <th><label>Valor Hora Extra (R$)</label></th>
                    <td>
                        <input type="number" name="valor_hora_extra" class="regular-text" step="0.01" min="0"
                               value="<?php echo esc_attr($pacote_edit['valor_hora_extra'] ?? '0.00'); ?>">
                    </td>
                </tr>
                <tr>
                    <th><label>Horas</label></th>
                    <td>
                        Mín: <input type="number" name="horas_min" class="small-text" min="1" max="24"
                                    value="<?php echo intval($pacote_edit['horas_min'] ?? 2); ?>">
                        &nbsp; Máx: <input type="number" name="horas_max" class="small-text" min="1" max="24"
                                    value="<?php echo intval($pacote_edit['horas_max'] ?? 8); ?>">
                    </td>
                </tr>
                <tr>
                    <th><label>Ordem</label></th>
                    <td><input type="number" name="ordem" class="small-text"
                               value="<?php echo intval($pacote_edit['ordem'] ?? 0); ?>"></td>
                </tr>
                <tr>
                    <th><label>Ativo</label></th>
                    <td><label>
                        <input type="checkbox" name="ativo" value="1"
                            <?php checked($pacote_edit['ativo'] ?? 1, 1); ?>>
                        Pacote ativo
                    </label></td>
                </tr>
            </table>

            <?php submit_button($pacote_edit ? 'Salvar Pacote' : 'Adicionar Pacote'); ?>
            <?php if ($pacote_edit): ?>
                <a href="<?php echo admin_url('admin.php?page=photomusic-servicos&servico=' . $servico['id']); ?>" class="button">Novo Pacote</a>
            <?php endif; ?>
        </form>
        <?php
    }

    /* ============================================================
       RENDER — LISTA DE PACOTES
    ============================================================ */
    private static function render_lista_pacotes($id_servico) {

        $pacotes = self::listar_pacotes($id_servico);

        if (empty($pacotes)): ?>
            <p><em>Nenhum pacote cadastrado para este serviço.</em></p>
        <?php return; endif; ?>

        <table class="widefat striped" style="margin-top:10px;">
            <thead>
                <tr>
                    <th>Ord</th>
                    <th>Título</th>
                    <th>Slug</th>
                    <th>Valor Base</th>
                    <th>Hora Extra</th>
                    <th>Horas</th>
                    <th>Ativo</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($pacotes as $p): ?>
                <tr>
                    <td><?php echo intval($p['ordem']); ?></td>
                    <td><strong><?php echo esc_html($p['titulo']); ?></strong></td>
                    <td><code><?php echo esc_html($p['slug']); ?></code></td>
                    <td>R$ <?php echo number_format(floatval($p['valor_base']), 2, ',', '.'); ?></td>
                    <td>R$ <?php echo number_format(floatval($p['valor_hora_extra'] ?? 0), 2, ',', '.'); ?></td>
                    <td><?php echo intval($p['horas_min']); ?>h–<?php echo intval($p['horas_max']); ?>h</td>
                    <td><?php echo $p['ativo'] ? '✅' : '❌'; ?></td>
                    <td>
                        <a href="<?php echo admin_url('admin.php?page=photomusic-servicos&servico=' . $id_servico . '&pacote=' . $p['id']); ?>">
                            Editar
                        </a>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }

    /* ============================================================
       RENDER — ADICIONAR SERVIÇO AO EVENTO
    ============================================================ */
    public static function render_add_servico_page() {

        if (!PhotoMusic_Users::is_admin()) wp_die('Acesso negado.');

        $id_evento = intval($_GET['id'] ?? 0);

        if (!$id_evento) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        global $wpdb;
        $evento = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d", $id_evento),
            ARRAY_A
        );

        if (!$evento) {
            echo '<div class="wrap"><h1>Evento não encontrado</h1></div>';
            return;
        }

        $saved      = intval($_GET['saved'] ?? 0);
        $removed    = intval($_GET['removed'] ?? 0);
        $id_editar  = intval($_GET['editar'] ?? 0);

        $servicos         = self::listar_servicos();
        $servicos_evento  = self::get_evento_servicos($id_evento);

        // Serviço em edição (pré-preenche o formulário)
        $se_editar = null;
        if ($id_editar > 0) {
            foreach ($servicos_evento as $se) {
                if (intval($se['id']) === $id_editar) {
                    $se_editar = $se;
                    break;
                }
            }
        }
        ?>
        <div class="wrap">
            <h1>Serviços do Evento #<?php echo $id_evento; ?></h1>
            <h3><?php
                echo esc_html($evento['motivo_evento'] ?? '');
                $dt = $evento['data_evento'] ?? '';
                if ($dt) echo ' — ' . date('d/m/Y', strtotime($dt));
                $hi = $evento['horario_inicio'] ?? '';
                $hf = $evento['horario_fim']    ?? '';
                if ($hi) {
                    echo ' &nbsp;|&nbsp; ⏰ ' . substr($hi, 0, 5);
                    if ($hf) echo ' às ' . substr($hf, 0, 5);
                }
            ?></h3>
            <a class="button" href="<?php echo admin_url('admin.php?page=photomusic-evento-detalhes&id=' . $id_evento); ?>">← Voltar ao Evento</a>
            <hr>

            <?php if ($saved): ?>
                <div class="notice notice-success is-dismissible"><p>✅ Serviço adicionado com sucesso!</p></div>
            <?php endif; ?>
            <?php if (!empty($_GET['updated'])): ?>
                <div class="notice notice-success is-dismissible"><p>✅ Serviço atualizado com sucesso!</p></div>
            <?php endif; ?>
            <?php if ($removed): ?>
                <div class="notice notice-success is-dismissible"><p>🗑️ Serviço removido.</p></div>
            <?php endif; ?>

            <div style="display:flex; gap:30px; align-items:flex-start;">

                <!-- FORMULÁRIO ADICIONAR SERVIÇO -->
                <div style="flex:1; min-width:360px;">
                    <h2><?php echo $id_editar > 0 ? 'Editar Serviço' : 'Adicionar Serviço'; ?></h2>

                    <?php if (empty($servicos)): ?>
                        <div class="notice notice-warning">
                            <p>⚠️ Nenhum serviço cadastrado no catálogo.
                               <a href="<?php echo admin_url('admin.php?page=photomusic-servicos'); ?>">Cadastrar serviços</a>
                            </p>
                        </div>
                    <?php else: ?>

                    <form method="post" action="<?php echo admin_url('admin-post.php'); ?>" id="form-add-servico">
                        <?php wp_nonce_field('pm_add_evento_servico', 'pm_add_servico_nonce'); ?>
                        <input type="hidden" name="action" value="pm_add_evento_servico">
                        <input type="hidden" name="id_evento" value="<?php echo $id_evento; ?>">
                        <input type="hidden" name="id_evento_servico_editar" value="<?php echo $id_editar; ?>">
                        <!-- Brinde automático: preenchido via JS quando Plataforma 360 é selecionada -->
                        <input type="hidden" name="add_brinde_paparazzi" id="add-brinde-paparazzi" value="0">

                        <table class="form-table">
                            <tr>
                                <th><label>Serviço *</label></th>
                                <td>
                                    <select name="id_servico" id="select-servico" required onchange="carregarPacotes(this.value); verificarBrinde(this);">
                                        <option value="">— Selecione —</option>
                                        <?php foreach ($servicos as $s): ?>
                                            <option value="<?php echo $s['id']; ?>"
                                                data-slug="<?php echo esc_attr($s['slug']); ?>"
                                                data-nome="<?php echo esc_attr($s['nome']); ?>"
                                                <?php selected($se_editar['id_servico'] ?? '', $s['id']); ?>>
                                                <?php echo esc_html($s['nome']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <!-- Aviso de brinde — exibido via JS -->
                                    <div id="aviso-brinde" style="
                                        display:none;
                                        margin-top:8px;
                                        padding:8px 12px;
                                        background:#f0fff0;
                                        border-left:4px solid #2a7a2a;
                                        border-radius:3px;
                                        font-size:13px;
                                        color:#2a7a2a;">
                                        🎁 <strong>Foto Paparazzi Digital</strong> será incluída automaticamente como brinde.
                                        Se o cliente não quiser, remova após salvar.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th><label>Pacote *</label></th>
                                <td>
                                    <select name="id_pacote" id="select-pacote">
                                        <option value="">— Selecione o serviço primeiro —</option>
                                    </select>
                                    <p class="description" id="pacote-desc" style="display:none;">
                                        ℹ️ Este serviço não possui pacotes.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th><label>Horas Contratadas *</label></th>
                                <td>
                                    <input type="number" name="horas_contratadas" id="input-horas"
                                           class="small-text" min="1" max="24"
                                           value="<?php echo intval($se_editar['horas_contratadas'] ?? 4); ?>" required>
                                    <span id="horas-info" style="color:#666; margin-left:8px;"></span>
                                </td>
                            </tr>
                            <tr>
                                <th><label>Horário de Início do Serviço</label></th>
                                <td>
                                    <input type="time" name="horario_inicio" class="regular-text"
                                           value="<?php echo esc_attr($se_editar['horario_inicio'] ? substr($se_editar['horario_inicio'], 0, 5) : ''); ?>">
                                    <p class="description">Horário que <strong>este serviço</strong> começa (pode diferir do horário do evento). Aparece no contrato.</p>
                                </td>
                            </tr>
                            <!-- Valor Base: hidden — preenchido pelo JS ao selecionar pacote -->
                            <input type="hidden" name="valor_base" id="input-valor-base"
                                   value="<?php echo number_format(floatval($se_editar['valor_base'] ?? 0), 2, '.', ''); ?>">
                            <tr>
                                <th><label>Valor (R$) *</label></th>
                                <td>
                                    <input type="number" name="valor_final" id="input-valor-final"
                                           class="regular-text" step="0.01" min="0"
                                           value="<?php echo number_format(floatval($se_editar['valor_final'] ?? 0), 2, '.', ''); ?>" required>
                                    <p class="description">Preenchido automaticamente ao selecionar o pacote. Pode ajustar.</p>
                                </td>
                            </tr>
                            <tr>
                                <th><label>🔗 Link da Galeria</label></th>
                                <td>
                                    <input type="url" name="link_galeria" class="large-text"
                                           value="<?php echo esc_attr($se_editar['link_galeria'] ?? ''); ?>"
                                           placeholder="https://fotoshare.co/... ou Google Drive, Dropbox etc.">
                                    <p class="description">
                                        Link de acesso às fotos/vídeos <strong>deste serviço</strong>.
                                        Será exibido no ChatBot quando o evento estiver ativado.
                                        Pode ser preenchido agora ou depois que as fotos estiverem prontas.
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <?php submit_button($id_editar > 0 ? 'Salvar Alterações' : 'Adicionar Serviço ao Evento'); ?>
                    </form>

                    <?php endif; ?>
                </div>

                <!-- SERVIÇOS JÁ ADICIONADOS -->
                <div style="flex:1;">
                    <h2>Serviços Contratados</h2>

                    <?php if (empty($servicos_evento)): ?>
                        <p><em>Nenhum serviço adicionado ainda.</em></p>
                    <?php else: ?>

                        <?php
                        // ── Calcula total (loop simples, sem envolver a tabela)
                        $total = 0;
                        foreach ($servicos_evento as $se) {
                            $total += floatval($se['valor_final']);
                        }
                        ?>
                        <table class="widefat striped">
                            <thead>
                                <tr>
                                    <th>Serviço</th>
                                    <th>Pacote</th>
                                    <th>Horas</th>
                                    <th>Início</th>
                                    <th>Valor</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($servicos_evento as $se): ?>
                                <tr <?php echo !empty($se['observacoes']) && strpos($se['observacoes'], 'Brinde') !== false ? 'style="background:#f0fff0;"' : ''; ?>>
                                    <td>
                                        <strong><?php echo esc_html($se['nome_servico'] ?? $se['id_servico']); ?></strong>
                                        <?php if (!empty($se['observacoes']) && strpos($se['observacoes'], 'Brinde') !== false): ?>
                                            <br><span style="color:#2a7a2a; font-size:11px;">🎁 Brinde</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($se['nome_pacote'] ?? '—'); ?></td>
                                    <td><?php echo intval($se['horas_contratadas']); ?>h</td>
                                    <td><?php echo !empty($se['horario_inicio']) ? substr($se['horario_inicio'], 0, 5) : '—'; ?></td>
                                    <td><strong>R$ <?php echo number_format(floatval($se['valor_final']), 2, ',', '.'); ?></strong></td>
                                    <td style="white-space:nowrap;">
                                        <a href="<?php echo esc_url(add_query_arg([
                                            'page'    => 'photomusic-add-servico',
                                            'id'      => $id_evento,
                                            'editar'  => $se['id'],
                                        ], admin_url('admin.php'))); ?>"
                                           class="button button-small">✏️</a>
                                        &nbsp;
                                        <form method="post" action="<?php echo admin_url('admin-post.php'); ?>"
                                              style="display:inline;"
                                              onsubmit="return confirm('Remover este serviço?');">
                                            <?php wp_nonce_field('pm_remove_evento_servico', 'pm_remove_nonce'); ?>
                                            <input type="hidden" name="action" value="pm_remove_evento_servico">
                                            <input type="hidden" name="id_evento" value="<?php echo $id_evento; ?>">
                                            <input type="hidden" name="id_evento_servico" value="<?php echo intval($se['id']); ?>">
                                            <button type="submit" class="button button-small" style="color:#a00;">✕</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" style="text-align:right;"><strong>Total do Evento:</strong></td>
                                    <td><strong style="font-size:1.1em;">R$ <?php echo number_format($total, 2, ',', '.'); ?></strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>

                    <?php endif; ?>
                </div>

            </div>
        </div>

        <script>
        // Dados dos pacotes carregados via PHP para JS
        var PM_PACOTES = <?php
            $todos_pacotes = [];
            foreach ($servicos as $s) {
                $pkts = self::listar_pacotes($s['id']);
                foreach ($pkts as $p) {
                    $todos_pacotes[$s['id']][] = [
                        'id'              => $p['id'],
                        'titulo'          => $p['titulo'],
                        'slug'            => $p['slug'],
                        'valor_base'      => $p['valor_base'],
                        'valor_hora_extra'=> $p['valor_hora_extra'] ?? 0,
                        'horas_min'       => $p['horas_min'],
                        'horas_max'       => $p['horas_max'],
                    ];
                }
            }
            echo json_encode($todos_pacotes);
        ?>;

        // ── Verifica se o serviço selecionado é Plataforma 360 e ativa o brinde
        function verificarBrinde(select) {
            var opt    = select.options[select.selectedIndex];
            var slug   = (opt ? opt.dataset.slug : '') || '';
            var nome   = (opt ? opt.dataset.nome  : '') || '';
            var eh360  = slug.indexOf('360') !== -1 || nome.toLowerCase().indexOf('360') !== -1;

            document.getElementById('aviso-brinde').style.display     = eh360 ? '' : 'none';
            document.getElementById('add-brinde-paparazzi').value     = eh360 ? '1' : '0';
        }

        function carregarPacotes(id_servico) {
            var select = document.getElementById('select-pacote');
            select.innerHTML = '<option value="">— Selecione o pacote —</option>';
            document.getElementById('horas-info').textContent = '';
            document.getElementById('input-valor-base').value = '0.00';
            document.getElementById('input-valor-final').value = '0.00';

            var descEl = document.getElementById('pacote-desc');

            if (!id_servico || !PM_PACOTES[id_servico] || PM_PACOTES[id_servico].length === 0) {
                if (descEl) descEl.style.display = '';
                return;
            }
            if (descEl) descEl.style.display = 'none';

            PM_PACOTES[id_servico].forEach(function(p) {
                var opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.titulo + ' — R$ ' + parseFloat(p.valor_base).toFixed(2).replace('.', ',');
                opt.dataset.valor    = p.valor_base;
                opt.dataset.horasMin = p.horas_min;
                opt.dataset.horasMax = p.horas_max;
                opt.dataset.horaExtra = p.valor_hora_extra;
                select.appendChild(opt);
            });

            select.onchange = function() {
                atualizarValores();
            };

            // Dispara imediatamente se já tem pacote selecionado
            if (select.value) atualizarValores();
        }

        // Centraliza o cálculo de valores
        function atualizarValores() {
            var select = document.getElementById('select-pacote');
            var opt    = select.options[select.selectedIndex];
            if (!opt || !opt.dataset.valor) return;

            var valorBase  = parseFloat(opt.dataset.valor)    || 0;
            var horasExtra = parseFloat(opt.dataset.horaExtra) || 0;
            var horasMin   = parseInt(opt.dataset.horasMin)    || 1;
            var horasMax   = parseInt(opt.dataset.horasMax)    || 12;
            var horas      = parseInt(document.getElementById('input-horas').value) || horasMin;

            document.getElementById('input-horas').min = horasMin;
            document.getElementById('input-horas').max = horasMax;
            document.getElementById('horas-info').textContent = '(' + horasMin + 'h a ' + horasMax + 'h)';

            var extra = Math.max(0, horas - horasMin) * horasExtra;
            var total = valorBase + extra;

            document.getElementById('input-valor-base').value  = valorBase.toFixed(2);
            document.getElementById('input-valor-final').value = total.toFixed(2);
        }

        // Recalcula ao mudar horas
        document.getElementById('input-horas').addEventListener('input', function() {
            atualizarValores();
        });

        // ── Ao carregar a página em modo edição, restaura o pacote selecionado
        document.addEventListener('DOMContentLoaded', function() {
            var idServico    = <?php echo intval($se_editar['id_servico'] ?? 0); ?>;
            var idPacote     = <?php echo intval($se_editar['id_pacote']  ?? 0); ?>;
            var savedBase    = <?php echo floatval($se_editar['valor_base']  ?? 0); ?>;
            var savedFinal   = <?php echo floatval($se_editar['valor_final'] ?? 0); ?>;
            if (idServico) {
                carregarPacotes(idServico); // reseta valor_base e valor_final para 0
                if (idPacote) {
                    var sel = document.getElementById('select-pacote');
                    sel.value = idPacote;
                    if (!sel.value) {
                        setTimeout(function() { sel.value = idPacote; }, 50);
                    }
                }
                // Restaura os valores salvos (carregarPacotes os zeraria)
                if (savedBase  > 0) document.getElementById('input-valor-base').value  = savedBase.toFixed(2);
                if (savedFinal > 0) document.getElementById('input-valor-final').value = savedFinal.toFixed(2);
                var selServico = document.getElementById('select-servico');
                verificarBrinde(selServico);
            }
        });
        </script>
        <?php
    }

    /* ============================================================
       HANDLERS — FORMULÁRIOS
    ============================================================ */
    public static function handle_salvar_servico() {

        if (!current_user_can('pm_gerenciar_usuarios')) wp_die('Acesso negado.');
        if (!wp_verify_nonce($_POST['pm_servico_nonce'] ?? '', 'pm_salvar_servico')) wp_die('Nonce inválido.');

        global $wpdb;
        $table = $wpdb->prefix . 'pm_servicos';

        $id    = intval($_POST['id'] ?? 0);
        $data  = [
            'nome'      => sanitize_text_field($_POST['nome'] ?? ''),
            'slug'      => sanitize_title($_POST['slug'] ?? ''),
            'descricao' => sanitize_textarea_field($_POST['descricao'] ?? ''),
            'ordem'     => intval($_POST['ordem'] ?? 0),
            'ativo'     => isset($_POST['ativo']) ? 1 : 0,
        ];

        if ($id > 0) {
            $wpdb->update($table, $data, ['id' => $id]);
        } else {
            $wpdb->insert($table, $data);
            $id = $wpdb->insert_id;
        }

        wp_redirect(admin_url('admin.php?page=photomusic-servicos&servico=' . $id . '&saved=1'));
        exit;
    }

    public static function handle_salvar_pacote() {

        if (!current_user_can('pm_gerenciar_usuarios')) wp_die('Acesso negado.');
        if (!wp_verify_nonce($_POST['pm_pacote_nonce'] ?? '', 'pm_salvar_pacote')) wp_die('Nonce inválido.');

        global $wpdb;
        $table = $wpdb->prefix . 'pm_servicos_pacotes';

        $id         = intval($_POST['id'] ?? 0);
        $id_servico = intval($_POST['id_servico'] ?? 0);

        $data = [
            'id_servico'       => $id_servico,
            'titulo'           => sanitize_text_field($_POST['titulo'] ?? ''),
            'slug'             => sanitize_title($_POST['slug'] ?? ''),
            'valor_base'       => floatval($_POST['valor_base'] ?? 0),
            'valor_hora_extra' => floatval($_POST['valor_hora_extra'] ?? 0),
            'horas_min'        => intval($_POST['horas_min'] ?? 2),
            'horas_max'        => intval($_POST['horas_max'] ?? 8),
            'ordem'            => intval($_POST['ordem'] ?? 0),
            'ativo'            => isset($_POST['ativo']) ? 1 : 0,
        ];

        if ($id > 0) {
            $wpdb->update($table, $data, ['id' => $id]);
        } else {
            $wpdb->insert($table, $data);
        }

        wp_redirect(admin_url('admin.php?page=photomusic-servicos&servico=' . $id_servico . '&saved=1'));
        exit;
    }

    public static function handle_add_evento_servico() {

        if (!current_user_can('pm_criar_eventos')) wp_die('Acesso negado.');
        if (!wp_verify_nonce($_POST['pm_add_servico_nonce'] ?? '', 'pm_add_evento_servico')) wp_die('Nonce inválido.');

        global $wpdb;
        $table = $wpdb->prefix . 'pm_eventos_servicos';

        $id_evento = intval($_POST['id_evento'] ?? 0);

        $id_se_editar = intval($_POST['id_evento_servico_editar'] ?? 0);

        $dados_servico = [
            'id_servico'        => intval($_POST['id_servico'] ?? 0),
            'id_pacote'         => intval($_POST['id_pacote'] ?? 0),
            'horas_contratadas' => intval($_POST['horas_contratadas'] ?? 0),
            'horario_inicio'    => sanitize_text_field($_POST['horario_inicio'] ?? '') ?: null,
            'fotos_contratadas' => 0,
            'valor_base'        => floatval($_POST['valor_base'] ?? 0),
            'valor_adicional'   => 0,
            'label_adicional'   => '',
            'valor_final'       => floatval($_POST['valor_final'] ?? 0),
            // 'observacoes' não incluso: preserva valor existente (usado para 🎁 Brinde automático)
            'link_galeria'      => esc_url_raw(trim($_POST['link_galeria'] ?? '')) ?: null,
        ];

        if ($id_se_editar > 0) {
            $wpdb->update($table, $dados_servico, ['id' => $id_se_editar, 'id_evento' => $id_evento]);
        } else {
            $dados_servico['id_evento'] = $id_evento;
            $wpdb->insert($table, $dados_servico);
        }

        if (class_exists('PhotoMusic_Logs')) {
            PhotoMusic_Logs::add('evento_servico_adicionado', null, $id_evento, null,
                'Serviço adicionado ao evento.');
        }

        /* ============================================================
           BRINDE AUTOMÁTICO: Plataforma 360 → Foto Paparazzi Digital
           - Só executa ao ADICIONAR (não ao editar)
           - Só se o JS sinalizou add_brinde_paparazzi = 1
           - Só se Paparazzi ainda NÃO existe no evento
        ============================================================ */
        if ($id_se_editar === 0 && intval($_POST['add_brinde_paparazzi'] ?? 0) === 1) {

            $srv_paparazzi = $wpdb->get_row(
                "SELECT id FROM {$wpdb->prefix}pm_servicos
                 WHERE (slug LIKE '%paparazzi%' OR nome LIKE '%Paparazzi%')
                   AND ativo = 1
                 ORDER BY id ASC LIMIT 1"
            );

            if ($srv_paparazzi) {

                $ja_existe = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}pm_eventos_servicos
                     WHERE id_evento = %d AND id_servico = %d",
                    $id_evento,
                    $srv_paparazzi->id
                ));

                if (!$ja_existe) {
                    $wpdb->insert($table, [
                        'id_evento'         => $id_evento,
                        'id_servico'        => $srv_paparazzi->id,
                        'id_pacote'         => 0,
                        'horas_contratadas' => intval($_POST['horas_contratadas'] ?? 4),
                        'fotos_contratadas' => 0,
                        'valor_base'        => 0,
                        'valor_adicional'   => 0,
                        'valor_final'       => 0,
                        'observacoes'       => '🎁 Brinde — incluído automaticamente com Plataforma 360°',
                    ]);
                }
            }
        }

        $msg = $id_se_editar > 0 ? 'updated=1' : 'saved=1';
        wp_redirect(admin_url('admin.php?page=photomusic-add-servico&id=' . $id_evento . '&' . $msg));
        exit;
    }

    public static function handle_remove_evento_servico() {

        if (!current_user_can('pm_criar_eventos')) wp_die('Acesso negado.');
        if (!wp_verify_nonce($_POST['pm_remove_nonce'] ?? '', 'pm_remove_evento_servico')) wp_die('Nonce inválido.');

        global $wpdb;

        $id_evento         = intval($_POST['id_evento'] ?? 0);
        $id_evento_servico = intval($_POST['id_evento_servico'] ?? 0);

        $wpdb->delete($wpdb->prefix . 'pm_eventos_servicos', ['id' => $id_evento_servico]);

        wp_redirect(admin_url('admin.php?page=photomusic-add-servico&id=' . $id_evento . '&removed=1'));
        exit;
    }
}