<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$conditions = vh_field( 'qualifying_conditions', array(
    'Chronic pain', 'PTSD', 'Anxiety', 'Glaucoma', 'Cancer', "Crohn's disease",
    'Epilepsy', 'Multiple sclerosis', 'HIV/AIDS', 'ALS', "Parkinson's", 'Terminal illness',
) );
?>
<section class="vh-section section conditions">
    <div class="container">
        <h2>Qualifying conditions in Florida</h2>
        <p class="section-intro">Florida law allows a medical marijuana physician to recommend cannabis for these conditions and others of comparable severity.</p>
        <div class="cond-grid" role="list">
            <?php foreach ( $conditions as $cond ) : ?>
                <div class="cond" role="listitem">
                    <?php echo vh_icon_svg( 'check' ); ?>
                    <?php echo esc_html( $cond ); ?>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>
