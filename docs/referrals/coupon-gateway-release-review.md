# Public coupon gateway compatibility — release addendum

Fresh read-only production metadata shows `validate-discount-code` v14 has `verify_jwt=true`. The reviewed browser's `applyCode` sends its modern publishable key in `apikey`, without a user JWT. The public endpoint therefore needs explicit modern-key gateway compatibility in the release scope; version metadata alone does not establish its deployed source matches the repository.

Independent peer review approved deploying the **exact reviewed validator and dependencies** with this endpoint's gateway flag `verify_jwt=false`. It validates two fixed coupons, returns only eligibility/code/percentage, reads at most a matching redemption ID and performs no writes. Payment preparation independently revalidates the discount and authoritative total. Do not merely relax an unreviewed deployed v14 bundle, change other unrelated gateways, expose backend keys or treat an API key as user authentication.

Three formerly floating `@supabase/supabase-js@2` imports (`_shared/pricing.ts`, `_shared/discounts.ts`, `validate-discount-code/index.ts`) are explicitly pinned to `2.118.0`, the already validated root-lock resolution. No pricing, discount or authorization algorithm changed. Targeted Deno checking also exposed an existing catch-variable TypeScript error in the validator; its catch now returns a fixed public error instead of echoing upstream diagnostics.

All **355 unit checks** pass, including two added offline endpoint regressions. The peer independently reran those two tests (2/2) and reviewed these minimal changes with no blocking finding. Deno checks pass for the validator, quote, secure creation and purchase verification. No provider request, real coupon/customer transaction, function deployment or gateway change occurred.

Reviewed SHA-256:

| File | SHA-256 |
| --- | --- |
| `supabase/functions/_shared/pricing.ts` | `60388140e30498f4d5fb57dd7ed80839e9d9ffb27150cfafd2a50217afd26cf8` |
| `supabase/functions/_shared/discounts.ts` | `76debeeb1255d73ca0cbf8693aa010d7b2716f828e538dbf1ce0b5774dab498d` |
| `supabase/functions/validate-discount-code/index.ts` | `72954a543d34439870be584ba19338fcc43f37db611490ee4e4aebd906d61518` |
| `tests/unit/couponPublicEndpoint.test.mjs` | `0d35f66b819cd4c07e2af864d9fa1de7e784ecd2b46ae7b86a7bc5f502451720` |

Residuals are existing public-coupon behavior: supplied-email coupon-use status is observable; this legacy endpoint lacks streaming body bounds, strict method enforcement and additional rate limiting. These are not resolved or disguised by the gateway compatibility change. The new buyer verification endpoint retains its separate bounded stream and proof-before-mail-budget safeguards. Prior denied operations remain held; supplementary denied independent PostgreSQL testing was not retried.
