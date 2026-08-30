# THE HYUN Shopify Theme

This is a Shopify theme implementation of THE HYUN's Curated Collection and Subscription Builder pages, ported from Webflow to Shopify. It demonstrates option B of the migration plan: a full migration to Shopify with design fidelity preserved.

## Structure

| Directory | Contents |
| --- | --- |
| `layout/theme.liquid` | Master layout wrapping all pages |
| `templates/product.liquid` | Product page (Curated Collection) |
| `templates/page.subscription-builder.liquid` | Subscription builder page |
| `assets/` | CSS, JavaScript, images, and icons |
| `config/` | Theme configuration and settings |
| `sections/` | Modular page sections (extensible) |

## Setup & Deployment

### Prerequisites

1. Shopify Partner account with a development store
2. Shopify CLI installed (`npm install -g @shopify/cli`)
3. Admin API credentials (Storefront API token)

### Environment Setup

1. **Create a development store** (if you don't have one):
   - Go to https://partners.shopify.com → Development stores
   - Create a new dev store

2. **Get your Shopify credentials**:
   - Dev store domain: `yourstore.myshopify.com` (from Shopify Partners)
   - Storefront API token: 
     - In your dev store admin, go to Settings → Apps and integrations → Develop apps
     - Create an app and enable Admin API scopes: `write_themes`, `read_themes`
     - Generate and copy the access token

3. **Authenticate with Shopify CLI**:
   ```bash
   # Option A: Interactive login (recommended)
   shopify login --store=yourstore.myshopify.com
   
   # Option B: Create .env file (if you prefer environment variables)
   echo "SHOPIFY_SHOP=yourstore.myshopify.com" > .env
   echo "SHOPIFY_THEME_TOKEN=shptka_xxxxxxxxxxxxx" >> .env
   ```

### Push to Shopify

```bash
cd shopify-theme/

# Option A: Using Shopify CLI (after shopify login)
shopify theme push

# Option B: Using .env credentials
shopify theme push --token $SHOPIFY_THEME_TOKEN --shop $SHOPIFY_SHOP
```

The theme will be uploaded as an unpublished theme in your dev store. You can then:
- Preview it from the Shopify admin (Online Store → Themes)
- Publish it to make it live
- Continue developing with `shopify theme dev` for local changes

### Live Development

```bash
# Watch local files and sync to Shopify in real-time
shopify theme dev --store=yourstore.myshopify.com
```

## Configuration

### Buy Widget — native mode, no token

On-theme, the buy widget and quiz run in **native mode**: `snippets/
hyun-product-json.liquid` Liquid-renders the product's variant and selling
plan IDs into the page, and checkout goes through Shopify's Cart AJAX API
(`/cart/add.js` with `selling_plan` and the quiz preferences as line item
properties, then `/checkout`). **No Storefront API token, no app, no
configuration** — it works as soon as the theme is on the store, and the IDs
are always current because Liquid renders them per request.

The Storefront-API + token code paths in `assets/buy-widget.js` and
`assets/quiz.js` are still there (they activate when no
`#hyun-product-json` blob is on the page) — they exist for the option A
architecture, where the same scripts are embedded on Webflow and must reach
Shopify cross-origin. See `webflow-embed/`.

### Fonts

The theme uses:
- **Adobe Typekit**: URW Classico, Neue Haas Grotesk (kit `ixk3mkf`)
- **Google Fonts**: Ubuntu, Droid Sans, IBM Plex Sans KR, Noto Sans KR, Yeon Sung

The Typekit kit's allowed domains must include your Shopify domain at production cutover.

### Newsletter Signup

The footer newsletter form (`page.subscription-builder.liquid` and `templates/product.liquid`) submits to `/pages/newsletter`. Configure this to use:
- Shopify Forms
- Klaviyo integration
- Custom form processor

## Known Limitations

1. **Mock Mode**: By default, the buy widget and quiz run in mock mode (no real Shopify checkout) to match `theme-port/` demo behavior
2. **Font Licensing**: Typekit and custom fonts are loaded remotely; self-hosting requires license verification
3. **Cart Sync**: The cart icon count (`{{ cart.item_count }}`) is static in templates; implement cart drawer for full interactivity
4. **Form Backend**: Newsletter signup is visual-only; needs Shopify Forms or equivalent integration

## Migration Notes

This theme is the Liquid equivalent of `theme-port/`, which was an HTML/CSS port for local testing. Key differences:

- **Liquid templating**: Uses Shopify's Liquid language for dynamic content (product info, cart state)
- **Asset URLs**: All asset paths use Shopify's `asset_url` filter for CDN delivery
- **Shop context**: Uses `shop.permanent_domain` and `cart.item_count` for Shopify-native features
- **No Webflow dependencies**: All Webflow JS/CSS removed; styling is from ported CSS (`thyun.css`)

## Further Development

### Adding Sections

Create reusable page sections in `sections/`:
```liquid
<!-- sections/hero-banner.liquid -->
<div class="hero-banner">
  <h1>{{ section.settings.heading }}</h1>
</div>

{% schema %}
{
  "name": "Hero Banner",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading"
    }
  ]
}
{% endschema %}
```

### Adding Pages

Create custom page templates:
```liquid
<!-- templates/page.custom.liquid -->
{% if page.handle == 'my-page' %}
  <!-- custom page content -->
{% endif %}
```

## Support & Resources

- [Shopify Liquid Reference](https://shopify.dev/api/liquid)
- [Shopify CLI Documentation](https://shopify.dev/docs/themes/tools/cli)
- [Storefront API Docs](https://shopify.dev/api/storefront)
- Migration docs: `docs/` directory in repository root
