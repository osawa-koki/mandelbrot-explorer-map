output "site_url" {
  description = "The URL of the site"
  value       = module.app.site_url
}

output "site_bucket_name" {
  description = "The name of the S3 bucket that stores the site files"
  value       = module.app.site_bucket_name
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = module.app.cloudfront_distribution_id
}
