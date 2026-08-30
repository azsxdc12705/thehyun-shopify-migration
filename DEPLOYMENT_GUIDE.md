# Shopify Theme Deployment Guide

This guide covers deploying the Shopify theme to a development store and preparing for production.

## Overview

The `shopify-theme/` directory contains a complete Shopify theme implementation of THE HYUN's Curated Collection product page and Subscription Builder quiz, ported from the Webflow-hosted HTML/CSS in `theme-port/`.

### What's Included

| Component | Purpose |
| --- | --- |
| `layout/theme.liquid` | Master layout for all pages (head, body wrapper, scripts) |
| `templates/product.liquid` | Curated Collection product page with buy widget |
| `templates/page.subscription-builder.liquid` | Subscription quiz flow |
| `assets/` | CSS (thyun.css), JavaScript (buy-widget.js, quiz.js, site.js), images, icons |
| `config/` | Theme settings schema and configuration |

### Key Features

✅ **Design Fidelity**: CSS and layout preserved from live site
✅ **Storefront API Integration**: Buy widget and quiz use Shopify's Storefront API
✅ **Mock Mode**: Runs in demo mode by default (no real checkout); configure for production
✅ **Liquid Templating**: Dynamic content binding via Shopify's Liquid language
✅ **Asset CDN**: All assets served via Shopify's asset CDN (optimal performance)

---

## Prerequisites

Before deploying, you'll need:

1. **Shopify Partner Account**
   - Sign up at https://partners.shopify.com

2. **Development Store**
   - In Partners dashboard, create a development store
   - Note the store domain: `{yourstore}.myshopify.com`

3. **Shopify CLI**
   ```bash
   npm install -g @shopify/cli @shopify/theme
   shopify version  # Verify installation
   ```

4. **Admin API Credentials**
   - Go to your dev store admin: `https://{yourstore}.myshopify.com/admin`
   - Settings → Apps and integrations → Develop apps and integrations
   - Create a new app (or use existing one)
   - Enable these Admin API scopes:
     - `write_themes`
     - `read_themes`
   - Generate access token
   - **Security**: Store the token securely; never commit it to git

---

## Quick Start (5 minutes)

### Step 1: Authenticate

```bash
# Interactive login (recommended)
shopify login --store=yourstore.myshopify.com

# Or use environment variables
export SHOPIFY_SHOP="yourstore.myshopify.com"
export SHOPIFY_THEME_TOKEN="shptka_xxxxxxxxxxxxx"
```

### Step 2: Push Theme

```bash
cd shopify-theme/
shopify theme push
```

The theme uploads as **unpublished**. You'll see:
```
✓ Pushed theme 123456789 to store
```

### Step 3: Preview & Publish

1. Go to your store admin: `https://yourstore.myshopify.com/admin`
2. Online Store → Themes
3. Find the new theme and click **Preview**
4. Once satisfied, click **Publish** to make it live (or keep testing)

---

## Detailed Setup

### Option A: Shopify CLI Authentication (Recommended)

Most straightforward for interactive development:

```bash
# Login to your partner account and dev store
shopify login --store=yourstore.myshopify.com

# You'll be prompted to open a browser and grant permissions
# CLI stores credentials in ~/.shopify-cli.yml (machine-specific, not in git)

# Verify it worked
shopify theme list  # Should show existing themes

# Now deploy
cd shopify-theme/
shopify theme push
```

### Option B: Environment Variables

For CI/CD or headless deployments:

```bash
# Get your credentials from the dev store admin as described above

# Create .env in repository root (already in .gitignore)
cat > .env << EOF
SHOPIFY_SHOP=yourstore.myshopify.com
SHOPIFY_THEME_TOKEN=shptka_xxxxxxxxxxxxx
EOF

# Deploy
cd shopify-theme/
shopify theme push --token $SHOPIFY_THEME_TOKEN --shop $SHOPIFY_SHOP
```

**Security**: `.env` is in `.gitignore`. Verify before committing:
```bash
git status  # Should NOT show .env
```

---

## Enable the Buy Widget (Production Mode)

By default, the theme runs in **demo mode** with mock checkout. To enable real Shopify checkout:

### 1. Get Storefront API Token

In your dev store admin:
1. Settings → Apps and integrations → Develop apps and integrations
2. Select your app
3. Configuration → Admin API → **Storefront API** section
4. Copy the Storefront access token
5. Note the scopes (should include `unauthenticated_read_product_inventory`)

### 2. Update Theme Configuration

**Method A: Theme Settings (Easiest)**

1. In your store admin, go to Online Store → Themes
2. Click **Customize** on the published theme
3. Look for settings that correspond to `config/settings_schema.json`
4. Add a setting for the Storefront token (you may need to extend settings_schema.json)

**Method B: Edit Liquid Templates**

Edit `shopify-theme/templates/product.liquid` and `shopify-theme/templates/page.subscription-builder.liquid`:

