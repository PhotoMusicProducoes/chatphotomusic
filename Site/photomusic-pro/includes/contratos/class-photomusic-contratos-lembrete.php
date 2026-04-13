<?php
// includes/contratos/class-photomusic-contratos-lembrete.php
// Lembretes automáticos diários via WhatsApp para contratos não assinados

if (!defined('ABSPATH')) exit;

class PhotoMusic_Contratos_Lembrete {

    const HOOK = 'pm_lembrete_contrato_diario';

    /* ============================================================
       INIT — registra o hook do cron
    ============================================================ */
    public static function init() {
        add_action(self::HOOK, [__CLASS__, 'processar']);
    }

    /* ============================================================
       AGENDAR — chame no upgrade_tables() ou na ativação do plugin
       Agenda para rodar às 10h UTC (7h BRT) diariamente
    ============================================================ */
    public static function agendar() {
        if (wp_next_scheduled(self::HOOK)) {
            return; // já agendado
        }

        // Calcula próximo 10:00 UTC (7h BRT)
        $agora_utc    = time();
        $hoje_10h_utc = strtotime(gmdate('Y-m-d', $agora_utc) . ' 10:00:00');

        // Se 10h UTC já passou hoje, agenda para amanhã
        if ($hoje_10h_utc <= $agora_utc) {
            $hoje_10h_utc = strtotime('+1 day', $hoje_10h_utc);
        }

        wp_schedule_event($hoje_10h_utc, 'daily', self::HOOK);
        error_log('[PM Lembrete] Cron agendado para ' . gmdate('Y-m-d H:i:s', $hoje_10h_utc) . ' UTC');
    }

    /* ============================================================
       CANCELAR — chame na desativação do plugin
    ============================================================ */
    public static function cancelar() {
        $ts = wp_next_scheduled(self::HOOK);
        if ($ts) {
            wp_unschedule_event($ts, self::HOOK);
            error_log('[PM Lembrete] Cron cancelado.');
        }
    }

    /* ============================================================
       PROCESSAR — executa a cada rodada do cron
    ============================================================ */
    public static function processar() {
        global $wpdb;

        error_log('[PM Lembrete] Iniciando verificação de contratos pendentes...');

        // Contratos aguardando assinatura do contratante há 2+ dias
        $contratos = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}pm_contratos
             WHERE status_contrato = 'aguardando_assinatura_contratante'
               AND assinatura_contratante_data IS NULL
               AND enviado_contratante_em IS NOT NULL
               AND DATEDIFF(NOW(), enviado_contratante_em) >= 2"
        );

        if (empty($contratos)) {
            error_log('[PM Lembrete] Nenhum contrato pendente encontrado.');
            return;
        }

        error_log('[PM Lembrete] ' . count($contratos) . ' contrato(s) pendente(s) encontrado(s).');

        foreach ($contratos as $contrato) {
            self::enviar_lembrete($contrato);
        }
    }

    /* ============================================================
       ENVIAR LEMBRETE — envia WhatsApp para um contrato específico
    ============================================================ */
    private static function enviar_lembrete($contrato) {
        global $wpdb;

        // Busca telefone (tenta contratante, depois evento)
        $telefone = '';

        if (class_exists('PhotoMusic_Contratantes')) {
            $contratante = PhotoMusic_Contratantes::get_by_event($contrato->id_evento);
            if ($contratante) {
                $telefone = preg_replace('/\D/', '', $contratante->telefone ?? '');
            }
        }

        if (empty($telefone) && !empty($contrato->id_evento)) {
            $tel_ev   = $wpdb->get_var($wpdb->prepare(
                "SELECT telefone_contratante FROM {$wpdb->prefix}pm_eventos WHERE id = %d LIMIT 1",
                $contrato->id_evento
            ));
            $telefone = preg_replace('/\D/', '', $tel_ev ?? '');
        }

        if (empty($telefone)) {
            error_log('[PM Lembrete] Contrato #' . $contrato->id . ' sem telefone — pulando.');
            return;
        }

        $dias    = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT DATEDIFF(NOW(), enviado_contratante_em) FROM {$wpdb->prefix}pm_contratos WHERE id = %d",
            $contrato->id
        ));

        $link    = PhotoMusic_Contratos_Actions::get_link_assinatura($contrato->token);
        $mensagem = "📋 *Lembrete:* Seu contrato ainda está aguardando sua assinatura"
                  . " (enviado há {$dias} dia" . ($dias > 1 ? 's' : '') . ").\n\n"
                  . "Acesse o link abaixo para visualizar e assinar:\n{$link}";

        $result = PhotoMusic_WhatsApp::send($telefone, $mensagem, ['id_evento' => $contrato->id_evento]);

        if (is_wp_error($result)) {
            error_log('[PM Lembrete] Erro no contrato #' . $contrato->id . ': ' . $result->get_error_message());
            PhotoMusic_Contratos::registrar_log(
                $contrato->id,
                'lembrete_erro',
                'Erro ao enviar lembrete WhatsApp: ' . $result->get_error_message()
            );
        } else {
            error_log('[PM Lembrete] Lembrete enviado → contrato #' . $contrato->id . ' → ' . $telefone);
            PhotoMusic_Contratos::registrar_log(
                $contrato->id,
                'lembrete_enviado',
                "Lembrete WhatsApp enviado para {$telefone} (dia {$dias} de espera)"
            );
        }
    }
}
