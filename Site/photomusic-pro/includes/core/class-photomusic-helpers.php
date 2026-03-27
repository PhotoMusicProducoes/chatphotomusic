<?php
// includes/core/class-photomusic-helpers.php

if (!defined('ABSPATH')) exit;

class PhotoMusic_Helpers {

    /* ============================================================
       SANITIZA TELEFONE
    ============================================================ */
    public static function sanitize_phone($phone) {
        $phone = is_string($phone) ? $phone : '';
        return preg_replace('/\D+/', '', $phone);
    }

    /* ============================================================
       GERA SLUG SEGURO
    ============================================================ */
    public static function slugify($string) {
        $string = sanitize_text_field($string);
        $string = strtolower(remove_accents($string));
        $string = preg_replace('/[^a-z0-9]+/', '-', $string);
        return trim($string, '-');
    }

    /* ============================================================
       GERA CÓDIGO INTERNO (EVENTOS, SERVIÇOS, ETC.)
    ============================================================ */
    public static function generate_code($prefix = 'EVT') {
        return $prefix . '-' . strtoupper(wp_generate_password(6, false, false));
    }

    /* ============================================================
       DEBUG SEGURO (APENAS PARA ADMIN)
    ============================================================ */
    public static function debug($data) {
        if (current_user_can('administrator')) {
            echo '<pre style="background:#111;color:#0f0;padding:10px;">';
            echo esc_html(print_r($data, true));
            echo '</pre>';
        }
    }

    /* ============================================================
       GERA HASH DO DISPOSITIVO
    ============================================================ */
    public static function device_hash() {

        // User Agent seguro
        $ua = isset($_SERVER['HTTP_USER_AGENT'])
            ? sanitize_text_field($_SERVER['HTTP_USER_AGENT'])
            : '';

        // Detecta IP real (proxy, cloudflare, load balancer)
        $ip = '';

        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $ip = $_SERVER['HTTP_CF_CONNECTING_IP']; // Cloudflare
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // Pode conter múltiplos IPs — pega o primeiro
            $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $ip = $_SERVER['HTTP_X_REAL_IP'];
        } elseif (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        }

        // Sanitiza IP
        $ip = sanitize_text_field(trim($ip));

        // Hash final
        return hash('sha256', $ua . '|' . $ip);
    }

    /* ============================================================
    HASH DE DISPOSITIVO — MOBILE (sem IP)
    Usado para convidados: IP muda entre Wi-Fi e dados móveis
    ============================================================ */
    public static function device_hash_mobile($telefone = '') {
        $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        return hash('sha256', $ua . '|' . $telefone);
    }

    /* ============================================================
    DETECTA NAVEGADOR
    ============================================================ */
    public static function detect_browser($ua = '') {
        if (empty($ua)) {
            $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        }
        if (stripos($ua, 'Edg')     !== false) return 'Edge';
        if (stripos($ua, 'Chrome')  !== false) return 'Chrome';
        if (stripos($ua, 'Firefox') !== false) return 'Firefox';
        if (stripos($ua, 'Safari')  !== false) return 'Safari';
        return 'Desconhecido';
    }

    /* ============================================================
    DETECTA DISPOSITIVO
    ============================================================ */
    public static function detect_device($ua = '') {
        if (empty($ua)) {
            $ua = sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '');
        }
        if (stripos($ua, 'iPhone')  !== false) return 'iPhone';
        if (stripos($ua, 'iPad')    !== false) return 'iPad';
        if (stripos($ua, 'Android') !== false) return 'Android';
        if (stripos($ua, 'Windows') !== false) return 'Windows';
        if (stripos($ua, 'Mac')     !== false) return 'Mac';
        return 'Desconhecido';
    }

    /* ============================================================
    VERIFICA SE É DISPOSITIVO MÓVEL
    ============================================================ */
    public static function is_mobile() {
        $ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
        return (
            strpos($ua, 'android') !== false ||
            strpos($ua, 'iphone')  !== false ||
            strpos($ua, 'ipad')    !== false ||
            strpos($ua, 'mobile')  !== false ||
            strpos($ua, 'tablet')  !== false
        );
    }

    /* ============================================================
       VALIDA TOKEN SHA256
    ============================================================ */
    public static function is_valid_sha256($token) {
        return preg_match('/^[a-f0-9]{64}$/', $token);
    }
}
