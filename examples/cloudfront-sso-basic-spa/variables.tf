variable "region" {
  description = "Region for the content bucket and other regional resources."
  type        = string
  default     = "eu-central-1"
}

variable "name" {
  description = "Name prefix passed to the module."
  type        = string
  default     = "ux-apps-portal"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for the site content."
  type        = string
}

variable "domain_name" {
  description = "Custom domain served by CloudFront. Must be covered by the ACM certificate."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 covering domain_name."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be an ACM certificate in us-east-1."
  }
}

variable "entra_tenant_id" {
  description = "Microsoft Entra ID tenant ID (GUID)."
  type        = string
}

variable "entra_client_id" {
  description = "Entra App Registration client (application) ID (GUID)."
  type        = string
}

variable "entra_client_secret_arn" {
  description = "Secrets Manager ARN (us-east-1) holding the Entra client secret."
  type        = string
}

variable "required_app_role" {
  description = "Optional Entra app role a user must hold to access the site. null disables the check."
  type        = string
  default     = null
}

variable "tags" {
  description = "Extra tags passed to the module."
  type        = map(string)
  default = {
    Team = "ux-apps"
  }
}

variable "invalidate_on_upload" {
  description = "Run `aws cloudfront create-invalidation` after site content changes. Requires the AWS CLI on the machine running Terraform."
  type        = bool
  default     = true
}
