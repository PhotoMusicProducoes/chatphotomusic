<?php
// includes/whatsapp/class-photomusic-whatsapp-settings.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_WhatsApp_Settings {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_settings_page']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
    }

    /**
     * Adiciona submenu em PhotoMusic → Configurações → WhatsApp
     */
    public static function register_settings_page() {

        add_submenu_page(
            'photomusic-eventos',
            'Configurações do WhatsApp',
            'WhatsApp',
            'pm_gerenciar_usuarios',
            'photomusic-whatsapp',
            [__CLASS__, 'render_page']
        );
    }

    /**
     * Registra opções no banco de dados
     */
    public static function register_settings() {

        // Provedor
        register_setting('pm_whatsapp_group', 'pm_whatsapp_provider', 'sanitize_text_field');

        // Z-API
        register_setting('pm_whatsapp_group', 'pm_zapi_instance',     'sanitize_text_field');
        register_setting('pm_whatsapp_group', 'pm_zapi_token',        'sanitize_text_field');
        register_setting('pm_whatsapp_group', 'pm_zapi_client_token', 'sanitize_text_field');

        // DSLBoot
        register_setting('pm_whatsapp_group', 'pm_dslboot_url', 'esc_url_raw');
        register_setting('pm_whatsapp_group', 'pm_dslboot_key', 'sanitize_text_field');

        // LumaBoot
        register_setting('pm_whatsapp_group', 'pm_lumaboot_url', 'esc_url_raw');
        register_setting('pm_whatsapp_group', 'pm_lumaboot_key', 'sanitize_text_field');

        // API genérica
        register_setting('pm_whatsapp_group', 'pm_generic_api_url', 'esc_url_raw');
        register_setting('pm_whatsapp_group', 'pm_generic_api_key', 'sanitize_text_field');

        // Mensagens padrão
        register_setting('pm_whatsapp_group', 'pm_msg_convite', 'wp_kses_post');
        register_setting('pm_whatsapp_group', 'pm_msg_contratante', 'wp_kses_post');
    }

    /**
     * Renderiza a página de configurações
     */
    public static function render_page() {
        ?>
        <div class="wrap">
            <h1>Configurações do WhatsApp</h1>
            <p>Configure aqui o envio automático de mensagens via WhatsApp.</p>

            <form method="post" action="options.php">
                <?php settings_fields('pm_whatsapp_group'); ?>
                <?php do_settings_sections('pm_whatsapp_group'); ?>

                <h2>Provedor de Envio</h2>
                <select name="pm_whatsapp_provider">
                    <option value="zapi"        <?php selected(get_option('pm_whatsapp_provider', 'zapi'), 'zapi'); ?>>Z-API (ChatBot PhotoMusic Pro)</option>
                    <option value="dslboot"     <?php selected(get_option('pm_whatsapp_provider', 'zapi'), 'dslboot'); ?>>DSLBoot</option>
                    <option value="lumaboot"    <?php selected(get_option('pm_whatsapp_provider', 'zapi'), 'lumaboot'); ?>>LumaBoot</option>
                    <option value="api_generica"<?php selected(get_option('pm_whatsapp_provider', 'zapi'), 'api_generica'); ?>>API Genérica</option>
                </select>

                <hr>

                <h2>Configurações Z-API</h2>
                <table class="form-table">
                    <tr><th>Instance ID</th><td><input type="text" name="pm_zapi_instance" value="<?php echo esc_attr(get_option('pm_zapi_instance')); ?>" class="regular-text" placeholder="Ex: 3EBC850F6AA9F27151BB5A0F33A263Z9"></td></tr>
                    <tr><th>Token</th><td><input type="text" name="pm_zapi_token" value="<?php echo esc_attr(get_option('pm_zapi_token')); ?>" class="regular-text" placeholder="Ex: DE2217CB1BSBBE0F420A3C66"></td></tr>
                    <tr><th>Client Token</th><td><input type="text" name="pm_zapi_client_token" value="<?php echo esc_attr(get_option('pm_zapi_client_token')); ?>" class="regular-text" placeholder="Ex: Bc06a4aeb96598a1db821a469cb145f06B"></td></tr>
                </table>

                <hr>

                <h2>Configurações DSLBoot</h2>
                <p><input type="text" name="pm_dslboot_url" value="<?php echo esc_attr(get_option('pm_dslboot_url')); ?>" placeholder="URL da API DSLBoot" size="60"></p>
                <p><input type="text" name="pm_dslboot_key" value="<?php echo esc_attr(get_option('pm_dslboot_key')); ?>" placeholder="Chave da API DSLBoot" size="60"></p>

                <hr>

                <h2>Configurações LumaBoot</h2>
                <p><input type="text" name="pm_lumaboot_url" value="<?php echo esc_attr(get_option('pm_lumaboot_url')); ?>" placeholder="URL da API LumaBoot" size="60"></p>
                <p><input type="text" name="pm_lumaboot_key" value="<?php echo esc_attr(get_option('pm_lumaboot_key')); ?>" placeholder="Chave da API LumaBoot" size="60"></p>

                <hr>

                <h2>API Genérica (Opcional)</h2>
                <p><input type="text" name="pm_generic_api_url" value="<?php echo esc_attr(get_option('pm_generic_api_url')); ?>" placeholder="URL da API Genérica" size="60"></p>
                <p><input type="text" name="pm_generic_api_key" value="<?php echo esc_attr(get_option('pm_generic_api_key')); ?>" placeholder="Chave da API Genérica" size="60"></p>

                <hr>

                <h2>Mensagens Padrão</h2>

                <p><strong>Mensagem de Convite</strong></p>
                <textarea name="pm_msg_convite" rows="4" cols="80" placeholder="Olá {nome}, aqui está seu acesso: {link}">
<?php echo esc_textarea(get_option('pm_msg_convite')); ?></textarea>

                <p><strong>Mensagem do Contratante</strong></p>
                <textarea name="pm_msg_contratante" rows="4" cols="80" placeholder="Olá, aqui está o acesso ao painel do contratante: {link}">
<?php echo esc_textarea(get_option('pm_msg_contratante')); ?></textarea>

                <hr>

                <?php submit_button(); ?>
            </form>

            <!-- ================================================
                 CHAVE DE API DO CHATBOT (somente leitura)
            ================================================ -->
            <hr>
            <h2>🤖 API do ChatBot (PhotoMusic Pro)</h2>
            <p>Cole esta chave no arquivo <code>utils/config.js</code> do ChatBot, na variável <code>PM_API_KEY</code>.</p>

            <?php $api_key = get_option('pm_chatbot_api_key', ''); ?>

            <?php if ($api_key): ?>
                <p>
                    <code style="background:#f0f0f0;padding:6px 12px;border-radius:4px;font-size:14px;letter-spacing:1px;">
                        <?php echo esc_html($api_key); ?>
                    </code>
                    &nbsp;
                    <button type="button" class="button button-secondary"
                        onclick="navigator.clipboard.writeText('<?php echo esc_js($api_key); ?>').then(()=>this.textContent='✅ Copiada!').catch(()=>{})">
                        Copiar chave
                    </button>
                </p>
            <?php else: ?>
                <p style="color:#a00;">Chave não gerada ainda. Recarregue a página.</p>
            <?php endif; ?>

            <p style="color:#555;font-size:0.9em;">
                Endpoint: <code><?php echo esc_html(get_rest_url(null, 'photomusic/v1/eventos-hoje')); ?></code><br>
                Header necessário: <code>X-PM-API-Key: [chave acima]</code>
            </p>

        </div>
        <?php
    }
}
