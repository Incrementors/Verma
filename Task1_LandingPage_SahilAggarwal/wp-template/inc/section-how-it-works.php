<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$steps = vh_field( 'how_steps', array(
    array(
        'title' => 'Quick online form',
        'desc'  => 'Answer a few questions about your health history. Takes about 5 minutes.',
        'icon'  => 'check-doc',
    ),
    array(
        'title' => 'Video visit with FL-licensed doctor',
        'desc'  => 'Same-day appointments available. Honest evaluation, no scripts.',
        'icon'  => 'video',
    ),
    array(
        'title' => 'Get your card within 24 hours',
        'desc'  => 'Recommendation submitted to the state. Most patients are approved next day.',
        'icon'  => 'card',
    ),
) );
?>
<section class="vh-section section" id="how-it-works">
    <div class="container">
        <h2>Three steps. One day.</h2>
        <p class="section-intro">No paperwork drives, no waiting rooms. Get certified entirely from your phone.</p>
        <div class="steps">
            <?php foreach ( $steps as $i => $step ) : ?>
                <article class="step">
                    <span class="step-num" aria-hidden="true"><?php echo (int) ( $i + 1 ); ?></span>
                    <div class="step-icon" aria-hidden="true">
                        <?php echo vh_icon_svg( $step['icon'] ); // safe: hardcoded SVGs ?>
                    </div>
                    <h3><?php echo esc_html( $step['title'] ); ?></h3>
                    <p><?php echo esc_html( $step['desc'] ); ?></p>
                </article>
            <?php endforeach; ?>
        </div>
    </div>
</section>
