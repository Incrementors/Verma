<?php
/**
 * Hero section. ACF-driven with safe literal fallbacks.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

$h1       = vh_field( 'hero_h1',  'Your Florida medical card, ready in 24 hours.' );
$sub      = vh_field( 'hero_sub', "Talk with a Florida-licensed doctor over a quick video visit. If you qualify, your state recommendation goes in the same day. If you don't, you pay nothing." );
$cta_url  = vh_field( 'apply_url', '/apply/florida' );
$rating   = vh_field( 'rating_score', '4.9' );
$rating_n = vh_field( 'rating_count', '12,000+' );
?>
<section class="vh-hero section">
    <div class="container">
        <div class="vh-hero__copy">
            <span class="eyebrow"><span class="dot" aria-hidden="true"></span> Florida residents only</span>
            <h1><?php echo esc_html( $h1 ); ?></h1>
            <p class="subhead"><?php echo wp_kses_post( $sub ); ?></p>
            <div class="cta-row">
                <a class="btn btn-primary" href="<?php echo esc_url( $cta_url ); ?>" data-cta="hero_apply">
                    Start My Application →
                </a>
                <a class="btn btn-ghost" href="#how-it-works">How it works</a>
            </div>
            <div class="trust-strip">
                <span class="stars" aria-hidden="true">★★★★★</span>
                <span><strong><?php echo esc_html( $rating ); ?></strong> · <?php echo esc_html( $rating_n ); ?> Florida patients</span>
            </div>
        </div>
        <aside class="hero-card" aria-label="Quick facts">
            <h3>What you get</h3>
            <p>A Florida MMJ certification from a state-licensed physician, all online.</p>
            <div class="hero-stats">
                <div class="stat"><div class="num">24h</div><div class="lbl">Avg. card delivery</div></div>
                <div class="stat"><div class="num">$99</div><div class="lbl">Flat fee</div></div>
                <div class="stat"><div class="num">100%</div><div class="lbl">Online visit</div></div>
            </div>
        </aside>
    </div>
</section>
