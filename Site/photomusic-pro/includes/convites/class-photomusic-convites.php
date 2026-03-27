<?php
// includes/convites/class-photomusic-convites.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Convites {

    public static function init() {
        // Futuro: telas de convites, QR Code, exportação etc.
    }

    /**
     * Cria um convite, registra o token e envia WhatsApp automaticamente
     *
     * $dados esperado:
     * - id_servico
     * - telefone
     * - email
     * - nome
     * - canal
     * - idioma
     */
    public static function create_convite($id_evento, $dados) {
        global $wpdb;

        $tbl_convites = $wpdb->prefix . 'pm_convites';
        $tbl_acessos  = $wpdb->prefix . 'pm_acessos_galeria';

        /* ============================================================
           1. Validar evento
        ============================================================ */
        $id_evento = intval($id_evento);

        $evento = PhotoMusic_Events::get_event($id_evento);
        if (!$evento) {
            return new WP_Error('evento_inexistente', 'Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            return new WP_Error('evento_desativado', 'Este evento está desativado.');
        }

        /* ============================================================
           2. Validar serviço
        ============================================================ */
        if (empty($dados['id_servico'])) {
            return new WP_Error('servico_obrigatorio', 'O serviço é obrigatório.');
        }

        $id_servico = intval($dados['id_servico']);

        $servico = PhotoMusic_Servicos::get_servico($id_servico);
        if (!$servico || intval($servico->id_evento) !== $id_evento) {
            return new WP_Error('servico_invalido', 'Serviço não pertence ao evento.');
        }

        if ($servico->status_servico === 'desativado') {
            return new WP_Error('servico_desativado', 'Este serviço está desativado.');
        }

        /* ============================================================
           3. Gerar token seguro padronizado
        ============================================================ */
        $token = PhotoMusic_Token_Generator::generate_convite_token();

        /* ============================================================
           4. Criar registro em pm_convites
        ============================================================ */

        $telefone = PhotoMusic_Helpers::sanitize_phone($dados['telefone'] ?? '');
        $email    = sanitize_email($dados['email'] ?? '');

        $nome = sanitize_text_field($dados['nome'] ?? '');
        $nome = substr($nome, 0, 200);

        $canal  = sanitize_text_field($dados['canal'] ?? 'whatsapp');
        $idioma = sanitize_text_field($dados['idioma'] ?? 'pt');

        $wpdb->insert($tbl_convites, [
            'id_evento'        => $id_evento,
            'token_convite'    => $token,
            'telefone'         => $telefone,
            'email'            => $email,
            'nome_convidado'   => $nome,
            'canal_origem'     => $canal,
            'idioma_preferido' => $idioma,
            'criado_em'        => current_time('mysql'),
        ]);

        $id_convite = $wpdb->insert_id;

        if (!$id_convite) {
            return new WP_Error('erro_convite', 'Não foi possível criar o convite.');
        }

        /* ============================================================
           5. Criar registro em pm_acessos_galeria
        ============================================================ */
        $wpdb->insert($tbl_acessos, [
            'id_evento'     => $id_evento,
            'id_servico'    => $id_servico,
            'telefone'      => $telefone,
            'token_acesso'  => $token,
            'device_hash'   => null,
            'acessos_hoje'  => 0,
            'acessos_total' => 0,
            'ultimo_acesso' => null,
            'criado_em'     => current_time('mysql'),
        ]);

        /* ============================================================
           6. Gerar link final
        ============================================================ */
        $link = home_url("/galeria/{$servico->slug_servico}/?token={$token}");

        /* ============================================================
           7. Enviar WhatsApp automaticamente
        ============================================================ */
        if (!empty($telefone)) {

            $template = get_option('pm_msg_convite');

            if (!empty($template)) {

                $mensagem = PhotoMusic_WhatsApp::build_message($template, [
                    'nome'     => $nome,
                    'telefone' => $telefone,
                    'link'     => $link,
                    'evento'   => $evento->nome_evento ?? '',
                    'servico'  => $servico->nome_servico ?? ''
                ]);

                PhotoMusic_WhatsApp::send(
                    $telefone,
                    $mensagem,
                    [
                        'id_evento'  => $id_evento,
                        'id_servico' => $id_servico,
                        'id_convite' => $id_convite
                    ]
                );
            }
        }

        /* ============================================================
           8. Retorno final
        ============================================================ */
        return [
            'token'      => $token,
            'link'       => $link,
            'id_convite' => $id_convite,
        ];
    }
}
