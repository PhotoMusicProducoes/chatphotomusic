<?php
// includes/pagamento/class-photomusic-tabela-precos-admin.php
// Página admin — Tabela de Preços dos Serviços (com cálculo automático)

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tabela_Precos_Admin {

    public static function init() {
        add_action('admin_init', [__CLASS__, 'process_actions']);
    }

    /* ============================================================
       PROCESSA AÇÕES (admin_init — antes do HTML)
    ============================================================ */
    public static function process_actions() {

        if (!isset($_GET['page']) || $_GET['page'] !== 'photomusic-tabela-precos') return;
        if (!current_user_can('manage_options')) return;

        /* ---- Salvar configuração + gerar tabela ---- */
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['pm_tabela_config_nonce'])) {
            if (!wp_verify_nonce($_POST['pm_tabela_config_nonce'], 'pm_salvar_tabela_config')) {
                wp_die('Token de segurança inválido.');
            }

            $config = [
                'increment_hora'    => intval($_POST['increment_hora']    ?? 200),
                'adicional_corp200' => intval($_POST['adicional_corp200'] ?? 300),
                'servicos'          => [],
            ];

            $srv_ids = $_POST['srv_id'] ?? [];
            foreach ($srv_ids as $raw_id) {
                $sid  = intval($raw_id);
                $tipo = sanitize_key($_POST['srv_tipo'][$sid] ?? 'livre');
                $entry = [
                    'tipo' => $tipo,
                    'nome' => sanitize_text_field($_POST['srv_nome'][$sid] ?? ''),
                ];

                if ($tipo === 'horario') {
                    $entry['base_social_3h'] = floatval(str_replace(',', '.', $_POST['srv_base'][$sid] ?? 0));

                } elseif ($tipo === 'derivado') {
                    $entry['base_de']   = intval($_POST['srv_base_de'][$sid] ?? 0);
                    $entry['diferenca'] = floatval(str_replace(',', '.', $_POST['srv_diff'][$sid] ?? 0));

                } elseif ($tipo === 'lembranca') {
                    $entry['precos'] = [];
                    foreach (PhotoMusic_Tabela_Precos::QTDS_LEMBRANCA as $qtd) {
                        $v = $_POST['lembranca_preco'][$sid][$qtd] ?? '';
                        if ($v !== '') {
                            $entry['precos'][$qtd] = floatval(str_replace(',', '.', $v));
                        }
                    }
                }

                $config['servicos'][$sid] = $entry;
            }

            PhotoMusic_Tabela_Precos::salvar_config($config);
            PhotoMusic_Tabela_Precos::gerar_tudo();

            wp_redirect(admin_url('admin.php?page=photomusic-tabela-precos&gerado=1'));
            exit;
        }

        /* ---- Override manual de uma célula ---- */
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['pm_override_nonce'])) {
            if (!wp_verify_nonce($_POST['pm_override_nonce'], 'pm_override_preco')) wp_die('Token inválido.');
            $id     = intval($_POST['override_id'] ?? 0);
            $valor  = $_POST['override_valor'] ?? 0;
            $motivo = sanitize_text_field($_POST['override_motivo'] ?? '');
            if ($id > 0) {
                PhotoMusic_Tabela_Precos::override($id, $valor, $motivo);
            }
            wp_redirect(admin_url('admin.php?page=photomusic-tabela-precos&tab=tabela&override=1'));
            exit;
        }

        /* ---- Restaurar célula ao valor calculado ---- */
        if (!empty($_GET['restaurar']) && !empty($_GET['_wpnonce'])) {
            $id = intval($_GET['restaurar']);
            if (!wp_verify_nonce($_GET['_wpnonce'], 'pm_restaurar_' . $id)) wp_die('Token inválido.');
            PhotoMusic_Tabela_Precos::restaurar_auto($id);
            wp_redirect(admin_url('admin.php?page=photomusic-tabela-precos&tab=tabela&restaurado=1'));
            exit;
        }
    }

    /* ============================================================
       RENDERIZA A PÁGINA
    ============================================================ */
    public static function render() {
        if (!current_user_can('manage_options')) wp_die('Sem permissão.');

        $tab      = sanitize_key($_GET['tab'] ?? 'config');
        $config   = PhotoMusic_Tabela_Precos::get_config();
        $servicos = PhotoMusic_Tabela_Precos::listar_servicos_ativos();
        $agrupado = PhotoMusic_Tabela_Precos::listar_agrupado();

        echo '<div class="wrap">';
        echo '<h1>💰 Tabela de Preços dos Serviços</h1>';

        if (!empty($_GET['gerado']))    echo '<div class="notice notice-success is-dismissible"><p>✅ Tabela gerada/recalculada com sucesso!</p></div>';
        if (!empty($_GET['override']))  echo '<div class="notice notice-success is-dismissible"><p>✅ Preço sobrescrito manualmente.</p></div>';
        if (!empty($_GET['restaurado']))echo '<div class="notice notice-success is-dismissible"><p>↺ Preço restaurado ao valor calculado automaticamente.</p></div>';

        echo '<h2 class="nav-tab-wrapper">';
        foreach (['config' => '⚙️ Configuração', 'tabela' => '📋 Tabela Completa'] as $t => $l) {
            $cls = $tab === $t ? ' nav-tab-active' : '';
            echo '<a href="' . esc_url(admin_url('admin.php?page=photomusic-tabela-precos&tab=' . $t)) . '" class="nav-tab' . $cls . '">' . $l . '</a>';
        }
        echo '</h2>';

        if ($tab === 'config') {
            self::render_config($config, $servicos);
        } else {
            self::render_tabela($agrupado);
        }

        echo '</div>';
    }

    /* ============================================================
       ABA CONFIGURAÇÃO
    ============================================================ */
    private static function render_config($config, $servicos) {
        $srv_cfg = $config['servicos'] ?? [];
        ?>
        <form method="post" style="margin-top:20px;">
            <?php wp_nonce_field('pm_salvar_tabela_config', 'pm_tabela_config_nonce'); ?>

            <!-- REGRAS GLOBAIS -->
            <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;max-width:680px;margin-bottom:24px;">
                <h2 style="margin-top:0;">🔧 Regras de Cálculo</h2>
                <table class="form-table" style="max-width:540px;">
                    <tr>
                        <th><label for="increment_hora">Incremento por hora acima de 3h</label></th>
                        <td>
                            R$ <input type="number" id="increment_hora" name="increment_hora"
                                      value="<?php echo intval($config['increment_hora'] ?? 200); ?>"
                                      step="1" min="0" style="width:100px;">
                            <p class="description">Ex: com R$200, o preço de 4h = 3h + R$200, 5h = 3h + R$400…</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="adicional_corp200">Adicional Corporativo/Formatura/Outros 200+ pessoas (base 3h)</label></th>
                        <td>
                            R$ <input type="number" id="adicional_corp200" name="adicional_corp200"
                                      value="<?php echo intval($config['adicional_corp200'] ?? 300); ?>"
                                      step="1" min="0" style="width:100px;">
                            <p class="description">
                                Aplica-se a eventos <strong>Corporativos, Formatura e Outros</strong> com mais de 200 pessoas.<br>
                                Eventos até 200 pessoas (Corporativo/Formatura/Outros) têm o <strong>mesmo preço do Social</strong>.
                            </p>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- SERVIÇOS -->
            <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;max-width:960px;margin-bottom:24px;">
                <h2 style="margin-top:0;">🛠️ Configuração dos Serviços</h2>
                <p class="description" style="margin-bottom:16px;">
                    Configure o tipo de precificação de cada serviço:<br>
                    <strong>⏱️ Horário</strong> — preço base (3h Social) informado manualmente; restante é calculado.<br>
                    <strong>🔗 Derivado</strong> — preço copiado de outro serviço com uma diferença fixa. Ex: Totem = Cabine − R$100.<br>
                    <strong>📷 Por Quantidade</strong> — Foto Lembrança: preço por qtd de fotos reveladas.<br>
                    <strong>📝 Livre</strong> — operador informa o valor manualmente no evento (sem tabela).
                </p>

                <?php foreach ($servicos as $s):
                    $sid  = intval($s->id);
                    $scfg = $srv_cfg[$sid] ?? [];
                    $tipo = $scfg['tipo'] ?? 'livre';
                ?>
                <div style="border:1px solid #e0e0e0;border-radius:4px;padding:12px 16px;margin-bottom:12px;background:#fafafa;">
                    <input type="hidden" name="srv_id[]" value="<?php echo $sid; ?>">
                    <input type="hidden" name="srv_nome[<?php echo $sid; ?>]" value="<?php echo esc_attr($s->nome); ?>">

                    <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">

                        <!-- Nome do serviço -->
                        <div style="min-width:200px;flex:0 0 200px;">
                            <strong><?php echo esc_html($s->nome); ?></strong>
                            <?php if ($s->codigo): ?>
                                <br><small style="color:#888;"><?php echo esc_html($s->codigo); ?></small>
                            <?php endif; ?>
                        </div>

                        <!-- Tipo de precificação -->
                        <div style="flex:0 0 180px;">
                            <label style="display:block;font-size:12px;color:#555;margin-bottom:4px;">Tipo de precificação</label>
                            <select name="srv_tipo[<?php echo $sid; ?>]" style="width:100%;"
                                    onchange="pmTipoChange(this, <?php echo $sid; ?>)">
                                <option value="livre"     <?php selected($tipo,'livre'); ?>>📝 Livre (manual)</option>
                                <option value="horario"   <?php selected($tipo,'horario'); ?>>⏱️ Horário (2–10h)</option>
                                <option value="derivado"  <?php selected($tipo,'derivado'); ?>>🔗 Derivado de outro</option>
                                <option value="lembranca" <?php selected($tipo,'lembranca'); ?>>📷 Por Quantidade</option>
                            </select>
                        </div>

                        <!-- Base 3h Social (só horario) -->
                        <div id="pm-base-<?php echo $sid; ?>"
                             style="flex:0 0 160px;<?php echo $tipo !== 'horario' ? 'display:none;' : ''; ?>">
                            <label style="display:block;font-size:12px;color:#555;margin-bottom:4px;">Base 3h Social (R$)</label>
                            <input type="number" name="srv_base[<?php echo $sid; ?>]"
                                   value="<?php echo number_format(floatval($scfg['base_social_3h'] ?? 0), 2, '.', ''); ?>"
                                   step="0.01" min="0" style="width:130px;"
                                   placeholder="Ex: 1500.00">
                        </div>

                        <!-- Derivado de (só derivado) -->
                        <div id="pm-derivado-<?php echo $sid; ?>"
                             style="flex:0 0 340px;<?php echo $tipo !== 'derivado' ? 'display:none;' : ''; ?>">
                            <label style="display:block;font-size:12px;color:#555;margin-bottom:4px;">Baseado em</label>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <select name="srv_base_de[<?php echo $sid; ?>]" style="flex:1;">
                                    <option value="">— Selecione o serviço base —</option>
                                    <?php foreach ($servicos as $s2):
                                        if (intval($s2->id) === $sid) continue; ?>
                                        <option value="<?php echo intval($s2->id); ?>"
                                                <?php selected(intval($scfg['base_de'] ?? 0), intval($s2->id)); ?>>
                                            <?php echo esc_html($s2->nome); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <span style="white-space:nowrap;">+ R$</span>
                                <input type="number" name="srv_diff[<?php echo $sid; ?>]"
                                       value="<?php echo number_format(floatval($scfg['diferenca'] ?? 0), 2, '.', ''); ?>"
                                       step="0.01" style="width:90px;"
                                       title="Use negativo para descontar. Ex: -100 = R$100 mais barato">
                                <span style="font-size:11px;color:#888;">(negativo p/ desconto)</span>
                            </div>
                        </div>

                    </div>

                    <!-- Foto Lembrança — por quantidade (linha separada) -->
                    <div id="pm-lembranca-<?php echo $sid; ?>"
                         style="margin-top:12px;padding:10px;background:#f0f7ff;border-radius:4px;<?php echo $tipo !== 'lembranca' ? 'display:none;' : ''; ?>">
                        <strong style="font-size:13px;">Preços por quantidade de fotos reveladas:</strong>
                        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
                            <?php foreach (PhotoMusic_Tabela_Precos::QTDS_LEMBRANCA as $qtd): ?>
                            <label style="font-size:13px;text-align:center;">
                                <span style="display:block;font-weight:600;margin-bottom:4px;"><?php echo $qtd; ?> fotos</span>
                                R$ <input type="number" name="lembranca_preco[<?php echo $sid; ?>][<?php echo $qtd; ?>]"
                                          value="<?php echo number_format(floatval($scfg['precos'][$qtd] ?? 0), 2, '.', ''); ?>"
                                          step="0.01" min="0" style="width:90px;">
                            </label>
                            <?php endforeach; ?>
                        </div>
                    </div>

                </div>
                <?php endforeach; ?>

            </div>

            <p>
                <button type="submit" class="button button-primary button-large">
                    ⚡ Salvar e Gerar Tabela Completa
                </button>
                <span style="margin-left:14px;color:#555;font-size:13px;">
                    Calcula automaticamente de 2h a 10h para todos os tipos de evento.
                </span>
            </p>
        </form>

        <script>
        function pmTipoChange(sel, sid) {
            const tipo = sel.value;
            document.getElementById('pm-base-' + sid).style.display     = tipo === 'horario'   ? '' : 'none';
            document.getElementById('pm-derivado-' + sid).style.display = tipo === 'derivado'  ? '' : 'none';
            document.getElementById('pm-lembranca-' + sid).style.display= tipo === 'lembranca' ? '' : 'none';
        }
        </script>
        <?php
    }

    /* ============================================================
       ABA TABELA COMPLETA
    ============================================================ */
    private static function render_tabela($agrupado) {

        if (empty($agrupado)) {
            echo '<div style="margin-top:20px;padding:16px;background:#fff3cd;border-radius:6px;max-width:600px;">';
            echo '⚠️ Nenhum preço gerado ainda. Vá para a aba <strong>⚙️ Configuração</strong> e clique em <strong>⚡ Salvar e Gerar Tabela Completa</strong>.';
            echo '</div>';
            return;
        }

        echo '<p style="margin-top:16px;color:#555;">';
        echo '🔴 = preço sobrescrito manualmente &nbsp;|&nbsp; Clique no valor para editar.';
        echo '</p>';

        $tipos_ev_labels = [
            'social'              => '🎉 Social',
            'corporativo_ate200'  => '🏢 Corp./Form./Outros<br><small>até 200 pax</small>',
            'corporativo_200mais' => '🏢 Corp./Form./Outros<br><small>200+ pax</small>',
        ];

        foreach ($agrupado as $id_servico => $grupo) {
            echo '<h3 style="margin-top:28px;">' . esc_html($grupo['nome']) . '</h3>';

            // Separar linhas por horas vs por quantidade
            $por_horas = [];
            $por_qtd   = [];
            $tipos_ev  = [];

            foreach ($grupo['linhas'] as $l) {
                if ($l->horas !== null) {
                    $por_horas[(int)$l->horas][$l->tipo_evento] = $l;
                    $tipos_ev[$l->tipo_evento] = true;
                } else {
                    $por_qtd[(int)$l->qtd_fotos] = $l;
                }
            }

            /* --- Tabela de horas --- */
            if (!empty($por_horas)) {
                $colunas = array_keys($tipos_ev);
                echo '<table class="widefat" style="max-width:700px;margin-bottom:8px;">';
                echo '<thead><tr style="background:#f0f7ff;">';
                echo '<th style="width:80px;">Horas</th>';
                foreach ($colunas as $te) {
                    echo '<th style="text-align:center;">' . ($tipos_ev_labels[$te] ?? esc_html($te)) . '</th>';
                }
                echo '</tr></thead><tbody>';

                foreach (PhotoMusic_Tabela_Precos::HORAS as $h) {
                    if (!isset($por_horas[$h])) continue;
                    echo '<tr>';
                    echo '<td><strong>' . $h . 'h' . ($h == 2 ? '<br><small style="color:#888;">(= 3h)</small>' : '') . '</strong></td>';
                    foreach ($colunas as $te) {
                        $cel = $por_horas[$h][$te] ?? null;
                        if ($cel) {
                            self::render_cell($cel);
                        } else {
                            echo '<td style="text-align:center;color:#bbb;">—</td>';
                        }
                    }
                    echo '</tr>';
                }
                echo '</tbody></table>';
            }

            /* --- Tabela por quantidade (Foto Lembrança) --- */
            if (!empty($por_qtd)) {
                ksort($por_qtd);
                echo '<table class="widefat" style="max-width:500px;margin-bottom:8px;">';
                echo '<thead><tr style="background:#f0f7ff;">';
                echo '<th>Qtd. fotos reveladas</th>';
                echo '<th style="text-align:center;">Preço</th>';
                echo '</tr></thead><tbody>';
                foreach ($por_qtd as $qtd => $cel) {
                    echo '<tr>';
                    echo '<td><strong>' . $qtd . ' fotos</strong></td>';
                    self::render_cell($cel);
                    echo '</tr>';
                }
                echo '</tbody></table>';
            }
        }

        /* --- Formulário de override manual --- */
        ?>
        <div id="pm-override-form" style="background:#fff;border:1px solid #e0c080;border-radius:6px;padding:16px;max-width:520px;margin-top:28px;">
            <h3 style="margin-top:0;">✏️ Sobrescrever Preço Manualmente</h3>
            <p class="description">Clique em qualquer valor na tabela acima para preencher automaticamente. Ou informe o ID diretamente.</p>
            <form method="post">
                <?php wp_nonce_field('pm_override_preco', 'pm_override_nonce'); ?>
                <table class="form-table" style="max-width:460px;">
                    <tr>
                        <th>ID da célula</th>
                        <td><input type="number" id="override_id" name="override_id" style="width:90px;"></td>
                    </tr>
                    <tr>
                        <th>Novo valor (R$)</th>
                        <td><input type="number" id="override_valor" name="override_valor" step="0.01" min="0" style="width:130px;"></td>
                    </tr>
                    <tr>
                        <th>Motivo</th>
                        <td><input type="text" id="override_motivo" name="override_motivo" style="width:260px;" placeholder="Ex: Promoção especial"></td>
                    </tr>
                </table>
                <button type="submit" class="button button-primary">✏️ Salvar Override</button>
                <span id="pm-override-label" style="margin-left:10px;font-size:12px;color:#555;"></span>
            </form>
        </div>

        <script>
        function pmPreencherOverride(id, valor, label) {
            document.getElementById('override_id').value    = id;
            document.getElementById('override_valor').value = valor;
            document.getElementById('override_label').textContent = '→ ' + label;
            document.getElementById('pm-override-form').scrollIntoView({behavior:'smooth', block:'nearest'});
            document.getElementById('override_id').focus();
        }
        </script>
        <?php
    }

    /* ---- Renderiza uma célula da tabela com botão de edição ---- */
    private static function render_cell($cel) {
        $manual = (int)$cel->gerado_automatico === 0;
        $url_r  = $manual
            ? wp_nonce_url(admin_url('admin.php?page=photomusic-tabela-precos&tab=tabela&restaurar=' . $cel->id), 'pm_restaurar_' . $cel->id)
            : '';
        $valor_fmt  = number_format(floatval($cel->valor), 2, ',', '.');
        $valor_raw  = number_format(floatval($cel->valor), 2, '.', '');
        $label_cel  = ($cel->horas ? $cel->horas . 'h' : $cel->qtd_fotos . ' fotos') . ' / ' . $cel->tipo_evento;

        echo '<td style="text-align:center;">';
        if ($manual) {
            echo '<strong style="color:#c62828;" title="Valor sobrescrito manualmente">';
            echo '🔴 R$ ' . esc_html($valor_fmt);
            echo '</strong>';
            echo ' <a href="' . esc_url($url_r) . '"
                      onclick="return confirm(\'Restaurar ao valor calculado automaticamente?\');"
                      title="Restaurar ao valor automático" style="font-size:11px;color:#1565c0;">↺</a>';
        } else {
            echo '<a href="#pm-override-form" style="color:#333;text-decoration:none;"
                     onclick="pmPreencherOverride(' . $cel->id . ', ' . $valor_raw . ', \'' . esc_js($label_cel) . '\');return false;"
                     title="Clique para editar este valor">R$ ' . esc_html($valor_fmt) . '</a>';
        }
        echo '</td>';
    }
}
