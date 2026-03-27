<?php
// /includes/contratante/class-photomusic-painel-contratante.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Painel_Contratante {

    public static function init() {
        add_shortcode('painel_contratante', [__CLASS__, 'render_painel']);
        add_action('init', [__CLASS__, 'processar_envio_whatsapp']);
        add_action('init', [__CLASS__, 'processar_envio_whatsapp_servico']);
        add_action('init', [__CLASS__, 'processar_export_csv_aceites']);
    }

    /* ============================================================
       RENDERIZA O PAINEL DO CONTRATANTE
       Shortcode: [painel_contratante]
       URL: /painel-contratante/?token=CTR_xxxxx
    ============================================================ */
    public static function render_painel() {

        // Lê o token da URL
        $token = sanitize_text_field($_GET['token'] ?? '');

        if (empty($token)) {
            return '<p>Link inválido. Solicite um novo link à PhotoMusic.</p>';
        }

        // Valida token e carrega contratante + evento
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) {
            return '<p>Link inválido ou não reconhecido.</p>';
        }

        $id_evento = intval($contratante->id_evento);

        // Evento desativado
        if ($contratante->status_evento === 'desativado') {
            return '<p>Este evento foi encerrado.</p>';
        }

        // Segurança: device deve ter aceitado o termo
        if (!PhotoMusic_Contratante::device_aceitou($id_evento)) {
            wp_redirect(home_url('/termo-contratante/?token=' . urlencode($token)));
            exit;
        }

        // Registra acesso do device
        PhotoMusic_Contratante::registrar_acesso($id_evento);

        // Carrega dados do evento
        $evento = PhotoMusic_Events::get_event($id_evento);
        if (!$evento) {
            return '<p>Evento não encontrado.</p>';
        }

        // Serviços do evento — usa PhotoMusic_Servicos (nome correto da classe)
        $servicos = class_exists('PhotoMusic_Servicos')
            ? PhotoMusic_Servicos::get_evento_servicos($id_evento)
            : [];

        // Status do termo — verifica se ALGUÉM aceitou (para badge no painel)
        $termo_aceito = class_exists('PhotoMusic_Termo_Contratante')
            ? PhotoMusic_Termo_Contratante::contratante_aceitou($id_evento)
            : false;

        // Estatísticas
        $stats = class_exists('PhotoMusic_Stats')
            ? PhotoMusic_Stats::get_event_stats($id_evento)
            : [];

        // Mensagens de feedback vindas de redirect
        $ok_msg   = !empty($_GET['ok'])
            ? '<div style="background:#e6f6e9;border:1px solid #bfe8c9;padding:10px 14px;border-radius:4px;margin-bottom:16px;color:#1b7f3b;">Mensagem enviada com sucesso.</div>'
            : '';
        $erro_msg = !empty($_GET['erro'])
            ? '<div style="background:#fce8e8;border:1px solid #f5c6c6;padding:10px 14px;border-radius:4px;margin-bottom:16px;color:#b32d2e;">' . esc_html($_GET['erro']) . '</div>'
            : '';

        global $wpdb;

        // Aceites únicos do evento
        $aceites = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_aceites
             WHERE id_evento = %d
             GROUP BY telefone, email
             ORDER BY aceite_em DESC",
            $id_evento
        ));

        $total_aceites = is_array($aceites) ? count($aceites) : 0;

        // URL de exportação CSV — passa token em vez de evento
        $export_url = wp_nonce_url(
            add_query_arg([
                'pm_export_aceites' => '1',
                'token'             => $token,
            ], home_url('/')),
            'pm_export_aceites_' . $id_evento
        );

        // URL base do painel para redirects internos
        $painel_url = home_url('/painel-contratante/?token=' . urlencode($token));

        ob_start();
        ?>

        <style>
            .pm-painel-wrap {
                max-width: 960px;
                margin: 20px auto;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .pm-painel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 20px;
            }
            .pm-painel-card {
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px 20px;
                margin-bottom: 20px;
            }
            .pm-painel-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 15px;
            }
            .pm-tag {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: .05em;
            }
            .pm-tag-ok      { background: #e6f6e9; color: #1b7f3b; }
            .pm-tag-pendente{ background: #fff4e5; color: #a66300; }
            .pm-stat-label  { font-size: 12px; color: #666; }
            .pm-stat-value  { font-size: 18px; font-weight: 600; }
            .pm-servico-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .pm-servico-nome { font-weight: 600; }
            .pm-servico-tipo { font-size: 12px; color: #666; }
            .pm-servico-acoes {
                margin-top: 10px;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .pm-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #f7f7f7;
                font-size: 12px;
                cursor: pointer;
                text-decoration: none;
                color: #222;
            }
            .pm-btn-primary { background: #2271b1; border-color: #2271b1; color: #fff; }
            .pm-btn-outline  { background: #fff; }
            .pm-btn-small   { font-size: 11px; padding: 3px 8px; }
            .pm-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.6;
                border: 1px solid transparent;
            }
            .pm-badge-ok  { background: #e6f6e9; color: #1b7f3b; border-color: #bfe8c9; }
            .pm-badge-new { background: #fff4e5; color: #a66300; border-color: #ffd7a8; }
            .pm-row-new   { background: #fffaf2; }
            .pm-muted     { color: #666; font-size: 12px; }
        </style>

        <div class="pm-painel-wrap">

            <?php echo $ok_msg . $erro_msg; ?>

            <!-- CABEÇALHO -->
            <div class="pm-painel-card pm-painel-header">
                <div>
                    <h2 style="margin:0;">Painel do Contratante</h2>
                    <p style="margin:4px 0 0;">
                        <strong>Evento:</strong> <?php echo esc_html($evento->motivo_evento ?? ''); ?><br>
                        <strong>Data:</strong> <?php echo esc_html($evento->data_evento ?? ''); ?>
                    </p>
                </div>
                <div>
                    <!-- Enviar link do painel via WhatsApp -->
                    <form method="post" style="margin:0 0 8px 0;">
                        <?php wp_nonce_field('pm_whatsapp_contratante', 'pm_nonce'); ?>
                        <input type="hidden" name="pm_enviar_whatsapp_contratante" value="1">
                        <input type="hidden" name="pm_token" value="<?php echo esc_attr($token); ?>">
                        <button type="submit" class="pm-btn pm-btn-primary">
                            Enviar link via WhatsApp
                        </button>
                    </form>

                    <!-- Badge de termo -->
                    <div style="margin-top:4px;">
                        <?php if ($termo_aceito): ?>
                            <span class="pm-tag pm-tag-ok">Termo aceito</span>
                        <?php else: ?>
                            <span class="pm-tag pm-tag-pendente">Termo pendente</span>
                        <?php endif; ?>
                    </div>

                    <!-- Botão Sair -->
                    <div style="margin-top:8px;">
                        <a href="<?php echo esc_url(home_url('/sair-contratante/?token=' . urlencode($token))); ?>"
                           class="pm-btn pm-btn-outline pm-btn-small"
                           style="color:#b32d2e; border-color:#b32d2e;">
                            Sair
                        </a>
                    </div>
                </div>
            </div>

            <!-- ESTATÍSTICAS -->
            <div class="pm-painel-card">
                <h3>Visão geral de acessos</h3>
                <div class="pm-painel-grid">
                    <div>
                        <div class="pm-stat-label">Acessos totais (convidados)</div>
                        <div class="pm-stat-value"><?php echo intval($stats['acessos_convidados_total'] ?? 0); ?></div>
                    </div>
                    <div>
                        <div class="pm-stat-label">Acessos hoje (convidados)</div>
                        <div class="pm-stat-value"><?php echo intval($stats['acessos_convidados_hoje'] ?? 0); ?></div>
                    </div>
                    <div>
                        <div class="pm-stat-label">Acessos do contratante</div>
                        <div class="pm-stat-value"><?php echo intval($stats['acessos_contratante'] ?? 0); ?></div>
                    </div>
                    <div>
                        <div class="pm-stat-label">Aceites registrados (únicos)</div>
                        <div class="pm-stat-value"><?php echo intval($total_aceites); ?></div>
                    </div>
                </div>
            </div>

            <!-- ACEITES -->
            <div class="pm-painel-card">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                        <h3 style="margin:0;">Aceites do Evento</h3>
                        <div class="pm-muted">Aceites únicos por pessoa (sem duplicidade).</div>
                    </div>
                    <a class="pm-btn pm-btn-outline pm-btn-small" href="<?php echo esc_url($export_url); ?>">
                        Exportar CSV
                    </a>
                </div>

                <div style="height:12px;"></div>

                <?php if (empty($aceites)): ?>
                    <p>Nenhum aceite registrado.</p>
                <?php else: ?>
                    <table class="widefat striped">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Contato</th>
                                <th>Dispositivo</th>
                                <th>Navegador</th>
                                <th>Status</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($aceites as $a): ?>
                                <?php
                                $ts     = !empty($a->aceite_em) ? strtotime($a->aceite_em) : 0;
                                $is_new = $ts && ($ts >= (time() - 24 * 3600));
                                $d      = strtolower($a->dispositivo ?? '');
                                $icon   = (strpos($d, 'iphone') !== false || strpos($d, 'android') !== false || strpos($d, 'ipad') !== false)
                                    ? '📱' : '💻';
                                ?>
                                <tr class="<?php echo $is_new ? 'pm-row-new' : ''; ?>">
                                    <td><?php echo esc_html($a->nome); ?></td>
                                    <td>
                                        <div><strong><?php echo esc_html($a->telefone); ?></strong></div>
                                        <div class="pm-muted"><?php echo esc_html($a->email); ?></div>
                                    </td>
                                    <td><?php echo $icon . ' ' . esc_html($a->dispositivo); ?></td>
                                    <td>🌐 <?php echo esc_html($a->navegador ?? 'Desconhecido'); ?></td>
                                    <td>
                                        <?php if ($is_new): ?>
                                            <span class="pm-badge pm-badge-new">Novo (24h)</span>
                                        <?php else: ?>
                                            <span class="pm-badge pm-badge-ok">Confirmado</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($a->aceite_em); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>

            <!-- SERVIÇOS -->
            <div class="pm-painel-card">
                <h3>Serviços do evento</h3>

                <?php if (empty($servicos)): ?>
                    <p>Nenhum serviço cadastrado para este evento.</p>
                <?php else: ?>
                    <?php foreach ($servicos as $s): ?>
                        <?php
                        $link_galeria = home_url("/galeria/{$s->slug_servico}/?contratante={$id_evento}");
                        ?>
                        <div style="border-bottom:1px solid #eee; padding:10px 0;">
                            <div class="pm-servico-header">
                                <div>
                                    <div class="pm-servico-nome"><?php echo esc_html($s->nome_servico); ?></div>
                                    <div class="pm-servico-tipo">
                                        Tipo: <?php echo esc_html($s->tipo ?? $s->tipo_servico ?? ''); ?>
                                    </div>
                                </div>
                                <div>
                                    <span class="pm-tag <?php echo ($s->status_servico ?? '') === 'ativo' ? 'pm-tag-ok' : 'pm-tag-pendente'; ?>">
                                        <?php echo ($s->status_servico ?? '') === 'ativo' ? 'Ativo' : 'Desativado'; ?>
                                    </span>
                                </div>
                            </div>

                            <div class="pm-servico-acoes">
                                <a href="<?php echo esc_url($link_galeria); ?>"
                                   target="_blank"
                                   class="pm-btn pm-btn-primary pm-btn-small">
                                    Abrir galeria
                                </a>

                                <button type="button"
                                        class="pm-btn pm-btn-outline pm-btn-small"
                                        onclick="navigator.clipboard.writeText('<?php echo esc_js($link_galeria); ?>'); alert('Link copiado!');">
                                    Copiar link
                                </button>

                                <form method="post" style="display:inline;">
                                    <?php wp_nonce_field('pm_whatsapp_servico', 'pm_nonce_servico'); ?>
                                    <input type="hidden" name="pm_enviar_whatsapp_servico" value="1">
                                    <input type="hidden" name="pm_token"    value="<?php echo esc_attr($token); ?>">
                                    <input type="hidden" name="id_servico"  value="<?php echo esc_attr($s->id); ?>">
                                    <button type="submit" class="pm-btn pm-btn-outline pm-btn-small">
                                        Enviar link via WhatsApp
                                    </button>
                                </form>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

        </div>

        <?php
        return ob_get_clean();
    }

    /* ============================================================
       PROCESSA ENVIO DE WHATSAPP — link do painel
    ============================================================ */
    public static function processar_envio_whatsapp() {

        if (!isset($_POST['pm_enviar_whatsapp_contratante'])) return;

        if (!wp_verify_nonce($_POST['pm_nonce'] ?? '', 'pm_whatsapp_contratante')) return;

        $token     = sanitize_text_field($_POST['pm_token'] ?? '');
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) wp_die('Token inválido.');

        $id_evento = intval($contratante->id_evento);
        $resultado = PhotoMusic_Contratante::enviar_whatsapp_contratante($id_evento);

        $painel_url = home_url('/painel-contratante/?token=' . urlencode($token));

        if (is_wp_error($resultado)) {
            wp_redirect(add_query_arg(['erro' => $resultado->get_error_message()], $painel_url));
        } else {
            wp_redirect(add_query_arg(['ok' => 1], $painel_url));
        }
        exit;
    }

    /* ============================================================
       PROCESSA ENVIO DE WHATSAPP — link de serviço/galeria
    ============================================================ */
    public static function processar_envio_whatsapp_servico() {

        if (!isset($_POST['pm_enviar_whatsapp_servico'])) return;

        if (!wp_verify_nonce($_POST['pm_nonce_servico'] ?? '', 'pm_whatsapp_servico')) return;

        $token       = sanitize_text_field($_POST['pm_token'] ?? '');
        $id_servico  = intval($_POST['id_servico'] ?? 0);
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) wp_die('Token inválido.');

        $id_evento  = intval($contratante->id_evento);
        $resultado  = self::enviar_whatsapp_servico($id_evento, $id_servico);
        $painel_url = home_url('/painel-contratante/?token=' . urlencode($token));

        if (is_wp_error($resultado)) {
            wp_redirect(add_query_arg(['erro' => $resultado->get_error_message()], $painel_url));
        } else {
            wp_redirect(add_query_arg(['ok' => 1], $painel_url));
        }
        exit;
    }

    /* ============================================================
       ENVIA LINK DA GALERIA DE UM SERVIÇO VIA WHATSAPP
    ============================================================ */
    public static function enviar_whatsapp_servico($id_evento, $id_servico) {

        $evento = PhotoMusic_Events::get_event($id_evento);
        if (!$evento) {
            return new WP_Error('evento_inexistente', 'Evento não encontrado.');
        }

        // Usa PhotoMusic_Servicos (nome correto da classe)
        $servico = class_exists('PhotoMusic_Servicos')
            ? PhotoMusic_Servicos::get_servico($id_servico)
            : null;

        if (!$servico || intval($servico->id_evento) !== intval($id_evento)) {
            return new WP_Error('servico_invalido', 'Serviço não pertence ao evento.');
        }

        $contratante = class_exists('PhotoMusic_Contratantes')
            ? PhotoMusic_Contratantes::get_by_event($id_evento)
            : null;

        $telefone = preg_replace('/\D/', '', $contratante->telefone ?? '');
        if (empty($telefone)) {
            return new WP_Error('telefone_vazio', 'O contratante não possui telefone cadastrado.');
        }

        $template = get_option('pm_msg_convite') ?: 'Olá {nome}, aqui está o link da galeria: {link}';

        $link = home_url("/galeria/{$servico->slug_servico}/?contratante={$id_evento}");

        $mensagem = PhotoMusic_WhatsApp::build_message($template, [
            'nome'    => $contratante->nome ?? $contratante->razao_social ?? '',
            'servico' => $servico->nome_servico ?? '',
            'link'    => $link,
        ]);

        return PhotoMusic_WhatsApp::send(
            $telefone,
            $mensagem,
            ['id_evento' => $id_evento, 'id_servico' => $id_servico, 'id_convite' => null]
        );
    }

    /* ============================================================
       EXPORTA CSV DE ACEITES
    ============================================================ */
    public static function processar_export_csv_aceites() {

        if (empty($_GET['pm_export_aceites']) || $_GET['pm_export_aceites'] !== '1') return;

        $token       = sanitize_text_field($_GET['token'] ?? '');
        $contratante = PhotoMusic_Contratante::validate_token($token);

        if (!$contratante) wp_die('Acesso não autorizado.');

        $id_evento = intval($contratante->id_evento);

        if (!PhotoMusic_Contratante::device_aceitou($id_evento)) {
            wp_die('Acesso não autorizado.');
        }

        if (empty($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'pm_export_aceites_' . $id_evento)) {
            wp_die('Falha de segurança (nonce).');
        }

        global $wpdb;

        $aceites = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_aceites
             WHERE id_evento = %d
             GROUP BY telefone, email
             ORDER BY aceite_em DESC",
            $id_evento
        ));

        $filename = 'aceites-evento-' . $id_evento . '-' . date('Y-m-d_H-i') . '.csv';

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);

        $out = fopen('php://output', 'w');

        fputcsv($out, [
            'Evento ID', 'Nome', 'Telefone', 'Email', 'IP',
            'Dispositivo', 'Navegador', 'Sistema Operacional',
            'Idioma', 'Canal Origem', 'Aceite em',
        ]);

        foreach ($aceites as $a) {
            fputcsv($out, [
                $id_evento,
                $a->nome,
                $a->telefone,
                $a->email,
                $a->ip,
                $a->dispositivo,
                $a->navegador,
                $a->sistema_operacional ?? '',
                $a->idioma_navegador ?? '',
                $a->canal_origem ?? '',
                $a->aceite_em,
            ]);
        }

        fclose($out);
        exit;
    }
}