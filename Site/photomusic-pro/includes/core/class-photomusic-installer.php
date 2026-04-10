<?php
// includes/core/class-photomusic-installer.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Installer {

    /**
     * Executado na ativação do plugin
     */
    public static function activate() {
        self::create_tables();
        self::create_roles_and_caps();
        self::create_upload_dirs();
        self::create_required_pages();
    }

    /**
     * Cria as páginas WordPress necessárias para o sistema funcionar
     * (shortcodes de contrato e pagamento)
     */
    private static function create_required_pages() {

        $pages = [
            [
                'option'    => 'photomusic_contrato_page',
                'title'     => 'Assinatura de Contrato',
                'slug'      => 'assinatura-de-contrato',
                'shortcode' => '[photomusic_contrato]',
            ],
            [
                'option'    => 'pm_pagamento_page_id',
                'title'     => 'Pagamento',
                'slug'      => 'pagamento',
                'shortcode' => '[photomusic_pagamento_evento]',
            ],
        ];

        foreach ($pages as $page) {

            // Já existe opção salva e a página ainda existe?
            $saved_id = (int) get_option($page['option'], 0);
            if ($saved_id > 0 && get_post($saved_id) && get_post_status($saved_id) === 'publish') {
                continue; // já configurado, ignora
            }

            // Busca por slug existente
            $existing = get_page_by_path($page['slug']);
            if ($existing) {
                update_option($page['option'], $existing->ID);
                continue;
            }

            // Busca por shortcode no conteúdo
            $found = get_posts([
                'post_type'      => 'page',
                'post_status'    => 'publish',
                'posts_per_page' => 1,
                's'              => trim($page['shortcode'], '[]'),
            ]);
            if (!empty($found)) {
                update_option($page['option'], $found[0]->ID);
                continue;
            }

            // Cria a página automaticamente
            $new_id = wp_insert_post([
                'post_title'   => $page['title'],
                'post_name'    => $page['slug'],
                'post_content' => $page['shortcode'],
                'post_status'  => 'publish',
                'post_type'    => 'page',
                'post_author'  => 1,
            ]);

            if ($new_id && !is_wp_error($new_id)) {
                update_option($page['option'], $new_id);
            }
        }
    }

    /**
     * Cria pastas de upload protegidas
     */
    private static function create_upload_dirs() {
        $upload_dir = wp_upload_dir();

        // Pasta de contratos PDF — protegida contra listagem de diretório
        $contratos_dir = $upload_dir['basedir'] . '/contratos';
        if (!file_exists($contratos_dir)) {
            wp_mkdir_p($contratos_dir);
        }

        // index.php para bloquear listagem
        $index_file = $contratos_dir . '/index.php';
        if (!file_exists($index_file)) {
            file_put_contents($index_file, '<?php // Silence is golden.');
        }

        // .htaccess para bloquear listagem de diretório (Apache)
        $htaccess_file = $contratos_dir . '/.htaccess';
        if (!file_exists($htaccess_file)) {
            $htaccess_content = "Options -Indexes\n";
            file_put_contents($htaccess_file, $htaccess_content);
        }
    }

    /**
     * Criação de todas as tabelas do sistema
     */
    private static function create_tables() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        // Nomes das tabelas
        $tbl_eventos             = $wpdb->prefix . 'pm_eventos';
        $tbl_termos              = $wpdb->prefix . 'pm_termos_versoes';
        $tbl_convites            = $wpdb->prefix . 'pm_convites';
        $tbl_aceites             = $wpdb->prefix . 'pm_aceites';
        $tbl_logs                = $wpdb->prefix . 'pm_logs_sistema';
        $tbl_senhas              = $wpdb->prefix . 'pm_eventos_senhas';
        $tbl_acessos             = $wpdb->prefix . 'pm_acessos_galeria';
        $tbl_aceite_contratante  = $wpdb->prefix . 'pm_aceite_contratante';
        $tbl_event_services      = $wpdb->prefix . 'pm_event_services';
        $tbl_aceites_evento      = $wpdb->prefix . 'pm_aceites_evento';
        $tbl_acessos_evento      = $wpdb->prefix . 'pm_acessos_evento';
        $tbl_compartilhamentos   = $wpdb->prefix . 'pm_compartilhamentos';
        $tbl_devices             = $wpdb->prefix . 'pm_devices';
        $tbl_whatsapp_logs       = $wpdb->prefix . 'pm_evento_whatsapp_logs';

        // Módulo 5
        $tbl_event_items         = $wpdb->prefix . 'pm_event_items';
        $tbl_event_history       = $wpdb->prefix . 'pm_event_history';
        $tbl_event_messages      = $wpdb->prefix . 'pm_event_messages';
        $tbl_contratantes        = $wpdb->prefix . 'pm_contratantes';
        $tbl_contratos           = $wpdb->prefix . 'pm_contratos';
        $tbl_clausulas           = $wpdb->prefix . 'pm_clausulas';

        // Módulo Serviços
        $tbl_servicos            = $wpdb->prefix . 'pm_servicos';
        $tbl_servicos_subtipos   = $wpdb->prefix . 'pm_servicos_subtipos';
        $tbl_servicos_pacotes    = $wpdb->prefix . 'pm_servicos_pacotes';
        $tbl_servicos_regras     = $wpdb->prefix . 'pm_servicos_regras';
        $tbl_eventos_servicos    = $wpdb->prefix . 'pm_eventos_servicos';

        // Módulo Ideias e Projetos
        $tbl_ideias_futuras      = $wpdb->prefix . 'pm_ideias_futuras';
        $tbl_projetos            = $wpdb->prefix . 'pm_projetos';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        /* ============================================================
           TABELA: EVENTOS
        ============================================================ */
        $sql_eventos = "CREATE TABLE $tbl_eventos (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            tipo_evento ENUM('PF','PJ') NOT NULL,

            nome_contratante VARCHAR(255) NULL,
            cpf              VARCHAR(20)  NULL,
            rg               VARCHAR(30)  NULL,
            data_nascimento  DATE         NULL,

            razao_social  VARCHAR(255) NULL,
            nome_fantasia VARCHAR(255) NULL,
            cnpj          VARCHAR(20)  NULL,
            responsavel      VARCHAR(255) NULL,
            cpf_responsavel  VARCHAR(20)  NULL,

            email_contratante     VARCHAR(255) NULL,
            telefone_contratante  VARCHAR(30)  NULL,
            endereco_contratante  TEXT         NULL,
            instagram_contratante VARCHAR(255) NULL,
            grau_parentesco       VARCHAR(255) NULL,

            cont_logradouro  VARCHAR(255) NULL,
            cont_numero      VARCHAR(20)  NULL,
            cont_complemento VARCHAR(100) NULL,
            cont_bairro      VARCHAR(100) NULL,
            cont_cidade      VARCHAR(100) NULL,
            cont_estado      VARCHAR(2)   NULL DEFAULT 'RJ',
            cont_cep         VARCHAR(10)  NULL,

            motivo_evento VARCHAR(255) NOT NULL,

            tipo_celebracao      VARCHAR(50)  NULL,
            tema_festa           VARCHAR(255) NULL,
            cores_festa          VARCHAR(255) NULL,
            nome_aniversariante  VARCHAR(255) NULL,
            nome_pais            VARCHAR(255) NULL,
            idade_aniversariante VARCHAR(50)  NULL,
            data_nascimento_aniversariante DATE         NULL,
            grau_parentesco_aniversariante VARCHAR(255) NULL,
            nome_noivos          VARCHAR(255) NULL,
            grau_parentesco_noivos VARCHAR(255) NULL,
            modelo_foto          VARCHAR(255) NULL,

            data_evento DATE NULL,
            horario_inicio         TIME NULL,
            horario_fim            TIME NULL,
            horario_servico        TIME NULL,
            local_evento           VARCHAR(255) NULL,
            endereco_evento  TEXT         NULL,
            local_logradouro VARCHAR(255) NULL,
            local_numero     VARCHAR(20)  NULL,
            local_complemento VARCHAR(100) NULL,
            local_bairro     VARCHAR(100) NULL,
            local_cidade     VARCHAR(100) NULL,
            local_estado     VARCHAR(2)   NULL DEFAULT 'RJ',
            cep_evento       VARCHAR(10)  NULL,
            contato_salao          VARCHAR(255) NULL,
            contato_cerimonialista VARCHAR(255) NULL,
            contato_responsavel    VARCHAR(255) NULL,
            status_evento ENUM('ativo','desativado','concluido') NOT NULL DEFAULT 'ativo',
            pagamento_config LONGTEXT NULL,
            link_pagamento_cartao TEXT NULL,
            pagamento_confirmado TINYINT(1) NOT NULL DEFAULT 0,

            codigo_interno VARCHAR(100) NULL,
            criado_por BIGINT UNSIGNED NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_tipo (tipo_evento),
            INDEX idx_status (status_evento)
        ) $charset;";

        /* ============================================================
           TABELA: SERVIÇOS DO EVENTO
        ============================================================ */
        $sql_event_services = "CREATE TABLE $tbl_event_services (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento BIGINT UNSIGNED NOT NULL,

            nome_servico VARCHAR(255) NOT NULL,
            slug_servico VARCHAR(255) NOT NULL,
            tipo ENUM('foto','video','360','gif','outro') NOT NULL DEFAULT 'foto',
            status_servico ENUM('ativo','desativado') NOT NULL DEFAULT 'ativo',

            link_convidado VARCHAR(500) NOT NULL,
            link_contratante VARCHAR(500) NOT NULL,

            regras_acesso LONGTEXT NOT NULL,

            pasta_protegida VARCHAR(500) NOT NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_slug (slug_servico)
        ) $charset;";

        /* ============================================================
           TABELA: ACESSOS À GALERIA (CONVIDADOS)
        ============================================================ */
        $sql_acessos = "CREATE TABLE $tbl_acessos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento INT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NOT NULL,

            telefone VARCHAR(30) NOT NULL,
            token_acesso VARCHAR(64) NOT NULL UNIQUE,
            device_hash VARCHAR(255) NOT NULL,

            acessos_hoje INT UNSIGNED NOT NULL DEFAULT 0,
            acessos_total INT UNSIGNED NOT NULL DEFAULT 0,

            ultimo_acesso DATE NULL,
            expira_em DATETIME NULL,

            ip VARCHAR(45) NULL,
            navegador VARCHAR(255) NULL,
            dispositivo VARCHAR(255) NULL,
            user_agent TEXT NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento_telefone (id_evento, telefone),
            INDEX idx_servico (id_servico)
        ) $charset;";

        /* ============================================================
        GALERIA — LOG DE VISUALIZAÇÃO POR SERVIÇO
        ============================================================ */
        $tbl_views = $wpdb->prefix . 'pm_galeria_views';

        $sql_views = "CREATE TABLE $tbl_views (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            id_evento BIGINT UNSIGNED NOT NULL,
            id_aceite BIGINT UNSIGNED NOT NULL,
            tipo_servico VARCHAR(50) DEFAULT NULL,
            nome_servico VARCHAR(255) DEFAULT NULL,
            total_views INT DEFAULT 1,
            primeiro_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_evento (id_evento),
            KEY idx_aceite (id_aceite),
            UNIQUE KEY uniq_view (id_evento, id_aceite, nome_servico)
        ) $charset;";

        dbDelta($sql_views);

        /* ============================================================
           TABELA: ACEITE DO CONTRATANTE
        ============================================================ */
        $sql_aceite_contratante = "CREATE TABLE $tbl_aceite_contratante (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento INT UNSIGNED NOT NULL,
            tipo_evento ENUM('PF','PJ') NOT NULL,

            nome_contratante VARCHAR(255) NOT NULL,
            email_contratante VARCHAR(255) NULL,

            ip VARCHAR(45) NOT NULL,
            navegador VARCHAR(255) NULL,
            dispositivo VARCHAR(255) NULL,
            user_agent TEXT NULL,

            device_hash VARCHAR(255) NOT NULL DEFAULT '',
            total_acessos INT UNSIGNED NOT NULL DEFAULT 1,
            ultimo_acesso DATETIME NULL,

            aceite_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            versao_termo VARCHAR(20) NOT NULL DEFAULT '1.0',

            INDEX idx_evento (id_evento),
            INDEX idx_tipo_evento (tipo_evento),
            INDEX idx_device (id_evento, device_hash)
        ) $charset;";
        /* ============================================================
           TABELA: TERMOS DE USO
        ============================================================ */
        $sql_termos = "CREATE TABLE $tbl_termos (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            versao VARCHAR(20) NOT NULL,
            idioma CHAR(2) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            conteudo LONGTEXT NOT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) $charset;";

        /* ============================================================
           TABELA: CONVITES
        ============================================================ */
        $sql_convites = "CREATE TABLE $tbl_convites (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento INT UNSIGNED NOT NULL,

            token_convite VARCHAR(64) NOT NULL UNIQUE,
            telefone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,
            nome_convidado VARCHAR(255) NULL,

            canal_origem VARCHAR(50) NOT NULL,
            idioma_preferido CHAR(2) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expirado_em DATETIME NULL,

            INDEX idx_evento (id_evento)
        ) $charset;";

        /* ============================================================
        TABELA: SENHAS POR DIA
        ============================================================ */
        $sql_senhas = "CREATE TABLE $tbl_senhas (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento INT UNSIGNED NOT NULL,
            data_evento DATE NOT NULL,
            senha_hash VARCHAR(255) NOT NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_evento (id_evento, data_evento)
        ) $charset;";


        /* ============================================================
        MÓDULO 5 — ITENS DE SERVIÇO DO EVENTO
        ============================================================ */
        $sql_event_items = "CREATE TABLE $tbl_event_items (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_service BIGINT UNSIGNED NOT NULL,

            item VARCHAR(255) NOT NULL,
            quantidade INT UNSIGNED NOT NULL DEFAULT 1,
            valor DECIMAL(10,2) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_service (id_service)
        ) $charset;";


        /* ============================================================
        MÓDULO 5 — HISTÓRICO DO EVENTO
        ============================================================ */
        $sql_event_history = "CREATE TABLE $tbl_event_history (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento BIGINT UNSIGNED NOT NULL,

            acao VARCHAR(255) NOT NULL,
            detalhes TEXT NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento)
        ) $charset;";


        /* ============================================================
        MÓDULO 5 — MENSAGENS DO EVENTO (WHATSAPP)
        ============================================================ */
        $sql_event_messages = "CREATE TABLE $tbl_event_messages (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento BIGINT UNSIGNED NOT NULL,

            chat_id VARCHAR(50) NOT NULL,
            direction ENUM('sent','received') NOT NULL,
            tipo VARCHAR(50) NOT NULL,
            mensagem TEXT NULL,

            enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_chat (chat_id)
        ) $charset;";


        /* ============================================================
        TABELA: CONTRATANTES (PF e PJ)
        ============================================================ */
        $sql_contratantes = "CREATE TABLE $tbl_contratantes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            tipo VARCHAR(2) NOT NULL DEFAULT 'PF',

            telefone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,
            instagram VARCHAR(255) NULL,
            facebook VARCHAR(255) NULL,

            logradouro VARCHAR(255) NULL,
            numero VARCHAR(20) NULL,
            complemento VARCHAR(255) NULL,
            bairro VARCHAR(255) NULL,
            cidade VARCHAR(255) NULL,
            estado VARCHAR(10) NULL,
            cep VARCHAR(20) NULL,

            nome VARCHAR(255) NULL,
            cpf VARCHAR(20) NULL,
            rg VARCHAR(30) NULL,
            rg_orgao VARCHAR(50) NULL,
            data_nascimento DATE NULL,
            parentesco VARCHAR(255) NULL,

            nome_fantasia VARCHAR(255) NULL,
            razao_social VARCHAR(255) NULL,
            cnpj VARCHAR(30) NULL,

            representante_nome VARCHAR(255) NULL,
            representante_cpf VARCHAR(20) NULL,
            representante_rg VARCHAR(30) NULL,
            representante_rg_orgao VARCHAR(50) NULL,
            representante_data_nascimento DATE NULL,
            representante_celular VARCHAR(30) NULL,

            token_acesso VARCHAR(64) NULL UNIQUE,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_tipo (tipo),
            INDEX idx_telefone (telefone),
            INDEX idx_email (email),
            INDEX idx_cnpj (cnpj),
            INDEX idx_cpf (cpf),
            INDEX idx_token_acesso (token_acesso)
        ) $charset;";

        /* ============================================================
            TABELA: CLÁUSULAS DOS CONTRATOS
        ============================================================ */
        $sql_clausulas = "CREATE TABLE $tbl_clausulas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            titulo VARCHAR(255) NOT NULL,
            tipo VARCHAR(50) NOT NULL DEFAULT 'geral',
            categoria VARCHAR(50) NOT NULL DEFAULT 'ambos',
            tags TEXT NULL,
            texto LONGTEXT NULL,
            ordem INT UNSIGNED NOT NULL DEFAULT 0,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_tipo (tipo),
            INDEX idx_categoria (categoria),
            INDEX idx_ativo (ativo),
            INDEX idx_ordem (ordem)
        ) $charset;";


        /* ============================================================
        TABELA: CONTRATOS DO EVENTO
        ============================================================ */
        $sql_contratos = "CREATE TABLE $tbl_contratos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            numero_contrato INT UNSIGNED NULL,

            id_evento BIGINT UNSIGNED NOT NULL,
            id_contratante BIGINT UNSIGNED NULL,

            token VARCHAR(64) NOT NULL UNIQUE,

            tipo_contrato ENUM('completo','simplificado') NOT NULL DEFAULT 'completo',

            status_contrato ENUM(
                'rascunho',
                'aguardando_assinatura_admin',
                'aguardando_assinatura_contratante',
                'assinado',
                'assinado_admin',
                'assinado_contratante',
                'dispensado',
                'cancelado'
            ) NOT NULL DEFAULT 'rascunho',

            tipo_assinatura ENUM(
                'digital_sistema',
                'manual_papel',
                'govbr',
                'nao_assinado'
            ) NOT NULL DEFAULT 'nao_assinado',

            conteudo LONGTEXT NULL,
            pdf_final VARCHAR(500) NULL,
            os_path VARCHAR(500) NULL,
            forma_pagamento VARCHAR(100) NULL,
            obs_pagamento TEXT NULL,

            assinatura_contratante_nome VARCHAR(255) NULL,
            assinatura_contratante_data DATETIME NULL,
            assinatura_contratante_ip VARCHAR(50) NULL,
            assinatura_contratante_useragent TEXT NULL,
            assinatura_contratante_hash VARCHAR(255) NULL,

            assinatura_admin_nome VARCHAR(255) NULL,
            assinatura_admin_data DATETIME NULL,
            assinatura_admin_ip VARCHAR(50) NULL,
            assinatura_admin_useragent TEXT NULL,
            assinatura_admin_hash VARCHAR(255) NULL,

            hash_contrato VARCHAR(255) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_contratante (id_contratante)
        ) $charset;";

        /* ============================================================
        TABELA: LOGS DE CONTRATOS
        ============================================================ */
        $tbl_contratos_logs = $wpdb->prefix . 'pm_contratos_logs';
        $sql_contratos_logs = "CREATE TABLE $tbl_contratos_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_contrato BIGINT UNSIGNED NOT NULL,
            acao VARCHAR(100) NOT NULL,
            detalhes TEXT NULL,
            descricao TEXT NULL,
            ip VARCHAR(45) NULL,
            user_agent VARCHAR(255) NULL,
            usuario_id BIGINT UNSIGNED NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_contrato (id_contrato)
        ) $charset;";

        /* ============================================================
        MÓDULO SERVIÇOS — SUBTIPOS
        ============================================================ */
        $sql_servicos_subtipos = "CREATE TABLE $tbl_servicos_subtipos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_servico BIGINT UNSIGNED NOT NULL,
            nome VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,

            ativo TINYINT(1) NOT NULL DEFAULT 1,
            ordem INT UNSIGNED NOT NULL DEFAULT 0,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_servico (id_servico),
            INDEX idx_slug (slug)
        ) $charset;";


        /* ============================================================
        MÓDULO SERVIÇOS — PACOTES
        ============================================================ */
        $sql_servicos_pacotes = "CREATE TABLE $tbl_servicos_pacotes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_servico BIGINT UNSIGNED NOT NULL,
            id_subtipo BIGINT UNSIGNED NULL,

            titulo VARCHAR(255) NOT NULL,
            slug VARCHAR(100) NULL,
            descricao TEXT NULL,

            horas_min INT UNSIGNED NULL,
            horas_max INT UNSIGNED NULL,

            fotos_min INT UNSIGNED NULL,
            fotos_max INT UNSIGNED NULL,

            valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
            valor_hora_extra DECIMAL(10,2) NULL,

            ativo TINYINT(1) NOT NULL DEFAULT 1,
            ordem INT UNSIGNED NOT NULL DEFAULT 0,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_servico (id_servico),
            INDEX idx_subtipo (id_subtipo)
        ) $charset;";


        /* ============================================================
        MÓDULO SERVIÇOS — REGRAS POR CELEBRAÇÃO
        ============================================================ */
        $sql_servicos_regras = "CREATE TABLE $tbl_servicos_regras (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_servico BIGINT UNSIGNED NOT NULL,
            celebracao VARCHAR(100) NOT NULL,

            horas_min INT UNSIGNED NULL,
            horas_max INT UNSIGNED NULL,

            fotos_min INT UNSIGNED NULL,
            fotos_max INT UNSIGNED NULL,

            valor_min DECIMAL(10,2) NULL,
            valor_max DECIMAL(10,2) NULL,

            ativo TINYINT(1) NOT NULL DEFAULT 1,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_servico (id_servico),
            INDEX idx_celebracao (celebracao)
        ) $charset;";


        /* ============================================================
        MÓDULO SERVIÇOS — SERVIÇOS CONTRATADOS POR EVENTO
        ============================================================ */
        $sql_eventos_servicos = "CREATE TABLE $tbl_eventos_servicos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NOT NULL,
            id_subtipo BIGINT UNSIGNED NULL,
            id_pacote BIGINT UNSIGNED NULL,

            horas_contratadas INT UNSIGNED NULL,
            fotos_contratadas INT UNSIGNED NULL,

            valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
            valor_adicional DECIMAL(10,2) NULL,
            valor_final DECIMAL(10,2) NOT NULL DEFAULT 0,

            observacoes TEXT NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_servico (id_servico),
            INDEX idx_pacote (id_pacote)
        ) $charset;";


        /* ============================================================
        TABELA: ACEITES DO CONVIDADO (NOVO FLUXO)
        ============================================================ */
        $sql_aceites_evento = "CREATE TABLE $tbl_aceites_evento (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NULL,
            id_convite BIGINT UNSIGNED NULL,

            nome VARCHAR(255) NULL,
            telefone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,

            ip VARCHAR(45) NULL,
            navegador VARCHAR(150) NULL,
            dispositivo VARCHAR(100) NULL,
            user_agent TEXT NULL,

            aceite_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_servico (id_servico),
            INDEX idx_telefone (telefone)
        ) $charset;";


        /* ============================================================
        TABELA: ACESSOS DO CONVIDADO (NOVO FLUXO)
        ============================================================ */
        $sql_acessos_evento = "CREATE TABLE $tbl_acessos_evento (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NOT NULL,

            token VARCHAR(64) NOT NULL UNIQUE,
            telefone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,

            acessos INT UNSIGNED NOT NULL DEFAULT 0,
            ultimo_acesso DATETIME NULL,

            ip VARCHAR(45) NULL,
            dispositivo VARCHAR(255) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_servico (id_servico)
        ) $charset;";


        /* ============================================================
        TABELA: COMPARTILHAMENTO DE LINKS
        ============================================================ */
        $sql_compartilhamentos = "CREATE TABLE $tbl_compartilhamentos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NOT NULL,

            token VARCHAR(64) NOT NULL UNIQUE,
            compartilhado_por VARCHAR(255) NULL,
            enviado_para VARCHAR(255) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_servico (id_servico)
        ) $charset;";


        /* ============================================================
        TABELA: DISPOSITIVOS
        ============================================================ */
        $sql_devices = "CREATE TABLE $tbl_devices (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            device_hash VARCHAR(255) NOT NULL UNIQUE,
            user_agent TEXT NULL,
            navegador VARCHAR(255) NULL,
            dispositivo VARCHAR(255) NULL,
            ip VARCHAR(45) NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) $charset;";


        /* ============================================================
        TABELA: LOGS DO WHATSAPP
        ============================================================ */
        $sql_whatsapp_logs = "CREATE TABLE $tbl_whatsapp_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,
            chat_id VARCHAR(50) NOT NULL,
            direction ENUM('sent','received') NOT NULL,
            mensagem TEXT NULL,

            enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_chat (chat_id)
        ) $charset;";   

        /* ============================================================
        TABELA: ACEITES DE CONVIDADOS
        ============================================================ */
        $sql_aceites = "CREATE TABLE $tbl_aceites (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_convite BIGINT UNSIGNED NULL,
            id_evento INT UNSIGNED NOT NULL,
            id_servico BIGINT UNSIGNED NULL,
            id_termos_versao INT UNSIGNED NULL,

            nome VARCHAR(255) NULL,
            telefone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,

            ip VARCHAR(45) NULL,
            pais VARCHAR(100) NULL,
            estado VARCHAR(100) NULL,
            cidade VARCHAR(100) NULL,
            navegador VARCHAR(255) NULL,
            sistema_operacional VARCHAR(100) NULL,
            dispositivo VARCHAR(100) NULL,
            user_agent TEXT NULL,
            idioma_navegador VARCHAR(10) NULL,
            canal_origem VARCHAR(50) NULL,

            aceite_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status_envio VARCHAR(50) NULL DEFAULT 'pendente',

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_telefone (telefone),
            INDEX idx_email (email)
        ) $charset;";


        /* ============================================================
        TABELA: LOGS DO SISTEMA
        ============================================================ */
        $sql_logs = "CREATE TABLE $tbl_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            tipo VARCHAR(100) NOT NULL,

            id_evento INT UNSIGNED NULL,
            id_servico BIGINT UNSIGNED NULL,
            id_convite BIGINT UNSIGNED NULL,
            id_aceite BIGINT UNSIGNED NULL,

            mensagem TEXT NULL,

            ip VARCHAR(45) NULL,
            navegador VARCHAR(255) NULL,
            dispositivo VARCHAR(100) NULL,
            user_agent TEXT NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_tipo (tipo),
            INDEX idx_evento (id_evento)
        ) $charset;";


        /* ============================================================
        MÓDULO SERVIÇOS — CATÁLOGO BASE
        ============================================================ */
        $sql_servicos = "CREATE TABLE $tbl_servicos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            nome VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL UNIQUE,
            descricao TEXT NULL,

            ativo TINYINT(1) NOT NULL DEFAULT 1,
            ordem INT UNSIGNED NOT NULL DEFAULT 0,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_slug (slug),
            INDEX idx_ativo (ativo)
        ) $charset;";


        /* ============================================================
        MÓDULO IDEIAS FUTURAS
        ============================================================ */
        $sql_ideias_futuras = "CREATE TABLE $tbl_ideias_futuras (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            titulo VARCHAR(255) NOT NULL,
            descricao LONGTEXT NULL,
            categoria VARCHAR(100) NULL,
            sigilosa TINYINT(1) NOT NULL DEFAULT 0,
            tags TEXT NULL,
            status ENUM('nova','aprovada','em_andamento','concluida','descartada')
                NOT NULL DEFAULT 'nova',
            prioridade ENUM('baixa','media','alta','critica') NOT NULL DEFAULT 'media',

            autor_id BIGINT UNSIGNED NULL,
            criado_por BIGINT UNSIGNED NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_status (status),
            INDEX idx_prioridade (prioridade)
        ) $charset;";


        /* ============================================================
        MÓDULO PROJETOS
        ============================================================ */
        $sql_projetos = "CREATE TABLE $tbl_projetos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_ideia BIGINT UNSIGNED NULL,
            titulo VARCHAR(255) NOT NULL,
            descricao LONGTEXT NULL,
            status ENUM('planejado','em_andamento','pausado','concluido','cancelado')
                NOT NULL DEFAULT 'planejado',

            responsavel BIGINT UNSIGNED NULL,
            previsao_conclusao DATE NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_status (status),
            INDEX idx_ideia (id_ideia)
        ) $charset;";


        /* ============================================================
        TABELA FINANCEIRO — MOVIMENTOS
        ============================================================ */
        self::create_table_financeiro();


        /* ============================================================
        EXECUTAR TODAS AS TABELAS
        ============================================================ */
        dbDelta($sql_eventos);
        dbDelta($sql_event_services);
        dbDelta($sql_convites);
        dbDelta($sql_aceites);
        dbDelta($sql_acessos);
        dbDelta($sql_senhas);
        dbDelta($sql_logs);
        dbDelta($sql_termos);
        dbDelta($sql_aceite_contratante);

        // Módulo 5
        dbDelta($sql_event_items);
        dbDelta($sql_event_history);
        dbDelta($sql_event_messages);
        dbDelta($sql_contratantes);
        dbDelta($sql_clausulas);
        dbDelta($sql_contratos);
        dbDelta($sql_contratos_logs);

        /* ============================================================
        TABELA: BANCO DE LINKS DE PAGAMENTO
        ============================================================ */
        $tbl_links_pgto = $wpdb->prefix . 'pm_links_pagamento';
        $sql_links_pgto = "CREATE TABLE $tbl_links_pgto (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            forma ENUM('cartao','pix_infinitepay') NOT NULL,
            tipo_evento ENUM('social','corporativo','ambos') NOT NULL DEFAULT 'ambos',
            valor DECIMAL(10,2) NOT NULL,
            link TEXT NOT NULL,
            parcelas_max TINYINT UNSIGNED NOT NULL DEFAULT 1,
            valor_parcela DECIMAL(10,2) NULL,
            descricao VARCHAR(255) NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_forma_valor (forma, valor),
            INDEX idx_tipo_evento (tipo_evento)
        ) $charset;";
        dbDelta($sql_links_pgto);

        /* ============================================================
        TABELA: CONTAS BANCÁRIAS DA EMPRESA
        ============================================================ */
        $tbl_contas = $wpdb->prefix . 'pm_contas_bancarias';
        $sql_contas = "CREATE TABLE $tbl_contas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            tipo ENUM('pix','transferencia','ambos') NOT NULL DEFAULT 'pix',
            banco VARCHAR(100) NULL,
            beneficiario VARCHAR(255) NULL,
            chave_pix VARCHAR(255) NULL,
            tipo_chave ENUM('cnpj','cpf','email','celular','aleatoria') NULL,
            agencia VARCHAR(20) NULL,
            codigo_banco VARCHAR(10) NULL,
            conta VARCHAR(30) NULL,
            cnpj VARCHAR(20) NULL,
            principal TINYINT(1) NOT NULL DEFAULT 0,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_tipo (tipo),
            INDEX idx_principal (principal)
        ) $charset;";
        dbDelta($sql_contas);

        dbDelta($sql_aceites_evento);
        dbDelta($sql_acessos_evento);
        dbDelta($sql_compartilhamentos);
        dbDelta($sql_devices);
        dbDelta($sql_whatsapp_logs);

        dbDelta($sql_servicos);
        dbDelta($sql_servicos_subtipos);
        dbDelta($sql_servicos_pacotes);
        dbDelta($sql_servicos_regras);
        dbDelta($sql_eventos_servicos);

        dbDelta($sql_ideias_futuras);
        dbDelta($sql_projetos);

        /* ============================================================
           TABELA: CATEQUIZANDOS DA 1ª EUCARISTIA
           Suporta múltiplos catequizandos por contrato (irmãos/primos)
        ============================================================ */
        $tbl_catequizandos = $wpdb->prefix . 'pm_eucaristia_catequizandos';
        $sql_catequizandos = "CREATE TABLE $tbl_catequizandos (
            id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_evento INT UNSIGNED NOT NULL,
            nome      VARCHAR(255) NOT NULL,
            data_nascimento DATE NULL,
            grau_parentesco VARCHAR(100) NULL,
            ordem     TINYINT UNSIGNED NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_evento (id_evento)
        ) $charset;";
        dbDelta($sql_catequizandos);

        /* ============================================================
           MÓDULO TAREFAS
        ============================================================ */
        $tbl_tarefas = $wpdb->prefix . 'pm_tarefas';
        $sql_tarefas = "CREATE TABLE $tbl_tarefas (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento   INT UNSIGNED NOT NULL,
            id_contrato BIGINT UNSIGNED NULL,

            responsavel ENUM('photomusic','cliente') NOT NULL DEFAULT 'photomusic',
            tipo        VARCHAR(100) NOT NULL,
            descricao   TEXT NOT NULL,

            data_prevista DATE NULL,
            status ENUM('pendente','concluida','cancelada') NOT NULL DEFAULT 'pendente',

            notificacoes_enviadas INT UNSIGNED NOT NULL DEFAULT 0,
            confirmado_por VARCHAR(255) NULL,
            confirmado_em  DATETIME NULL,

            criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_status (status),
            INDEX idx_evento (id_evento),
            INDEX idx_responsavel (responsavel),
            INDEX idx_data_prevista (data_prevista)
        ) $charset;";
        dbDelta($sql_tarefas);

        /* ============================================================
           TABELA: TABELA DE PREÇOS DOS SERVIÇOS
        ============================================================ */
        $tbl_precos = $wpdb->prefix . 'pm_tabela_precos';
        $sql_precos = "CREATE TABLE $tbl_precos (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_servico INT UNSIGNED NOT NULL COMMENT 'FK para pm_servicos.id',
            tipo_evento VARCHAR(50) NOT NULL DEFAULT 'social'
                COMMENT 'social | corporativo_ate200 | corporativo_200mais',
            horas TINYINT UNSIGNED NULL COMMENT '2-10 para servicos horarios, NULL para Lembranca',
            qtd_fotos SMALLINT UNSIGNED NULL COMMENT 'Para Foto Lembranca: 60,100,150,200,300,400,500',
            valor DECIMAL(10,2) NOT NULL DEFAULT 0,
            gerado_automatico TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '0 = override manual (nao recalcular)',
            descricao TEXT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_preco (id_servico, tipo_evento, horas, qtd_fotos),
            INDEX idx_servico (id_servico),
            INDEX idx_tipo_evento (tipo_evento)
        ) $charset;";
        dbDelta($sql_precos);

        /* ============================================================
           TABELA: HISTÓRICO DE PREÇOS
        ============================================================ */
        $tbl_precos_hist = $wpdb->prefix . 'pm_tabela_precos_historico';
        $sql_precos_hist = "CREATE TABLE $tbl_precos_hist (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_preco INT UNSIGNED NOT NULL,
            id_servico INT UNSIGNED NOT NULL,
            tipo ENUM('servico','pacote') NOT NULL DEFAULT 'servico',
            tipo_evento VARCHAR(50) NOT NULL DEFAULT 'ambos',
            valor_anterior DECIMAL(10,2) NOT NULL,
            valor_novo DECIMAL(10,2) NOT NULL,
            alterado_por BIGINT UNSIGNED NULL,
            alterado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            motivo VARCHAR(255) NULL,
            INDEX idx_preco (id_preco),
            INDEX idx_servico (id_servico),
            INDEX idx_alterado_em (alterado_em)
        ) $charset;";
        dbDelta($sql_precos_hist);

    } // fim create_tables()

    private static function create_roles_and_caps() {

        /* ============================================================
        ROLES — PAPÉIS DO SISTEMA
        ============================================================ */

        add_role('photomusic_admin', 'PhotoMusic Admin', []);
        add_role('photomusic_user', 'PhotoMusic User', []);


        /* ============================================================
        CAPABILITIES — PADRÃO DO SISTEMA
        ============================================================ */

        $caps = [
            'pm_gerenciar_usuarios',
            'pm_ver_eventos',
            'pm_criar_eventos',
            'pm_editar_eventos',
            'pm_desativar_eventos',
            'pm_ver_dados_evento',
            'pm_gerar_pdf',
            'pm_gerar_excel',
            'pm_ver_logs',
            'pm_ver_contratos',
            'pm_criar_contratos',
            'pm_assinar_contratos',
            'pm_subir_contrato_assinado',
            'pm_cancelar_contratos',
            'photomusic_view_roadmap',
        ];


        /* ============================================================
        CAPABILITIES — IDEIAS FUTURAS E PROJETOS
        ============================================================ */

        $caps_ideias_projetos = [
            'pm_ideias_view',
            'pm_ideias_edit',
            'pm_ideias_priorizar',
            'pm_ideias_aprovar',
            'pm_projetos_criar',
            'pm_projetos_editar',
            'pm_projetos_concluir',
        ];


        /* ============================================================
        ATRIBUI CAPABILITIES AO PAPEL photomusic_admin
        ============================================================ */

        $role_admin = get_role('photomusic_admin');
        if ($role_admin) {

            // caps padrão
            foreach ($caps as $cap) {
                $role_admin->add_cap($cap);
            }

            // caps novas
            foreach ($caps_ideias_projetos as $cap) {
                $role_admin->add_cap($cap);
            }
        }


        /* ============================================================
        ATRIBUI CAPABILITIES AO PAPEL photomusic_user
        ============================================================ */

        $role_user = get_role('photomusic_user');
        if ($role_user) {

            // caps básicas
            $role_user->add_cap('pm_ver_eventos');
            $role_user->add_cap('pm_ideias_view');
            $role_user->add_cap('pm_ideias_edit'); // pode sugerir ideias
        }


        /* ============================================================
        ATRIBUI CAPABILITIES AO ADMINISTRADOR NATIVO DO WORDPRESS
        ============================================================ */

        $role_wp_admin = get_role('administrator');
        if ($role_wp_admin) {

            // caps padrão
            foreach ($caps as $cap) {
                $role_wp_admin->add_cap($cap);
            }

            // caps novas
            foreach ($caps_ideias_projetos as $cap) {
                $role_wp_admin->add_cap($cap);
            }
        }
        
        /* ============================================================
            ATRIBUIR CAPABILITIES AO ADMINISTRATOR DO WORDPRESS
            Garante que o admin nativo tenha acesso completo ao sistema
        ============================================================ */
        $admin_role = get_role('administrator');
        if ($admin_role) {
            $todas_caps = array_merge(
                $caps_eventos,
                $caps_contratos,
                $caps_financeiro,
                $caps_logs,
                $caps_ideias_projetos
            );
            $todas_caps[] = 'pm_gerenciar_usuarios';
            $todas_caps[] = 'photomusic_view_roadmap';

            foreach ($todas_caps as $cap) {
                $admin_role->add_cap($cap);
            }
        }

    }//Fim create_roles_and_caps()

    /**
     * Adiciona colunas novas em tabelas existentes (migrations)
     */
    public static function migrate() {
        global $wpdb;

        /* ============================================================
           TAREFAS — garantir tabela se plugin já estava ativo
        ============================================================ */
        $tbl_tarefas = $wpdb->prefix . 'pm_tarefas';
        $existe = $wpdb->get_var("SHOW TABLES LIKE '{$tbl_tarefas}'");
        if (!$existe) {
            $charset = $wpdb->get_charset_collate();
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            $sql = "CREATE TABLE $tbl_tarefas (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_evento   INT UNSIGNED NOT NULL,
                id_contrato BIGINT UNSIGNED NULL,
                responsavel ENUM('photomusic','cliente') NOT NULL DEFAULT 'photomusic',
                tipo        VARCHAR(100) NOT NULL,
                descricao   TEXT NOT NULL,
                data_prevista DATE NULL,
                status ENUM('pendente','concluida','cancelada') NOT NULL DEFAULT 'pendente',
                notificacoes_enviadas INT UNSIGNED NOT NULL DEFAULT 0,
                confirmado_por VARCHAR(255) NULL,
                confirmado_em  DATETIME NULL,
                criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_evento (id_evento),
                INDEX idx_responsavel (responsavel),
                INDEX idx_data_prevista (data_prevista)
            ) $charset;";
            dbDelta($sql);
        }

        $tbl_contratos = $wpdb->prefix . 'pm_contratos';

        // Adiciona coluna os_path se não existir
        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_contratos}` LIKE 'os_path'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE `{$tbl_contratos}` ADD COLUMN `os_path` VARCHAR(500) NULL AFTER `pdf_final`");
        }

        // Adiciona coluna forma_pagamento se não existir
        $col2 = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_contratos}` LIKE 'forma_pagamento'");
        if (empty($col2)) {
            $wpdb->query("ALTER TABLE `{$tbl_contratos}` ADD COLUMN `forma_pagamento` VARCHAR(100) NULL AFTER `os_path`");
        }

        // Adiciona coluna obs_pagamento se não existir
        $col3 = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_contratos}` LIKE 'obs_pagamento'");
        if (empty($col3)) {
            $wpdb->query("ALTER TABLE `{$tbl_contratos}` ADD COLUMN `obs_pagamento` TEXT NULL AFTER `forma_pagamento`");
        }

        // Adiciona coluna numero_contrato se não existir
        $col4 = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_contratos}` LIKE 'numero_contrato'");
        if (empty($col4)) {
            $wpdb->query("ALTER TABLE `{$tbl_contratos}` ADD COLUMN `numero_contrato` INT UNSIGNED NULL AFTER `id`");
        }

        // Adiciona coluna enviado_contratante_em se não existir (usado pelo lembrete automático)
        $col_env = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_contratos}` LIKE 'enviado_contratante_em'");
        if (empty($col_env)) {
            $wpdb->query("ALTER TABLE `{$tbl_contratos}` ADD COLUMN `enviado_contratante_em` DATETIME NULL AFTER `atualizado_em`");
        }

        // Adiciona coluna usuario_id em pm_event_history se não existir
        $tbl_hist = $wpdb->prefix . 'pm_event_history';
        $col_uid = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_hist}` LIKE 'usuario_id'");
        if (empty($col_uid)) {
            $wpdb->query("ALTER TABLE `{$tbl_hist}` ADD COLUMN `usuario_id` BIGINT UNSIGNED NULL AFTER `detalhes`");
        }

        // Agenda cron de lembrete diário (7h BRT = 10h UTC)
        if (class_exists('PhotoMusic_Contratos_Lembrete')) {
            PhotoMusic_Contratos_Lembrete::agendar();
        }

        // Adiciona coluna pagamento_config se não existir
        $tbl_eventos = $wpdb->prefix . 'pm_eventos';
        $col_pgto = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'pagamento_config'");
        if (empty($col_pgto)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `pagamento_config` LONGTEXT NULL");
        }

        // Adiciona colunas de confirmação de pagamento se não existirem
        $col_pgto_conf = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'pagamento_confirmado'");
        if (empty($col_pgto_conf)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `pagamento_confirmado` TINYINT(1) NOT NULL DEFAULT 0 AFTER `pagamento_config`");
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `pagamento_confirmado_em` DATETIME NULL AFTER `pagamento_confirmado`");
        }

        /* ============================================================
           GALERIA — links de fotoshare por evento
        ============================================================ */
        $tbl_eventos = $wpdb->prefix . 'pm_eventos';

        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'link_galeria_convidado'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `link_galeria_convidado` TEXT NULL");
        }

        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'link_galeria_contratante'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `link_galeria_contratante` TEXT NULL");
        }

        /* ============================================================
        GALERIA — GARANTE TABELA DE LOG DE VISUALIZAÇÃO
        ============================================================ */
        $tbl_views      = $wpdb->prefix . 'pm_galeria_views';
        $charset_collate = $wpdb->get_charset_collate();

        $wpdb->query("
            CREATE TABLE IF NOT EXISTS $tbl_views (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                id_evento BIGINT UNSIGNED NOT NULL,
                id_aceite BIGINT UNSIGNED NOT NULL,
                tipo_servico VARCHAR(50) DEFAULT NULL,
                nome_servico VARCHAR(255) DEFAULT NULL,
                total_views INT DEFAULT 1,
                primeiro_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
                ultimo_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                PRIMARY KEY (id),
                KEY idx_evento (id_evento),
                KEY idx_aceite (id_aceite)
            ) $charset_collate
        ");

        /* ============================================================
           PM_EVENTOS_SERVICOS — link de galeria por serviço do evento
        ============================================================ */
        $tbl_es = $wpdb->prefix . 'pm_eventos_servicos';

        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_es}` LIKE 'link_galeria'");
        if (empty($col)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_es}`
                 ADD COLUMN `link_galeria` VARCHAR(500) NULL DEFAULT NULL
                 COMMENT 'Link de acesso às fotos/vídeos deste serviço (Fotoshare, Drive etc.)'
                 AFTER `observacoes`"
            );
        }

        /* ============================================================
           PM_EVENTOS — flag de visibilidade no ChatBot
        ============================================================ */
        $tbl_eventos = $wpdb->prefix . 'pm_eventos';

        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'chatbot_ativo'");
        if (empty($col)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_eventos}`
                 ADD COLUMN `chatbot_ativo` TINYINT(1) NOT NULL DEFAULT 0
                 COMMENT 'Controla se o evento aparece no menu ChatBot (independente de data)'"
            );
        }

        // Índice para consulta rápida do ChatBot
        $idx = $wpdb->get_results("SHOW INDEX FROM `{$tbl_eventos}` WHERE Key_name = 'idx_chatbot_ativo'");
        if (empty($idx)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD INDEX `idx_chatbot_ativo` (`chatbot_ativo`)");
        }

        /* ============================================================
           PM_EVENTOS — token único do evento para link de aceite
        ============================================================ */
        $tbl_eventos_tok = $wpdb->prefix . 'pm_eventos';

        $col = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos_tok}` LIKE 'token_evento'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos_tok}` ADD COLUMN `token_evento` VARCHAR(64) NULL DEFAULT NULL");
        }

        $idx = $wpdb->get_results("SHOW INDEX FROM `{$tbl_eventos_tok}` WHERE Key_name = 'idx_token_evento'");
        if (empty($idx)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos_tok}` ADD UNIQUE INDEX `idx_token_evento` (`token_evento`)");
        }

        // Gera token para eventos que ainda não têm
        $wpdb->query(
            "UPDATE `{$tbl_eventos_tok}`
             SET token_evento = SHA2(CONCAT(id, '|', codigo_interno, '|', RAND()), 256)
             WHERE token_evento IS NULL OR token_evento = ''"
        );

        /* ============================================================
           ACEITES DO CONVIDADO — colunas de segurança e token
        ============================================================ */
        $tbl_aceites = $wpdb->prefix . 'pm_aceites_evento';

        $cols = [
            'token_acesso' => "VARCHAR(64) NULL",
            'device_hash'  => "VARCHAR(64) NULL",
            'versao_termo' => "VARCHAR(20) NOT NULL DEFAULT '1.0'",
            'origem'       => "VARCHAR(50) NULL",
            'idioma'       => "CHAR(2) NOT NULL DEFAULT 'pt'",
        ];

        foreach ($cols as $col_name => $col_def) {
            $exists = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_aceites}` LIKE '{$col_name}'");
            if (empty($exists)) {
                $wpdb->query("ALTER TABLE `{$tbl_aceites}` ADD COLUMN `{$col_name}` {$col_def}");
            }
        }

        // Índice único no token_acesso (ignora erro se já existir)
        $idx = $wpdb->get_results("SHOW INDEX FROM `{$tbl_aceites}` WHERE Key_name = 'idx_token_aceite'");
        if (empty($idx)) {
            $wpdb->query("ALTER TABLE `{$tbl_aceites}` ADD UNIQUE INDEX `idx_token_aceite` (`token_acesso`)");
        }

        /* ============================================================
           PM_EVENT_SERVICES — torna colunas opcionais e amplia ENUM
        ============================================================ */
        $tbl_es = $wpdb->prefix . 'pm_event_services';

        // Atualiza ENUM de tipo com todos os serviços da PhotoMusic
        $col_tipo = $wpdb->get_row("SHOW COLUMNS FROM `{$tbl_es}` LIKE 'tipo'");
        if ($col_tipo && strpos($col_tipo->Type, 'paparazzi_digital') === false) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_es}` MODIFY COLUMN `tipo`
                 ENUM('foto_cabine','totem','360','paparazzi_digital','paparazzi','lembranca','video','gif','outro') NOT NULL DEFAULT 'foto_cabine'"
            );
        }

        // Torna colunas não obrigatórias para facilitar cadastro rápido
        $col_lc = $wpdb->get_row("SHOW COLUMNS FROM `{$tbl_es}` LIKE 'link_contratante'");
        if ($col_lc && strpos($col_lc->Null, 'NO') !== false) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_es}` MODIFY COLUMN `link_contratante` VARCHAR(500) NULL DEFAULT ''"
            );
        }

        $col_ra = $wpdb->get_row("SHOW COLUMNS FROM `{$tbl_es}` LIKE 'regras_acesso'");
        if ($col_ra && strpos($col_ra->Null, 'NO') !== false) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_es}` MODIFY COLUMN `regras_acesso` LONGTEXT NULL"
            );
        }

        $col_pp = $wpdb->get_row("SHOW COLUMNS FROM `{$tbl_es}` LIKE 'pasta_protegida'");
        if ($col_pp && strpos($col_pp->Null, 'NO') !== false) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_es}` MODIFY COLUMN `pasta_protegida` VARCHAR(500) NULL DEFAULT ''"
            );
        }

        /* ============================================================
           PM_EVENTOS — campos específicos da 1ª Eucaristia
        ============================================================ */
        $cols_eucaristia = [
            'nome_catequista'           => "VARCHAR(255) NULL COMMENT 'Nome do(a) catequista'",
            'horario_catequese'         => "VARCHAR(100) NULL COMMENT 'Dia e horário da catequese'",
            'nome_paroquia'             => "VARCHAR(255) NULL COMMENT 'Nome da paróquia'",
            'nome_capela'               => "VARCHAR(255) NULL COMMENT 'Nome da capela'",
            'forma_pagamento_eucaristia'=> "ENUM('pix','cartao') NULL COMMENT 'Forma de pagamento escolhida pelo cliente'",
            'pre_cadastro_status'       => "ENUM('pendente','confirmado','cancelado') NULL COMMENT 'Status do pré-cadastro via formulário público'",
        ];
        foreach ($cols_eucaristia as $col_name => $col_def) {
            $exists = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE '{$col_name}'");
            if (empty($exists)) {
                $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `{$col_name}` {$col_def}");
            }
        }

        /* ============================================================
           PM_EUCARISTIA_CATEQUIZANDOS — cria tabela se não existir
        ============================================================ */
        $tbl_cat = $wpdb->prefix . 'pm_eucaristia_catequizandos';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_cat}'") !== $tbl_cat) {
            $wpdb->query("CREATE TABLE {$tbl_cat} (
                id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_evento INT UNSIGNED NOT NULL,
                nome      VARCHAR(255) NOT NULL,
                data_nascimento DATE NULL,
                grau_parentesco VARCHAR(100) NULL,
                ordem     TINYINT UNSIGNED NOT NULL DEFAULT 1,
                criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_evento (id_evento)
            ) {$charset};");
        }

        /* ============================================================
           PM_EVENTOS_SERVICOS — coluna descrição e label do adicional
        ============================================================ */
        $tbl_ev_serv = $wpdb->prefix . 'pm_eventos_servicos';

        $col_desc = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_ev_serv}` LIKE 'descricao'");
        if (empty($col_desc)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_ev_serv}`
                 ADD COLUMN `descricao` TEXT NULL
                 COMMENT 'Descrição detalhada do serviço contratado'
                 AFTER `observacoes`"
            );
        }

        $col_label = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_ev_serv}` LIKE 'label_adicional'");
        if (empty($col_label)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_ev_serv}`
                 ADD COLUMN `label_adicional` VARCHAR(100) NULL DEFAULT 'Deslocamento'
                 COMMENT 'Rótulo do valor adicional no contrato (ex: Deslocamento, Horas extras)'
                 AFTER `valor_adicional`"
            );
        }

        $col_hr = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_ev_serv}` LIKE 'horario_inicio'");
        if (empty($col_hr)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_ev_serv}`
                 ADD COLUMN `horario_inicio` TIME NULL DEFAULT NULL
                 COMMENT 'Horário de início individual deste serviço no evento'
                 AFTER `horas_contratadas`"
            );
        }

        /* ============================================================
           PM_EVENTOS — link de pagamento por cartão (por evento)
        ============================================================ */
        $tbl_eventos = $wpdb->prefix . 'pm_eventos';
        $col_lpc = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'link_pagamento_cartao'");
        if (empty($col_lpc)) {
            $wpdb->query(
                "ALTER TABLE `{$tbl_eventos}`
                 ADD COLUMN `link_pagamento_cartao` TEXT NULL
                 COMMENT 'Link de pagamento gerado externamente (Pagar.me, Stripe, etc.) para cartão'"
            );
        }

        $col_pgconf = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_eventos}` LIKE 'pagamento_confirmado'");
        if (empty($col_pgconf)) {
            $wpdb->query("ALTER TABLE `{$tbl_eventos}` ADD COLUMN `pagamento_confirmado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = pagamento confirmado pelo operador'");
        }

        // Garante pasta de contratos com proteção (idempotente)
        self::create_upload_dirs();

        // Garante páginas necessárias (idempotente)
        self::create_required_pages();

        /* ============================================================
           PM_GALERIA_VIEWS — colunas de rastreio de cliques por serviço
        ============================================================ */
        $tbl_views = $wpdb->prefix . 'pm_galeria_views';

        if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_views}'") === $tbl_views) {

            $cols_views = [
                'token_aceite'  => "VARCHAR(64) NULL",
                'total_cliques' => "INT UNSIGNED NOT NULL DEFAULT 0",
                'ultimo_clique' => "DATETIME NULL",
            ];

            foreach ($cols_views as $col_name => $col_def) {
                $exists = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_views}` LIKE '{$col_name}'");
                if (empty($exists)) {
                    $wpdb->query("ALTER TABLE `{$tbl_views}` ADD COLUMN `{$col_name}` {$col_def}");
                }
            }

            // Índice no token_aceite para lookup rápido
            $idx = $wpdb->get_results("SHOW INDEX FROM `{$tbl_views}` WHERE Key_name = 'idx_token_aceite'");
            if (empty($idx)) {
                $wpdb->query("ALTER TABLE `{$tbl_views}` ADD INDEX `idx_token_aceite` (`token_aceite`)");
            }
        }

        /* ============================================================
           PM_TABELA_PRECOS — cria se não existir (plugin já ativo)
        ============================================================ */
        $tbl_precos = $wpdb->prefix . 'pm_tabela_precos';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_precos}'") !== $tbl_precos) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            $charset = $wpdb->get_charset_collate();
            dbDelta("CREATE TABLE $tbl_precos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_servico INT UNSIGNED NOT NULL,
                tipo_evento VARCHAR(50) NOT NULL DEFAULT 'social',
                horas TINYINT UNSIGNED NULL,
                qtd_fotos SMALLINT UNSIGNED NULL,
                valor DECIMAL(10,2) NOT NULL DEFAULT 0,
                gerado_automatico TINYINT(1) NOT NULL DEFAULT 1,
                descricao TEXT NULL,
                ativo TINYINT(1) NOT NULL DEFAULT 1,
                criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_preco (id_servico, tipo_evento, horas, qtd_fotos),
                INDEX idx_servico (id_servico),
                INDEX idx_tipo_evento (tipo_evento)
            ) $charset;");
        } else {
            // Tabela existe mas pode ter o schema antigo — adiciona colunas se faltar
            $cols_precos = [
                'horas'             => 'TINYINT UNSIGNED NULL AFTER tipo_evento',
                'qtd_fotos'         => 'SMALLINT UNSIGNED NULL AFTER horas',
                'gerado_automatico' => 'TINYINT(1) NOT NULL DEFAULT 1 AFTER valor',
            ];
            foreach ($cols_precos as $col => $def) {
                $ex = $wpdb->get_results("SHOW COLUMNS FROM `{$tbl_precos}` LIKE '{$col}'");
                if (empty($ex)) {
                    $wpdb->query("ALTER TABLE `{$tbl_precos}` ADD COLUMN `{$col}` {$def}");
                }
            }
            // Adiciona UNIQUE KEY se não existir
            $uk = $wpdb->get_results("SHOW INDEX FROM `{$tbl_precos}` WHERE Key_name = 'uk_preco'");
            if (empty($uk)) {
                $wpdb->query("ALTER TABLE `{$tbl_precos}` ADD UNIQUE KEY `uk_preco` (`id_servico`, `tipo_evento`, `horas`, `qtd_fotos`)");
            }
        }

        $tbl_precos_hist = $wpdb->prefix . 'pm_tabela_precos_historico';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_precos_hist}'") !== $tbl_precos_hist) {
            $charset = isset($charset) ? $charset : $wpdb->get_charset_collate();
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            dbDelta("CREATE TABLE $tbl_precos_hist (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_preco INT UNSIGNED NOT NULL,
                id_servico INT UNSIGNED NOT NULL,
                tipo ENUM('servico','pacote') NOT NULL DEFAULT 'servico',
                tipo_evento VARCHAR(50) NOT NULL DEFAULT 'ambos',
                valor_anterior DECIMAL(10,2) NOT NULL,
                valor_novo DECIMAL(10,2) NOT NULL,
                alterado_por BIGINT UNSIGNED NULL,
                alterado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                motivo VARCHAR(255) NULL,
                INDEX idx_preco (id_preco),
                INDEX idx_servico (id_servico),
                INDEX idx_alterado_em (alterado_em)
            ) $charset;");
        }
    }

    /* ============================================================
    CRIA TABELA DE MOVIMENTOS FINANCEIROS
    ============================================================ */
    private static function create_table_financeiro() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        $tbl = $wpdb->prefix . 'pm_financeiro_movimentos';

        $sql = "CREATE TABLE $tbl (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

            id_evento BIGINT UNSIGNED NOT NULL,

            tipo ENUM('entrada','saida') NOT NULL DEFAULT 'entrada',
            categoria VARCHAR(100) NULL,
            descricao TEXT NULL,

            valor DECIMAL(10,2) NOT NULL DEFAULT 0,
            data_movimento DATE NULL,

            forma_pagamento VARCHAR(100) NULL,
            status_pagamento ENUM('pendente','pago','cancelado')
                NOT NULL DEFAULT 'pendente',

            observacoes TEXT NULL,
            registrado_por BIGINT UNSIGNED NULL,

            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_evento (id_evento),
            INDEX idx_tipo (tipo),
            INDEX idx_status (status_pagamento)
        ) $charset;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

}