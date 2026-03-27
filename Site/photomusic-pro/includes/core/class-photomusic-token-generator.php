<?php
// includes/core/class-photomusic-token-generator.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Token_Generator {

    /**
     * Gera um token seguro usando random_bytes
     * @param int $length Tamanho em bytes (não caracteres)
     * @return string
     */
    public static function generate_secure_token($length = 16) {
        return bin2hex(random_bytes($length));
    }

    /**
     * Gera token com prefixo (ex: EVT_, SRV_, CON_)
     */
    public static function generate_prefixed_token($prefix, $length = 16) {
        $prefix = strtoupper(sanitize_text_field($prefix));
        return $prefix . '_' . self::generate_secure_token($length);
    }

    /**
     * Gera token curto (ideal para URLs)
     */
    public static function generate_short_token($length = 8) {
        return substr(self::generate_secure_token($length), 0, 12);
    }

    /**
     * Gera token médio (padrão para convites)
     */
    public static function generate_medium_token() {
        return self::generate_secure_token(16); // 32 chars
    }

    /**
     * Gera token longo (para contratante ou acesso crítico)
     */
    public static function generate_long_token() {
        return self::generate_secure_token(32); // 64 chars
    }

    /**
     * Gera token com expiração embutida (timestamp codificado)
     * Exemplo: TOKEN|1734567890
     */
    public static function generate_expiring_token($hours = 24) {
        $token = self::generate_medium_token();
        $expires = time() + ($hours * 3600);
        return $token . '|' . $expires;
    }

    /**
     * Valida token com expiração
     */
    public static function validate_expiring_token($token) {

        $token = sanitize_text_field($token);

        if (strpos($token, '|') === false) {
            return false;
        }

        list($hash, $expires) = explode('|', $token);

        $expires = intval($expires);

        if (time() > $expires) {
            return false;
        }

        return $hash;
    }

    /**
     * Gera token específico para convites
     */
    public static function generate_convite_token() {
        return self::generate_prefixed_token('CONV', 12);
    }

    /**
     * Gera token específico para acesso à galeria
     */
    public static function generate_acesso_token() {
        return self::generate_prefixed_token('ACC', 16);
    }

    /**
     * Gera token específico para contratante
     */
    public static function generate_contratante_token() {
        return self::generate_prefixed_token('CTR', 20);
    }

    /**
     * Gera token específico para serviços
     */
    public static function generate_servico_token() {
        return self::generate_prefixed_token('SRV', 12);
    }
}
