terraform {
  required_version = ">= 1.16"

  # bucket・key・region などは backend.hcl で渡す
  backend "s3" {
    # S3 のネイティブロックで state をロックする
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.69"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "mandelbrot-explorer-map"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
