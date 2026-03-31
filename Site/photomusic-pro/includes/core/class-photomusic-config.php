<?php
// includes/core/class-photomusic-config.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Config {

    public static function init() {
        add_action('admin_init', [__CLASS__, 'register_settings']);
        add_action('admin_post_pm_salvar_config', [__CLASS__, 'salvar']);
        add_action('admin_post_pm_regenerar_api_key', [__CLASS__, 'regenerar_api_key']);
    }

    /* ============================================================
       REGENERA A CHAVE DE API DO CHATBOT
    ============================================================ */
    public static function regenerar_api_key() {

        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_regenerar_api_key');

        $nova_chave = wp_generate_password(32, false);
        update_option('pm_chatbot_api_key', $nova_chave);

        wp_redirect(add_query_arg([
            'page'        => 'photomusic-config',
            'key_renewed' => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       REGISTRA AS CONFIGURAÇÕES
    ============================================================ */
    public static function register_settings() {
        register_setting('pm_config_group', 'photomusic_contrato_page', [
            'type'              => 'integer',
            'sanitize_callback' => 'intval',
            'default'           => 0,
        ]);
    }

    /* ============================================================
       PROCESSA O FORMULÁRIO (admin-post)
    ============================================================ */
    public static function salvar() {

        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_salvar_config');

        $page_id = intval($_POST['photomusic_contrato_page'] ?? 0);
        update_option('photomusic_contrato_page', $page_id);

        // Número sequencial do próximo contrato
        $proximo = intval($_POST['pm_contrato_proximo_numero'] ?? 1);
        if ($proximo > 0) update_option('pm_contrato_proximo_numero', $proximo);

        // Dados da empresa
        $campos_empresa = [
            'nome_fantasia', 'slogan', 'razao_social', 'tipo_empresa',
            'cnpj', 'inscricao_municipal',
            'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
            'celular', 'email',
            'representante_nome', 'representante_cpf', 'representante_rg',
            'logo_url',
        ];
        $dados_empresa = [];
        foreach ($campos_empresa as $campo) {
            $dados_empresa[$campo] = sanitize_text_field($_POST['empresa_' . $campo] ?? '');
        }
        update_option('pm_empresa_dados', $dados_empresa);

        wp_redirect(add_query_arg([
            'page'    => 'photomusic-config',
            'saved'   => 1,
        ], admin_url('admin.php')));
        exit;
    }

    /* ============================================================
       RENDERIZA A PÁGINA DE CONFIGURAÇÕES
    ============================================================ */
    public static function render_page() {

        if (!current_user_can('manage_options')) {
            wp_die('Acesso negado.');
        }

        // ID salvo atualmente
        $pagina_contrato_id  = (int) get_option('photomusic_contrato_page', 0);
        $proximo_num         = (int) get_option('pm_contrato_proximo_numero', 1);
        $empresa             = get_option('pm_empresa_dados', []);

        // Busca todas as páginas publicadas para o select
        $paginas = get_pages(['post_status' => 'publish', 'sort_column' => 'post_title']);

        // Verifica se a página salva existe
        $pagina_salva = $pagina_contrato_id ? get_post($pagina_contrato_id) : null;
        $url_publica  = $pagina_salva ? get_permalink($pagina_salva) : '';
        ?>

        <div class="wrap">
            <h1>Configurações — PhotoMusic Pro</h1>

            <?php if (!empty($_GET['saved'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p><strong>✅ Configurações salvas com sucesso.</strong></p>
                </div>
            <?php endif; ?>

            <?php if (!empty($_GET['key_renewed'])): ?>
                <div class="notice notice-warning is-dismissible">
                    <p>
                        <strong>🔄 Nova chave gerada.</strong>
                        Atualize o <code>PM_API_KEY</code> no arquivo <code>.env</code> do servidor do ChatBot e reinicie o processo.
                    </p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('pm_salvar_config'); ?>
                <input type="hidden" name="action" value="pm_salvar_config">

                <table class="form-table">

                    <!-- ============================================
                         PÁGINA DE ASSINATURA DE CONTRATO
                    ============================================ -->
                    <tr>
                        <th scope="row">
                            <label for="photomusic_contrato_page">
                                Página de Assinatura de Contrato
                            </label>
                        </th>
                        <td>
                            <select name="photomusic_contrato_page"
                                    id="photomusic_contrato_page"
                                    style="min-width: 300px;">

                                <option value="0">— Selecione uma página —</option>

                                <?php foreach ($paginas as $pagina): ?>
                                    <option value="<?php echo esc_attr($pagina->ID); ?>"
                                        <?php selected($pagina_contrato_id, $pagina->ID); ?>>
                                        <?php echo esc_html($pagina->post_title); ?>
                                        (ID: <?php echo esc_html($pagina->ID); ?>)
                                    </option>
                                <?php endforeach; ?>

                            </select>

                            <?php if ($pagina_salva && $url_publica): ?>
                                <p class="description">
                                    ✅ Página configurada:
                                    <a href="<?php echo esc_url($url_publica); ?>" target="_blank">
                                        <?php echo esc_html($url_publica); ?>
                                    </a>
                                </p>
                            <?php else: ?>
                                <p class="description" style="color: #b32d2e;">
                                    ⚠️ Nenhuma página configurada. Os links de contrato vão
                                    retornar erro 404 até isso ser definido.
                                </p>
                            <?php endif; ?>

                            <p class="description">
                                Selecione a página que contém o shortcode
                                <code>[photomusic_contrato]</code>.
                                Todos os links <code>/contrato/{token}/</code>
                                gerados no PDF e no WhatsApp vão redirecionar para ela.
                            </p>
                        </td>
                    </tr>

                </table>

                    <!-- ============================================
                         NUMERAÇÃO DE CONTRATOS
                    ============================================ -->
                    <tr>
                        <th scope="row"><label for="pm_contrato_proximo_numero">Próximo Nº de Contrato</label></th>
                        <td>
                            <input type="number" min="1" id="pm_contrato_proximo_numero"
                                   name="pm_contrato_proximo_numero"
                                   value="<?php echo esc_attr($proximo_num); ?>"
                                   style="width:120px;">
                            <p class="description">O número que será atribuído ao próximo contrato gerado. Use para continuar a numeração existente (ex.: 965).</p>
                        </td>
                    </tr>

                </table>

                <h2>Dados da Empresa (Contratada)</h2>
                <p class="description">Estes dados são inseridos automaticamente no cabeçalho de cada contrato gerado.</p>
                <table class="form-table">

                    <tr>
                        <th><label>Nome Fantasia</label></th>
                        <td><input type="text" name="empresa_nome_fantasia" class="regular-text"
                                   value="<?php echo esc_attr($empresa['nome_fantasia'] ?? ''); ?>">
                            <p class="description">Ex.: PHOTOMUSIC PRODUÇÕES</p></td>
                    </tr>
                    <tr>
                        <th><label>Slogan</label></th>
                        <td><input type="text" name="empresa_slogan" class="regular-text"
                                   value="<?php echo esc_attr($empresa['slogan'] ?? ''); ?>">
                            <p class="description">Ex.: Uma explosão de alegria e sucesso!!!</p></td>
                    </tr>
                    <tr>
                        <th><label>Razão Social</label></th>
                        <td><input type="text" name="empresa_razao_social" class="regular-text"
                                   value="<?php echo esc_attr($empresa['razao_social'] ?? ''); ?>">
                            <p class="description">Ex.: 55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ</p></td>
                    </tr>
                    <tr>
                        <th><label>Tipo de Empresa</label></th>
                        <td><input type="text" name="empresa_tipo_empresa" class="regular-text"
                                   value="<?php echo esc_attr($empresa['tipo_empresa'] ?? ''); ?>">
                            <p class="description">Ex.: MICROEMPREENDEDOR INDIVIDUAL</p></td>
                    </tr>
                    <tr>
                        <th><label>CNPJ</label></th>
                        <td><input type="text" name="empresa_cnpj" class="regular-text"
                                   value="<?php echo esc_attr($empresa['cnpj'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Inscrição Municipal</label></th>
                        <td><input type="text" name="empresa_inscricao_municipal" class="regular-text"
                                   value="<?php echo esc_attr($empresa['inscricao_municipal'] ?? ''); ?>">
                            <p class="description">Ex.: Isento</p></td>
                    </tr>

                    <tr><th colspan="2"><strong>Endereço</strong></th></tr>
                    <tr>
                        <th><label>Logradouro</label></th>
                        <td><input type="text" name="empresa_logradouro" class="regular-text"
                                   value="<?php echo esc_attr($empresa['logradouro'] ?? ''); ?>">
                            <p class="description">Ex.: Avenida Central Everton Xavier</p></td>
                    </tr>
                    <tr>
                        <th><label>Número</label></th>
                        <td><input type="text" name="empresa_numero" style="width:100px;"
                                   value="<?php echo esc_attr($empresa['numero'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Complemento</label></th>
                        <td><input type="text" name="empresa_complemento" class="regular-text"
                                   value="<?php echo esc_attr($empresa['complemento'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Bairro</label></th>
                        <td><input type="text" name="empresa_bairro" class="regular-text"
                                   value="<?php echo esc_attr($empresa['bairro'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Cidade</label></th>
                        <td><input type="text" name="empresa_cidade" class="regular-text"
                                   value="<?php echo esc_attr($empresa['cidade'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>Estado</label></th>
                        <td><input type="text" name="empresa_estado" style="width:80px;"
                                   value="<?php echo esc_attr($empresa['estado'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>CEP</label></th>
                        <td><input type="text" name="empresa_cep" style="width:120px;"
                                   value="<?php echo esc_attr($empresa['cep'] ?? ''); ?>"></td>
                    </tr>

                    <tr><th colspan="2"><strong>Contato</strong></th></tr>
                    <tr>
                        <th><label>Celular</label></th>
                        <td><input type="text" name="empresa_celular" style="width:200px;"
                                   value="<?php echo esc_attr($empresa['celular'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>E-mail</label></th>
                        <td><input type="email" name="empresa_email" class="regular-text"
                                   value="<?php echo esc_attr($empresa['email'] ?? ''); ?>"></td>
                    </tr>

                    <tr><th colspan="2"><strong>Representante Legal</strong></th></tr>
                    <tr>
                        <th><label>Nome</label></th>
                        <td><input type="text" name="empresa_representante_nome" class="regular-text"
                                   value="<?php echo esc_attr($empresa['representante_nome'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>CPF</label></th>
                        <td><input type="text" name="empresa_representante_cpf" style="width:200px;"
                                   value="<?php echo esc_attr($empresa['representante_cpf'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label>RG</label></th>
                        <td><input type="text" name="empresa_representante_rg" style="width:200px;"
                                   value="<?php echo esc_attr($empresa['representante_rg'] ?? ''); ?>"></td>
                    </tr>

                    <tr><th colspan="2"><strong>Logo</strong></th></tr>
                    <tr>
                        <th><label>URL da Logo</label></th>
                        <td>
                            <input type="url" name="empresa_logo_url" class="large-text"
                                   value="<?php echo esc_attr($empresa['logo_url'] ?? ''); ?>">
                            <p class="description">URL completa da imagem (ex.: <?php echo esc_url(content_url('uploads/photomusic/logo.png')); ?>). Aparece no cabeçalho do contrato.</p>
                            <?php if (!empty($empresa['logo_url'])): ?>
                                <br><img src="<?php echo esc_url($empresa['logo_url']); ?>" style="max-height:60px; margin-top:5px; border:1px solid #ccc; padding:4px;" alt="Logo">
                            <?php endif; ?>
                        </td>
                    </tr>

                </table>

                <?php submit_button('Salvar Configurações'); ?>

            </form>

            <!-- ============================================
                 CHAVE DE API DO CHATBOT
            ============================================ -->
            <hr>
            <h2>🤖 Integração ChatBot</h2>
            <p class="description">
                Esta chave é usada pelo ChatBot (Node.js) para autenticar na API WordPress.
                Adicione no arquivo <code>.env</code> do servidor do ChatBot.
            </p>
            <?php
            $api_key = get_option('pm_chatbot_api_key', '');
            if (empty($api_key)) {
                $api_key = wp_generate_password(32, false);
                update_option('pm_chatbot_api_key', $api_key);
            }
            ?>
            <table class="widefat" style="max-width:680px; margin-bottom:20px;">
                <tr>
                    <th style="width:200px;">Variável no <code>.env</code></th>
                    <td><code>PM_API_KEY</code></td>
                </tr>
                <tr>
                    <th>Chave</th>
                    <td>
                        <code id="pm-api-key-value" style="
                            display:inline-block;
                            background:#f0f0f1;
                            padding:6px 12px;
                            border-radius:4px;
                            font-size:14px;
                            letter-spacing:1px;
                            user-select:all;
                        "><?php echo esc_html($api_key); ?></code>
                        &nbsp;
                        <button type="button" class="button"
                            onclick="navigator.clipboard.writeText('<?php echo esc_js($api_key); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{ this.textContent='📋 Copiar'; },2000); }.bind(this))">
                            📋 Copiar
                        </button>
                    </td>
                </tr>
                <tr>
                    <th>Linha completa para o <code>.env</code></th>
                    <td>
                        <code id="pm-env-line">PM_API_KEY=<?php echo esc_html($api_key); ?></code>
                        &nbsp;
                        <button type="button" class="button"
                            onclick="navigator.clipboard.writeText('PM_API_KEY=<?php echo esc_js($api_key); ?>').then(function(){ this.textContent='✅ Copiado!'; setTimeout(()=>{ this.textContent='📋 Copiar linha'; },2000); }.bind(this))">
                            📋 Copiar linha
                        </button>
                    </td>
                </tr>
                <tr>
                    <th>Endpoint ChatBot</th>
                    <td>
                        <code><?php echo esc_html(home_url('/wp-json/photomusic/v1/eventos-chatbot')); ?></code>
                    </td>
                </tr>
            </table>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                <?php wp_nonce_field('pm_regenerar_api_key'); ?>
                <input type="hidden" name="action" value="pm_regenerar_api_key">
                <button type="submit" class="button button-secondary"
                    onclick="return confirm('Atenção: ao regenerar a chave, o ChatBot vai parar de funcionar até você atualizar o .env no servidor. Deseja continuar?')">
                    🔄 Regenerar chave
                </button>
                <p class="description" style="margin-top:6px;">
                    Use somente se a chave atual for comprometida. Lembre de atualizar o <code>.env</code> no servidor do ChatBot e reiniciá-lo.
                </p>
            </form>

            <!-- ============================================
                 INFORMAÇÃO EXTRA: ID ATUAL
            ============================================ -->
            <?php if ($pagina_contrato_id > 0): ?>
                <hr>
                <h3>Informação técnica</h3>
                <table class="widefat" style="max-width: 500px;">
                    <tr>
                        <th>Opção no banco</th>
                        <td><code>photomusic_contrato_page</code></td>
                    </tr>
                    <tr>
                        <th>ID salvo</th>
                        <td><strong><?php echo esc_html($pagina_contrato_id); ?></strong></td>
                    </tr>
                    <tr>
                        <th>Título da página</th>
                        <td><?php echo $pagina_salva ? esc_html($pagina_salva->post_title) : '<em style="color:#b32d2e;">Página não encontrada</em>'; ?></td>
                    </tr>
                    <tr>
                        <th>URL pública</th>
                        <td>
                            <?php if ($url_publica): ?>
                                <a href="<?php echo esc_url($url_publica); ?>" target="_blank">
                                    <?php echo esc_html($url_publica); ?>
                                </a>
                            <?php else: ?>
                                <em style="color:#b32d2e;">URL não disponível</em>
                            <?php endif; ?>
                        </td>
                    </tr>
                </table>
            <?php endif; ?>

        </div>

        <?php
    }
}