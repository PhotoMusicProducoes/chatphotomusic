DIAGRAMA COMPLETO - includes/core/class-photomusic-helpers.php

PhotoMusic_Helpers
   ├── sanitize_phone($phone)
   │       ├── remove todos os caracteres não numéricos
   │       └── return telefone_sanitizado
   │
   ├── slugify($string)
   │       ├── strtolower()
   │       ├── remove_accents()
   │       ├── substitui caracteres não a-z0-9 por '-'
   │       ├── trim('-')
   │       └── return slug
   │
   ├── generate_code($prefix = 'EVT')
   │       ├── gera senha aleatória de 6 chars (wp_generate_password)
   │       ├── uppercase
   │       └── return PREFIX-XXXXXX
   │
   ├── debug($data)
   │       ├── SE current_user_can('administrator'):
   │       │       ├── print_r($data) dentro de <pre> estilizado
   │       └── fim
   │
   ├── device_hash()
   │       ├── ua = HTTP_USER_AGENT
   │       ├── ip = REMOTE_ADDR
   │       ├── concat ua|ip
   │       └── return hash('sha256', concat)
   │
   └── is_valid_sha256($token)
           ├── verifica regex /^[a-f0-9]{64}$/
           └── return true/false


MAPA DAS TABELAS USADAS
Nenhuma tabela.
Classe 100% utilitária.

DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Helpers
Coleção de funções utilitárias essenciais para o PhotoMusic Pro.  
Inclui sanitização de telefone, geração de slugs, criação de códigos internos, debug seguro, geração de hash de dispositivo e validação de tokens SHA256.
É amplamente utilizada em todo o sistema para padronização, segurança e consistência de dados.
