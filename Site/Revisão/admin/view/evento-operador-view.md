DIAGRAMA COMPLETO — includes/admin/view/evento-operador-view.php

evento-operador-view.php
   ├── Container principal (#pm-operador-root)
   │       └── data-id-evento
   │
   ├── Tabela de serviços contratados
   │       ├── Serviço
   │       ├── Subtipo
   │       ├── Pacote
   │       ├── Horas
   │       ├── Fotos
   │       ├── Valor base
   │       ├── Adicional
   │       ├── Valor final
   │       ├── Observações
   │       └── Botão remover
   │
   ├── Botão: Adicionar serviço
   │
   ├── Seção Financeiro
   │       ├── Deslocamento
   │       ├── Valor deslocamento
   │       ├── Desconto manual
   │       └── Valor total final
   │
   ├── Botão: Salvar financeiro
   │
   ├── Seção Contrato
   │       └── Botão: Gerar contrato
   │
   └── Div de mensagens (#pm-mensagens-operador)


MAPA DE DADOS USADOS
Elemento	            Uso
data-id-evento	        ID do evento carregado pelo operador
#pm-tabela-servicos	    Tabela preenchida via AJAX
#pm-deslocamento	    Texto livre
#pm-deslocamento-valor	Número (float)
#pm-desconto-manual	    Número (float)
#pm-valor-total-final	Número (float)
#pm-operador-nonce	    Segurança para AJAX

DESCRIÇÃO OFICIAL — evento-operador-view.php
View administrativa usada pelos operadores do PhotoMusic Pro para gerenciar serviços contratados, valores financeiros e geração do contrato do evento.
Serve como interface dinâmica, preenchida via JavaScript, permitindo adicionar serviços, ajustar valores, salvar financeiro e acionar a geração do contrato.
É uma tela operacional, não pública, protegida por permissões específicas.