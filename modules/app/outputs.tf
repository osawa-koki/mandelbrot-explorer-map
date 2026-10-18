output "site_url" {
  description = "The URL of the site"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}/"
}

output "site_bucket_name" {
  description = "The name of the S3 bucket that stores the site files"
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.site.id
}
