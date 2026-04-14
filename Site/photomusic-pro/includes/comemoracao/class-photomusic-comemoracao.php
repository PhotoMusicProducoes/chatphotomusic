<?php
// includes/comemoracao/class-photomusic-comemoracao.php

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Class PhotoMusic_Comemoracao
 *
 * Gerencia contatos para envio de mensagens comemorativas (aniversários,
 * casamentos, 15 anos, bodas) via WhatsApp/Bot.
 */
class PhotoMusic_Comemoracao {

    /** @var string Nome completo da tabela no banco */
    private static function table() {
        global $wpdb;
        return $wpdb->prefix . 'pm_comemoracao_contatos';
    }

    /* ============================================================
       INICIALIZAÇÃO
    ============================================================ */

    public static function init() {
        add_action( 'admin_menu',                       [ __CLASS__, 'register_menu' ] );
        add_action( 'admin_post_pm_salvar_comem',       [ __CLASS__, 'handle_salvar' ] );
        add_action( 'admin_post_pm_excluir_comem',      [ __CLASS__, 'handle_excluir' ] );
        add_action( 'rest_api_init',                    [ __CLASS__, 'register_rest' ] );
    }

    /* ============================================================
       CRUD
    ============================================================ */

    /**
     * Retorna todos os registros com filtros opcionais.
     *
     * @param array $filters  Chaves aceitas: mes (int), ativo (0|1), origem (string)
     * @return array
     */
    public static function get_all( $filters = [] ) {
        global $wpdb;
        $table = self::table();

        $where  = [];
        $values = [];

        if ( isset( $filters['mes'] ) && $filters['mes'] !== '' ) {
            $where[]  = 'mes = %d';
            $values[] = absint( $filters['mes'] );
        }

        if ( isset( $filters['ativo'] ) && $filters['ativo'] !== '' ) {
            $where[]  = 'ativo = %d';
            $values[] = absint( $filters['ativo'] );
        }

        if ( ! empty( $filters['origem'] ) ) {
            $where[]  = 'origem = %s';
            $values[] = sanitize_text_field( $filters['origem'] );
        }

        if ( ! empty( $filters['tipo'] ) ) {
            $where[]  = 'tipo = %s';
            $values[] = sanitize_text_field( $filters['tipo'] );
        }

        $sql = "SELECT * FROM {$table}";

        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }

        $sql .= ' ORDER BY mes ASC, dia ASC, id DESC';

        // Paginação
        $per_page = isset( $filters['per_page'] ) ? absint( $filters['per_page'] ) : 20;
        $page     = isset( $filters['page'] )     ? max( 1, absint( $filters['page'] ) ) : 1;
        $offset   = ( $page - 1 ) * $per_page;
        $sql     .= " LIMIT %d OFFSET %d";
        $values[] = $per_page;
        $values[] = $offset;

        if ( $values ) {
            $prepared = $wpdb->prepare( $sql, $values );
        } else {
            $prepared = $sql;
        }

