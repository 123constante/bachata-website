import { ScrollReveal } from '@/components/ScrollReveal';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { DiscountPartners } from '@/components/DiscountPartners';
import { CommunitySpotlight } from '@/components/CommunitySpotlight';

const Discounts = () => {
  useSeo(buildSeoForRoute('discounts'));

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('discounts')}
      hero={{
        titleWhite: 'Bachata',
        titleOrange: 'Organisers',
        // The city name is struck: this same component also serves
        // /city/:slug/discounts, where the hero would name one city while the
        // grid below queried another. The trailing clause about who is
        // currently active is struck too -- the grid renders nothing at all
        // when the RPC returns no rows, so that clause could announce a
        // section that is not there, and activity in it is an admin flag
        // rather than a fact about who is running events. What remains
        // asserts only the absence of a programme, which is the one thing
        // this page can actually evidence.
        //
        // Struck copy is DESCRIBED here, never quoted: comment text survives
        // into the server bundle and the sourcemaps, so a quoted phrase stays
        // findable in the build by anything grepping for it -- including a
        // fabrication guard, which would then red on the code that removed
        // the claim.
        subtitle:
          'Organisers and studios in the bachata community. No discount or membership programme exists yet.',
      }}
    >
      <ScrollReveal animation="fadeUp" duration={0.8}>
        <section className="px-4 mb-16">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <CommunitySpotlight />
          </div>
        </section>
      </ScrollReveal>

      <DiscountPartners />
    </GlobalLayout>
  );
};

export default Discounts;
