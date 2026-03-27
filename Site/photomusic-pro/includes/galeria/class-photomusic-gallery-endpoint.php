<?php
// includes/galeria/class-photomusic-gallery-endpoint.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Gallery_Endpoint {

    /**
     * Ponto de entrada da galeria via rota amigável
     */
    public function handle_request() {

        global $wpdb;

        $evento_slug  = sanitize_title(get_query_var('evento_slug'));
        $servico_slug = sanitize_title(get_query_var('servico_slug'));

        $tbl_eventos  = $wpdb->prefix . 'pm_eventos';
        $tbl_servicos = $wpdb->prefix . 'pm_servicos';
        $tbl_aceites  = $wpdb->prefix . 'pm_aceites_evento';
        $tbl_acessos  = $wpdb->prefix . 'pm_acessos_galeria';

        /* ============================================================
           1. VALIDAR EVENTO
        ============================================================ */
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_eventos WHERE slug_evento = %s",
            $evento_slug
        ));

        if (!$evento) {
            wp_die('Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            wp_die('Este evento está encerrado.');
        }

        $id_evento = intval($evento->id);

        /* ============================================================
           2. VALIDAR SERVIÇO
        ============================================================ */
        $servico = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_servicos 
             WHERE slug_servico = %s AND id_evento = %d",
            $servico_slug,
            $id_evento
        ));

        if (!$servico) {
            wp_die('Serviço não encontrado para este evento.');
        }

        $id_servico = intval($servico->id);

        /* ============================================================
           3. CARREGAR LINKS DO SERVIÇO
        ============================================================ */
        $links = json_decode($servico->links, true);

        if (empty($links)) {
            wp_die('Nenhum link configurado para este serviço.');
        }

        /* ============================================================
           4. GERAR DEVICE HASH
        ============================================================ */
        $device_hash = $this->generate_device_hash();

        /* ============================================================
           5. VERIFICAR ACEITE ÚNICO POR EVENTO
        ============================================================ */
        $aceite = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_aceites 
             WHERE id_evento = %d AND device_hash = %s 
             ORDER BY id DESC LIMIT 1",
            $id_evento,
            $device_hash
        ));

        if (!$aceite) {
            $this->render_form_aceite($evento, $servico);
            return;
        }

        /* ============================================================
           6. VERIFICAR LIMITE DIÁRIO POR SERVIÇO
        ============================================================ */
        $hoje = current_time('Y-m-d');

        $acesso = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_acessos 
             WHERE id_evento = %d AND id_servico = %d AND device_hash = %s",
            $id_evento,
            $id_servico,
            $device_hash
        ));

        $limite = 10;

        if ($acesso) {

            $acessos_hoje = ($acesso->ultimo_acesso === $hoje)
                ? intval($acesso->acessos_hoje)
                : 0;

            if ($acessos_hoje >= $limite) {
                wp_die('Limite diário de acessos atingido. Tente novamente amanhã.');
            }

            $acessos_hoje++;

            $wpdb->update($tbl_acessos, [
                'acessos_hoje' => $acessos_hoje,
                'ultimo_acesso'=> $hoje
            ], ['id' => $acesso->id]);

        } else {

            $wpdb->insert($tbl_acessos, [
                'id_evento'    => $id_evento,
                'id_servico'   => $id_servico,
                'device_hash'  => $device_hash,
                'acessos_hoje' => 1,
                'ultimo_acesso'=> $hoje
            ]);
        }

        /* ============================================================
           7. RENDERIZAR GALERIA PROTEGIDA
        ============================================================ */
        $this->render_galeria($evento, $servico, $links);
    }

    /**
     * Gera hash único por dispositivo
     */
    private function generate_device_hash() {
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        return hash('sha256', $ua . '|' . $ip);
    }

    /**
     * Exibe formulário de aceite
     */
    private function render_form_aceite($evento, $servico) {
        ?>
        <h2><?php echo esc_html($evento->motivo_evento); ?></h2>
        <p>Para acessar a galeria deste evento, aceite o termo abaixo:</p>

        <form method="post">
            <?php wp_nonce_field('pm_aceite_evento', 'pm_nonce_aceite'); ?>
            <input type="hidden" name="pm_aceite_evento" value="1">

            <label>Nome:</label>
            <input type="text" name="nome" required><br><br>

            <label>Telefone:</label>
            <input type="text" name="telefone" required><br><br>

            <label>
                <input type="checkbox" name="aceite" required>
                Li e aceito o Termo de Uso de Imagem.
            </label><br><br>

            <button type="submit">Aceitar e Continuar</button>
        </form>
        <?php
    }

    /**
     * Exibe galeria protegida
     */
    private function render_galeria($evento, $servico, $links) {
        ?>
        <h1><?php echo esc_html($evento->motivo_evento); ?></h1>
        <h3><?php echo esc_html($servico->nome_servico); ?></h3>

        <p>Selecione abaixo:</p>

        <?php foreach ($links as $i => $link): ?>
            <div style="margin-bottom:20px;">
                <h4>Link <?php echo $i + 1; ?></h4>
                <iframe src="<?php echo esc_url($link); ?>" 
                        style="width:100%; height:600px; border:1px solid #ccc;">
                </iframe>
            </div>
        <?php endforeach; ?>
        <?php
    }
}