        return $wpdb->get_results( $prepared, ARRAY_A );
    }

    /**
     * Conta registros respeitando os mesmos filtros (sem paginação).
     *
     * @param array $filters
     * @return int
     */
    public static function count( $filters = [] ) {
        global $wpdb;
        $table = self::table();

        $where  = [];
        $values = [];

        if ( isset( $filters['mes'] ) && $filters['mes'] !== '' ) {
            $where[]  = 'mes = %d';
            $values[] = absint( $filters['mes'] );
        }

        if ( isset( $filters['ativo'] ) && $filters['ativo'] !== '' ) {
            $where[]  = 'ativo = %d';
            $values[] = absint( $filters['ativo'] );
        }

        if ( ! empty( $filters['origem'] ) ) {
            $where[]  = 'origem = %s';
            $values[] = sanitize_text_field( $filters['origem'] );
        }

        if ( ! empty( $filters['tipo'] ) ) {
            $where[]  = 'tipo = %s';
            $values[] = sanitize_text_field( $filters['tipo'] );
        }

        $sql = "SELECT COUNT(*) FROM {$table}";

        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }

        if ( $values ) {
            return (int) $wpdb->get_var( $wpdb->prepare( $sql, $values ) );
        }

        return (int) $wpdb->get_var( $sql );
    }

    /**
     * Retorna um único registro pelo ID.
     *
     * @param int $id
     * @return array|null
     */
    public static function get( $id ) {
        global $wpdb;
        $table = self::table();
        return $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", absint( $id ) ),
            ARRAY_A
        );
    }

    /**
     * Insere ou atualiza um registro.
     *
     * @param array    $data  Dados a salvar.
     * @param int|null $id    Se fornecido, atualiza; senão insere.
     * @return int|WP_Error   ID do registro ou WP_Error em caso de falha.
     */
    public static function save( $data, $id = null ) {
        global $wpdb;
        $table = self::table();

        // Sanitização
        $clean = [
            'telefone'        => sanitize_text_field( $data['telefone']        ?? '' ),
            'nome_celebrado'  => sanitize_text_field( $data['nome_celebrado']  ?? '' ),
            'nome_responsavel'=> sanitize_text_field( $data['nome_responsavel'] ?? '' ),
            'relacao'         => sanitize_text_field( $data['relacao']         ?? '' ),
            'genero_celebrado'=> in_array( $data['genero_celebrado'] ?? '', [ 'feminino', 'masculino' ] )
                                    ? $data['genero_celebrado']
                                    : 'masculino',
            'tipo'            => in_array( $data['tipo'] ?? '', self::tipos_validos() )
                                    ? $data['tipo']
                                    : 'aniversario_pessoal',
            'destinatario'    => in_array( $data['destinatario'] ?? '', self::destinatarios_validos() )
                                    ? $data['destinatario']
                                    : 'responsavel',
            'dia'             => absint( $data['dia']  ?? 0 ),
            'mes'             => absint( $data['mes']  ?? 0 ),
            'ano'             => ( isset( $data['ano'] ) && $data['ano'] !== '' ) ? absint( $data['ano'] ) : null,
            'nome_noiva'      => sanitize_text_field( $data['nome_noiva']  ?? '' ),
            'nome_noivo'      => sanitize_text_field( $data['nome_noivo']  ?? '' ),
            'nome_bodas'      => sanitize_text_field( $data['nome_bodas']  ?? '' ),
            'email'           => sanitize_email( $data['email']            ?? '' ),
            'origem'          => in_array( $data['origem'] ?? '', [ 'manual', 'orcamento', 'evento', 'eucaristia' ] )
                                    ? $data['origem']
                                    : 'manual',
            'data_valida'     => isset( $data['data_valida'] ) ? 1 : 0,
            'ativo'           => isset( $data['ativo'] ) ? 1 : 0,
            'observacao'      => sanitize_textarea_field( $data['observacao'] ?? '' ),
            'id_evento'       => ! empty( $data['id_evento'] ) ? absint( $data['id_evento'] ) : null,
        ];

        // Validações obrigatórias
        if ( empty( $clean['telefone'] ) ) {
            return new WP_Error( 'campo_obrigatorio', 'O telefone é obrigatório.' );
        }

        if ( $clean['dia'] < 1 || $clean['dia'] > 31 ) {
            return new WP_Error( 'campo_obrigatorio', 'O dia deve estar entre 1 e 31.' );
        }

        if ( $clean['mes'] < 1 || $clean['mes'] > 12 ) {
            return new WP_Error( 'campo_obrigatorio', 'O mês deve estar entre 1 e 12.' );
        }

        // Formato para $wpdb
        $format = [
            '%s', // telefone
            '%s', // nome_celebrado
            '%s', // nome_responsavel
            '%s', // relacao
            '%s', // genero_celebrado
            '%s', // tipo
            '%s', // destinatario
            '%d', // dia
            '%d', // mes
            is_null( $clean['ano'] ) ? '%s' : '%d', // ano
            '%s', // nome_noiva
            '%s', // nome_noivo
            '%s', // nome_bodas
            '%s', // email
            '%s', // origem
            '%d', // data_valida
            '%d', // ativo
            '%s', // observacao
            is_null( $clean['id_evento'] ) ? '%s' : '%d', // id_evento
        ];

        if ( $id ) {
            $result = $wpdb->update( $table, $clean, [ 'id' => absint( $id ) ], $format, [ '%d' ] );

            if ( $result === false ) {
                return new WP_Error( 'db_error', 'Erro ao atualizar o registro.' );
            }

            return absint( $id );
        } else {
            $result = $wpdb->insert( $table, $clean, $format );

            if ( $result === false ) {
                return new WP_Error( 'db_error', 'Erro ao inserir o registro.' );
            }

            return $wpdb->insert_id;
        }
    }

    /**
     * Remove um registro (hard delete).
     *
     * @param int $id
     * @return bool
     */
    public static function delete( $id ) {
        global $wpdb;
        $table = self::table();
        return (bool) $wpdb->delete( $table, [ 'id' => absint( $id ) ], [ '%d' ] );
    }

    /**
     * Retorna todos os registros ativos para um determinado dia e mês.
     *
     * @param int $dia
     * @param int $mes
     * @return array
     */
    public static function get_para_hoje( $dia, $mes ) {
        global $wpdb;
        $table = self::table();

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE dia = %d AND mes = %d AND ativo = 1 AND data_valida = 1",
                absint( $dia ),
                absint( $mes )
            ),
            ARRAY_A
        );
    }

    /* ============================================================
       HELPERS
    ============================================================ */

    private static function tipos_validos() {
        return [
            'aniversario_pessoal',
            'aniversario_casamento',
            'dia_casamento',
            'quinze_anos',
            'bodas',
        ];
    }

    private static function destinatarios_validos() {
        return [ 'celebrado', 'responsavel', 'casal', 'debutante', 'pais' ];
    }

    private static function label_tipo( $tipo ) {
        $map = [
            'aniversario_pessoal'    => 'Aniversário',
            'aniversario_casamento'  => 'Aniversário de Casamento',
            'dia_casamento'          => 'Dia do Casamento',
            'quinze_anos'            => '15 Anos',
            'bodas'                  => 'Bodas',
        ];
        return $map[ $tipo ] ?? $tipo;
    }

    private static function label_destinatario( $dest ) {
        $map = [
            'celebrado'   => 'Celebrado',
            'responsavel' => 'Responsável',
            'casal'       => 'Casal',
            'debutante'   => 'Debutante',
            'pais'        => 'Pais',
        ];
        return $map[ $dest ] ?? $dest;
    }

    private static function nomes_meses() {
        return [
            1  => 'Janeiro',  2  => 'Fevereiro', 3  => 'Março',
            4  => 'Abril',    5  => 'Maio',       6  => 'Junho',
            7  => 'Julho',    8  => 'Agosto',     9  => 'Setembro',
            10 => 'Outubro',  11 => 'Novembro',   12 => 'Dezembro',
        ];
    }

    /* ============================================================
       MENU ADMIN
    ============================================================ */

    public static function register_menu() {
        add_submenu_page(
            'photomusic-eventos',
            '💌 Comemorações',
            '💌 Comemorações',
            'manage_options',
            'photomusic-comemoracao',
            [ __CLASS__, 'render_page' ]
        );
    }

    /* ============================================================
       PÁGINA ADMIN — LISTA + FORMULÁRIO
    ============================================================ */

    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Acesso negado.', 'photomusic-pro' ) );
        }

        $editing  = null;
        $edit_id  = isset( $_GET['edit'] ) ? absint( $_GET['edit'] ) : 0;
        $show_form = ( isset( $_GET['action'] ) && $_GET['action'] === 'add' ) || $edit_id > 0;

        if ( $edit_id > 0 ) {
            $editing = self::get( $edit_id );
        }

        // Filtros da listagem
        $filter_mes  = isset( $_GET['filter_mes'] )  ? absint( $_GET['filter_mes'] )           : '';
        $filter_tipo = isset( $_GET['filter_tipo'] )  ? sanitize_text_field( $_GET['filter_tipo'] ) : '';
        $page_num    = isset( $_GET['paged'] )        ? max( 1, absint( $_GET['paged'] ) )      : 1;

        $filters = [ 'per_page' => 20, 'page' => $page_num ];
        if ( $filter_mes !== '' ) $filters['mes']  = $filter_mes;
        if ( $filter_tipo !== '' ) $filters['tipo'] = $filter_tipo;

        $registros   = self::get_all( $filters );
        $total       = self::count( array_diff_key( $filters, [ 'per_page' => 0, 'page' => 0 ] ) );
        $total_pages = max( 1, ceil( $total / 20 ) );

        $base_url     = admin_url( 'admin.php?page=photomusic-comemoracao' );
        $meses        = self::nomes_meses();
        $tipos_validos = self::tipos_validos();

        // Notices
        $notice = '';
        if ( isset( $_GET['saved'] ) ) {
            $notice = '<div class="notice notice-success is-dismissible"><p>✅ Registro salvo com sucesso!</p></div>';
        } elseif ( isset( $_GET['deleted'] ) ) {
            $notice = '<div class="notice notice-success is-dismissible"><p>🗑️ Registro excluído com sucesso!</p></div>';
        } elseif ( isset( $_GET['error'] ) ) {
            $notice = '<div class="notice notice-error is-dismissible"><p>❌ ' . esc_html( urldecode( $_GET['error'] ) ) . '</p></div>';
        }

        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">💌 Comemorações</h1>

            <?php if ( ! $show_form ) : ?>
                <a href="<?php echo esc_url( $base_url . '&action=add' ); ?>" class="page-title-action">+ Adicionar</a>
            <?php endif; ?>

            <?php echo wp_kses_post( $notice ); ?>

            <?php if ( $show_form ) : ?>
                <?php self::render_form( $editing ); ?>
            <?php else : ?>
                <?php self::render_list( $registros, $total, $total_pages, $page_num, $filter_mes, $filter_tipo, $filters, $base_url, $meses, $tipos_validos ); ?>
            <?php endif; ?>
        </div>
        <?php

        // Inline JS para show/hide de campos conforme tipo
        self::render_admin_js();
    }

    /* ============================================================
       LISTAGEM
    ============================================================ */

    private static function render_list( $registros, $total, $total_pages, $page_num, $filter_mes, $filter_tipo, $filters, $base_url, $meses, $tipos_validos ) {
        $filter_url = $base_url;
        if ( $filter_mes )  $filter_url .= '&filter_mes='  . $filter_mes;
        if ( $filter_tipo ) $filter_url .= '&filter_tipo=' . rawurlencode( $filter_tipo );
        ?>
        <!-- Filtros -->
        <form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" style="margin: 15px 0;">
            <input type="hidden" name="page" value="photomusic-comemoracao">

            <label for="filter_mes">Mês:</label>
            <select name="filter_mes" id="filter_mes">
                <option value="">Todos</option>
                <?php foreach ( $meses as $num => $nome ) : ?>
                    <option value="<?php echo esc_attr( $num ); ?>" <?php selected( $filter_mes, $num ); ?>>
                        <?php echo esc_html( $nome ); ?>
                    </option>
                <?php endforeach; ?>
            </select>

            &nbsp;

            <label for="filter_tipo">Tipo:</label>
            <select name="filter_tipo" id="filter_tipo">
                <option value="">Todos</option>
                <?php foreach ( $tipos_validos as $t ) : ?>
                    <option value="<?php echo esc_attr( $t ); ?>" <?php selected( $filter_tipo, $t ); ?>>
                        <?php echo esc_html( self::label_tipo( $t ) ); ?>
                    </option>
                <?php endforeach; ?>
            </select>

            &nbsp;
            <button type="submit" class="button">Filtrar</button>
            <a href="<?php echo esc_url( $base_url ); ?>" class="button">Limpar</a>
        </form>

        <p>Total: <strong><?php echo esc_html( $total ); ?></strong> registros encontrados.</p>

        <table class="wp-list-table widefat fixed striped" style="margin-top:10px;">
            <thead>
                <tr>
                    <th>Nome Celebrado</th>
                    <th>Telefone</th>
                    <th>Tipo</th>
                    <th>Dia/Mês</th>
                    <th>Ano</th>
                    <th>Destinatário</th>
                    <th>Origem</th>
                    <th>Válida</th>
                    <th>Ativo</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                <?php if ( empty( $registros ) ) : ?>
                    <tr><td colspan="10" style="text-align:center;">Nenhum registro encontrado.</td></tr>
                <?php else : ?>
                    <?php foreach ( $registros as $row ) : ?>
                        <tr>
                            <td>
                                <?php
                                $tipo_r = $row['tipo'] ?? '';
                                if ( in_array( $tipo_r, [ 'aniversario_casamento', 'dia_casamento', 'bodas' ] ) ) {
                                    $noiva = trim( $row['nome_noiva'] ?? '' );
                                    $noivo = trim( $row['nome_noivo'] ?? '' );
                                    if ( $noiva || $noivo ) {
                                        echo esc_html( implode( ' & ', array_filter( [ $noiva, $noivo ] ) ) );
                                    } else {
                                        echo '—';
                                    }
                                } else {
                                    echo esc_html( $row['nome_celebrado'] ?: '—' );
                                }
                                ?>
                                <?php if ( ! $row['data_valida'] ) : ?>
                                    <span style="color:#cc6b00;font-size:11px;display:block;">⚠️ Data a confirmar</span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo esc_html( $row['telefone'] ); ?></td>
                            <td><?php echo esc_html( self::label_tipo( $row['tipo'] ) ); ?></td>
                            <td><?php echo esc_html( $row['dia'] . '/' . $row['mes'] ); ?></td>
                            <td><?php echo esc_html( $row['ano'] ?: '—' ); ?></td>
                            <td><?php echo esc_html( self::label_destinatario( $row['destinatario'] ) ); ?></td>
                            <td><?php echo esc_html( ucfirst( $row['origem'] ) ); ?></td>
                            <td><?php echo $row['data_valida'] ? '<span style="color:green;">✔</span>' : '<span style="color:#cc6b00;">⚠️</span>'; ?></td>
                            <td><?php echo $row['ativo'] ? '<span style="color:green;">✔</span>' : '<span style="color:#999;">✖</span>'; ?></td>
                            <td>
                                <a href="<?php echo esc_url( $base_url . '&edit=' . $row['id'] ); ?>"
                                   class="button button-small">Editar</a>

                                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
                                      style="display:inline;"
                                      onsubmit="return confirm('Excluir este registro permanentemente?');">
                                    <input type="hidden" name="action" value="pm_excluir_comem">
                                    <input type="hidden" name="id" value="<?php echo absint( $row['id'] ); ?>">
                                    <?php wp_nonce_field( 'pm_excluir_comem_' . $row['id'], 'pm_comem_nonce' ); ?>
                                    <button type="submit" class="button button-small button-link-delete">Excluir</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <!-- Paginação -->
        <?php if ( $total_pages > 1 ) : ?>
            <div class="tablenav bottom" style="margin-top:10px;">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links( [
                        'base'      => $filter_url . '%_%',
                        'format'    => '&paged=%#%',
                        'current'   => $page_num,
                        'total'     => $total_pages,
                        'prev_text' => '&laquo;',
                        'next_text' => '&raquo;',
                    ] );
                    ?>
                </div>
            </div>
        <?php endif; ?>
        <?php
    }

    /* ============================================================
       FORMULÁRIO ADD / EDIT
    ============================================================ */

    private static function render_form( $item = null ) {
        $is_edit  = ! empty( $item );
        $action   = admin_url( 'admin-post.php' );
        $base_url = admin_url( 'admin.php?page=photomusic-comemoracao' );

        // Valores
        $v = [
            'id'               => $is_edit ? absint( $item['id'] ) : 0,
            'telefone'         => $is_edit ? esc_attr( $item['telefone'] )         : '',
            'tipo'             => $is_edit ? esc_attr( $item['tipo'] )              : 'aniversario_pessoal',
            'destinatario'     => $is_edit ? esc_attr( $item['destinatario'] )      : 'responsavel',
            'dia'              => $is_edit ? absint( $item['dia'] )                 : '',
            'mes'              => $is_edit ? absint( $item['mes'] )                 : '',
            'ano'              => $is_edit ? ( $item['ano'] ? absint( $item['ano'] ) : '' ) : '',
            'nome_celebrado'   => $is_edit ? esc_attr( $item['nome_celebrado'] )   : '',
            'genero_celebrado' => $is_edit ? esc_attr( $item['genero_celebrado'] ) : 'masculino',
            'nome_responsavel' => $is_edit ? esc_attr( $item['nome_responsavel'] ) : '',
            'relacao'          => $is_edit ? esc_attr( $item['relacao'] )           : '',
            'nome_noiva'       => $is_edit ? esc_attr( $item['nome_noiva'] )        : '',
            'nome_noivo'       => $is_edit ? esc_attr( $item['nome_noivo'] )        : '',
            'nome_bodas'       => $is_edit ? esc_attr( $item['nome_bodas'] )        : '',
            'email'            => $is_edit ? esc_attr( $item['email'] )             : '',
            'data_valida'      => $is_edit ? (int) $item['data_valida']              : 1,
            'ativo'            => $is_edit ? (int) $item['ativo']                   : 1,
            'observacao'       => $is_edit ? esc_textarea( $item['observacao'] )    : '',
            'origem'           => $is_edit ? esc_attr( $item['origem'] )            : 'manual',
        ];

        $meses        = self::nomes_meses();
        $tipos_validos = self::tipos_validos();
        ?>
        <div style="max-width:700px; background:#fff; border:1px solid #ccd0d4; padding:20px; margin-top:15px; border-radius:4px;">
            <h2 style="margin-top:0;"><?php echo $is_edit ? '✏️ Editar Comemoração' : '➕ Nova Comemoração'; ?></h2>

            <form method="post" action="<?php echo esc_url( $action ); ?>">
                <input type="hidden" name="action" value="pm_salvar_comem">
                <?php if ( $is_edit ) : ?>
                    <input type="hidden" name="id" value="<?php echo esc_attr( $v['id'] ); ?>">
                <?php endif; ?>
                <?php wp_nonce_field( 'pm_salvar_comem', 'pm_comem_nonce' ); ?>

                <table class="form-table">
                    <tbody>

                        <!-- Telefone -->
                        <tr>
                            <th><label for="telefone">Telefone <span style="color:red;">*</span></label></th>
                            <td>
                                <input type="text" id="telefone" name="telefone"
                                       value="<?php echo $v['telefone']; ?>"
                                       class="regular-text" required placeholder="5511999999999">
                                <p class="description">Formato: 55 + DDD + número (sem espaços)</p>
                            </td>
                        </tr>

                        <!-- Tipo -->
                        <tr>
                            <th><label for="tipo">Tipo <span style="color:red;">*</span></label></th>
                            <td>
                                <select id="tipo" name="tipo" required onchange="pmComemToggleFields(this.value)">
                                    <?php foreach ( $tipos_validos as $t ) : ?>
                                        <option value="<?php echo esc_attr( $t ); ?>" <?php selected( $v['tipo'], $t ); ?>>
                                            <?php echo esc_html( self::label_tipo( $t ) ); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>

                        <!-- Destinatário -->
                        <tr>
                            <th><label for="destinatario">Destinatário</label></th>
                            <td>
                                <select id="destinatario" name="destinatario">
                                    <?php foreach ( self::destinatarios_validos() as $d ) : ?>
                                        <option value="<?php echo esc_attr( $d ); ?>" <?php selected( $v['destinatario'], $d ); ?>>
                                            <?php echo esc_html( self::label_destinatario( $d ) ); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>

                        <!-- Dia / Mês / Ano -->
                        <tr>
                            <th>Data <span style="color:red;">*</span></th>
                            <td>
                                <label>Dia:
                                    <input type="number" name="dia" id="dia"
                                           value="<?php echo esc_attr( $v['dia'] ); ?>"
                                           min="1" max="31" style="width:60px;" required>
                                </label>
                                &nbsp;
                                <label>Mês:
                                    <select name="mes" id="mes" required>
                                        <option value="">--</option>
                                        <?php foreach ( $meses as $num => $nome ) : ?>
                                            <option value="<?php echo esc_attr( $num ); ?>" <?php selected( $v['mes'], $num ); ?>>
                                                <?php echo esc_html( $nome ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </label>
                                &nbsp;
                                <label>Ano (opcional):
                                    <input type="number" name="ano" id="ano"
                                           value="<?php echo esc_attr( $v['ano'] ); ?>"
                                           min="1900" max="2100" style="width:80px;"
                                           placeholder="ex: 2025">
                                </label>
                                <p class="description">Ano só é necessário para eventos únicos (bodas, dia do casamento).</p>
                            </td>
                        </tr>

                        <!-- Nome Celebrado (aniversario_pessoal, quinze_anos) -->
                        <tr class="pm-campo-celebrado">
                            <th><label for="nome_celebrado">Nome do Celebrado</label></th>
                            <td>
                                <input type="text" id="nome_celebrado" name="nome_celebrado"
                                       value="<?php echo $v['nome_celebrado']; ?>"
                                       class="regular-text" placeholder="Nome completo ou apelido">
                            </td>
                        </tr>

                        <!-- Gênero -->
                        <tr class="pm-campo-celebrado">
                            <th><label for="genero_celebrado">Gênero</label></th>
                            <td>
                                <select id="genero_celebrado" name="genero_celebrado">
                                    <option value="masculino" <?php selected( $v['genero_celebrado'], 'masculino' ); ?>>Masculino</option>
                                    <option value="feminino"  <?php selected( $v['genero_celebrado'], 'feminino' ); ?>>Feminino</option>
                                </select>
                            </td>
                        </tr>

                        <!-- Nome Responsável / Relação -->
                        <tr class="pm-campo-responsavel">
                            <th><label for="nome_responsavel">Nome do Responsável</label></th>
                            <td>
                                <input type="text" id="nome_responsavel" name="nome_responsavel"
                                       value="<?php echo $v['nome_responsavel']; ?>"
                                       class="regular-text" placeholder="Quem vai receber a mensagem">
                            </td>
                        </tr>
                        <tr class="pm-campo-responsavel">
                            <th><label for="relacao">Relação</label></th>
                            <td>
                                <input type="text" id="relacao" name="relacao"
                                       value="<?php echo $v['relacao']; ?>"
                                       class="regular-text" placeholder="ex: mãe, pai, filha, amigo">
                            </td>
                        </tr>

                        <!-- Nome Noiva / Noivo (casamento, bodas) -->
                        <tr class="pm-campo-casal">
                            <th><label for="nome_noiva">Nome da Noiva</label></th>
                            <td>
                                <input type="text" id="nome_noiva" name="nome_noiva"
                                       value="<?php echo $v['nome_noiva']; ?>"
                                       class="regular-text">
                            </td>
                        </tr>
                        <tr class="pm-campo-casal">
                            <th><label for="nome_noivo">Nome do Noivo</label></th>
                            <td>
                                <input type="text" id="nome_noivo" name="nome_noivo"
                                       value="<?php echo $v['nome_noivo']; ?>"
                                       class="regular-text">
                            </td>
                        </tr>

                        <!-- Nome Bodas -->
                        <tr class="pm-campo-bodas">
                            <th><label for="nome_bodas">Nome das Bodas</label></th>
                            <td>
                                <input type="text" id="nome_bodas" name="nome_bodas"
                                       value="<?php echo $v['nome_bodas']; ?>"
                                       class="regular-text" placeholder="ex: Bodas de Prata">
                            </td>
                        </tr>

                        <!-- E-mail -->
                        <tr>
                            <th><label for="email">E-mail</label></th>
                            <td>
                                <input type="email" id="email" name="email"
                                       value="<?php echo $v['email']; ?>"
                                       class="regular-text">
                            </td>
                        </tr>

                        <!-- Origem -->
                        <tr>
                            <th><label for="origem">Origem</label></th>
                            <td>
                                <select id="origem" name="origem">
                                    <option value="manual"     <?php selected( $v['origem'], 'manual' ); ?>>Manual</option>
                                    <option value="orcamento"  <?php selected( $v['origem'], 'orcamento' ); ?>>Orçamento</option>
                                    <option value="evento"     <?php selected( $v['origem'], 'evento' ); ?>>Evento</option>
                                    <option value="eucaristia" <?php selected( $v['origem'], 'eucaristia' ); ?>>1ª Eucaristia</option>
                                </select>
                            </td>
                        </tr>

                        <!-- Data Válida / Ativo -->
                        <tr>
                            <th>Status</th>
                            <td>
                                <label>
                                    <input type="checkbox" name="data_valida" value="1"
                                           <?php checked( $v['data_valida'], 1 ); ?>>
                                    Data confirmada
                                </label>
                                &nbsp;&nbsp;
                                <label>
                                    <input type="checkbox" name="ativo" value="1"
                                           <?php checked( $v['ativo'], 1 ); ?>>
                                    Ativo (enviar mensagens)
                                </label>
                            </td>
                        </tr>

                        <!-- Observação -->
                        <tr>
                            <th><label for="observacao">Observação</label></th>
                            <td>
                                <textarea id="observacao" name="observacao"
                                          rows="3" class="large-text"><?php echo $v['observacao']; ?></textarea>
                            </td>
                        </tr>

                    </tbody>
                </table>

                <p class="submit">
                    <button type="submit" class="button button-primary">
                        <?php echo $is_edit ? '💾 Atualizar' : '➕ Salvar'; ?>
                    </button>
                    <a href="<?php echo esc_url( $base_url ); ?>" class="button">Cancelar</a>
                </p>
            </form>
        </div>
        <?php
    }

    /* ============================================================
       JS INLINE — show/hide de campos conforme tipo
    ============================================================ */

    private static function render_admin_js() {
        ?>
        <script type="text/javascript">
        function pmComemToggleFields(tipo) {
            // Todos os grupos
            var grupos = {
                celebrado:   document.querySelectorAll('.pm-campo-celebrado'),
                responsavel: document.querySelectorAll('.pm-campo-responsavel'),
                casal:       document.querySelectorAll('.pm-campo-casal'),
                bodas:       document.querySelectorAll('.pm-campo-bodas')
            };

            // Oculta tudo primeiro
            Object.keys(grupos).forEach(function(k) {
                grupos[k].forEach(function(el) { el.style.display = 'none'; });
            });

            switch (tipo) {
                case 'aniversario_pessoal':
                    grupos.celebrado.forEach(function(el)   { el.style.display = ''; });
                    grupos.responsavel.forEach(function(el) { el.style.display = ''; });
                    break;
                case 'quinze_anos':
                    grupos.celebrado.forEach(function(el)   { el.style.display = ''; });
                    grupos.responsavel.forEach(function(el) { el.style.display = ''; });
                    break;
                case 'aniversario_casamento':
                    grupos.casal.forEach(function(el)       { el.style.display = ''; });
                    grupos.responsavel.forEach(function(el) { el.style.display = ''; });
                    break;
                case 'dia_casamento':
                    grupos.casal.forEach(function(el)       { el.style.display = ''; });
                    grupos.responsavel.forEach(function(el) { el.style.display = ''; });
                    break;
                case 'bodas':
                    grupos.casal.forEach(function(el)  { el.style.display = ''; });
                    grupos.bodas.forEach(function(el)  { el.style.display = ''; });
                    grupos.responsavel.forEach(function(el) { el.style.display = ''; });
                    break;
            }
        }

        // Inicializa com o valor atual ao carregar a página
        document.addEventListener('DOMContentLoaded', function() {
            var tipoSelect = document.getElementById('tipo');
            if (tipoSelect) {
                pmComemToggleFields(tipoSelect.value);
            }
        });
        </script>
        <?php
    }

    /* ============================================================
       ACTIONS — SALVAR / EXCLUIR
    ============================================================ */

    public static function handle_salvar() {
        check_admin_referer( 'pm_salvar_comem', 'pm_comem_nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Acesso negado.', 'photomusic-pro' ) );
        }

        $id   = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : null;
        $data = $_POST; // sanitização feita dentro de save()

        $result = self::save( $data, $id ?: null );

        $redirect = admin_url( 'admin.php?page=photomusic-comemoracao' );

        if ( is_wp_error( $result ) ) {
            wp_redirect( $redirect . '&error=' . rawurlencode( $result->get_error_message() ) );
        } else {
            wp_redirect( $redirect . '&saved=1' );
        }

        exit;
    }

    public static function handle_excluir() {
        $id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
        check_admin_referer( 'pm_excluir_comem_' . $id, 'pm_comem_nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Acesso negado.', 'photomusic-pro' ) );
        }

        self::delete( $id );

        wp_redirect( admin_url( 'admin.php?page=photomusic-comemoracao&deleted=1' ) );
        exit;
    }

    /* ============================================================
       REST API
    ============================================================ */

    public static function register_rest() {
        // Leitura pública (bot + apps)
        register_rest_route(
            'photomusic/v1',
            '/comemoracao-contatos',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [ __CLASS__, 'rest_get_contatos' ],
                'permission_callback' => '__return_true',
            ]
        );

        // Captura automática vinda do bot (requer X-PM-Api-Key)
        register_rest_route(
            'photomusic/v1',
            '/comemoracao-capturar',
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [ __CLASS__, 'rest_capturar' ],
                'permission_callback' => '__return_true', // auth via header — ver callback
            ]
        );
    }

    /**
     * Callback do endpoint REST — Versão unificada (Phase 2).
     *
     * Combina quatro fontes de dados:
     *   1. pm_comemoracao_contatos  → cadastro manual/automático (DB principal)
     *   2. pm_eventos               → aniversário do contratante PF (data_nascimento)
     *   3. pm_eventos               → aniversário do homenageado (data_nascimento_aniversariante)
     *   4. pm_eucaristia_catequizandos → aniversário do catequizando (msg enviada ao contratante)
     *
     * Deduplicação por chave: telefone_norm + dia + mes + tipo.
     * A fonte 1 tem prioridade; fontes 2-4 são ignoradas se já cobertas.
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function rest_get_contatos( WP_REST_Request $request ) {
        global $wpdb;

        $table   = self::table();
        $tbl_evt = $wpdb->prefix . 'pm_eventos';
        $tbl_cat = $wpdb->prefix . 'pm_eucaristia_catequizandos';

        $output = [];
        $vistos = []; // chave → true; evita duplicatas entre fontes

        // --------------------------------------------------------
        // HELPER: normalizar telefone (mesma lógica do bot JS)
        // --------------------------------------------------------
        $norm = function ( $tel ) {
            if ( ! $tel ) return '';
            $t = preg_replace( '/\D+/', '', $tel );
            $t = ltrim( $t, '0' );
            if ( strlen( $t ) === 11 ) return '55' . $t;
            if ( strlen( $t ) === 10 ) return '55' . $t;
            if ( strlen( $t ) === 13 && substr( $t, 0, 2 ) !== '55' ) return '55' . $t;
            return $t;
        };

        // --------------------------------------------------------
        // HELPER: parse DATE string 'YYYY-MM-DD' → array dia/mes/ano
        //         Retorna null se inválido.
        // --------------------------------------------------------
        $parse = function ( $s ) {
            if ( ! $s || $s === '0000-00-00' ) return null;
            $p = explode( '-', $s );
            if ( count( $p ) < 3 ) return null;
            $d = [ 'ano' => (int) $p[0], 'mes' => (int) $p[1], 'dia' => (int) $p[2] ];
            if ( $d['dia'] < 1 || $d['mes'] < 1 || $d['mes'] > 12 ) return null;
            return $d;
        };

        // --------------------------------------------------------
        // HELPER: registrar chave de deduplicação.
        //         Retorna true se é novo (pode adicionar); false se duplicado.
        // --------------------------------------------------------
        $novo = function ( $telefone, $dia, $mes, $tipo ) use ( &$vistos, $norm ) {
            $chave = $norm( $telefone ) . "|{$dia}|{$mes}|{$tipo}";
            if ( isset( $vistos[ $chave ] ) ) return false;
            $vistos[ $chave ] = true;
            return true;
        };

        // (helper reservado — ano não é usado para filtrar; mensagens não mencionam idade)

        // ========================================================
        // FONTE 1 — pm_comemoracao_contatos (prioridade máxima)
        // ========================================================
        $rows = $wpdb->get_results(
            "SELECT * FROM {$table} WHERE ativo = 1 AND data_valida = 1 ORDER BY mes ASC, dia ASC",
            ARRAY_A
        );

        foreach ( $rows as $row ) {
            $novo( $row['telefone'], $row['dia'], $row['mes'], $row['tipo'] ); // só registra; sempre inclui
            $output[] = [
                'telefone'        => $row['telefone'],
                'dia'             => (int) $row['dia'],
                'mes'             => (int) $row['mes'],
                'tipo'            => $row['tipo'],
                'destinatario'    => $row['destinatario'],
                'nomeCelebrado'   => $row['nome_celebrado']   ?: null,
                'generoCelebrado' => $row['genero_celebrado'] ?: 'masculino',
                'nomeResponsavel' => $row['nome_responsavel'] ?: null,
                'relacao'         => $row['relacao']          ?: null,
                'nomeNoiva'       => $row['nome_noiva']        ?: null,
                'nomeNoivo'       => $row['nome_noivo']        ?: null,
                'nome_bodas'      => $row['nome_bodas']        ?: null,
                'ano'             => $row['ano'] !== null ? (int) $row['ano'] : null,
                'fonte'           => 'db',
            ];
        }

        // Verifica se a tabela pm_eventos existe antes de consultar
        $evt_existe = ( $wpdb->get_var( "SHOW TABLES LIKE '{$tbl_evt}'" ) === $tbl_evt );

        if ( $evt_existe ) {

            // ====================================================
            // FONTE 2 — pm_eventos: aniversário do contratante PF
            // ====================================================
            $eventos_pf = $wpdb->get_results(
                "SELECT id, nome_contratante, telefone_contratante,
                        data_nascimento, data_evento
                 FROM {$tbl_evt}
                 WHERE tipo_evento = 'PF'
                   AND data_nascimento IS NOT NULL
                   AND data_nascimento != '0000-00-00'
                   AND status_evento != 'desativado'
                   AND telefone_contratante IS NOT NULL
                   AND telefone_contratante != ''",
                ARRAY_A
            );

            foreach ( $eventos_pf as $evt ) {
                $nasc = $parse( $evt['data_nascimento'] );
                if ( ! $nasc ) continue;

                if ( ! $novo( $evt['telefone_contratante'], $nasc['dia'], $nasc['mes'], 'aniversario_pessoal' ) ) continue;

                $output[] = [
                    'telefone'        => $evt['telefone_contratante'],
                    'dia'             => $nasc['dia'],
                    'mes'             => $nasc['mes'],
                    'tipo'            => 'aniversario_pessoal',
                    'destinatario'    => 'celebrado',
                    'nomeCelebrado'   => $evt['nome_contratante'] ?: null,
                    'generoCelebrado' => 'masculino',
                    'nomeResponsavel' => null,
                    'relacao'         => null,
                    'nomeNoiva'       => null,
                    'nomeNoivo'       => null,
                    'nome_bodas'      => null,
                    'ano'             => null,
                    'fonte'           => 'evento_contratante',
                ];
            }

            // ====================================================
            // FONTE 3 — pm_eventos: aniversário do homenageado
            //           (data_nascimento_aniversariante)
            // ====================================================
            $eventos_aniv = $wpdb->get_results(
                "SELECT id, nome_contratante, telefone_contratante,
                        data_nascimento_aniversariante, data_evento,
                        nome_aniversariante, tipo_celebracao,
                        grau_parentesco_aniversariante
                 FROM {$tbl_evt}
                 WHERE data_nascimento_aniversariante IS NOT NULL
                   AND data_nascimento_aniversariante != '0000-00-00'
                   AND status_evento != 'desativado'
                   AND telefone_contratante IS NOT NULL
                   AND telefone_contratante != ''",
                ARRAY_A
            );

            foreach ( $eventos_aniv as $evt ) {
                $nasc = $parse( $evt['data_nascimento_aniversariante'] );
                if ( ! $nasc ) continue;

                // Detectar tipo pelo tipo_celebracao
                $tipo_celeb = strtolower( $evt['tipo_celebracao'] ?? '' );
                $tipo       = ( strpos( $tipo_celeb, '15' ) !== false || strpos( $tipo_celeb, 'quinze' ) !== false )
                                ? 'quinze_anos'
                                : 'aniversario_pessoal';

                if ( ! $novo( $evt['telefone_contratante'], $nasc['dia'], $nasc['mes'], $tipo ) ) continue;

                // Para quinze_anos o gênero é sempre feminino
                $genero = ( $tipo === 'quinze_anos' ) ? 'feminino' : 'masculino';

                $output[] = [
                    'telefone'        => $evt['telefone_contratante'],
                    'dia'             => $nasc['dia'],
                    'mes'             => $nasc['mes'],
                    'tipo'            => $tipo,
                    'destinatario'    => ( $tipo === 'quinze_anos' ) ? 'pais' : 'responsavel',
                    'nomeCelebrado'   => $evt['nome_aniversariante'] ?: null,
                    'generoCelebrado' => $genero,
                    'nomeResponsavel' => $evt['nome_contratante'] ?: null,
                    'relacao'         => $evt['grau_parentesco_aniversariante'] ?: null,
                    'nomeNoiva'       => null,
                    'nomeNoivo'       => null,
                    'nome_bodas'      => null,
                    'ano'             => null,
                    'fonte'           => 'evento_homenageado',
                ];
            }

            // ====================================================
            // FONTE 4 — pm_eucaristia_catequizandos
            //           Msg de aniversário enviada ao contratante
            // ====================================================
            $cat_existe = ( $wpdb->get_var( "SHOW TABLES LIKE '{$tbl_cat}'" ) === $tbl_cat );

            if ( $cat_existe ) {
                $catequizandos = $wpdb->get_results(
                    "SELECT c.id, c.nome AS nome_catequizando,
                            c.data_nascimento, c.grau_parentesco,
                            e.nome_contratante, e.telefone_contratante,
                            e.data_evento
                     FROM {$tbl_cat} c
                     INNER JOIN {$tbl_evt} e ON c.id_evento = e.id
                     WHERE c.data_nascimento IS NOT NULL
                       AND c.data_nascimento != '0000-00-00'
                       AND e.status_evento != 'desativado'
                       AND e.telefone_contratante IS NOT NULL
                       AND e.telefone_contratante != ''",
                    ARRAY_A
                );

                foreach ( $catequizandos as $cat ) {
                    $nasc = $parse( $cat['data_nascimento'] );
                    if ( ! $nasc ) continue;

                    if ( ! $novo( $cat['telefone_contratante'], $nasc['dia'], $nasc['mes'], 'aniversario_pessoal' ) ) continue;

                    // Inferir gênero pelo grau_parentesco (filha, sobrinha, neta, prima → feminino)
                    $relacao = strtolower( $cat['grau_parentesco'] ?? '' );
                    $fem_sufixos = [ 'filha', 'sobrinha', 'neta', 'prima', 'irmã', 'irma', 'nora' ];
                    $genero = 'masculino';
                    foreach ( $fem_sufixos as $suf ) {
                        if ( strpos( $relacao, $suf ) !== false ) { $genero = 'feminino'; break; }
                    }

                    $output[] = [
                        'telefone'        => $cat['telefone_contratante'],
                        'dia'             => $nasc['dia'],
                        'mes'             => $nasc['mes'],
                        'tipo'            => 'aniversario_pessoal',
                        'destinatario'    => 'responsavel',
                        'nomeCelebrado'   => $cat['nome_catequizando'] ?: null,
                        'generoCelebrado' => $genero,
                        'nomeResponsavel' => $cat['nome_contratante'] ?: null,
                        'relacao'         => $cat['grau_parentesco'] ?: null,
                        'nomeNoiva'       => null,
                        'nomeNoivo'       => null,
                        'nome_bodas'      => null,
                        'ano'             => null,
                        'fonte'           => 'eucaristia',
                    ];
                }
            }
        }

        // Ordena resultado final: mes ASC, dia ASC
        usort( $output, function ( $a, $b ) {
            if ( $a['mes'] !== $b['mes'] ) return $a['mes'] - $b['mes'];
            return $a['dia'] - $b['dia'];
        } );

        return new WP_REST_Response( $output, 200 );
    }

    /**
     * POST /wp-json/photomusic/v1/comemoracao-capturar
     *
     * Recebe dados de um cliente vindo do bot (fluxo de orçamento) e
     * salva um registro de aniversário em pm_comemoracao_contatos.
     *
     * Autenticação: cabeçalho X-PM-Api-Key deve bater com a opção
     * WordPress 'pm_api_key'. Se a opção estiver em branco, a verificação
     * é pulada (útil durante setup inicial).
     *
     * Corpo JSON esperado:
     *   telefone       string  obrigatório
     *   nome           string
     *   email          string
     *   dia            int     obrigatório (da data de nascimento)
     *   mes            int     obrigatório
     *   ano            int|null
     *   dataEvento     string  DD/MM/YYYY (para referência)
     *   tipoCelebracao string  (e.g. "Casamento", "Aniversário")
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function rest_capturar( WP_REST_Request $request ) {
        global $wpdb;

        // ── Verificação de chave de API ───────────────────────────────────────
        $chave_salva = get_option( 'pm_api_key', '' );
        if ( $chave_salva !== '' ) {
            $chave_enviada = $request->get_header( 'X-PM-Api-Key' );
            if ( $chave_enviada !== $chave_salva ) {
                return new WP_REST_Response( [ 'erro' => 'Não autorizado.' ], 401 );
            }
        }

        // ── Leitura e validação do corpo ──────────────────────────────────────
        $body     = $request->get_json_params();
        $telefone = sanitize_text_field( $body['telefone'] ?? '' );
        $dia      = absint( $body['dia']  ?? 0 );
        $mes      = absint( $body['mes']  ?? 0 );
        $nome     = sanitize_text_field( $body['nome']           ?? '' );
        $email    = sanitize_email(      $body['email']          ?? '' );
        $tipo_cel = sanitize_text_field( $body['tipoCelebracao'] ?? '' );

        // ── Normalização do ano ───────────────────────────────────────────────
        // Aceita ano com 4 dígitos, 2 dígitos, ou null.
        // 2 dígitos: se > ano atual (2 dígitos) → século XX, senão → século XXI.
        // Ex: "90" → 1990 | "05" → 2005
        $ano = null;
        if ( isset( $body['ano'] ) && $body['ano'] !== null && $body['ano'] !== '' ) {
            $ano_raw      = absint( $body['ano'] );
            $ano_atual    = (int) date( 'Y' );
            $ano_atual_2d = $ano_atual % 100;

            if ( $ano_raw > 0 && $ano_raw < 100 ) {
                // 2 dígitos
                $ano = ( $ano_raw > $ano_atual_2d ) ? ( 1900 + $ano_raw ) : ( 2000 + $ano_raw );
            } elseif ( $ano_raw >= 1900 && $ano_raw <= $ano_atual ) {
                $ano = $ano_raw;
            }
            // Fora do intervalo razoável → $ano permanece null
        }

        if ( empty( $telefone ) ) {
            return new WP_REST_Response( [ 'erro' => 'Telefone obrigatório.' ], 400 );
        }

        if ( $dia < 1 || $dia > 31 || $mes < 1 || $mes > 12 ) {
            // Sem data de nascimento válida → nada a salvar para comemorações
            return new WP_REST_Response( [ 'status' => 'ignorado', 'motivo' => 'sem_data_nascimento' ], 200 );
        }

        $table = self::table();

        // ── Evitar duplicata: mesmo telefone + aniversario_pessoal + origem orcamento ──
        $existe = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$table}
             WHERE telefone = %s AND tipo = 'aniversario_pessoal' AND origem = 'orcamento'
             LIMIT 1",
            $telefone
        ) );

        if ( $existe ) {
            return new WP_REST_Response( [ 'status' => 'ignorado', 'motivo' => 'ja_existe', 'id' => (int) $existe ], 200 );
        }

        // ── Inserção ─────────────────────────────────────────────────────────
        $dados = [
            'telefone'         => $telefone,
            'nome_celebrado'   => $nome,
            'nome_responsavel' => '',
            'relacao'          => '',
            'genero_celebrado' => 'masculino',
            'tipo'             => 'aniversario_pessoal',
            'destinatario'     => 'celebrado',
            'dia'              => $dia,
            'mes'              => $mes,
            'ano'              => $ano,
            'nome_noiva'       => '',
            'nome_noivo'       => '',
            'nome_bodas'       => '',
            'email'            => $email,
            'origem'           => 'orcamento',
            'data_valida'      => 1,
            'ativo'            => 1,
            'observacao'       => $tipo_cel ? 'Tipo celebração: ' . $tipo_cel : '',
            'id_evento'        => null,
        ];

        $formato = [
            '%s', '%s', '%s', '%s', '%s', '%s', '%s',
            '%d', '%d',
            is_null( $ano ) ? '%s' : '%d',
            '%s', '%s', '%s', '%s', '%s',
            '%d', '%d', '%s',
            is_null( $dados['id_evento'] ) ? '%s' : '%d',
        ];

        $ok = $wpdb->insert( $table, $dados, $formato );

        if ( $ok === false ) {
            return new WP_REST_Response( [ 'erro' => 'Erro ao salvar no banco.' ], 500 );
        }

        return new WP_REST_Response( [
            'status' => 'salvo',
            'id'     => $wpdb->insert_id,
        ], 201 );
    }

} // end class PhotoMusic_Comemoracao
