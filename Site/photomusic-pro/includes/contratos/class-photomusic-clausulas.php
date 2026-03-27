<?php
// includes/contratos/class-photomusic-clausulas.php

if (!defined('ABSPATH')) {
    exit;
}

class PhotoMusic_Clausulas
{
    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_init', [__CLASS__, 'handle_form_submit']);
    }

    public static function register_menu()
    {
        if (!PhotoMusic_Users::is_admin()) {
            return;
        }

        add_submenu_page(
            'photomusic-eventos',
            'Contratos - Cláusulas',
            'Cláusulas',
            'pm_gerenciar_usuarios',
            'photomusic-clausulas',
            [__CLASS__, 'render_page']
        );
    }

    protected static function get_table()
    {
        global $wpdb;
        return $wpdb->prefix . 'pm_clausulas';
    }

    public static function get_clausulas($args = [])
    {
        global $wpdb;
        $table = self::get_table();

        $where  = 'WHERE 1=1';
        $params = [];

        if (!empty($args['tipo'])) {
            $where   .= ' AND tipo = %s';
            $params[] = $args['tipo'];
        }

        if (!empty($args['categoria'])) {
            $where   .= ' AND categoria = %s';
            $params[] = $args['categoria'];
        }

        if (isset($args['ativo']) && $args['ativo'] !== '') {
            $where   .= ' AND ativo = %d';
            $params[] = intval($args['ativo']);
        }

        $sql = "SELECT * FROM $table $where ORDER BY ordem ASC, id DESC";

        if (!empty($params)) {
            return $wpdb->get_results($wpdb->prepare($sql, $params));
        }

        return $wpdb->get_results($sql);
    }

    public static function get_clausula($id)
    {
        global $wpdb;
        $table = self::get_table();

        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM $table WHERE id = %d", intval($id))
        );
    }

    public static function save_clausula($data)
    {
        global $wpdb;
        $table = self::get_table();

        $id = isset($data['id']) ? intval($data['id']) : 0;

        $fields = [
            'titulo'     => sanitize_text_field($data['titulo'] ?? ''),
            'tipo'       => sanitize_text_field($data['tipo'] ?? 'geral'),
            'categoria'  => sanitize_text_field($data['categoria'] ?? 'ambos'),
            'tags'       => sanitize_text_field($data['tags'] ?? ''),
            'texto'      => wp_kses_post($data['texto'] ?? ''),
            'ordem'      => intval($data['ordem'] ?? 0),
            'ativo'      => isset($data['ativo']) ? 1 : 0,
            'updated_at' => current_time('mysql'),
        ];

        if ($id > 0) {
            $wpdb->update($table, $fields, ['id' => $id]);
            return $id;
        }

        $fields['created_at'] = current_time('mysql');
        $wpdb->insert($table, $fields);
        return $wpdb->insert_id;
    }

    public static function deactivate_clausula($id)
    {
        global $wpdb;
        $table = self::get_table();

        return $wpdb->update(
            $table,
            ['ativo' => 0, 'updated_at' => current_time('mysql')],
            ['id' => intval($id)]
        );
    }

    public static function handle_form_submit()
    {
        if (empty($_POST['pm_clausula_action'])) {
            return;
        }

        if (!current_user_can('pm_gerenciar_usuarios')) {
            return;
        }

        if (empty($_POST['pm_clausula_nonce']) ||
            !wp_verify_nonce($_POST['pm_clausula_nonce'], 'pm_clausula_form')) {
            return;
        }

        $action = sanitize_text_field($_POST['pm_clausula_action']);

        if ($action === 'save') {
            $data = [
                'id'        => $_POST['id'] ?? 0,
                'titulo'    => $_POST['titulo'] ?? '',
                'tipo'      => $_POST['tipo'] ?? 'geral',
                'categoria' => $_POST['categoria'] ?? 'ambos',
                'tags'      => $_POST['tags'] ?? '',
                'texto'     => $_POST['texto'] ?? '',
                'ordem'     => $_POST['ordem'] ?? 0,
                'ativo'     => isset($_POST['ativo']) ? 1 : 0,
            ];

            $id = self::save_clausula($data);

            PhotoMusic_Logs::add(
                'clausula_save',
                null,
                null,
                $id,
                'Cláusula salva/atualizada pelo painel.'
            );

            // ← CORRIGIDO: sem 'edit' => $id para limpar o formulário após salvar
            wp_redirect(add_query_arg([
                'page'  => 'photomusic-clausulas',
                'saved' => 1,
            ], admin_url('admin.php')));
            exit;
        }

        if ($action === 'deactivate' && !empty($_POST['id'])) {
            $id = intval($_POST['id']);
            self::deactivate_clausula($id);

            PhotoMusic_Logs::add(
                'clausula_deactivate',
                null,
                null,
                $id,
                'Cláusula desativada pelo painel.'
            );

            wp_redirect(add_query_arg([
                'page'    => 'photomusic-clausulas',
                'updated' => 1,
            ], admin_url('admin.php')));
            exit;
        }
    }

    public static function render_page()
    {
        if (!current_user_can('pm_gerenciar_usuarios')) {
            wp_die('Acesso negado.');
        }

        $editing_id = isset($_GET['edit']) ? intval($_GET['edit']) : 0;
        $editing    = $editing_id ? self::get_clausula($editing_id) : null;

        $tipos = [
            'geral'            => 'Geral',
            'pagamento'        => 'Pagamento',
            'servico'          => 'Serviço',
            'responsabilidade' => 'Responsabilidade',
            'cancelamento'     => 'Cancelamento',
            'direitos_imagem'  => 'Direitos de Imagem',
            'logistica'        => 'Logística',
        ];

        $categorias = [
            'pf'    => 'Pessoa Física',
            'pj'    => 'Pessoa Jurídica',
            'ambos' => 'Ambos',
        ];

        $clausulas = self::get_clausulas();
        ?>
        <div class="wrap">
            <h1>Contratos — Cláusulas</h1>

            <?php if (!empty($_GET['saved'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>✅ Cláusula salva com sucesso.</p>
                </div>
            <?php endif; ?>

            <?php if (!empty($_GET['updated'])): ?>
                <div class="notice notice-success is-dismissible">
                    <p>✅ Cláusula atualizada.</p>
                </div>
            <?php endif; ?>

            <div style="display:flex; gap:30px; align-items:flex-start;">

                <!-- FORMULÁRIO -->
                <div style="flex:1;">
                    <h2><?php echo $editing ? 'Editar Cláusula' : 'Nova Cláusula'; ?></h2>

                    <form method="post">
                        <?php wp_nonce_field('pm_clausula_form', 'pm_clausula_nonce'); ?>
                        <input type="hidden" name="pm_clausula_action" value="save">
                        <input type="hidden" name="id" value="<?php echo esc_attr($editing->id ?? 0); ?>">

                        <table class="form-table">

                            <!-- 1. TÍTULO -->
                            <tr>
                                <th><label for="titulo">Título</label></th>
                                <td>
                                    <input type="text" name="titulo" id="titulo" class="regular-text"
                                           value="<?php echo esc_attr($editing->titulo ?? ''); ?>" required>
                                </td>
                            </tr>

                            <!-- 2. ORDEM -->
                            <tr>
                                <th><label for="ordem">Ordem</label></th>
                                <td>
                                    <input type="number" name="ordem" id="ordem" class="small-text"
                                           value="<?php echo esc_attr($editing->ordem ?? 0); ?>">
                                    <p class="description">Define a ordem em que a cláusula aparece no contrato.</p>
                                </td>
                            </tr>

                            <!-- 3. TIPO -->
                            <tr>
                                <th><label for="tipo">Tipo</label></th>
                                <td>
                                    <select name="tipo" id="tipo">
                                        <?php foreach ($tipos as $k => $v): ?>
                                            <option value="<?php echo esc_attr($k); ?>"
                                                <?php selected($editing->tipo ?? 'geral', $k); ?>>
                                                <?php echo esc_html($v); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>

                            <!-- 4. CATEGORIA -->
                            <tr>
                                <th><label for="categoria">Categoria</label></th>
                                <td>
                                    <select name="categoria" id="categoria">
                                        <?php foreach ($categorias as $k => $v): ?>
                                            <option value="<?php echo esc_attr($k); ?>"
                                                <?php selected($editing->categoria ?? 'ambos', $k); ?>>
                                                <?php echo esc_html($v); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>

                            <!-- 5. TAGS -->
                            <tr>
                                <th><label for="tags">Tags (serviços, contexto)</label></th>
                                <td>
                                    <input type="text" name="tags" id="tags" class="regular-text"
                                           placeholder="Ex: foto-cabine, som-dj, corporativo"
                                           value="<?php echo esc_attr($editing->tags ?? ''); ?>">
                                    <p class="description">
                                        Use vírgulas para separar. Ex: aniversario, foto-cabine, casamento.
                                    </p>
                                </td>
                            </tr>

                            <!-- 6. TEXTO -->
                            <tr>
                                <th><label for="texto">Texto da Cláusula</label></th>
                                <td>
                                    <?php
                                    wp_editor($editing->texto ?? '', 'texto', [
                                        'textarea_name' => 'texto',
                                        'textarea_rows' => 12,
                                        'media_buttons' => false,
                                    ]);
                                    ?>
                                    <p class="description">
                                        Variáveis disponíveis: {nome_cliente}, {documento_cliente},
                                        {data_evento}, {local_evento}, {lista_servicos}, {valor_total_final},
                                        {horario_inicio}, {horario_fim}.
                                    </p>
                                </td>
                            </tr>

                            <!-- 7. ATIVA -->
                            <tr>
                                <th><label for="ativo">Ativa</label></th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="ativo" id="ativo"
                                            <?php checked($editing->ativo ?? 1, 1); ?>>
                                        Cláusula ativa
                                    </label>
                                </td>
                            </tr>

                        </table>

                        <?php submit_button($editing ? 'Salvar Alterações' : 'Criar Cláusula'); ?>

                        <?php if ($editing): ?>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=photomusic-clausulas')); ?>"
                               class="button">Nova Cláusula</a>
                        <?php endif; ?>

                    </form>
                </div>

                <!-- LISTAGEM -->
                <div style="flex:1;">
                    <h2>Cláusulas Cadastradas</h2>

                    <?php if (empty($clausulas)): ?>
                        <p>Nenhuma cláusula cadastrada ainda.</p>
                    <?php else: ?>
                        <table class="widefat striped">
                            <thead>
                            <tr>
                                <th>Ord</th>
                                <th>Título</th>
                                <th>Tipo</th>
                                <th>Categoria</th>
                                <th>Tags</th>
                                <th>Ativa</th>
                                <th>Ações</th>
                            </tr>
                            </thead>
                            <tbody>
                            <?php foreach ($clausulas as $c): ?>
                                <tr>
                                    <td><?php echo esc_html($c->ordem); ?></td>
                                    <td><strong><?php echo esc_html($c->titulo); ?></strong></td>
                                    <td><?php echo esc_html($tipos[$c->tipo] ?? $c->tipo); ?></td>
                                    <td><?php echo esc_html($categorias[$c->categoria] ?? $c->categoria); ?></td>
                                    <td style="font-size:11px;"><?php echo esc_html($c->tags); ?></td>
                                    <td><?php echo $c->ativo ? '✅' : '❌'; ?></td>
                                    <td>
                                        <a href="<?php echo esc_url(add_query_arg([
                                            'page' => 'photomusic-clausulas',
                                            'edit' => $c->id,
                                        ], admin_url('admin.php'))); ?>">Editar</a>

                                        <?php if ($c->ativo): ?>
                                            |
                                            <form method="post" style="display:inline;"
                                                  onsubmit="return confirm('Desativar esta cláusula?');">
                                                <?php wp_nonce_field('pm_clausula_form', 'pm_clausula_nonce'); ?>
                                                <input type="hidden" name="pm_clausula_action" value="deactivate">
                                                <input type="hidden" name="id" value="<?php echo esc_attr($c->id); ?>">
                                                <button type="submit" class="link-button" style="color:#a00;">
                                                    Desativar
                                                </button>
                                            </form>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </div>

            </div>
        </div>

        <style>
            .link-button {
                background: none;
                border: none;
                padding: 0;
                margin: 0;
                cursor: pointer;
                font-size: inherit;
            }
        </style>
        <?php
    }

    /* ============================================================
       GERA O HTML DO CONTRATO COM BASE NAS CLÁUSULAS E VARIÁVEIS
    ============================================================ */
    public static function gerar_contrato_html($evento, $contratante, $servicos, $financeiro)
    {
        $html = '';

        $tags = [];
        if (!empty($evento['tipo'])) {
            $tags[] = sanitize_title($evento['tipo']);
        }
        foreach ($servicos as $s) {
            if (!empty($s['slug']))    $tags[] = sanitize_title($s['slug']);
            if (!empty($s['subtipo'])) $tags[] = sanitize_title($s['subtipo']);
            if (!empty($s['pacote']))  $tags[] = sanitize_title($s['pacote']);
        }

        $categoria_contratante = $contratante['categoria'] ?? 'pf';
        $clausulas = self::buscar_por_tags($tags, $categoria_contratante);

        usort($clausulas, function ($a, $b) {
            return $a->ordem <=> $b->ordem;
        });

        $vars = [
            '{nome_cliente}'      => esc_html($contratante['nome'] ?? ''),
            '{documento_cliente}' => esc_html($contratante['documento'] ?? ''),
            '{email_cliente}'     => esc_html($contratante['email'] ?? ''),
            '{telefone_cliente}'  => esc_html($contratante['telefone'] ?? ''),
            '{endereco_cliente}'  => esc_html($contratante['endereco'] ?? ''),
            '{data_evento}'       => esc_html($evento['data'] ?? ''),
            '{horario_inicio}'    => esc_html($evento['horario_inicio'] ?? ''),
            '{horario_fim}'       => esc_html($evento['horario_fim'] ?? ''),
            '{local_evento}'      => esc_html($evento['local'] ?? ''),
            '{horas_evento}'      => esc_html($evento['horas'] ?? ''),
            '{contato_salao}'     => esc_html($evento['contato_salao'] ?? ''),
            '{contato_cerimonialista}' => esc_html($evento['contato_cerimonialista'] ?? ''),
            '{valor_total_final}' => isset($financeiro['valor_total_final'])
                ? 'R$ ' . number_format($financeiro['valor_total_final'], 2, ',', '.')
                : 'R$ 0,00',
        ];

        $lista_servicos_html = '';
        foreach ($servicos as $index => $s) {
            $id   = $index + 1;
            $nome = $s['nome'] ?? '';

            $vars["{servico_{$id}_nome}"]    = esc_html($nome);
            $vars["{servico_{$id}_horas}"]   = esc_html($s['horas_contratadas'] ?? '');
            $vars["{servico_{$id}_preco}"]   = isset($s['preco_total'])
                ? 'R$ ' . number_format($s['preco_total'], 2, ',', '.') : 'R$ 0,00';

            $linha = '<p><strong>' . esc_html($nome) . '</strong>';
            if (!empty($s['subtipo'])) $linha .= ' — ' . esc_html($s['subtipo']);
            if (!empty($s['pacote']))  $linha .= ' — Pacote ' . esc_html($s['pacote']);
            if (!empty($s['horas_contratadas'])) $linha .= ' — ' . esc_html($s['horas_contratadas']) . ' horas';
            $linha .= '</p>';

            $lista_servicos_html .= $linha;
        }
        $vars['{lista_servicos}'] = $lista_servicos_html;

        foreach ($clausulas as $c) {

            // 1. Substituir variáveis
            $texto = str_replace(array_keys($vars), array_values($vars), $c->texto);

            // 2. Processar blocos condicionais {if:tag}...{/if:tag}
            $texto = self::processar_condicionais($texto, $tags);

            // 3. Remover <br> iniciais que sobram após o título da cláusula
            $texto = preg_replace('/^(\s*<br\s*\/?>\s*)+/i', '', $texto);

            // 4. Limpar linhas em branco extras
            $texto = preg_replace("/\n{3,}/", "\n\n", trim($texto));

            $html .= '<h3>' . esc_html($c->titulo) . "</h3>\n" . $texto . "\n";
        }

        return "<div class='contrato-gerado'>{$html}</div>";
    }

    /* ============================================================
       PROCESSA BLOCOS CONDICIONAIS NO TEXTO DA CLÁUSULA

       SINTAXE DISPONÍVEL:

       1. Bloco condicional simples:
          {if:foto-cabine}
            texto só para foto cabine
          {/if:foto-cabine}

       2. Bloco condicional com múltiplas tags (OU):
          {if:foto-cabine|totem}
            texto para cabine OU totem
          {/if:foto-cabine|totem}

       3. Bloco negativo (aparece quando NÃO tem a tag):
          {ifnot:som-dj}
            texto para quem NÃO contratou som
          {/ifnot:som-dj}

       As tags são as mesmas do campo Tags da cláusula.
       Ex: foto-cabine-premium, totem-gold, plataforma-360, som-dj
    ============================================================ */
    public static function processar_condicionais($texto, $tags_ativas = [])
    {
        $tags_ativas = array_map('trim', (array) $tags_ativas);

        // {if:tag1|tag2}...{/if:tag1|tag2}
        // Exibe se PELO MENOS UMA tag estiver ativa
        $texto = preg_replace_callback(
            '/\{if:([^}]+)\}(.*?)\{\/if:[^}]+\}/s',
            function ($m) use ($tags_ativas) {
                $condicoes = array_map('trim', explode('|', $m[1]));
                foreach ($condicoes as $cond) {
                    if (in_array($cond, $tags_ativas, true)) {
                        return $m[2]; // exibe o bloco
                    }
                }
                return ''; // remove o bloco
            },
            $texto
        );

        // {ifnot:tag1|tag2}...{/ifnot:tag1|tag2}
        // Exibe se NENHUMA das tags estiver ativa
        $texto = preg_replace_callback(
            '/\{ifnot:([^}]+)\}(.*?)\{\/ifnot:[^}]+\}/s',
            function ($m) use ($tags_ativas) {
                $condicoes = array_map('trim', explode('|', $m[1]));
                foreach ($condicoes as $cond) {
                    if (in_array($cond, $tags_ativas, true)) {
                        return ''; // remove o bloco
                    }
                }
                return $m[2]; // exibe o bloco
            },
            $texto
        );

        return $texto;
    }

    /* ============================================================
       BUSCA CLÁUSULAS POR TAGS E CATEGORIA
    ============================================================ */
    public static function buscar_por_tags($tags = [], $categoria = 'pf')
    {
        global $wpdb;

        $tabela = self::get_table();

        if (!is_array($tags)) {
            $tags = [$tags];
        }

        $tags = array_filter(array_map('sanitize_title', $tags));

        $condicoes_tags = [];
        foreach ($tags as $tag) {
            $condicoes_tags[] = $wpdb->prepare("FIND_IN_SET(%s, tags)", $tag);
        }

        $where_tags = count($condicoes_tags) > 0
            ? '(' . implode(' OR ', $condicoes_tags) . ')'
            : '1=1';

        $where_categoria = $wpdb->prepare(
            "(categoria = %s OR categoria = 'ambos')",
            $categoria
        );

        $query = "
            SELECT *
            FROM {$tabela}
            WHERE ativo = 1
            AND {$where_categoria}
            AND {$where_tags}
            ORDER BY ordem ASC, id DESC
        ";

        return $wpdb->get_results($query);
    }
}