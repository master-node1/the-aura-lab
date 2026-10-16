# Uploads ./site to the bucket created by the module.
# Every file under ./site becomes an S3 object; editing a file and re-running
# `terraform apply` uploads only the changed objects and (optionally) invalidates CloudFront.

locals {
  site_dir   = "${path.module}/site"
  site_files = fileset(local.site_dir, "**")

  content_types = {
    html = "text/html; charset=utf-8"
    css  = "text/css; charset=utf-8"
    js   = "application/javascript; charset=utf-8"
    json = "application/json; charset=utf-8"
    svg  = "image/svg+xml"
    png  = "image/png"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    ico  = "image/x-icon"
    txt  = "text/plain; charset=utf-8"
    map  = "application/json; charset=utf-8"
  }

  # Fingerprint of all site content: drives version.json and the cache invalidation.
  site_hash = sha256(join("", [for f in sort(tolist(local.site_files)) : filesha256("${local.site_dir}/${f}")]))
}

resource "aws_s3_object" "site" {
  for_each = local.site_files

  bucket = module.cloudfront_sso.bucket_name
  key    = each.value
  source = "${local.site_dir}/${each.value}"

  # source_hash (not etag) so change detection also works with SSE-KMS buckets.
  source_hash  = filemd5("${local.site_dir}/${each.value}")
  content_type = lookup(local.content_types, lower(element(split(".", each.value), length(split(".", each.value)) - 1)), "application/octet-stream")

  # HTML must always be revalidated; assets can be cached at the edge.
  cache_control = endswith(each.value, ".html") ? "no-cache" : "public, max-age=300"
}

# Lets you confirm which content version CloudFront is serving (shown on the Diagnostics page).
resource "aws_s3_object" "version" {
  bucket        = module.cloudfront_sso.bucket_name
  key           = "version.json"
  content       = jsonencode({ version = substr(local.site_hash, 0, 12) })
  content_type  = "application/json; charset=utf-8"
  cache_control = "no-cache"
}

resource "terraform_data" "invalidate" {
  count = var.invalidate_on_upload ? 1 : 0

  triggers_replace = [local.site_hash]

  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${module.cloudfront_sso.distribution_id} --paths '/*'"
  }

  depends_on = [aws_s3_object.site, aws_s3_object.version]
}
