output "bucket_name" {
  description = "S3 bucket name for content deployment."
  value       = module.cloudfront_sso.bucket_name
}

output "distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = module.cloudfront_sso.distribution_id
}

output "entra_redirect_uri" {
  description = "Register this URI in the Entra App Registration."
  value       = module.cloudfront_sso.entra_redirect_uri
}

output "site_url" {
  description = "URL to open in a browser to test the SSO flow."
  value       = "https://${var.domain_name}/"
}

output "site_version" {
  description = "Content version expected in /version.json after deploy."
  value       = substr(local.site_hash, 0, 12)
}

output "uploaded_files" {
  description = "Object keys uploaded to the bucket."
  value       = sort(concat(keys(aws_s3_object.site), [aws_s3_object.version.key]))
}
