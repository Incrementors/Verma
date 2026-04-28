<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$doctors = vh_field( 'fl_doctors', array(
    array( 'name' => 'Dr. S. Kapoor, MD', 'license' => 'ME-118233', 'initials' => 'SK' ),
    array( 'name' => 'Dr. M. Reyes, DO',  'license' => 'OS-27411',  'initials' => 'MR' ),
    array( 'name' => 'Dr. J. Tran, MD',   'license' => 'ME-141902', 'initials' => 'JT' ),
    array( 'name' => 'Dr. A. Brooks, MD', 'license' => 'ME-129055', 'initials' => 'AB' ),
) );
?>
<section class="vh-section section">
    <div class="container">
        <h2>Licensed Florida physicians, not chatbots.</h2>
        <p class="section-intro">Every recommendation comes from a board-certified doctor licensed by the Florida Department of Health.</p>
        <div class="doctors">
            <?php foreach ( $doctors as $doc ) : ?>
                <article class="doc">
                    <?php if ( ! empty( $doc['photo'] ) ) : ?>
                        <img class="doc-photo doc-photo--img" src="<?php echo esc_url( $doc['photo'] ); ?>" alt="" loading="lazy" width="88" height="88" />
                    <?php else : ?>
                        <div class="doc-photo" aria-hidden="true"><?php echo esc_html( $doc['initials'] ); ?></div>
                    <?php endif; ?>
                    <h3><?php echo esc_html( $doc['name'] ); ?></h3>
                    <p class="lic">FL Lic. № <?php echo esc_html( $doc['license'] ); ?></p>
                </article>
            <?php endforeach; ?>
        </div>
    </div>
</section>
