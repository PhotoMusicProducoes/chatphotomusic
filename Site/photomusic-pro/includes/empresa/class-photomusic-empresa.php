<?php
// includes/empresa/class-photomusic-empresa.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Empresa {

    const OPTION_KEY = 'photomusic_empresa_dados';

    /* ============================================================
       INICIALIZA O PAINEL
    ============================================================ */
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_pm_salvar_empresa', [__CLASS__, 'salvar']);
    }

    /* ============================================================
       ADICIONA MENU NO ADMIN
    ============================================================ */
    public static function menu() {
        add_submenu_page(
            'photomusic-eventos',
            'Dados da Empresa',
            'Dados da Empresa',
            'pm_gerenciar_usuarios',
            'photomusic_empresa',
            [__CLASS__, 'render_page']
        );
    }

    /* ============================================================
       SALVA OS DADOS
    ============================================================ */
    public static function salvar() {

        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Sem permissão.');
        }

        check_admin_referer('pm_salvar_empresa', 'pm_empresa_nonce');

        $p = $_POST[self::OPTION_KEY] ?? [];

        // Preserva o campo 'endereco' legado se os novos campos de endereço estiverem vazios
        $dados_antigos = self::get();

        $dados = [
            // Identificação
            'nome_fantasia'         => sanitize_text_field($p['nome_fantasia']         ?? ''),
            'slogan'                => sanitize_text_field($p['slogan']                ?? ''),
            'razao_social'          => sanitize_text_field($p['razao_social']          ?? ''),
            'tipo_empresa'          => sanitize_text_field($p['tipo_empresa']          ?? ''),
            'cnpj'                  => sanitize_text_field($p['cnpj']                  ?? ''),
            'ie'                    => sanitize_text_field($p['ie']                    ?? ''),
            // Endereço
            'logradouro'            => sanitize_text_field($p['logradouro']            ?? ''),
            'numero'                => sanitize_text_field($p['numero']                ?? ''),
            'complemento'           => sanitize_text_field($p['complemento']           ?? ''),
            'bairro'                => sanitize_text_field($p['bairro']                ?? ''),
            'cidade'                => sanitize_text_field($p['cidade']                ?? ''),
            'estado'                => sanitize_text_field($p['estado']                ?? ''),
            'cep'                   => sanitize_text_field($p['cep']                   ?? ''),
            // Contato
            'celular'               => sanitize_text_field($p['celular']               ?? ''),
            'telefone'              => sanitize_text_field($p['telefone']              ?? ''),
            'email'                 => sanitize_email($p['email']                      ?? ''),
            'site'                  => esc_url_raw($p['site']                          ?? ''),
            // Representante Legal
            'representante_nome'    => sanitize_text_field($p['representante_nome']    ?? ''),
            'representante_cpf'     => sanitize_text_field($p['representante_cpf']     ?? ''),
            'representante_rg'      => sanitize_text_field($p['representante_rg']      ?? ''),
            // Campo legado — preserva endereco completo se logradouro não foi preenchido
            'endereco'              => !empty($p['logradouro'])
                                        ? ''
                                        : sanitize_textarea_field($dados_antigos['endereco'] ?? ''),
            // Logo
            'logo'                  => esc_url_raw($p['logo']                          ?? ''),
            // Numeração de contratos
            'proximo_numero'        => intval($p['proximo_numero']                     ?? 1),
        ];

        update_option(self::OPTION_KEY, $dados);

        // Salva o próximo número de contrato separadamente (compatibilidade com código existente)
        if (!empty($dados['proximo_numero'])) {
            update_option('pm_contrato_proximo_numero', $dados['proximo_numero']);
        }

        wp_redirect(admin_url('admin.php?page=photomusic_empresa&saved=1'));
        exit;
    }

    /* ============================================================
       OBTÉM OS DADOS DA EMPRESA
    ============================================================ */
    public static function get() {
        return get_option(self::OPTION_KEY, []);
    }

    /* ============================================================
       MONTA ENDEREÇO FORMATADO PARA O CONTRATO
    ============================================================ */
    public static function get_endereco_contrato() {
        $d = self::get();
        $partes = array_filter([
            !empty($d['logradouro']) ? $d['logradouro'] : ($d['endereco'] ?? ''),
            !empty($d['numero'])     ? 'nº ' . $d['numero']         : null,
            $d['complemento']        ?? null,
            !empty($d['bairro'])     ? 'bairro: ' . $d['bairro']    : null,
            !empty($d['cidade'])     ? 'cidade: ' . $d['cidade']    : null,
            !empty($d['estado'])     ? 'estado: ' . $d['estado']    : null,
            !empty($d['cep'])        ? 'CEP: '    . $d['cep']       : null,
        ]);
        return implode(', ', $partes);
    }

    /* ============================================================
       RENDERIZA A PÁGINA DO PAINEL
    ============================================================ */
    public static function render_page() {

        $dados = self::get();
        $k     = self::OPTION_KEY;
        $proximo = intval(get_option('pm_contrato_proximo_numero', 1));
        ?>

        <div class="wrap">
            <h1>Dados da Empresa</h1>

            <?php if (isset($_GET['saved'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>✅ Dados da empresa salvos com sucesso!</p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('pm_salvar_empresa', 'pm_empresa_nonce'); ?>
                <input type="hidden" name="action" value="pm_salvar_empresa">

                <h2>Identificação</h2>
                <table class="form-table">

                    <tr>
                        <th><label>Nome Fantasia</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[nome_fantasia]"
                                   value="<?php echo esc_attr($dados['nome_fantasia'] ?? ''); ?>"
                                   class="regular-text" placeholder="PHOTOMUSIC PRODUÇÕES"></td>
                    </tr>

                    <tr>
                        <th><label>Slogan</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[slogan]"
                                   value="<?php echo esc_attr($dados['slogan'] ?? ''); ?>"
                                   class="regular-text" placeholder="Uma explosão de alegria e sucesso!!!"></td>
                    </tr>

                    <tr>
                        <th><label>Razão Social</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[razao_social]"
                                   value="<?php echo esc_attr($dados['razao_social'] ?? ''); ?>"
                                   class="regular-text" placeholder="55.353.989 MARIO AUGUSTO NAZEANZE DA CRUZ"></td>
                    </tr>

                    <tr>
                        <th><label>Tipo de Empresa</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[tipo_empresa]"
                                   value="<?php echo esc_attr($dados['tipo_empresa'] ?? ''); ?>"
                                   class="regular-text" placeholder="MICROEMPREENDEDOR INDIVIDUAL"></td>
                    </tr>

                    <tr>
                        <th><label>CNPJ</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[cnpj]"
                                   value="<?php echo esc_attr($dados['cnpj'] ?? ''); ?>"
                                   class="regular-text" placeholder="55.353.989/0001-09"></td>
                    </tr>

                    <tr>
                        <th><label>Inscrição Municipal</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[ie]"
                                   value="<?php echo esc_attr($dados['ie'] ?? ''); ?>"
                                   class="regular-text" placeholder="Isento"></td>
                    </tr>

                </table>

                <h2>Endereço</h2>
                <table class="form-table">

                    <tr>
                        <th><label>Logradouro</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[logradouro]"
                                   value="<?php echo esc_attr($dados['logradouro'] ?? ''); ?>"
                                   class="regular-text" placeholder="Avenida Central Everton Xavier"></td>
                    </tr>

                    <tr>
                        <th><label>Número</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[numero]"
                                   value="<?php echo esc_attr($dados['numero'] ?? ''); ?>"
                                   class="regular-text" placeholder="8.000"></td>
                    </tr>

                    <tr>
                        <th><label>Complemento</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[complemento]"
                                   value="<?php echo esc_attr($dados['complemento'] ?? ''); ?>"
                                   class="regular-text" placeholder="Casa 04"></td>
                    </tr>

                    <tr>
                        <th><label>Bairro</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[bairro]"
                                   value="<?php echo esc_attr($dados['bairro'] ?? ''); ?>"
                                   class="regular-text" placeholder="Várzea das Moças"></td>
                    </tr>

                    <tr>
                        <th><label>Cidade</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[cidade]"
                                   value="<?php echo esc_attr($dados['cidade'] ?? ''); ?>"
                                   class="regular-text" placeholder="Niterói"></td>
                    </tr>

                    <tr>
                        <th><label>Estado</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[estado]"
                                   value="<?php echo esc_attr($dados['estado'] ?? ''); ?>"
                                   class="regular-text" placeholder="RJ" style="width:60px;"></td>
                    </tr>

                    <tr>
                        <th><label>CEP</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[cep]"
                                   value="<?php echo esc_attr($dados['cep'] ?? ''); ?>"
                                   class="regular-text" placeholder="24330-285"></td>
                    </tr>

                </table>

                <h2>Contato</h2>
                <table class="form-table">

                    <tr>
                        <th><label>Celular</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[celular]"
                                   value="<?php echo esc_attr($dados['celular'] ?? ''); ?>"
                                   class="regular-text" placeholder="(21) 96442-8172"></td>
                    </tr>

                    <tr>
                        <th><label>Telefone Fixo</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[telefone]"
                                   value="<?php echo esc_attr($dados['telefone'] ?? ''); ?>"
                                   class="regular-text"></td>
                    </tr>

                    <tr>
                        <th><label>E-mail</label></th>
                        <td><input type="email" name="<?php echo $k; ?>[email]"
                                   value="<?php echo esc_attr($dados['email'] ?? ''); ?>"
                                   class="regular-text" placeholder="contato@photomusic.com.br"></td>
                    </tr>

                    <tr>
                        <th><label>Site</label></th>
                        <td><input type="url" name="<?php echo $k; ?>[site]"
                                   value="<?php echo esc_attr($dados['site'] ?? ''); ?>"
                                   class="regular-text" placeholder="https://photomusic.com.br/"></td>
                    </tr>

                </table>

                <h2>Representante Legal</h2>
                <table class="form-table">

                    <tr>
                        <th><label>Nome Completo</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[representante_nome]"
                                   value="<?php echo esc_attr($dados['representante_nome'] ?? ''); ?>"
                                   class="regular-text" placeholder="Mario Augusto Nazeanze da Cruz"></td>
                    </tr>

                    <tr>
                        <th><label>CPF</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[representante_cpf]"
                                   value="<?php echo esc_attr($dados['representante_cpf'] ?? ''); ?>"
                                   class="regular-text" placeholder="912.571.159-87"></td>
                    </tr>

                    <tr>
                        <th><label>RG</label></th>
                        <td><input type="text" name="<?php echo $k; ?>[representante_rg]"
                                   value="<?php echo esc_attr($dados['representante_rg'] ?? ''); ?>"
                                   class="regular-text" placeholder="555167-1 MB"></td>
                    </tr>

                </table>

                <h2>Logo e Numeração</h2>
                <table class="form-table">

                    <tr>
                        <th><label>Logo da Empresa (URL)</label></th>
                        <td>
                            <input type="url" name="<?php echo $k; ?>[logo]"
                                   value="<?php echo esc_attr($dados['logo'] ?? ''); ?>"
                                   class="regular-text">
                            <p class="description">
                                Caminho padrão do plugin:<br>
                                <code><?php echo esc_html(plugins_url('assets/logo.png', PHOTOMUSIC_PRO_PATH . 'photomusic-pro.php')); ?></code>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th><label>Próximo Nº de Contrato</label></th>
                        <td>
                            <input type="number" name="<?php echo $k; ?>[proximo_numero]"
                                   value="<?php echo esc_attr($proximo); ?>"
                                   class="small-text" min="1">
                            <p class="description">O próximo contrato gerado receberá este número.</p>
                        </td>
                    </tr>

                </table>

                <?php submit_button('Salvar Dados da Empresa'); ?>

            </form>
        </div>

        <?php
    }
}
