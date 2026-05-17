# WordPress

[WordPress](https://wordpress.org) is the most widely used content management system, powering roughly half the sites on the web. It serves everything from personal blogs to enterprise publishing platforms, and extends through a large plugin and theme ecosystem — including [WooCommerce](https://woocommerce.com) for e-commerce. Its popularity makes it a high-value target for automated attacks, particularly against the login page and the XML-RPC endpoint.

## Standard installation

Covers a standard WordPress installation. The login page and `xmlrpc.php` are rate-limited. The Gutenberg editor sends raw HTML that can trigger XSS and PHP detection rules, so the admin area starts in detect-only mode.

```yaml title="waf.yaml"
version: v1alpha1
host: example.com
data_dir: /data/barbacana

routes:
  - id: wp-login
    match:
      paths: [/wp-login.php]
    upstream: http://wordpress:80
    rate_limit:
      requests: 5
      window: 60s
      source:
        type: ip

  - id: wp-xmlrpc
    match:
      paths: [/xmlrpc.php]
    upstream: http://wordpress:80
    rate_limit:
      requests: 2
      window: 60s
      source:
        type: ip

  - id: wp-rest-api
    match:
      paths: [/wp-json/*]
    upstream: http://wordpress:80
    accept:
      content_types: [application/json]
      methods: [GET, POST, PUT, PATCH, DELETE]

  - id: wp-admin
    match:
      paths: [/wp-admin/*]
    upstream: http://wordpress:80
    mode: detect_only

  - id: frontend
    upstream: http://wordpress:80
```

### Tuning notes

After running the admin area in detect-only mode, the most likely matches you will see are in the `cross-site-scripting` and `php-injection` families — both fire on Gutenberg blocks that embed JavaScript or PHP-like shortcode syntax. Check each `matched_protections` entry against the [protection catalog](../reference/catalog.md) and disable the specific leaf, not the whole family, on the `wp-admin` route only.

The `wp-xmlrpc` route is rate-limited rather than blocked because Barbacana forwards all matched traffic to an upstream. If you do not use the WordPress mobile app or Jetpack, disable `xmlrpc.php` at the server level (Apache `<Files>` directive or Nginx `location` block) — Barbacana then never sees those requests.

---

## With WooCommerce

Extends the standard preset with separate routes for the WooCommerce REST API and checkout flow. The checkout route starts in detect-only mode because payment gateway plugins inject non-standard fields that are a common source of false positives.

```yaml title="waf.yaml"
version: v1alpha1
host: example.com
data_dir: /data/barbacana

routes:
  - id: wp-login
    match:
      paths: [/wp-login.php]
    upstream: http://wordpress:80
    rate_limit:
      requests: 5
      window: 60s
      source:
        type: ip

  - id: wp-xmlrpc
    match:
      paths: [/xmlrpc.php]
    upstream: http://wordpress:80
    rate_limit:
      requests: 2
      window: 60s
      source:
        type: ip

  - id: wc-rest-api
    match:
      paths: [/wp-json/wc/*]
    upstream: http://wordpress:80
    accept:
      content_types: [application/json]
      methods: [GET, POST, PUT, PATCH, DELETE]

  - id: wp-rest-api
    match:
      paths: [/wp-json/*]
    upstream: http://wordpress:80
    accept:
      content_types: [application/json]
      methods: [GET, POST, PUT, PATCH, DELETE]

  - id: wc-checkout
    match:
      paths: [/checkout/*, /cart/*]
    upstream: http://wordpress:80
    mode: detect_only

  - id: wp-admin
    match:
      paths: [/wp-admin/*]
    upstream: http://wordpress:80
    mode: detect_only

  - id: frontend
    upstream: http://wordpress:80
```

### Tuning notes

The most commonly reported false positive sources on WooCommerce are coupon code fields (which accept strings that can resemble SQL tokens) and payment gateway fields injected by Stripe, PayPal, and similar plugins. Review the audit log on the `wc-checkout` route and disable specific leaves under `sql-injection` or `cross-site-scripting` after confirming they fire on legitimate submissions.

WooCommerce REST API authentication uses OAuth 1.0a signatures in query parameters. If the audit log shows matches on the `wc-rest-api` route from authenticated API calls, check whether the signature values are triggering `sql-injection` leaves and disable the specific leaf on that route.

All standard WordPress tuning notes above apply.
