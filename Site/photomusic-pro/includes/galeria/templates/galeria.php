<?php
// includes/galeria/templates/galeria.php

if (!defined('ABSPATH')) exit;

/**
 * Variáveis disponíveis (definidas pelo controller):
 * $evento_nome      — nome/motivo do evento
 * $evento_data      — data do evento (Y-m-d)
 * $slug             — codigo_interno do evento
 * $id_evento
 * $id_aceite
 * $aceite_nome      — nome do convidado que fez o aceite
 * $link_fotoshare   — link fallback único (se não há serviços individuais)
 * $servicos_links[] — array de objetos {nome_servico, tipo, link_convidado}
 */

// Ícones por tipo de serviço
$tipo_icones = [
    'foto_cabine'       => '📸',
    'totem'             => '🏛️',
    '360'               => '🎡',
    'paparazzi_digital' => '🎭',
    'lembranca'         => '🖼️',
    'video'             => '🎥',
    'gif'               => '🎞️',
    'outro'             => '📎',
];

/**
 * Prepara a URL para exibição em iframe:
 * - fotoshare.co → garante ?embed=1
 * - outros → retorna como está
 */
function pm_preparar_url_embed($url) {
    if (stripos($url, 'fotoshare.co') !== false) {
        // Adiciona embed=1 se ainda não estiver na URL
        if (stripos($url, 'embed=1') === false) {
            $url .= (strpos($url, '?') !== false ? '&' : '?') . 'embed=1';
        }
        return $url;
    }
    return $url;
}

/**
 * Plataformas que bloqueiam iframe — abre em nova aba como botão.
 * fotoshare.co é COMPATÍVEL com iframe (usa embed=1).
 */
function pm_bloqueia_iframe($url) {
    $bloqueados = [
        'drive.google.com',
        'dropbox.com',
        'onedrive.live.com',
        'youtube.com',
        'youtu.be',
        'vimeo.com',
    ];
    foreach ($bloqueados as $host) {
        if (stripos($url, $host) !== false) return true;
    }
    return false;
}
?>
<style>
    .pm-galeria-wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px 16px 60px;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .pm-galeria-header {
        text-align: center;
        margin-bottom: 32px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e5e5e5;
    }

    .pm-galeria-header h1 {
        font-size: 1.9rem;
        margin: 0 0 6px;
        color: #1a1a1a;
    }

    .pm-galeria-header .pm-data {
        font-size: 1rem;
        color: #777;
        margin: 4px 0;
    }

    .pm-galeria-header .pm-usuario {
        display: inline-block;
        margin-top: 10px;
        background: #eaf5ea;
        color: #2a7a2a;
        border-radius: 20px;
        padding: 5px 16px;
        font-size: 0.9rem;
    }

    /* ── Cada serviço em um card ── */
    .pm-servico-card {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 32px;
        box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }

    .pm-servico-titulo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.15rem;
        font-weight: 700;
        padding: 14px 20px;
        background: #f8f8f8;
        border-bottom: 1px solid #e5e5e5;
        color: #222;
    }

    /* ── Modo botão (plataformas externas) ── */
    .pm-acesso-externo {
        padding: 40px 20px;
        text-align: center;
    }

    .pm-acesso-externo p {
        color: #555;
        margin-bottom: 20px;
        font-size: 0.95rem;
    }

    .pm-btn-galeria {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #1a6e1a;
        color: #fff !important;
        text-decoration: none !important;
        padding: 14px 32px;
        border-radius: 8px;
        font-size: 1.05rem;
        font-weight: 600;
        transition: background .2s;
        box-shadow: 0 2px 6px rgba(0,0,0,.15);
    }

    .pm-btn-galeria:hover {
        background: #145714;
    }

    /* ── Modo iframe (plataformas compatíveis como fotoshare) ── */
    .pm-servico-frame {
        width: 100%;
        min-height: 75vh;
        border: none;
        background: #f5f5f5;
        display: block;
    }

    /* ── Mensagem quando galeria não disponível ── */
    .pm-galeria-vazia {
        text-align: center;
        padding: 60px 20px;
        background: #fafafa;
        border-radius: 10px;
        border: 2px dashed #ddd;
        color: #777;
    }

    .pm-galeria-vazia .pm-icon { font-size: 3rem; }
    .pm-galeria-vazia p { margin: 10px 0 0; font-size: 1rem; }

    @media (max-width: 600px) {
        .pm-galeria-header h1 { font-size: 1.4rem; }
        .pm-btn-galeria { width: 100%; justify-content: center; }
    }
</style>

<div class="pm-galeria-wrap">

    <!-- Cabeçalho -->
    <div class="pm-galeria-header">
        <h1><?php echo esc_html($evento_nome); ?></h1>

        <?php if (!empty($evento_data)): ?>
            <p class="pm-data">
                <?php echo esc_html(date_i18n('d \d\e F \d\e Y', strtotime($evento_data))); ?>
            </p>
        <?php endif; ?>

        <?php if (!empty($aceite_nome)): ?>
            <span class="pm-usuario">
                ✅ Acesso autorizado — <strong><?php echo esc_html($aceite_nome); ?></strong>
            </span>
        <?php endif; ?>
    </div>

    <?php if (!empty($servicos_links)): ?>

        <?php foreach ($servicos_links as $sv): ?>
            <?php
                $icone   = $tipo_icones[$sv->tipo] ?? '📎';
                $nome    = $sv->nome_servico ?? 'Galeria';
                $link    = $sv->link_convidado;
                $externo = pm_bloqueia_iframe($link);
                $src     = $externo ? $link : pm_preparar_url_embed($link);
            ?>

            <div class="pm-servico-card">

                <div class="pm-servico-titulo">
                    <span><?php echo $icone; ?></span>
                    <span><?php echo esc_html(mb_strtoupper($nome)); ?></span>
                </div>

                <?php if ($externo): ?>
                    <!-- Botão para plataformas que bloqueiam iframe (Drive, YouTube, etc.) -->
                    <div class="pm-acesso-externo">
                        <p>Clique no botão abaixo para acessar sua galeria.</p>
                        <a href="<?php echo esc_url($src); ?>"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="pm-btn-galeria">
                            <?php echo $icone; ?> Acessar <?php echo esc_html($nome); ?> &rarr;
                        </a>
                    </div>

                <?php else: ?>
                    <!-- iframe embed — fotoshare.co com ?embed=1 automático -->
                    <iframe
                        allow="web-share"
                        src="<?php echo esc_url($src); ?>"
                        class="pm-servico-frame"
                        frameborder="0"
                        loading="lazy"
                        title="<?php echo esc_attr($nome); ?>">
                    </iframe>

                <?php endif; ?>

            </div>

        <?php endforeach; ?>

    <?php else: ?>

        <div class="pm-galeria-vazia">
            <div class="pm-icon">⏳</div>
            <p><strong>Galeria em preparação.</strong><br>
               As fotos estarão disponíveis em breve. Aguarde a confirmação.</p>
        </div>

    <?php endif; ?>

</div>
