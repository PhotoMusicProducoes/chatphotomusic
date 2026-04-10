<?php
// includes/pagamento/class-photomusic-links-pagamento-admin.php
// Página admin — Banco de Links de Pagamento

if (!defined('ABSPATH')) exit;

class PhotoMusic_Links_Pagamento_Admin {

    public static function init() {
        add_action('admin_init', [__CLASS__, 'process_actions']);
    }

    /* ============================================================
       PROCESSA AÇÕES (admin_init — antes do HTML)
    ============================================================ */
    public static function process_actions() {

        if (!isset($_GET['page']) || $_GET['page'] !== 'photomusic-links-pagamento') {
            return;
        }

        if (!current_user_can('manage_options')) {
            return;
        }

        // SALVAR (novo ou editar)
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['pm_link_pgto_nonce'])) {
            if (!wp_verify_nonce($_POST['pm_link_pgto_nonce'], 'pm_salvar_link_pagamento')) {
                wp_die('Token de segurança inválido.');
            }

            $dados = [
                'forma'         => sanitize_key($_POST['forma'] ?? ''),
                'tipo_evento'   => sanitize_key($_POST['tipo_evento'] ?? 'ambos'),
                'valor'         => floatval(str_replace(',', '.', $_POST['valor'] ?? 0)),
                'link'          => esc_url_raw($_POST['link'] ?? ''),
                'parcelas_max'  => intval($_POST['parcelas_max'] ?? 1),
                'valor_parcela' => !empty($_POST['valor_parcela']) ? floatval(str_replace(',', '.', $_POST['valor_parcela'])) : null,
                'descricao'     => sanitize_text_field($_POST['descricao'] ?? ''),
            ];

            $edit_id = intval($_POST['edit_id'] ?? 0);

            if ($edit_id > 0) {
                PhotoMusic_Links_Pagamento::atualizar($edit_id, $dados);
                $msg = 'editado=1';
            } else {
                PhotoMusic_Links_Pagamento::criar($dados);
                $msg = 'criado=1';
            }

            wp_redirect(admin_url('admin.php?page=photomusic-links-pagamento&' . $msg));
            exit;
        }

        // EXCLUIR
        if (!empty($_GET['excluir']) && !empty($_GET['_wpnonce'])) {
            if (!wp_verify_nonce($_GET['_wpnonce'], 'pm_excluir_link_' . intval($_GET['excluir']))) {
                wp_die('Token inválido.');
            }
            PhotoMusic_Links_Pagamento::excluir(intval($_GET['excluir']));
            wp_redirect(admin_url('admin.php?page=photomusic-links-pagamento&excluido=1'));
            exit;
        }
    }

    /* ============================================================
       RENDERIZA A PÁGINA
    ============================================================ */
    public static function render() {

        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão.');
        }

        $editando   = null;
        $edit_id    = intval($_GET['editar'] ?? 0);
        $busca_val  = sanitize_text_field($_GET['busca_valor'] ?? '');
        $filtro_forma = sanitize_key($_GET['filtro_forma'] ?? '');

        if ($edit_id > 0) {
            $editando = PhotoMusic_Links_Pagamento::get($edit_id);
        }

        $filtros = [];
        if ($busca_val)    $filtros['busca_valor'] = $busca_val;
        if ($filtro_forma) $filtros['forma']        = $filtro_forma;

        $links = PhotoMusic_Links_Pagamento::listar($filtros);

        echo '<div class="wrap">';
        echo '<h1>💳 Banco de Links de Pagamento</h1>';

        // Notificações
        if (!empty($_GET['criado']))  echo '<div class="notice notice-success is-dismissible"><p>✅ Link cadastrado com sucesso!</p></div>';
        if (!empty($_GET['editado'])) echo '<div class="notice notice-success is-dismissible"><p>✅ Link atualizado com sucesso!</p></div>';
        if (!empty($_GET['excluido']))echo '<div class="notice notice-success is-dismissible"><p>🗑️ Link removido.</p></div>';

        // ── FORMULÁRIO CADASTRO / EDIÇÃO ──────────────────────────
        $form_titulo = $editando ? '✏️ Editar Link' : '➕ Novo Link';
        $forma_val   = $editando->forma         ?? '';
        $tipo_val    = $editando->tipo_evento   ?? 'ambos';
        $valor_val   = $editando ? number_format(floatval($editando->valor), 2, ',', '.') : '';
        $link_val    = $editando->link          ?? '';
        $parc_val    = $editando->parcelas_max  ?? 1;
        $parc_r_val  = $editando ? number_format(floatval($editando->valor_parcela ?? 0), 2, ',', '.') : '';
        $desc_val    = $editando->descricao     ?? '';
        ?>

        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;max-width:680px;margin-bottom:24px;">
            <h2 style="margin-top:0;"><?php echo esc_html($form_titulo); ?></h2>
            <form method="post">
                <?php wp_nonce_field('pm_salvar_link_pagamento', 'pm_link_pgto_nonce'); ?>
                <?php if ($editando): ?>
                    <input type="hidden" name="edit_id" value="<?php echo intval($editando->id); ?>">
                <?php endif; ?>

                <table class="form-table" style="max-width:620px;">
                    <tr>
                        <th><label for="pm_forma">Forma</label></th>
                        <td>
                            <select name="forma" id="pm_forma" required onchange="toggleParcelas(this.value)">
                                <option value="">— Selecione —</option>
                                <option value="cartao"          <?php selected($forma_val,'cartao'); ?>>💳 Cartão (InfinitePay)</option>
                                <option value="pix_infinitepay" <?php selected($forma_val,'pix_infinitepay'); ?>>⚡ PIX InfinitePay</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_tipo_evento">Tipo de Evento</label></th>
                        <td>
                            <select name="tipo_evento" id="pm_tipo_evento">
                                <option value="ambos"      <?php selected($tipo_val,'ambos'); ?>>🔁 Ambos</option>
                                <option value="social"     <?php selected($tipo_val,'social'); ?>>🎉 Social</option>
                                <option value="corporativo"<?php selected($tipo_val,'corporativo'); ?>>🏢 Corporativo (PJ)</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_valor">Valor (R$)</label></th>
                        <td>
                            <input type="text" name="valor" id="pm_valor" value="<?php echo esc_attr($valor_val); ?>"
                                   placeholder="Ex: 1597,00" required style="width:150px;">
                            <p class="description">Use vírgula como separador decimal.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_link">Link InfinitePay</label></th>
                        <td>
                            <input type="url" name="link" id="pm_link" value="<?php echo esc_attr($link_val); ?>"
                                   placeholder="https://link.infinitepay.io/..." required style="width:100%;">
                        </td>
                    </tr>
                    <tr id="row_parcelas" style="<?php echo $forma_val !== 'cartao' ? 'display:none;' : ''; ?>">
                        <th><label for="pm_parcelas_max">Máx. Parcelas</label></th>
                        <td>
                            <select name="parcelas_max" id="pm_parcelas_max">
                                <?php for ($i = 1; $i <= 12; $i++): ?>
                                    <option value="<?php echo $i; ?>" <?php selected($parc_val, $i); ?>><?php echo $i; ?>x</option>
                                <?php endfor; ?>
                            </select>
                        </td>
                    </tr>
                    <tr id="row_valor_parcela" style="<?php echo $forma_val !== 'cartao' ? 'display:none;' : ''; ?>">
                        <th><label for="pm_valor_parcela">Valor da Parcela (R$)</label></th>
                        <td>
                            <input type="text" name="valor_parcela" id="pm_valor_parcela"
                                   value="<?php echo esc_attr($parc_r_val); ?>"
                                   placeholder="Ex: 532,33" style="width:150px;">
                            <p class="description">Calculado automaticamente se deixar em branco.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_descricao">Descrição (opcional)</label></th>
                        <td>
                            <input type="text" name="descricao" id="pm_descricao"
                                   value="<?php echo esc_attr($desc_val); ?>"
                                   placeholder="Ex: Pacote Casamento Prata" style="width:100%;">
                        </td>
                    </tr>
                </table>

                <p>
                    <button type="submit" class="button button-primary">
                        <?php echo $editando ? '💾 Salvar Alterações' : '➕ Cadastrar Link'; ?>
                    </button>
                    <?php if ($editando): ?>
                        <a href="<?php echo admin_url('admin.php?page=photomusic-links-pagamento'); ?>" class="button">Cancelar</a>
                    <?php endif; ?>
                </p>
            </form>
        </div>

        <script>
        function toggleParcelas(forma) {
            var show = forma === 'cartao';
            document.getElementById('row_parcelas').style.display      = show ? '' : 'none';
            document.getElementById('row_valor_parcela').style.display = show ? '' : 'none';

            // Auto-calcula valor da parcela quando muda parcelas
            document.getElementById('pm_parcelas_max').addEventListener('change', calcularParcela);
            document.getElementById('pm_valor').addEventListener('blur', calcularParcela);
        }
        function calcularParcela() {
            var valor   = parseFloat(document.getElementById('pm_valor').value.replace(',', '.')) || 0;
            var parcelas= parseInt(document.getElementById('pm_parcelas_max').value) || 1;
            var campo   = document.getElementById('pm_valor_parcela');
            if (valor > 0 && parcelas > 1 && campo.value === '') {
                campo.value = (valor / parcelas).toFixed(2).replace('.', ',');
            }
        }
        document.getElementById('pm_parcelas_max').addEventListener('change', calcularParcela);
        document.getElementById('pm_valor').addEventListener('blur', calcularParcela);
        toggleParcelas(document.getElementById('pm_forma').value);
        </script>

        <?php
        // ── FILTROS + LISTA ───────────────────────────────────────
        echo '<h2>📋 Links Cadastrados</h2>';

        // Filtros
        echo '<form method="get" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">';
        echo '<input type="hidden" name="page" value="photomusic-links-pagamento">';
        echo '<input type="text" name="busca_valor" value="' . esc_attr($busca_val) . '" placeholder="Buscar por valor (ex: 1597)" style="width:180px;">';
        echo '<select name="filtro_forma">';
        echo '<option value="">— Todas as formas —</option>';
        echo '<option value="cartao"          ' . selected($filtro_forma, 'cartao', false) . '>💳 Cartão</option>';
        echo '<option value="pix_infinitepay" ' . selected($filtro_forma, 'pix_infinitepay', false) . '>⚡ PIX InfinitePay</option>';
        echo '</select>';
        echo '<button type="submit" class="button">🔍 Filtrar</button>';
        if ($busca_val || $filtro_forma) {
            echo ' <a href="' . admin_url('admin.php?page=photomusic-links-pagamento') . '" class="button">✖ Limpar</a>';
        }
        echo '</form>';

        if (empty($links)) {
            echo '<p><em>Nenhum link cadastrado ainda.</em></p>';
        } else {
            echo '<table class="widefat striped">';
            echo '<thead><tr>
                    <th>ID</th>
                    <th>Forma</th>
                    <th>Tipo Evento</th>
                    <th>Valor</th>
                    <th>Parcelas</th>
                    <th>Valor Parcela</th>
                    <th>Link</th>
                    <th>Descrição</th>
                    <th>Ações</th>
                  </tr></thead><tbody>';

            foreach ($links as $l) {
                $link_curto = strlen($l->link) > 45 ? substr($l->link, 0, 45) . '…' : $l->link;
                $url_editar  = admin_url('admin.php?page=photomusic-links-pagamento&editar=' . $l->id);
                $url_excluir = wp_nonce_url(
                    admin_url('admin.php?page=photomusic-links-pagamento&excluir=' . $l->id),
                    'pm_excluir_link_' . $l->id
                );
                echo '<tr>';
                echo '<td>' . intval($l->id) . '</td>';
                echo '<td>' . esc_html(PhotoMusic_Links_Pagamento::label_forma($l->forma)) . '</td>';
                echo '<td>' . esc_html(PhotoMusic_Links_Pagamento::label_tipo_evento($l->tipo_evento)) . '</td>';
                echo '<td><strong>R$ ' . number_format(floatval($l->valor), 2, ',', '.') . '</strong></td>';
                echo '<td>' . ($l->forma === 'cartao' ? intval($l->parcelas_max) . 'x' : '—') . '</td>';
                echo '<td>' . ($l->valor_parcela ? 'R$ ' . number_format(floatval($l->valor_parcela), 2, ',', '.') : '—') . '</td>';
                echo '<td><a href="' . esc_url($l->link) . '" target="_blank" title="' . esc_attr($l->link) . '">' . esc_html($link_curto) . '</a></td>';
                echo '<td>' . esc_html($l->descricao ?: '—') . '</td>';
                echo '<td>
                        <a class="button button-small" href="' . esc_url($url_editar) . '">✏️ Editar</a>
                        <a class="button button-small" href="' . esc_url($url_excluir) . '"
                           onclick="return confirm(\'Remover este link?\');" style="color:#c00;">🗑️</a>
                      </td>';
                echo '</tr>';
            }

            echo '</tbody></table>';
            echo '<p class="description">Total: ' . count($links) . ' link(s) cadastrado(s).</p>';
        }

        echo '</div>'; // .wrap
    }
}
