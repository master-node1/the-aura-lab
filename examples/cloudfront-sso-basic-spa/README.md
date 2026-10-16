# Example: basic SPA behind CloudFront + Entra ID SSO

An end-to-end test for `terraform-module-cloudfront-sso`. It does three things:

1. Calls the module (bucket, CloudFront, SSO edge auth).
2. Uploads a small static single-page app from `./site` to the module's bucket.
3. Invalidates the CloudFront cache when the site content changes.

The module is referenced as `source = "../../"`. Copy this folder into the module repo under `examples/` (for example `examples/basic-spa/`), or change `source` to point at the module.

## Layout

```text
.
├── versions.tf              # Terraform / AWS provider constraints
├── providers.tf             # default + us_east_1 providers, shared default tags
├── variables.tf             # module inputs as variables (with validation)
├── main.tf                  # module "cloudfront_sso"
├── site.tf                  # S3 upload, version.json, CloudFront invalidation
├── outputs.tf
├── terraform.tfvars.example
└── site/
    ├── index.html
    ├── favicon.svg
    ├── robots.txt
    └── assets/
        ├── app.js           # history-API router: /, /about, /diagnostics
        └── styles.css
```

## Prerequisites

- AWS credentials for the test account.
- An ACM certificate in **us-east-1** covering `domain_name`, and a DNS record pointing `domain_name` at the distribution. Create the record after the first apply, using the distribution domain.
- An Entra App Registration, with its client secret stored in Secrets Manager (us-east-1).
- The AWS CLI on the machine running Terraform, unless you set `invalidate_on_upload = false`.

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in real values; never commit this file
terraform init
terraform apply
```

After the first apply, add the `entra_redirect_uri` output as a **Web** redirect URI in the App Registration.

## Test checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Open `site_url` in a private window | Redirected to the Microsoft sign-in page |
| 2 | Sign in | Lands on "You are signed in" |
| 3 | Click About / Diagnostics | Page changes without a full reload |
| 4 | Reload on `/about` | Page still renders (SPA fallback to `index.html`) |
| 5 | Diagnostics → Deployed version | Matches the `site_version` output |
| 6 | Diagnostics → Cookies visible to JS | `(none …)`, which means the session cookie is HttpOnly |
| 7 | Browser console | No CSP violations, because the site has no inline JS or CSS |
| 8 | With `required_app_role` set, sign in as a user without the role | Access denied |
| 9 | `curl -I https://<bucket>.s3.<region>.amazonaws.com/index.html` | `403`, so the bucket is not public |
| 10 | Edit `site/index.html`, then `terraform apply` | Only that object changes, an invalidation runs, and the new version is served |

If check 4 fails, the module's distribution does not map 403/404 to `/index.html`. That matters for real SPAs that use history routing.

## Upload behaviour

- Every file under `site/` becomes one `aws_s3_object`. Change detection uses `source_hash`, so it works with SSE-S3 and SSE-KMS buckets.
- `Content-Type` comes from the file extension. Unknown extensions get `application/octet-stream`; to support another type, add it to `local.content_types`.
- `*.html` is uploaded with `Cache-Control: no-cache`. Everything else gets `public, max-age=300`.
- `version.json` holds a hash of all site content, and so does the invalidation trigger, so an invalidation runs only when content changes.
- No ACL is set on objects, so this works with `BucketOwnerEnforced` buckets.

## Clean up

```bash
terraform destroy
```

Destroy deletes the uploaded objects first. Lambda@Edge replicas can take up to an hour to be released, so the first destroy may fail on the edge function. If it does, run it again later.
