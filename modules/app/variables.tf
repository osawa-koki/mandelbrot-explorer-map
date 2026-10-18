locals {
  environments = ["dev", "stg", "prod"]
}

variable "environment" {
  type        = string
  description = "Environment name"

  validation {
    condition     = contains(local.environments, var.environment)
    error_message = "Environment must be one of: ${join(", ", local.environments)}"
  }
}

variable "project_name" {
  type        = string
  description = "Project name"
  default     = "mandelbrot-explorer-map"
}

variable "cloudfront_price_class" {
  type        = string
  description = "Price class of the CloudFront distribution (PriceClass_200 includes Japan)"
  default     = "PriceClass_200"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.cloudfront_price_class)
    error_message = "cloudfront_price_class must be one of: PriceClass_100, PriceClass_200, PriceClass_All"
  }
}
