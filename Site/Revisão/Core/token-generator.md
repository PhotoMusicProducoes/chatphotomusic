DIAGRAMA COMPLETO - includes/core/class-photomusic-token-generator.php

PhotoMusic_Token_Generator
   ├── generate_secure_token($length = 16)
   │       ├── random_bytes($length)
   │       ├── bin2hex()
   │       └── return token_hexadecimal
   │
   ├── generate_prefixed_token($prefix, $length = 16)
   │       ├── prefix = strtoupper(sanitize_text_field($prefix))
   │       ├── token = generate_secure_token($length)
   │       └── return PREFIX_token
   │
   ├── generate_short_token($length = 8)
   │       ├── token = generate_secure_token($length)
   │       └── return substr(token, 0, 12)
   │
   ├── generate_medium_token()
   │       ├── generate_secure_token(16)
   │       └── return 32 chars
   │
   ├── generate_long_token()
   │       ├── generate_secure_token(32)
   │       └── return 64 chars
   │
   ├── generate_expiring_token($hours = 24)
   │       ├── token = generate_medium_token()
   │       ├── expires = time() + (hours * 3600)
   │       └── return token|expires
   │
   ├── validate_expiring_token($token)
   │       ├── SE não contém '|'
   │       │       └── return false
   │       ├── list($hash, $expires) = explode('|')
   │       ├── SE time() > expires → return false
   │       └── return hash
   │
   ├── generate_convite_token()
   │       └── return generate_prefixed_token('CONV', 12)
   │
   ├── generate_acesso_token()
   │       └── return generate_prefixed_token('ACC', 16)
   │
   ├── generate_contratante_token()
   │       └── return generate_prefixed_token('CTR', 20)
   │
   └── generate_servico_token()
           └── return generate_prefixed_token('SRV', 12)


MAPA DAS TABELAS USADAS
Nenhuma tabela.
A classe é 100% independente.

DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Token_Generator
Gerador central de tokens seguros do PhotoMusic Pro.  
Cria tokens criptograficamente fortes usando random_bytes, com variações curtas, médias, longas, com prefixo e com expiração embutida.
Usado em convites, acessos à galeria, contratantes, serviços e qualquer parte do sistema que exija segurança e unicidade.
É totalmente independente e não depende de banco de dados.
