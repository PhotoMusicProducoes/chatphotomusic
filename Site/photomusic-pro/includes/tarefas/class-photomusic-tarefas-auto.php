<?php
// includes/tarefas/class-photomusic-tarefas-auto.php
// Geração automática de tarefas ao assinar contrato

if (!defined('ABSPATH')) exit;

class PhotoMusic_Tarefas_Auto {

    // Slugs de serviços que precisam de moldura / arte do convite
    const SLUGS_FOTO = ['foto-cabine','totem','plataforma-360','foto-paparazzi','foto-lembranca','fotografia'];

    // Slugs que precisam de guestbook
    const SLUGS_GUESTBOOK = ['foto-cabine','totem'];

    // Slugs de som/DJ
    const SLUGS_SOM = ['som-dj'];

    /* ============================================================
       PONTO DE ENTRADA — chamado ao assinar contrato (pelo cliente)
    ============================================================ */
    public static function gerar($id_contrato, $id_evento) {

        if (!class_exists('PhotoMusic_Tarefas') || !class_exists('PhotoMusic_Servicos')) return;

        $contrato = PhotoMusic_Contratos::get($id_contrato);
        if (!$contrato) return;

        // Busca dados do evento
        global $wpdb;
        $evento = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}pm_eventos WHERE id = %d",
            intval($id_evento)
        ));
        if (!$evento) return;

        // Busca serviços contratados neste evento
        $servicos = $wpdb->get_results($wpdb->prepare(
            "SELECT s.slug FROM {$wpdb->prefix}pm_eventos_servicos es
             JOIN {$wpdb->prefix}pm_servicos s ON s.id = es.id_servico
             WHERE es.id_evento = %d",
            intval($id_evento)
        ));
        $slugs = array_column($servicos, 'slug');

        $tem_foto     = !empty(array_intersect($slugs, self::SLUGS_FOTO));
        $tem_guestbook= !empty(array_intersect($slugs, self::SLUGS_GUESTBOOK));
        $tem_som      = !empty(array_intersect($slugs, self::SLUGS_SOM));
        $eh_pj        = ($evento->tipo_evento === 'PJ');

        // ── 1. NOTA FISCAL (apenas PJ) ─────────────────────────────
        if ($eh_pj && !PhotoMusic_Tarefas::existe($id_evento, 'nota_fiscal')) {
            $data_nf = self::calcular_data_nf($evento->data_evento ?? null);
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'photomusic',
                'tipo'         => 'nota_fiscal',
                'descricao'    => 'Emitir e enviar Nota Fiscal ao cliente.',
                'data_prevista'=> $data_nf,
            ]);
        }

        // ── 2. MOLDURA — ENVIAR MODELO AO CLIENTE (PhotoMusic faz) ──
        if ($tem_foto && !PhotoMusic_Tarefas::existe($id_evento, 'moldura_modelo')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'photomusic',
                'tipo'         => 'moldura_modelo',
                'descricao'    => 'Enviar modelo das molduras das fotos ao cliente para aprovação.',
                'data_prevista'=> null,
            ]);
        }

        // ── 3. CAPA DO GUESTBOOK ───────────────────────────────────
        if ($tem_guestbook && !PhotoMusic_Tarefas::existe($id_evento, 'guestbook_capa')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'photomusic',
                'tipo'         => 'guestbook_capa',
                'descricao'    => 'Enviar capa do Guestbook para a gráfica após aprovação do cliente.',
                'data_prevista'=> null,
            ]);
        }

        // ── 4. MONTAR GUESTBOOK ────────────────────────────────────
        if ($tem_guestbook && !PhotoMusic_Tarefas::existe($id_evento, 'guestbook_montar')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'photomusic',
                'tipo'         => 'guestbook_montar',
                'descricao'    => 'Montar o Guestbook após impressão na gráfica.',
                'data_prevista'=> null,
            ]);
        }

        // ── 5. COBRAR PLAYLIST AO CLIENTE (Som/DJ) ─────────────────
        if ($tem_som && !PhotoMusic_Tarefas::existe($id_evento, 'playlist_cobrar')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'photomusic',
                'tipo'         => 'playlist_cobrar',
                'descricao'    => 'Cobrar playlist de músicas do cliente para o DJ.',
                'data_prevista'=> null,
            ]);
        }

        // ── 6. CLIENTE: ENVIAR ARTE DO CONVITE ─────────────────────
        if ($tem_foto && !PhotoMusic_Tarefas::existe($id_evento, 'convite_arte')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'cliente',
                'tipo'         => 'convite_arte',
                'descricao'    => 'Enviar arte do convite para criação da moldura das fotos.',
                'data_prevista'=> null,
            ]);
        }

        // ── 7. CLIENTE: ENVIAR PLAYLIST (Som/DJ) ───────────────────
        if ($tem_som && !PhotoMusic_Tarefas::existe($id_evento, 'playlist_enviar')) {
            PhotoMusic_Tarefas::criar([
                'id_evento'    => $id_evento,
                'id_contrato'  => $id_contrato,
                'responsavel'  => 'cliente',
                'tipo'         => 'playlist_enviar',
                'descricao'    => 'Enviar playlist de músicas para o DJ.',
                'data_prevista'=> null,
            ]);
        }

        // Notifica operador sobre as tarefas geradas
        self::notificar_operador($id_evento, $evento);
    }

    /* ============================================================
       CALCULAR DATA DA NOTA FISCAL
       - 1º dia do mês do evento
       - Se já passou ou é hoje: amanhã
    ============================================================ */
    private static function calcular_data_nf($data_evento) {
        if (empty($data_evento)) {
            $amanha = new DateTime(current_time('Y-m-d'));
            $amanha->modify('+1 day');
            return $amanha->format('Y-m-d');
        }

        $evento_dt      = new DateTime($data_evento);
        $primeiro_mes   = new DateTime($evento_dt->format('Y-m-01'));
        $hoje           = new DateTime(current_time('Y-m-d'));

        if ($primeiro_mes <= $hoje) {
            $amanha = clone $hoje;
            $amanha->modify('+1 day');
            return $amanha->format('Y-m-d');
        }

        return $primeiro_mes->format('Y-m-d');
    }

    /* ============================================================
       NOTIFICAR OPERADOR VIA WHATSAPP AO GERAR TAREFAS
    ============================================================ */
    private static function notificar_operador($id_evento, $evento) {
        if (!class_exists('PhotoMusic_WhatsApp')) return;

        $total = PhotoMusic_Tarefas::count_abertas();
        $nome  = $evento->nome_contratante ?? "Evento #{$id_evento}";
        $data  = !empty($evento->data_evento)
            ? date('d/m/Y', strtotime($evento->data_evento))
            : 'a definir';

        $msg  = "📋 *Tarefas geradas — Contrato assinado!*\n\n";
        $msg .= "👤 *Cliente:* {$nome}\n";
        $msg .= "📅 *Evento:* {$data}\n\n";
        $msg .= "✅ As tarefas do evento foram criadas automaticamente.\n";
        $msg .= "Total em aberto: *{$total}*\n\n";
        $msg .= "Acesse o painel para visualizar:\n";
        $msg .= admin_url('admin.php?page=photomusic-tarefas');

        $tel_operador = get_option('pm_whatsapp_operador', '');
        if ($tel_operador) {
            PhotoMusic_WhatsApp::send($tel_operador, $msg);
        }

        // Envia para o grupo de tarefas, se configurado
        $grupo = get_option('pm_tarefas_grupo_wpp', '');
        if ($grupo) {
            PhotoMusic_WhatsApp::send($grupo, $msg);
        }
    }
}
