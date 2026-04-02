<?php
// includes/galeria/class-photomusic-galeria-routes.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Galeria_Routes {

    public function __construct() {
        // Se init já disparou (ex: classe instanciada dentro do próprio init),
        // chama add_rewrite_rules() diretamente para garantir que as regras
        // entrem em $wp_rewrite->extra_rules_top antes de qualquer flush_rules().
        if ( did_action('init') ) {
            $this->add_rewrite_rules();
        } else {
            add_action('init', [$this, 'add_rewrite_rules']);
        }
        add_filter('query_vars', [$this, 'add_query_vars']);
        add_action('template_redirect', [$this, 'route_handler']);
    }

    /* ============================================================
       REGISTRA AS ROTAS AMIGÁVEIS
    ============================================================ */
    public function add_rewrite_rules() {

        // Formulário de aceite
        add_rewrite_rule(
            '^galeria/([^/]+)/aceite/?$',
            'index.php?pm_evento_slug=$matches[1]&pm_galeria_acao=aceite',
            'top'
        );

        // Galeria protegida
        add_rewrite_rule(
            '^galeria/([^/]+)/?$',
            'index.php?pm_evento_slug=$matches[1]&pm_galeria_acao=galeria',
            'top'
        );
    }

    /* ============================================================
       REGISTRA AS VARIÁVEIS DE QUERY
    ============================================================ */
    public function add_query_vars($vars) {
        $vars[] = 'pm_evento_slug';
        $vars[] = 'pm_galeria_acao';
        return $vars;
    }

    /* ============================================================
       MANIPULA AS ROTAS E CHAMA O CONTROLADOR CORRETO
    ============================================================ */
    public function route_handler() {

        $slug = sanitize_title(get_query_var('pm_evento_slug'));
        $acao = sanitize_text_field(get_query_var('pm_galeria_acao'));

        if (!$slug || !$acao) {
            return; // Não é rota da galeria
        }

        // Carregar classes necessárias
        require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-aceite-evento.php';
        require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-controller-galeria.php';

        global $wpdb;
        $tbl_eventos = $wpdb->prefix . 'pm_eventos';

        // Buscar evento pelo slug
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_eventos WHERE codigo_interno = %s",
            $slug
        ));

        if (!$evento) {
            wp_die('Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            wp_die('Este evento está desativado.');
        }

        /* ============================================================
           ROTA: FORMULÁRIO DE ACEITE
        ============================================================ */
        if ($acao === 'aceite') {

            $aceite = new PhotoMusic_Aceite_Evento();

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $aceite->processar_aceite($evento->id);
                exit;
            }

            get_header();
            $aceite->render_form($evento);
            get_footer();
            exit;
        }

        /* ============================================================
           ROTA: GALERIA PROTEGIDA
        ============================================================ */
        if ($acao === 'galeria') {

            $controller = new PhotoMusic_Galeria_Controller();

            get_header();
            $controller->handle_request();
            get_footer();
            exit;
        }
    }
}
