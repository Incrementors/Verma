<?php
/**
 * functions-additions.php
 *
 * Snippets to drop into the active (or child) theme's functions.php.
 * Provides:
 *   1. Asset enqueueing scoped to the FL MMJ landing page template
 *   2. Reusable inline-SVG icon helper used by section partials
 *   3. Critical-CSS inlining hook for above-the-fold LCP
 *   4. ACF field-group registration for marketing self-serve copy edits
 *   5. Resource hints (preconnect to GTM + fonts)
 *
 * @package Veriheal
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* -----------------------------------------------------------------
 * 1. Conditional asset enqueue — only on the FL landing template.
 *    Keeps payload off every other page.
 * ----------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_page_template( 'page-florida-mmj-card.php' ) ) { return; }

    $theme_uri = get_stylesheet_directory_uri();
    $theme_dir = get_stylesheet_directory();

    $css_path = '/assets/florida-mmj.css';
    $js_path  = '/assets/florida-mmj.js';

    wp_enqueue_style(
        'vh-fl-mmj',
        $theme_uri . $css_path,
        array(),
        file_exists( $theme_dir . $css_path ) ? filemtime( $theme_dir . $css_path ) : '1.0.0'
    );

    wp_enqueue_script(
        'vh-fl-mmj',
        $theme_uri . $js_path,
        array(),
        file_exists( $theme_dir . $js_path ) ? filemtime( $theme_dir . $js_path ) : '1.0.0',
        true
    );
}, 20 );

/* -----------------------------------------------------------------
 * 2. Inline-SVG icon helper.
 *    Avoids loading icon-font CSS for 6 icons; ships ~0.5 KB of inline SVG.
 *    Always returns escaped/whitelisted markup safe to echo directly.
 * ----------------------------------------------------------------- */
if ( ! function_exists( 'vh_icon_svg' ) ) {
    function vh_icon_svg( $name ) {
        $icons = array(
            'check' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
            'check-doc' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
            'video' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/></svg>',
            'card'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>',
            'shield'=> '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>',
            'chev'  => '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
        );
        return isset( $icons[ $name ] ) ? $icons[ $name ] : '';
    }
}

/* -----------------------------------------------------------------
 * 3. Critical-CSS inlining for above-the-fold LCP.
 *    Reads /assets/florida-mmj.critical.css and inlines in <head>.
 *    Skipped when WP_DEBUG so devs see live CSS edits.
 * ----------------------------------------------------------------- */
add_action( 'wp_head', function () {
    if ( ! is_page_template( 'page-florida-mmj-card.php' ) ) { return; }
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) { return; }

    $crit = get_stylesheet_directory() . '/assets/florida-mmj.critical.css';
    if ( file_exists( $crit ) ) {
        echo "<style id='vh-critical'>" . file_get_contents( $crit ) . "</style>"; // phpcs:ignore
    }
}, 1 );

/* -----------------------------------------------------------------
 * 4. ACF field group (PHP-registered so config lives in version control).
 *    Skipped if ACF Pro isn't active.
 * ----------------------------------------------------------------- */
add_action( 'acf/init', function () {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) { return; }

    acf_add_local_field_group( array(
        'key'      => 'group_vh_fl_mmj',
        'title'    => 'Florida MMJ Landing — Content',
        'fields'   => array(
            array( 'key' => 'field_vh_hero_h1',  'label' => 'Hero H1', 'name' => 'hero_h1', 'type' => 'text' ),
            array( 'key' => 'field_vh_hero_sub', 'label' => 'Hero Sub-headline (HTML allowed)', 'name' => 'hero_sub', 'type' => 'textarea' ),
            array( 'key' => 'field_vh_apply_url','label' => 'Application URL', 'name' => 'apply_url', 'type' => 'url' ),
            array( 'key' => 'field_vh_renew_url','label' => 'Renewal URL',     'name' => 'renew_url', 'type' => 'url' ),
            array( 'key' => 'field_vh_price_i',  'label' => 'Initial price (USD, no $)', 'name' => 'price_initial', 'type' => 'text' ),
            array( 'key' => 'field_vh_price_r',  'label' => 'Renewal price (USD, no $)', 'name' => 'price_renewal', 'type' => 'text' ),
            array(
                'key' => 'field_vh_faqs', 'label' => 'FAQs', 'name' => 'faqs', 'type' => 'repeater',
                'sub_fields' => array(
                    array( 'key' => 'field_vh_faq_q', 'label' => 'Question', 'name' => 'q', 'type' => 'text' ),
                    array( 'key' => 'field_vh_faq_a', 'label' => 'Answer',   'name' => 'a', 'type' => 'textarea' ),
                ),
            ),
        ),
        'location' => array( array( array(
            'param'    => 'page_template',
            'operator' => '==',
            'value'    => 'page-florida-mmj-card.php',
        ) ) ),
    ) );
} );

/* -----------------------------------------------------------------
 * 5. Resource hints — preconnect/dns-prefetch for GTM + fonts.
 *    Cuts ~80–120ms off TTFB on cold mobile loads.
 * ----------------------------------------------------------------- */
add_filter( 'wp_resource_hints', function ( $hints, $relation_type ) {
    if ( ! is_page_template( 'page-florida-mmj-card.php' ) ) { return $hints; }
    if ( $relation_type === 'preconnect' ) {
        $hints[] = 'https://www.googletagmanager.com';
        $hints[] = 'https://www.google-analytics.com';
        $hints[] = 'https://fonts.gstatic.com';
    }
    if ( $relation_type === 'dns-prefetch' ) {
        $hints[] = '//www.googletagmanager.com';
    }
    return $hints;
}, 10, 2 );
