galeria.php (template)
   ├── Recebe variáveis do controller:
   │       ├── $evento_nome
   │       ├── $evento_data
   │       ├── $aceite_nome
   │       ├── $slug
   │       ├── $id_evento
   │       └── $id_aceite
   │
   ├── Renderiza cabeçalho da galeria
   │       ├── nome do evento
   │       ├── data formatada
   │       └── nome do convidado autorizado
   │
   ├── Renderiza grid de fotos
   │       └── (mock temporário)
   │
   ├── Modal de visualização
   │       └── imagem ampliada
   │
   └── JavaScript
           ├── carrega fotos mock
           ├── abre modal
           └── fecha modal


MAPA DE DEPENDÊNCIAS
Recebe dados de:
PhotoMusic_Galeria_Controller::render_template()

Depende de:
Nenhuma classe diretamente

Apenas variáveis injetadas pelo controller

Usa:
HTML + CSS + JS

esc_html(), esc_url(), esc_attr()

Modal JS simples

DESCRIÇÃO OFICIAL — galeria.php
Template principal da galeria protegida do PhotoMusic Pro.
Exibe informações do evento, identifica o convidado autorizado e apresenta a galeria de fotos em grid responsivo com modal de visualização.
As imagens são carregadas dinamicamente (mock temporário), permitindo futura integração com sistemas externos como Fotoshare, Nextcloud, S3 ou armazenamento protegido.