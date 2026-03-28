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

        $motivo = esc_html($evento->motivo_evento);
        $data   = esc_html(date('d/m/Y', strtotime($evento->data_evento)));

        ?>
        <div class="pm-aceite-container">
            <h2><?php echo $motivo; ?></h2>
            <p>Data do evento: <strong><?php echo $data; ?></strong></p>

            <p>Para acessar a galeria deste evento, preencha os dados abaixo e aceite o termo de uso de imagem.</p>

            <form method="post">
                <?php wp_nonce_field('pm_aceite_evento', 'pm_nonce_aceite'); ?>
                <input type="hidden" name="pm_aceite_evento" value="1">

                <label>Nome:</label>
                <input type="text" name="nome" required>

                <label>Email:</label>
                <input type="email" name="email" required>

                <input type="hidden" name="telefone" value="">

                <label>
                    <input type="checkbox" name="aceite" required>
                    Declaro que li e aceito o Termo de Uso de Imagem.
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

        /* ============================================================
           REGISTRAR DEVICE (SE NÃO EXISTIR)
        ============================================================ */
        $this->registrar_device($device_hash, $telefone, $ip, $user_agent);

        /* ============================================================
           EVITAR ACEITE DUPLICADO
        ============================================================ */
        $aceite_existente = $this->wpdb->get_row($this->wpdb->prepare(
            "SELECT id, token_acesso FROM {$this->tbl_aceites_evento}
             WHERE id_evento = %d AND device_hash = %s LIMIT 1",
            $id_evento,
            $device_hash
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
