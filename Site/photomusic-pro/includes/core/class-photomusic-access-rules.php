<?php
// includes/core/class-photomusic-access-rules.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Access_Rules {

    /**
     * Valida o acesso do convidado ao serviço
     *
     * Retorna:
     * - true (acesso permitido)
     * - WP_Error (acesso negado)
     */
    public static function validate_guest_access($id_evento, $id_servico, $token, $device_hash) {
        global $wpdb;

        // Sanitização básica de parâmetros
        $id_evento   = (int) $id_evento;
        $id_servico  = (int) $id_servico;
        $token       = sanitize_text_field($token);
        $device_hash = sanitize_text_field($device_hash);

        $tbl_eventos  = $wpdb->prefix . 'pm_eventos';
        $tbl_servicos = $wpdb->prefix . 'pm_event_services';
        $tbl_acessos  = $wpdb->prefix . 'pm_acessos_galeria';

        /* ============================================================
            0. VERIFICAR SE É DISPOSITIVO MÓVEL
                O link da galeria só pode ser aberto em celular/tablet
        ============================================================ */
        $regras_mobile = json_decode(
            $wpdb->get_var($wpdb->prepare(
                "SELECT regras_acesso FROM {$wpdb->prefix}pm_event_services
                WHERE id = %d",
                $id_servico
            )) ?? '{}',
            true
        ) ?: [];

        $apenas_mobile = (bool) ($regras_mobile['apenas_mobile'] ?? true);

        if ($apenas_mobile && !PhotoMusic_Helpers::is_mobile()) {
            return new WP_Error(
                'apenas_mobile',
                'Este link só pode ser aberto em um celular ou tablet.'
            );
        }

        /* ============================================================
           1. Validar evento
        ============================================================ */
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_eventos WHERE id = %d",
            $id_evento
        ));

        if (!$evento) {
            return new WP_Error('evento_inexistente', 'Evento não encontrado.');
        }

        if ($evento->status_evento === 'desativado') {
            return new WP_Error('evento_desativado', 'Este evento está encerrado.');
        }

        /* ============================================================
           2. Validar serviço
        ============================================================ */
        $servico = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_servicos WHERE id = %d AND id_evento = %d",
            $id_servico,
            $id_evento
        ));

        if (!$servico) {
            return new WP_Error('servico_inexistente', 'Serviço não encontrado.');
        }

        if ($servico->status_servico === 'desativado') {
            return new WP_Error('servico_desativado', 'Este serviço está desativado.');
        }

        /* ============================================================
           3. Carregar regras de acesso
        ============================================================ */
        $regras = json_decode($servico->regras_acesso, true) ?: [];

        $limite_diario        = intval($regras['limite_diario'] ?? 10);
        $expira_com_evento    = (bool) ($regras['expira_com_evento'] ?? true);
        $bloqueio_dispositivo = (bool) ($regras['bloqueio_dispositivo'] ?? true);
        $bloqueio_ip          = (bool) ($regras['bloqueio_ip'] ?? false);
        $auditoria            = (bool) ($regras['auditoria'] ?? true);
        $apenas_mobile        = (bool) ($regras['apenas_mobile'] ?? true);

        /* ============================================================
           3a. VERIFICAR DISPOSITIVO MÓVEL 
        ============================================================ */
        if ($apenas_mobile && !PhotoMusic_Helpers::is_mobile()) {
            return new WP_Error(
                'apenas_mobile',
                'Este link só pode ser aberto em um celular ou tablet.'
            );
        }

        /* ============================================================
           4. Validar token
        ============================================================ */
        $acesso = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $tbl_acessos WHERE token_acesso = %s AND id_evento = %d AND id_servico = %d",
            $token,
            $id_evento,
            $id_servico
        ));

        if (!$acesso) {
            return new WP_Error('token_invalido', 'Token inválido ou expirado.');
        }

        /* ============================================================
           5. Validar expiração (evento controla expiração)
        ============================================================ */
        if ($expira_com_evento && $evento->status_evento === 'desativado') {
            return new WP_Error('evento_encerrado', 'Este evento foi encerrado.');
        }

        /* ============================================================
           6. Validar dispositivo
        ============================================================ */
        if ($bloqueio_dispositivo && $acesso->device_hash !== $device_hash) {
            return new WP_Error('dispositivo_bloqueado', 'Este link só pode ser acessado no dispositivo original.');
        }

        /* ============================================================
           7. Validar limite diário
        ============================================================ */
        $hoje         = date('Y-m-d');
        $acessos_hoje = intval($acesso->acessos_hoje);

        if ($acesso->ultimo_acesso !== $hoje) {
            // Zera contador diário
            $wpdb->update($tbl_acessos, [
                'acessos_hoje'  => 0,
                'ultimo_acesso' => $hoje
            ], ['id' => $acesso->id]);

            $acessos_hoje           = 0;
            $acesso->acessos_hoje   = 0;
            $acesso->ultimo_acesso  = $hoje;
        }

        if ($acessos_hoje >= $limite_diario) {
            return new WP_Error('limite_diario', 'Você atingiu o limite diário de acessos.');
        }

        /* ============================================================
           8. Validar IP (opcional)
        ============================================================ */
        $ip_atual = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

        if ($bloqueio_ip) {
            if (!empty($acesso->ip) && $acesso->ip !== $ip_atual) {
                return new WP_Error('ip_bloqueado', 'Este link só pode ser acessado do mesmo IP.');
            }
        }

        /* ============================================================
           9. Registrar auditoria e atualizar contadores
        ============================================================ */
        $update = [
            'acessos_hoje'  => $acessos_hoje + 1,
            'acessos_total' => intval($acesso->acessos_total) + 1,
            'ultimo_acesso' => $hoje,
        ];

        if ($bloqueio_ip) {
            $update['ip'] = $ip_atual;
        }

        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        if ($auditoria) {
            $update['navegador']  = $ua;
            $update['dispositivo'] = sanitize_text_field(self::detect_device());
            $update['user_agent'] = $ua;
        }

        $wpdb->update($tbl_acessos, $update, ['id' => $acesso->id]);

        return true;
    }

    /**
     * Detecta o tipo de dispositivo
     */
    private static function detect_device() {
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');

        if (stripos($ua, 'iPhone') !== false) return 'iPhone';
        if (stripos($ua, 'iPad') !== false) return 'iPad';
        if (stripos($ua, 'Android') !== false) return 'Android';
        if (stripos($ua, 'Windows') !== false) return 'Windows';
        if (stripos($ua, 'Mac') !== false) return 'Mac';

        return 'Desconhecido';
    }
}
