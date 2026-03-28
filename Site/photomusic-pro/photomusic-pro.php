<?php
//photomusic-pro.php
/**
 * Plugin Name: PhotoMusic Pro
 * Description: Sistema completo de gestão de eventos, galerias, convites, contratos, financeiro e WhatsApp.
 * Version: 3.0
 * Author: PhotoMusic
 */

if (!defined('ABSPATH')) exit;

/* ============================================================
   DEFINIÇÃO DE CONSTANTES
============================================================ */
define('PHOTOMUSIC_PRO_PATH', plugin_dir_path(__FILE__));
define('PHOTOMUSIC_PRO_URL', plugin_dir_url(__FILE__));
define('PHOTOMUSIC_PRO_VERSION', '3.0');

/* ============================================================
   AUTOLOAD DE CLASSES
============================================================ */
function photomusic_pro_autoload_classes() {

    /* ---------------- ADMIN ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/admin/class-photomusic-roadmap-menu.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/admin/class-photomusic-ideias-futuras.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/admin/class-photomusic-projetos.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/admin/class-photomusic-dashboard.php';

    /* ---------------- CORE ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-installer.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-users.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-events.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-events-core.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-financeiro.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-logs.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-admin-menu.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-access-rules.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-token-generator.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-helpers.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-contratantes.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-config.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-agenda.php';

    /* ---------------- CONTRATANTE ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratante/class-photomusic-termo-contratante.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratante/class-photomusic-contratante.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratante/class-photomusic-painel-contratante.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratante/class-photomusic-aceites.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratante/class-photomusic-permissoes-operador.php';

    /* ---------------- CONVITES ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/convites/class-photomusic-convites.php';

    /* ---------------- CONTRATOS ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-route.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-shortcode.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-pdf.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-clausulas.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-list.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-edit.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-view.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-actions.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-logs.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-email.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-whatsapp.php';
    if (file_exists(PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-os.php')) {
        require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-os.php';
    }
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-contratos-permissoes.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/contratos/class-photomusic-assinatura-admin.php';

    /* ---------------- GALERIA ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-galeria.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-gallery-endpoint.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-file-endpoint.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-galeria-routes.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-controller-galeria.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-aceite-evento.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-aceite-endpoint.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/galeria/class-photomusic-eventos-api.php';

    /* ---------------- SERVIÇOS ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/servicos/class-photomusic-servicos.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/servicos/class-photomusic-itens.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/servicos/class-photomusic-pagamentos.php';

    /* ---------------- EMPRESA ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/empresa/class-photomusic-empresa.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/empresa/class-photomusic-representantes.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/empresa/class-photomusic-helpers-representantes.php';

    /* ---------------- WHATSAPP ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/whatsapp/class-photomusic-whatsapp.php';
    require_once PHOTOMUSIC_PRO_PATH . 'includes/whatsapp/class-photomusic-whatsapp-settings.php';

    /* ---------------- STATS ---------------- */
    require_once PHOTOMUSIC_PRO_PATH . 'includes/stats/class-photomusic-stats.php';

    /* ---------------- SECURITY ---------------- */
    // .htaccess já está na pasta, não precisa carregar

    /* ---------------- LIBS ---------------- */
    if (file_exists(PHOTOMUSIC_PRO_PATH . 'libs/tcpdf/tcpdf.php')) {
       require_once PHOTOMUSIC_PRO_PATH . 'libs/tcpdf/tcpdf.php';
    }

}
add_action('plugins_loaded', 'photomusic_pro_autoload_classes');

/* ============================================================
   INSTALAÇÃO DO PLUGIN
============================================================ */
// Carrega o installer ANTES do hook de ativação
require_once PHOTOMUSIC_PRO_PATH . 'includes/core/class-photomusic-installer.php';
register_activation_hook(__FILE__, ['PhotoMusic_Installer', 'activate']);

/* ============================================================
   INICIALIZAÇÃO DE MÓDULOS
============================================================ */
// DEPOIS — versão corrigida:
function photomusic_pro_init_modules() {

   // Menu Roadmap + Ideias + Projetos
   new PhotoMusic_Roadmap_Menu();
   PhotoMusic_Ideias_Futuras::init();
   PhotoMusic_Projetos::init();
   PhotoMusic_Dashboard::init();

   // Rotas da galeria
   new PhotoMusic_Galeria_Routes();

   // Menu administrativo principal
   PhotoMusic_Events::init();       // ← Eventos primeiro
   PhotoMusic_Admin_Menu::init();   // ← resto dos submenus depois

   // Empresa, representantes e permissões
   PhotoMusic_Empresa::init();             // ← ADICIONAR
   PhotoMusic_Representantes::init();      // ← ADICIONAR
   PhotoMusic_Permissoes_Operador::init(); // ← ADICIONAR

   // Cláusulas e WhatsApp
   PhotoMusic_Clausulas::init();           // ← ADICIONAR
   PhotoMusic_WhatsApp_Settings::init();   // ← ADICIONAR

   // WhatsApp
   new PhotoMusic_WhatsApp();

   // Contratos (ações, permissões, rotas públicas e shortcode)
   PhotoMusic_Contratos_Actions::init();
   PhotoMusic_Contratos_Permissoes::init();
   PhotoMusic_Contratos_Route::init();
   PhotoMusic_Contratos_Shortcode::init();

   // Painel do contratante
   PhotoMusic_Painel_Contratante::init();

   // Endpoints da galeria
   new PhotoMusic_Gallery_Endpoint();
   new PhotoMusic_File_Endpoint();
   new PhotoMusic_Aceite_Endpoint();

   // Configurações
   PhotoMusic_Config::init();

   // Serviços
   PhotoMusic_Servicos::init();

   // Migration de banco de dados
   PhotoMusic_Installer::migrate();

   // API REST para o ChatBot
   PhotoMusic_Eventos_API::init();

   // Gera chave de API do ChatBot se ainda não existir
   if (!get_option('pm_chatbot_api_key')) {
       update_option('pm_chatbot_api_key', wp_generate_password(32, false));
   }

   // Agenda
   PhotoMusic_Agenda::init();
}
add_action('init', 'photomusic_pro_init_modules');
