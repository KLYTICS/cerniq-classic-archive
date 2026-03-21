# ─── CERNIQ AWS Infrastructure ───────────────────────────────
# Primary: us-east-1 (N. Virginia — closest to PR, ~28ms latency)
# DR: us-east-2 (Ohio — active-passive warm standby)
# RTO: 4 hours | RPO: 1 hour

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }

  backend "s3" {
    bucket         = "cerniq-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cerniq-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.primary_region
  default_tags {
    tags = {
      Project     = "cerniq"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

# ─── Variables ───────────────────────────────────────────────

variable "environment" {
  type    = string
  default = "production"
}

variable "primary_region" {
  type    = string
  default = "us-east-1"
}

variable "dr_region" {
  type    = string
  default = "us-east-2"
}

variable "app_image" {
  type        = string
  description = "Docker image URI for the CERNIQ backend"
}

variable "db_password" {
  type      = string
  sensitive = true
}

# ─── VPC ─────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "cerniq-${var.environment}" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.primary_region}a"
  tags = { Name = "cerniq-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.primary_region}b"
  tags = { Name = "cerniq-private-b" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.10.0/24"
  availability_zone       = "${var.primary_region}a"
  map_public_ip_on_launch = true
  tags = { Name = "cerniq-public-a" }
}

# ─── ECS Fargate ─────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "cerniq-${var.environment}"
  setting { name = "containerInsights" value = "enabled" }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "cerniq-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"  # 1 vCPU
  memory                   = "2048"  # 2 GB
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "cerniq-backend"
    image = var.app_image
    portMappings = [{ containerPort = 3000 }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/cerniq-backend"
        "awslogs-region"        = var.primary_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "cerniq-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups = [aws_security_group.ecs.id]
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}

# ─── RDS PostgreSQL Multi-AZ ─────────────────────────────────

resource "aws_db_instance" "main" {
  identifier           = "cerniq-${var.environment}"
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t3.large"
  allocated_storage    = 100
  max_allocated_storage = 500
  storage_encrypted    = true
  multi_az             = true

  db_name  = "cerniq"
  username = "cerniq_app"
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "cerniq-final-${formatdate("YYYY-MM-DD", timestamp())}"
}

resource "aws_db_subnet_group" "main" {
  name       = "cerniq-${var.environment}"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# ─── ElastiCache Redis ───────────────────────────────────────

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "cerniq-${var.environment}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "cerniq-${var.environment}"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# ─── Security Groups ────────────────────────────────────────

resource "aws_security_group" "ecs" {
  name   = "cerniq-ecs-${var.environment}"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 3000; to_port = 3000; protocol = "tcp"; cidr_blocks = ["10.0.0.0/16"] }
  egress  { from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "rds" {
  name   = "cerniq-rds-${var.environment}"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 5432; to_port = 5432; protocol = "tcp"; security_groups = [aws_security_group.ecs.id] }
}

resource "aws_security_group" "redis" {
  name   = "cerniq-redis-${var.environment}"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 6379; to_port = 6379; protocol = "tcp"; security_groups = [aws_security_group.ecs.id] }
}

# ─── IAM Roles ───────────────────────────────────────────────

resource "aws_iam_role" "ecs_execution" {
  name = "cerniq-ecs-execution-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "cerniq-ecs-task-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

# ─── Outputs ─────────────────────────────────────────────────

output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "rds_endpoint" { value = aws_db_instance.main.endpoint }
output "redis_endpoint" { value = aws_elasticache_cluster.main.cache_nodes[0].address }
