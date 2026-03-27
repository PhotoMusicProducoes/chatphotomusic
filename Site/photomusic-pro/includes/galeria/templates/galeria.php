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
    'foto_cabine' => '📸',
    'totem'       => '🏛️',
    '360'         => '🎡',
    'paparazzi'   => '🎭',
    'lembranca'   => '🖼️',
    'video'       => '🎥',
    'gif'         => '🎞️',
    'outro'       => '📎',
];
?>
<style>
    .pm-galeria-wrap {
        max-width: 1200px;
        margin: 0 auto;
        padding: 28px 16px 48px;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .pm-galeria-header {
        text-align: center;
        margin-bottom: 28px;
        padding-bottom: 18px;
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
        margin-top: 8px;
        background: #eaf5ea;
        color: #2a7a2a;
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 0.9rem;
    }

    /* Cada serviço em um bloco separado */
    .pm-servico-bloco {
        margin-bottom: 40px;
    }

    .pm-servico-titulo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: #333;
        padding-bottom: 6px;
        border-bottom: 1px solid #e0e0e0;
    }

    .pm-servico-frame {
        width: 100%;
        min-height: 72vh;
        border: none;
        border-radius: 10px;
        background: #f5f5f5;
        display: block;
    }

    /* Mensagem quando galeria não disponível */
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
                $icone = $tipo_icones[$sv->tipo] ?? '📎';
                $nome  = $sv->nome_servico;
                $link  = $sv->link_convidado;
            ?>

            <div class="pm-servico-bloco">

                <?php if (count($servicos_links) > 1): ?>
                    <div class="pm-servico-titulo">
                        <span><?php echo $icone; ?></span>
                        <span><?php echo esc_html($nome); ?></span>
                    </div>
                <?php endif; ?>

                <iframe
                    src="<?php echo esc_url($link); ?>"
                    class="pm-servico-frame"
                    allowfullscreen
                    loading="lazy"
                    title="<?php echo esc_attr($nome); ?>">
                </iframe>

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
