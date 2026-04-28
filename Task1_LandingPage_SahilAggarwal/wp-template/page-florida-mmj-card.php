<?php
/**
 * Template Name: Florida MMJ Card Landing
 * Template Post Type: page
 *
 * Drop this file into the active (or child) theme. WordPress will expose
 * "Florida MMJ Card Landing" in the Page Attributes > Template selector.
 *
 * The page content area is intentionally NOT used — every section below is
 * driven by structured ACF fields (or sensible fallbacks) so marketing can
 * iterate copy without touching markup. This keeps the template testable
 * and the markup stable for GTM selectors.
 *
 * @package Veriheal
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Helper: ACF if present, otherwise fall back to a literal default.
if ( ! function_exists( 'vh_field' ) ) {
    function vh_field( $key, $default = '' ) {
        if ( function_exists( 'get_field' ) ) {
            $val = get_field( $key );
            if ( ! empty( $val ) ) { return $val; }
        }
        return $default;
    }
}

get_header();

// Page-level data layer push: no PII, intent only.
// Patient identifiers fire post-form-submit, server-side (see GA4 spec).
?>
<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
    page_type: 'lp_state_signup',
    page_state: 'FL',
    product_type: 'initial_certification',
    consent_state: window.__veriheal_consent || 'pending'
});
</script>

<main id="main" class="vh-fl-lp">
    <?php
    // Section partials live alongside this template under /inc/.
    // Keeping them as separate includes makes it easy for marketing to
    // reorder, A/B test, or swap a section without merge conflicts.
    get_template_part( 'inc/section', 'hero' );
    get_template_part( 'inc/section', 'how-it-works' );
    get_template_part( 'inc/section', 'conditions' );
    get_template_part( 'inc/section', 'doctors' );
    get_template_part( 'inc/section', 'pricing' );
    get_template_part( 'inc/section', 'faq' );
    ?>
</main>

<?php
// Sticky mobile CTA — rendered outside <main> so it overlays consistently.
?>
<div class="vh-mob-cta" role="complementary" aria-label="Sticky application CTA">
    <a class="btn btn-primary"
       href="<?php echo esc_url( vh_field( 'apply_url', '/apply/florida' ) ); ?>"
       data-cta="mobile_sticky">
        Start my $99 application
    </a>
</div>

<?php get_footer();
