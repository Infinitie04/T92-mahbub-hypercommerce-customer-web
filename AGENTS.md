# T92 customer website guidance

This is the Hypercommerce customer storefront adapted for T92, a single-vendor wholesale garment business. The site uses the Next.js Pages Router in `src/pages/`, with API clients in `src/services/`. Read [the T92 business and backend guidance](../backend-panel/AGENTS.md) for shared requirements and open decisions. All business operations are managed in the admin panel.

- Use **Branch** wherever T92 customers see **Store**. Show the shared product catalog across locations. Use backend stock and fulfillment checks during checkout.
- Follow the T92 Home Builder configuration and hide home category tabs. Hide marketplace seller discovery and onboarding, wallet, Shiprocket-specific controls, and any other modules identified as unused for T92. Keep shared Hypercommerce code and data during the initial rollout.
- Display quantity-based wholesale prices and use backend pricing for cart and order totals. Support **Default** and **Quotation** checkout, with Indian and NRI billing.
- In quotation checkout, collect products, quantities, and proposed prices. Show the admin decision to the customer. After admin creates an order from an accepted quote, display its payment link in the customer's order details.
- Offer Razorpay and COD for new orders. Show COD only when the backend confirms eligibility for the products, destination, and order. Display advance payment or agreed payment terms for international wholesale orders.
- Show the shipping methods, rates, and estimates returned by the backend for the buyer's destination. For large international orders, offer a shipping quote request and show that the shipping charge is pending until agreed.
- Before buyer confirmation, display the final quotation or proforma invoice with shipping, customs duties, import taxes, and other destination charges as separate lines. Show the agreed Incoterm and identify charges payable separately by the buyer.

## Single-vendor storefront

- Treat the storefront as single-vendor on every render, including before settings load. Redirect legacy marketplace pages and keep them out of sitemaps. The Laravel API retains `system.systemVendorType` for existing API clients.
- Hide Wallet, Watch & Buy, and Refer & Earn, including direct routes. Cart pricing and order submission must keep wallet use disabled.
- Hide seller onboarding, marketplace store discovery, seller attribution, and seller feedback. Use **Branch** when customers need fulfillment context. Keep existing API fields such as `store_id` when the backend contract requires them.
- Follow the backend's checkout rules. A single vendor can have multiple branches. Show branch-specific validation messages if checkout is configured to require one branch.
- Keep seller IDs and ownership decisions on the backend. Build wholesale pricing, quotation, and billing UI against backend rules and responses as those endpoints become available.
