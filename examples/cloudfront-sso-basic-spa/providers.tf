locals {
  default_tags = {
    Application = "basic spa sso test"
    ManagedBy   = "Terraform"
    Owner       = "DL-Cloud-Architecture@dazn.com"
    GitRepo     = "https://github.com/getndazn/terraform-module-cloudfront-sso"
    Environment = "dev"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.default_tags
  }
}

# CloudFront-scoped resources (ACM, Lambda@Edge, edge secrets) must live in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.default_tags
  }
}
