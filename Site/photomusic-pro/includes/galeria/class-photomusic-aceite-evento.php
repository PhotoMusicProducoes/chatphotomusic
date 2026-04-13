<?php
// includes/galeria/class-photomusic-aceite-evento.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Aceite_Evento {

    private $wpdb;
    private $tbl_aceites_evento;
    private $tbl_devices;
    private $tbl_eventos;
    private $tbl_servicos;

    public function __construct() {
        global $wpdb;
        $this->wpdb = $wpdb;

        $this->tbl_aceites_evento = $wpdb->prefix . 'pm_aceites_evento';
        $this->tbl_devices        = $wpdb->prefix . 'pm_devices';
        $this->tbl_eventos        = $wpdb->prefix . 'pm_eventos';
        $this->tbl_servicos       = $wpdb->prefix . 'pm_servicos';
    }

    /* ============================================================
       EXIBE O FORMULÁRIO DE ACEITE
    ============================================================ */
    public function render_form($evento) {

        $tipo   = sanitize_text_field($_GET['tipo'] ?? 'convidado');
        $motivo = esc_html($evento->motivo_evento);
        $data   = esc_html(date('d/m/Y', strtotime($evento->data_evento)));

        if ($tipo === 'contratante') {
            $titulo  = 'Acesso do Contratante';
            $subtit  = 'Para acessar a galeria completa, confirme seus dados e aceite o termo de uso.';
        } else {
            $titulo  = esc_html($motivo);
            $subtit  = 'Para acessar a galeria deste evento, preencha os dados abaixo e aceite o termo de uso de imagem.';
        }

        ?>
        <style>
        .pm-aceite-container {
            max-width: 480px;
            margin: 40px auto;
            padding: 32px 28px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 16px rgba(0,0,0,.08);
            font-family: system-ui, -apple-system, sans-serif;
        }
        .pm-aceite-container h2 {
            font-size: 1.4rem;
            margin: 0 0 8px;
            color: #1a1a1a;
        }
        .pm-aceite-container p {
            color: #555;
            font-size: .95rem;
            margin: 0 0 20px;
        }
        .pm-aceite-container label {
            display: block;
            font-size: .9rem;
            font-weight: 600;
            margin: 14px 0 4px;
            color: #333;
        }
        .pm-aceite-container input[type="text"],
        .pm-aceite-container input[type="email"] {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
            font-size: .95rem;
            box-sizing: border-box;
        }
        .pm-aceite-container label.pm-check {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-weight: 400;
            margin-top: 18px;
            cursor: pointer;
        }
        .pm-aceite-container label.pm-check input {
            margin-top: 3px;
            flex-shrink: 0;
        }
        .pm-aceite-container button[type="submit"] {
            width: 100%;
            margin-top: 20px;
            padding: 12px;
            background: #1f7ae0;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
        }
        .pm-aceite-container button[type="submit"]:hover {
            background: #1668c4;
        }
        </style>

        <div class="pm-aceite-container">
            <h2><?php echo $titulo; ?></h2>
            <?php if ($tipo !== 'contratante'): ?>
            <p>Data do evento: <strong><?php echo $data; ?></strong></p>
            <?php endif; ?>

            <p><?php echo $subtit; ?></p>

            <form method="post">
                <?php wp_nonce_field('pm_aceite_evento', 'pm_nonce_aceite'); ?>
                <input type="hidden" name="pm_aceite_evento" value="1">
                <input type="hidden" name="tipo" value="<?php echo esc_attr($tipo); ?>">

                <label for="pm_nome">Nome:</label>
                <input type="text" id="pm_nome" name="nome" required placeholder="Seu nome completo">

                <label for="pm_email">Email:</label>
                <input type="email" id="pm_email" name="email" required placeholder="seu@email.com">

                <input type="hidden" name="telefone" value="">

                <div style="border:1px solid #ddd;border-radius:6px;padding:12px 14px;max-height:180px;overflow-y:auto;background:#fafafa;margin-top:18px;font-size:.85rem;color:#444;line-height:1.6;">
                    <strong>Termos de Uso de Imagem</strong><br><br>
                    Ao aceitar este termo, você autoriza a <strong>PhotoMusic Produções</strong> a disponibilizar as fotos e vídeos produzidos no evento para acesso digital.<br><br>
                    <strong>Dados coletados:</strong> nome, e-mail, IP, navegador e data do aceite — usados exclusivamente para controle de acesso e auditoria.<br><br>
                    <strong>Compartilhamento:</strong> as fotos/vídeos são disponibilizados apenas para pessoas autorizadas pelo contratante do evento. Seus dados não são vendidos ou compartilhados com terceiros para fins comerciais.<br><br>
                    <strong>LGPD:</strong> você pode solicitar a exclusão dos seus dados a qualquer momento pelo e-mail contato@photomusic.com.br.<br><br>
                    <strong>Uso das imagens:</strong> o material é de uso pessoal. Qualquer uso comercial ou publicação em larga escala requer autorização prévia da PhotoMusic Produções.
                </div>

                <label class="pm-check" style="margin-top:12px;">
                    <input type="checkbox" name="aceite" required>
                    <span>Li e aceito os Termos de Uso de Imagem acima.</span>
                </label>

                <button type="submit">Aceitar e Continuar</button>
            </form>
        </div>
        <?php
    }

    /* ============================================================
       PROCESSA O ACEITE DO CONVIDADO
    ============================================================ */
    public function processar_aceite($id_evento) {

        if (!isset($_POST['pm_aceite_evento'])) {
            return false;
        }

        if (!isset($_POST['pm_nonce_aceite']) || !wp_verify_nonce($_POST['pm_nonce_aceite'], 'pm_aceite_evento')) {
            wp_die('Falha de segurança.');
        }

        $nome     = sanitize_text_field($_POST['nome'] ?? '');
        $email = sanitize_email($_POST['email'] ?? '');
        $aceite   = isset($_POST['aceite']);

        // ============================================================
        // 📱 TELEFONE AUTOMÁTICO
        // ============================================================

        // 1. tenta pegar do POST (fallback)
        $telefone = preg_replace('/\D/', '', $_POST['telefone'] ?? '');

        // 2. se não vier, tenta pegar do device
        if (empty($telefone)) {

            $device_hash = $this->gerar_device_hash();

            $telefone_db = $this->wpdb->get_var($this->wpdb->prepare(
                "SELECT telefone FROM {$this->tbl_devices}
                WHERE device_hash = %s
                LIMIT 1",
                $device_hash
            ));

            if ($telefone_db) {
                $telefone = $telefone_db;
            }
        }

        if (!$nome || !$email || !$aceite) {
            wp_die('Preencha todos os campos e aceite o termo.');
        }

        /* ============================================================
           VALIDAR EVENTO
        ============================================================ */
        $evento = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT * FROM {$this->tbl_eventos} WHERE id = %d",
            $id_evento
        ));

        if (!$evento) {
            wp_die('Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            wp_die('Este evento está desativado.');
        }

        /* ============================================================
           GERAR DEVICE HASH
        ============================================================ */
        $device_hash = $this->gerar_device_hash();
        $ip          = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $user_agent  = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        $tipo_aceite = sanitize_text_field($_POST['tipo'] ?? 'convidado');
        if (!in_array($tipo_aceite, ['convidado', 'contratante'], true)) {
            $tipo_aceite = 'convidado';
        }

        /* ============================================================
           REGISTRAR DEVICE (SE NÃO EXISTIR)
        ============================================================ */
        $this->registrar_device($device_hash, $telefone, $ip, $user_agent);

        /* ============================================================
           EVITAR ACEITE DUPLICADO
           Chave: email + IP + tipo_aceite
           - Mesmo email no mesmo IP → reutiliza token
           - Mesmo email em IP diferente → novo aceite (novo dispositivo)
        ============================================================ */
        $aceite_existente = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT id, token_acesso FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND email = %s AND ip = %s AND tipo_aceite = %s LIMIT 1",
            $id_evento,
            $email,
            $ip,
            $tipo_aceite
        ));

        if ($aceite_existente) {
            // Reutiliza o token existente ou gera um novo se ainda não havia sido salvo
            if (!empty($aceite_existente->token_acesso)) {
                $token = $aceite_existente->token_acesso;
            } else {
                $token = $this->gerar_token_acesso($id_evento, $aceite_existente->id);
                $this->wpdb->update(
                    $this->tbl_aceites_evento,
                    ['token_acesso' => $token],
                    ['id' => $aceite_existente->id]
                );
            }
            wp_redirect(home_url("/galeria/{$evento->codigo_interno}/?token={$token}"));
            exit;
        }

        /* ============================================================
           SALVAR ACEITE
        ============================================================ */
        $this->wpdb->insert($this->tbl_aceites_evento, [
            'id_evento'     => $id_evento,
            'nome'      => $nome,
            'email'     => $email,
            'telefone'  => $telefone,
            'device_hash'   => $device_hash,
            'ip'            => $ip,
            'user_agent'    => $user_agent,
            'versao_termo'  => '1.0',
            'origem'        => 'pagina-externa',
            'tipo_aceite'   => $tipo_aceite,
            'aceite_em'     => current_time('mysql')
        ]);

        $id_aceite = $this->wpdb->insert_id;

        /* ============================================================
           GERA E SALVA O TOKEN DE ACESSO NA TABELA
        ============================================================ */
        $token = $this->gerar_token_acesso($id_evento, $id_aceite);

        $this->wpdb->update(
            $this->tbl_aceites_evento,
            ['token_acesso' => $token],
            ['id' => $id_aceite]
        );

        /* ============================================================
           REDIRECIONAR PARA A GALERIA PROTEGIDA
        ============================================================ */
        wp_redirect(home_url("/galeria/{$evento->codigo_interno}/?token={$token}"));
        exit;
    }

    /* ============================================================
       REGISTRA O DISPOSITIVO
    ============================================================ */
    private function registrar_device($device_hash, $telefone, $ip, $user_agent) {

        $existe = $this->wpdb->get_var($this->wpdb->prepare(
            "SELECT id FROM {$this->tbl_devices} WHERE device_hash = %s",
            $device_hash
        ));

        if ($existe) return;

        $this->wpdb->insert($this->tbl_devices, [
            'device_hash'   => $device_hash,
            'telefone'      => $telefone,
            'ip'            => $ip,
            'user_agent'    => $user_agent,
            'data_registro' => current_time('mysql')
        ]);
    }

    /* ============================================================
       GERA O DEVICE HASH
    ============================================================ */
    private function gerar_device_hash() {
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        return hash('sha256', $ua . '|' . $ip);
    }

    /* ============================================================
       GERA TOKEN DE ACESSO SEGURO (único, salvo no banco)
    ============================================================ */
    private function gerar_token_acesso($id_evento, $id_aceite) {
        // UUID garante unicidade; id_evento+id_aceite tornam o token não adivinável
        $raw = $id_evento . '|' . $id_aceite . '|' . wp_generate_uuid4();
        return hash('sha256', $raw);
    }
}