```liquid
<!-- In product.liquid, line ~165 -->
<div data-hyun-buy="curated-collection" 
     data-shop="{{ shop.permanent_domain }}" 
     data-token="YOUR_STOREFRONT_TOKEN_HERE">
</div>

<!-- In page.subscription-builder.liquid, line ~272 -->
<script>
  window.HYUN_QUIZ = { 
    shop: '{{ shop.permanent_domain }}', 
    token: 'YOUR_STOREFRONT_TOKEN_HERE' 
  };
</script>
```

Replace `YOUR_STOREFRONT_TOKEN_HERE` with the Storefront API token.

### 3. Push Changes

```bash
cd shopify-theme/
shopify theme push
```

Now the quiz and buy widget will create real Shopify carts and send customers to Shopify checkout.

---

## Fonts & Branding

### Adobe Typekit (URW Classico, Neue Haas Grotesk)

The theme loads fonts from Adobe Typekit kit `ixk3mkf` via `https://use.typekit.net/`.

**Before production**, add your Shopify domain to the kit's allowed domains:
1. Log in to typekit.adobe.com
2. Select kit `ixk3mkf`
3. Domains → Add `{yourstore}.myshopify.com`

Without this, fonts won't load on production.

### Custom Favicon

Currently using a placeholder (`assets/favicon.png`). To customize:
1. Prepare a 180×180 PNG
2. Upload to `shopify-theme/assets/favicon.png`
3. Push theme

---

## Newsletter Integration

The footer newsletter form currently submits to `/pages/newsletter` but has **no backend**. 

To enable:
- **Shopify Forms**: Built into Shopify; create a form in admin
- **Klaviyo**: Popular email platform; install the app and configure
- **Custom endpoint**: Build a serverless function to capture emails

Update the form `action` in `templates/product.liquid` and `templates/page.subscription-builder.liquid`:
```liquid
<form method="post" action="/pages/newsletter">
  <!-- or -->
  <form method="post" action="https://your-api.example.com/newsletter">
```

---

## Local Development

For real-time file watching and syncing:

```bash
cd shopify-theme/

# Watch local changes and push to dev store automatically
shopify theme dev --store=yourstore.myshopify.com

# Opens a preview URL in your browser
# Edit files locally, see changes in preview immediately
```

When you're done:
```
Press Ctrl+C to stop
```

---

## Troubleshooting

### "Unknown access token" or "Insufficient permissions"

→ Token may be expired or lack required scopes
→ Re-generate the token in store admin
→ Ensure scopes include `write_themes` and `read_themes`

### Assets not loading (404s)

→ Use `{{ 'filename' | asset_url }}` in Liquid templates
→ Check that files exist in `shopify-theme/assets/`
→ Verify file names match exactly (case-sensitive)

### Fonts not loading on production

→ Add Shopify domain to Typekit kit allowed domains
→ Verify CDN URLs in `layout/theme.liquid`

### Buy widget shows demo/mock mode on production

→ Verify Storefront token is set in template files
→ Check browser console for API errors
→ Ensure token has `unauthenticated_read_product_inventory` scope

### Cart count not updating

→ Quiz and buy widget create carts in Shopify
→ Cart count updates when page reloads
→ For live sync, implement a JavaScript cart sync listener (beyond current scope)

---

## Next Steps

### Before Publishing to Production

- [ ] Configure Shopify Payments or payment provider
- [ ] Set up shipping zones and rates
- [ ] Add tax configuration
- [ ] Enable Storefront API tokens (see **Enable the Buy Widget**)
- [ ] Test full checkout flow end-to-end
- [ ] Add your domain (thehyun.com) to Typekit allowed domains
- [ ] Set up analytics (Pixel, GTM, etc.)
- [ ] Configure email notifications (orders, shipments, etc.)
- [ ] Implement newsletter backend (Klaviyo, Shopify Forms, etc.)
- [ ] Create Terms & Conditions and Privacy Policy pages
- [ ] Review and customize footer (currently placeholder text)

### Optional Enhancements

- Create additional product pages as templates
- Add sections for reusable components
- Implement cart drawer for live cart preview
- Add product recommendations
- Set up abandoned cart emails
- Configure inventory sync with POS (Square)
- Build custom order tracking page

### Cutover Planning

When ready to migrate from Webflow to Shopify:
1. Set up redirects from old Webflow URLs to Shopify equivalents
2. Update DNS records to point domain to Shopify
3. Migrate other content (about, contact, etc.) to Shopify pages
4. Communicate changes to customers
5. Monitor analytics and performance
6. Deactivate Webflow ecommerce

---

## Support

- [Shopify Theme Development](https://shopify.dev/themes)
- [Liquid Reference](https://shopify.dev/api/liquid)
- [Shopify CLI Docs](https://shopify.dev/docs/themes/tools/cli)
- [Storefront API](https://shopify.dev/api/storefront)

For migration-specific questions, see `docs/` in the repository root.
