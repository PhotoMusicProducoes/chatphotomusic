<?php
// includes/contratos/class-photomusic-contratos-route.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Route {

    /* ============================================================
       INICIALIZA A ROTA PERSONALIZADA
       ============================================================ */
    public static function init() {
        add_action('init', [__CLASS__, 'add_rewrite_rule']);
        add_filter('query_vars', [__CLASS__, 'add_query_vars']);
        add_action('template_redirect', [__CLASS__, 'handle_route']);
    }

    /* ============================================================
       REGISTRA A ROTA /contrato/{token}
       ============================================================ */
    public static function add_rewrite_rule() {
        add_rewrite_rule(
            '^contrato/([^/]+)/?$',
            'index.php?pm_contrato_token=$matches[1]',
            'top'
        );
    }

    /* ============================================================
       REGISTRA A QUERY VAR pm_contrato_token
       ============================================================ */
    public static function add_query_vars($vars) {
        $vars[] = 'pm_contrato_token';
        return $vars;
    }

    /* ============================================================
       INTERCEPTA A ROTA E CARREGA A PÁGINA DO ELEMENTOR
       ============================================================ */
    public static function handle_route() {
        $token = get_query_var('pm_contrato_token');

        if (empty($token)) {
            return;
        }

        // Sanitiza o token apenas para garantir formato seguro na query var
        $token = sanitize_text_field($token);

        // Garante que o token fique disponível globalmente (shortcode, Elementor, etc.)
        $GLOBALS['photomusic_contrato_token'] = $token;

        $page_id = self::get_contrato_page_id();

        if (!$page_id || !get_post($page_id)) {
            wp_die('Página de assinatura de contrato não configurada ou inexistente.');
        }

        echo self::render_page($page_id);
        exit;
    }

    /* ============================================================
       OBTÉM A PÁGINA COM O SHORTCODE [photomusic_contrato]
       Prioridade:
       1. Opção manual salva em photomusic_contrato_page
       2. Busca automática por página que contém [photomusic_contrato]
       3. Busca por slug assinatura-de-contrato ou assinatura-de-contrato-2
       ============================================================ */
    protected static function get_contrato_page_id() {

        // 1. Opção configurada manualmente
        $id = (int) get_option('photomusic_contrato_page');
        if ($id && get_post($id)) {
            return $id;
        }

        // 2. Busca por shortcode no conteúdo
        $pages = get_posts([
            'post_type'   => 'page',
            'post_status' => 'publish',
            's'           => 'photomusic_contrato',
            'numberposts' => 1,
        ]);
        if (!empty($pages)) {
            return $pages[0]->ID;
        }

        // 3. Busca por slug conhecido
        foreach (['assinatura-de-contrato', 'assinatura-de-contrato-2'] as $slug) {
            $page = get_page_by_path($slug);
            if ($page) {
                return $page->ID;
            }
        }

        return 0;
    }

    /* ============================================================
       RENDERIZA A PÁGINA DO ELEMENTOR
       ============================================================ */
    protected static function render_page($page_id) {
        global $wp_query;

        $post = get_post($page_id);
        if (!$post) {
            wp_die('Página de contrato não encontrada.');
        }

        $wp_query->post        = $post;
        $wp_query->posts       = [$post];
        $wp_query->post_count  = 1;
        $wp_query->is_page     = true;
        $wp_query->is_singular = true;
        $wp_query->is_home     = false;
        $wp_query->is_404      = false;

        setup_postdata($post);

        ob_start();
        include get_page_template();
        wp_reset_postdata();

        return ob_get_clean();
    }
}
