<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$faqs = vh_field( 'faqs', array(
    array(
        'q' => 'How long does the whole process take?',
        'a' => 'Most patients book a same-day appointment, complete the visit in about 15 minutes, and receive their state recommendation within 24 hours.',
    ),
    array(
        'q' => "What happens if I'm not approved?",
        'a' => "You don't pay. The $99 fee is fully refunded if a Florida-licensed physician determines you don't qualify under FL law.",
    ),
    array(
        'q' => 'Is my information private?',
        'a' => 'Yes. Your visit and records are HIPAA-protected, encrypted in transit and at rest, and never shared with advertisers.',
    ),
    array(
        'q' => 'Can I use my Florida card outside the state?',
        'a' => 'Some states honor reciprocity for visiting MMJ patients. We list current reciprocity states inside your patient dashboard once you are certified.',
    ),
    array(
        'q' => 'Do I need to be a Florida resident?',
        'a' => 'Yes. The Florida MMJ program requires proof of residency. A FL driver license, state ID, or a utility bill plus government ID will work.',
    ),
) );
?>
<section class="vh-section section" id="faq">
    <div class="container">
        <h2 style="text-align:center">Frequently asked questions</h2>
        <p class="section-intro" style="margin-left:auto;margin-right:auto;text-align:center">
            Quick answers about Florida MMJ certification with Veriheal.
        </p>
        <div class="faq-list">
            <?php foreach ( $faqs as $i => $faq ) :
                $qid = 'q' . ( $i + 1 );
                $aid = 'a' . ( $i + 1 );
            ?>
                <div class="faq-item">
                    <button class="faq-q"
                            aria-expanded="false"
                            aria-controls="<?php echo esc_attr( $aid ); ?>"
                            id="<?php echo esc_attr( $qid ); ?>">
                        <span><?php echo esc_html( $faq['q'] ); ?></span>
                        <?php echo vh_icon_svg( 'chev' ); ?>
                    </button>
                    <div class="faq-a"
                         id="<?php echo esc_attr( $aid ); ?>"
                         role="region"
                         aria-labelledby="<?php echo esc_attr( $qid ); ?>">
                        <?php echo esc_html( $faq['a'] ); ?>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<?php
// Inject FAQPage JSON-LD generated from the same data.
// Keeping schema and visible content aligned avoids "structured data mismatch" warnings.
$schema = array(
    '@context'   => 'https://schema.org',
    '@type'      => 'FAQPage',
    'mainEntity' => array_map( function( $f ) {
        return array(
            '@type'          => 'Question',
            'name'           => $f['q'],
            'acceptedAnswer' => array(
                '@type' => 'Answer',
                'text'  => $f['a'],
            ),
        );
    }, $faqs ),
);
?>
<script type="application/ld+json"><?php echo wp_json_encode( $schema ); ?></script>
