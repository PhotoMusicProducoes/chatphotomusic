// includes/admin/views/evento-operador-view.php

<div id="pm-operador-root" data-id-evento="<?php echo esc_attr($id_evento); ?>">

    <h2>Serviços contratados</h2>

    <table class="widefat striped" id="pm-tabela-servicos">
        <thead>
            <tr>
                <th>Serviço</th>
                <th>Subtipo</th>
                <th>Pacote</th>
                <th>Horas</th>
                <th>Fotos</th>
                <th>Valor base</th>
                <th>Adicional</th>
                <th>Valor final</th>
                <th>Obs.</th>
                <th></th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>

    <p>
        <button class="button button-secondary" id="pm-add-servico">
            + Adicionar serviço
        </button>
    </p>

    <hr>

    <h2>Financeiro</h2>

    <table class="form-table">
        <tr>
            <th><label for="pm-deslocamento">Deslocamento</label></th>
            <td><input type="text" id="pm-deslocamento" class="regular-text"></td>
        </tr>
        <tr>
            <th><label for="pm-deslocamento-valor">Valor deslocamento</label></th>
            <td><input type="number" step="0.01" id="pm-deslocamento-valor"></td>
        </tr>
        <tr>
            <th><label for="pm-desconto-manual">Desconto manual</label></th>
            <td><input type="number" step="0.01" id="pm-desconto-manual"></td>
        </tr>
        <tr>
            <th><label for="pm-valor-total-final">Valor total final</label></th>
            <td><input type="number" step="0.01" id="pm-valor-total-final"></td>
        </tr>
    </table>

    <p>
        <button class="button button-primary" id="pm-salvar-financeiro">
            Salvar financeiro
        </button>
    </p>

    <hr>

    <h2>Contrato</h2>

    <p>
        <button class="button button-primary" id="pm-gerar-contrato">
            Gerar contrato
        </button>
    </p>

    <div id="pm-mensagens-operador"></div>

</div>
