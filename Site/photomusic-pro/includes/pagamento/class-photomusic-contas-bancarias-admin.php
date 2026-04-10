<?php
// includes/pagamento/class-photomusic-contas-bancarias-admin.php
// Página admin — Contas Bancárias da Empresa

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contas_Bancarias_Admin {

    public static function init() {
        add_action('admin_init', [__CLASS__, 'process_actions']);
    }

    /* ============================================================
       PROCESSA AÇÕES (admin_init — antes do HTML)
    ============================================================ */
    public static function process_actions() {

        if (!isset($_GET['page']) || $_GET['page'] !== 'photomusic-contas-bancarias') {
            return;
        }

        if (!current_user_can('manage_options')) return;

        // SALVAR (novo ou editar)
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['pm_conta_nonce'])) {
            if (!wp_verify_nonce($_POST['pm_conta_nonce'], 'pm_salvar_conta_bancaria')) {
                wp_die('Token de segurança inválido.');
            }

            $dados = [
                'nome'        => sanitize_text_field($_POST['nome'] ?? ''),
                'tipo'        => sanitize_key($_POST['tipo'] ?? 'pix'),
                'banco'       => sanitize_text_field($_POST['banco'] ?? ''),
                'beneficiario'=> sanitize_text_field($_POST['beneficiario'] ?? ''),
                'chave_pix'   => sanitize_text_field($_POST['chave_pix'] ?? ''),
                'tipo_chave'  => sanitize_key($_POST['tipo_chave'] ?? ''),
                'agencia'     => sanitize_text_field($_POST['agencia'] ?? ''),
                'codigo_banco'=> sanitize_text_field($_POST['codigo_banco'] ?? ''),
                'conta'       => sanitize_text_field($_POST['conta'] ?? ''),
                'cnpj'        => sanitize_text_field($_POST['cnpj'] ?? ''),
                'principal'   => !empty($_POST['principal']) ? 1 : 0,
            ];

            $edit_id = intval($_POST['edit_id'] ?? 0);

            if ($edit_id > 0) {
                PhotoMusic_Contas_Bancarias::atualizar($edit_id, $dados);
                $msg = 'editado=1';
            } else {
                PhotoMusic_Contas_Bancarias::criar($dados);
                $msg = 'criado=1';
            }

            wp_redirect(admin_url('admin.php?page=photomusic-contas-bancarias&' . $msg));
            exit;
        }

        // EXCLUIR
        if (!empty($_GET['excluir']) && !empty($_GET['_wpnonce'])) {
            if (!wp_verify_nonce($_GET['_wpnonce'], 'pm_excluir_conta_' . intval($_GET['excluir']))) {
                wp_die('Token inválido.');
            }
            PhotoMusic_Contas_Bancarias::excluir(intval($_GET['excluir']));
            wp_redirect(admin_url('admin.php?page=photomusic-contas-bancarias&excluido=1'));
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

        $editando = null;
        $edit_id  = intval($_GET['editar'] ?? 0);
        if ($edit_id > 0) {
            $editando = PhotoMusic_Contas_Bancarias::get($edit_id);
        }

        $contas = PhotoMusic_Contas_Bancarias::listar();

        echo '<div class="wrap">';
        echo '<h1>🏦 Contas Bancárias da Empresa</h1>';

        if (!empty($_GET['criado']))   echo '<div class="notice notice-success is-dismissible"><p>✅ Conta cadastrada!</p></div>';
        if (!empty($_GET['editado']))  echo '<div class="notice notice-success is-dismissible"><p>✅ Conta atualizada!</p></div>';
        if (!empty($_GET['excluido'])) echo '<div class="notice notice-success is-dismissible"><p>🗑️ Conta removida.</p></div>';

        // ── FORMULÁRIO ─────────────────────────────────────────────
        $tipo_v    = $editando->tipo         ?? 'pix';
        $nome_v    = $editando->nome         ?? '';
        $banco_v   = $editando->banco        ?? '';
        $benef_v   = $editando->beneficiario ?? '';
        $chave_v   = $editando->chave_pix    ?? '';
        $tchave_v  = $editando->tipo_chave   ?? 'cnpj';
        $ag_v      = $editando->agencia      ?? '';
        $cod_v     = $editando->codigo_banco ?? '';
        $conta_v   = $editando->conta        ?? '';
        $cnpj_v    = $editando->cnpj         ?? '';
        $princ_v   = $editando->principal    ?? 0;
        ?>

        <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px;max-width:680px;margin-bottom:24px;">
            <h2 style="margin-top:0;"><?php echo $editando ? '✏️ Editar Conta' : '➕ Nova Conta'; ?></h2>
            <form method="post">
                <?php wp_nonce_field('pm_salvar_conta_bancaria', 'pm_conta_nonce'); ?>
                <?php if ($editando): ?>
                    <input type="hidden" name="edit_id" value="<?php echo intval($editando->id); ?>">
                <?php endif; ?>

                <table class="form-table" style="max-width:620px;">
                    <tr>
                        <th><label for="pm_tipo">Tipo</label></th>
                        <td>
                            <select name="tipo" id="pm_tipo" onchange="toggleCampos(this.value)">
                                <option value="pix"           <?php selected($tipo_v,'pix'); ?>>⚡ PIX</option>
                                <option value="transferencia" <?php selected($tipo_v,'transferencia'); ?>>🏛️ Transferência</option>
                                <option value="ambos"         <?php selected($tipo_v,'ambos'); ?>>🔁 PIX + Transferência</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_nome">Nome da Conta</label></th>
                        <td>
                            <input type="text" name="nome" id="pm_nome" required style="width:100%;"
                                   value="<?php echo esc_attr($nome_v); ?>"
                                   placeholder="Ex: Nubank PIX, InfinitePay, PicPay">
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_banco">Banco</label></th>
                        <td>
                            <input type="text" name="banco" id="pm_banco" style="width:100%;"
                                   value="<?php echo esc_attr($banco_v); ?>"
                                   placeholder="Ex: Nubank, Nu Pagamentos S.A.">
                        </td>
                    </tr>
                    <tr>
                        <th><label for="pm_beneficiario">Beneficiário</label></th>
                        <td>
                            <input type="text" name="beneficiario" id="pm_beneficiario" style="width:100%;"
                                   value="<?php echo esc_attr($benef_v); ?>"
                                   placeholder="55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ">
                        </td>
                    </tr>

                    <!-- Campos PIX -->
                    <tr class="campo-pix">
                        <th><label for="pm_tipo_chave">Tipo da Chave PIX</label></th>
                        <td>
                            <select name="tipo_chave" id="pm_tipo_chave">
                                <option value="cnpj"      <?php selected($tchave_v,'cnpj'); ?>>CNPJ</option>
                                <option value="cpf"       <?php selected($tchave_v,'cpf'); ?>>CPF</option>
                                <option value="email"     <?php selected($tchave_v,'email'); ?>>E-mail</option>
                                <option value="celular"   <?php selected($tchave_v,'celular'); ?>>Celular</option>
                                <option value="aleatoria" <?php selected($tchave_v,'aleatoria'); ?>>Aleatória</option>
                            </select>
                        </td>
                    </tr>
                    <tr class="campo-pix">
                        <th><label for="pm_chave_pix">Chave PIX</label></th>
                        <td>
                            <input type="text" name="chave_pix" id="pm_chave_pix" style="width:100%;"
                                   value="<?php echo esc_attr($chave_v); ?>"
                                   placeholder="55.353.989/0001-09">
                        </td>
                    </tr>

                    <!-- Campos Transferência -->
                    <tr class="campo-transf">
                        <th><label for="pm_codigo_banco">Código do Banco</label></th>
                        <td>
                            <input type="text" name="codigo_banco" id="pm_codigo_banco" style="width:100px;"
                                   value="<?php echo esc_attr($cod_v); ?>" placeholder="0260">
                        </td>
                    </tr>
                    <tr class="campo-transf">
                        <th><label for="pm_agencia">Agência</label></th>
                        <td>
                            <input type="text" name="agencia" id="pm_agencia" style="width:100px;"
                                   value="<?php echo esc_attr($ag_v); ?>" placeholder="0001">
                        </td>
                    </tr>
                    <tr class="campo-transf">
                        <th><label for="pm_conta">Conta</label></th>
                        <td>
                            <input type="text" name="conta" id="pm_conta" style="width:160px;"
                                   value="<?php echo esc_attr($conta_v); ?>" placeholder="787593852-9">
                        </td>
                    </tr>
                    <tr class="campo-transf">
                        <th><label for="pm_cnpj">CNPJ</label></th>
                        <td>
                            <input type="text" name="cnpj" id="pm_cnpj" style="width:200px;"
                                   value="<?php echo esc_attr($cnpj_v); ?>" placeholder="55.353.989/0001-09">
                        </td>
                    </tr>

                    <tr>
                        <th>Conta Principal</th>
                        <td>
                            <label>
                                <input type="checkbox" name="principal" value="1" <?php checked($princ_v, 1); ?>>
                                Usar como conta padrão para este tipo
                            </label>
                            <p class="description">A conta principal é usada automaticamente na geração do texto de pagamento.</p>
                        </td>
                    </tr>
                </table>

                <p>
                    <button type="submit" class="button button-primary">
                        <?php echo $editando ? '💾 Salvar Alterações' : '➕ Cadastrar Conta'; ?>
                    </button>
                    <?php if ($editando): ?>
                        <a href="<?php echo admin_url('admin.php?page=photomusic-contas-bancarias'); ?>" class="button">Cancelar</a>
                    <?php endif; ?>
                </p>
            </form>
        </div>

        <script>
        function toggleCampos(tipo) {
            var isPix   = tipo === 'pix'   || tipo === 'ambos';
            var isTransf= tipo === 'transferencia' || tipo === 'ambos';
            document.querySelectorAll('.campo-pix').forEach(function(el){
                el.style.display = isPix ? '' : 'none';
            });
            document.querySelectorAll('.campo-transf').forEach(function(el){
                el.style.display = isTransf ? '' : 'none';
            });
        }
        toggleCampos(document.getElementById('pm_tipo').value);
        </script>

        <?php
        // ── LISTA ─────────────────────────────────────────────────
        echo '<h2>📋 Contas Cadastradas</h2>';

        if (empty($contas)) {
            echo '<p><em>Nenhuma conta cadastrada ainda.</em></p>';
        } else {
            echo '<table class="widefat striped">';
            echo '<thead><tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Banco</th>
                    <th>Beneficiário</th>
                    <th>Chave PIX / Conta</th>
                    <th>Principal</th>
                    <th>Ações</th>
                  </tr></thead><tbody>';

            foreach ($contas as $c) {
                $detalhe = '';
                if ($c->chave_pix) {
                    $detalhe = PhotoMusic_Contas_Bancarias::label_tipo_chave($c->tipo_chave) . ': ' . $c->chave_pix;
                } elseif ($c->conta) {
                    $detalhe = 'Ag ' . $c->agencia . ' / CC ' . $c->conta;
                }

                $url_editar  = admin_url('admin.php?page=photomusic-contas-bancarias&editar=' . $c->id);
                $url_excluir = wp_nonce_url(
                    admin_url('admin.php?page=photomusic-contas-bancarias&excluir=' . $c->id),
                    'pm_excluir_conta_' . $c->id
                );

                echo '<tr>';
                echo '<td><strong>' . esc_html($c->nome) . '</strong></td>';
                echo '<td>' . esc_html(PhotoMusic_Contas_Bancarias::label_tipo($c->tipo)) . '</td>';
                echo '<td>' . esc_html($c->banco) . '</td>';
                echo '<td>' . esc_html($c->beneficiario) . '</td>';
                echo '<td><code style="font-size:12px;">' . esc_html($detalhe) . '</code></td>';
                echo '<td>' . ($c->principal ? '<span style="color:#2a7a2a;font-weight:600;">⭐ Sim</span>' : '—') . '</td>';
                echo '<td>
                        <a class="button button-small" href="' . esc_url($url_editar) . '">✏️ Editar</a>
                        <a class="button button-small" href="' . esc_url($url_excluir) . '"
                           onclick="return confirm(\'Remover esta conta?\');" style="color:#c00;">🗑️</a>
                      </td>';
                echo '</tr>';
            }

            echo '</tbody></table>';
        }

        echo '</div>'; // .wrap
    }
}
