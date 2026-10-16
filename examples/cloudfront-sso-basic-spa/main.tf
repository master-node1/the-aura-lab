module "cloudfront_sso" {
  source = "../../"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                    = var.name
  bucket_name             = var.bucket_name
  domain_name             = var.domain_name
  acm_certificate_arn     = var.acm_certificate_arn
  entra_tenant_id         = var.entra_tenant_id
  entra_client_id         = var.entra_client_id
  entra_client_secret_arn = var.entra_client_secret_arn
  required_app_role       = var.required_app_role

  # Optional: bring your own cookie-signing secret instead of letting the module create one.
  # cookie_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:my-cookie-secret-XyZwVu"

  # Optional: override the Content-Security-Policy baseline.
  # The test site uses no inline scripts/styles, so a strict "default-src 'self'" policy works.
  # content_security_policy = "default-src 'self'; ..."

  tags = var.tags
}
