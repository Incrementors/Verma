<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$initial_price = vh_field( 'price_initial', '99' );
$renewal_price = vh_field( 'price_renewal', '79' );
$apply_url     = vh_field( 'apply_url', '/apply/florida' );
$renew_url     = vh_field( 'renew_url', '/apply/florida-renewal' );
?>
<section class="vh-section section pricing">
    <div class="container">
        <h2>Simple, flat pricing.</h2>
        <p class="section-intro">No subscriptions. No upsells. Pay only if a Florida-licensed physician approves your certification.</p>
        <div class="price-row">
            <div class="tile featured">
                <span class="tile-flag">Most popular</span>
                <h3>Initial certification</h3>
                <div class="price">$<?php echo esc_html( $initial_price ); ?><small> flat</small></div>
                <p>Includes the video visit and the state-recommendation submission.</p>
                <a class="btn btn-primary" href="<?php echo esc_url( $apply_url ); ?>" data-cta="pricing_initial">Start my application</a>
            </div>
            <div class="tile">
                <h3>Renewal</h3>
                <div class="price">$<?php echo esc_html( $renewal_price ); ?><small> flat</small></div>
                <p>For existing Florida MMJ patients renewing their state certification.</p>
                <a class="btn btn-ghost" href="<?php echo esc_url( $renew_url ); ?>" data-cta="pricing_renewal">Renew my card</a>
            </div>
        </div>
        <div class="guarantee" role="note">
            <?php echo vh_icon_svg( 'shield' ); ?>
            Money-back guarantee. If you're not approved, you don't pay.
        </div>
    </div>
</section>
