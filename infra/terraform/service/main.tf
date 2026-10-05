locals {
  image = format(
    "%s.dkr.ecr.%s.amazonaws.com/%s/%s:%s",
    data.aws_caller_identity.current.account_id,
    var.aws_region,
    var.ecr_repository_prefix,
    var.service_name,
    var.image_tag,
  )

  secret_name = coalesce(var.secret_name, "${var.service_name}-secrets")

  selector_labels = {
    "app.kubernetes.io/name"     = var.service_name
    "app.kubernetes.io/instance" = "${var.service_name}-${var.environment}"
  }

  labels = merge(local.selector_labels, {
    "app.kubernetes.io/part-of"    = "the-aura-lab"
    "app.kubernetes.io/version"    = var.image_tag
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  container_env = merge(var.common_env, var.env, { PORT = tostring(var.container_port) })
}

resource "kubernetes_deployment_v1" "this" {
  metadata {
    name      = var.service_name
    namespace = var.namespace
    labels    = local.labels
  }

  wait_for_rollout = true

  spec {
    replicas               = var.min_replicas
    revision_history_limit = 5

    selector {
      match_labels = local.selector_labels
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "25%"
        max_unavailable = "0"
      }
    }

    template {
      metadata {
        labels = local.labels
      }

      spec {
        termination_grace_period_seconds = 30

        container {
          name              = var.service_name
          image             = local.image
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = var.container_port
          }

          dynamic "env" {
            for_each = local.container_env
            content {
              name  = env.key
              value = env.value
            }
          }

          env_from {
            secret_ref {
              name = local.secret_name
            }
          }

          resources {
            requests = {
              cpu    = var.cpu_request
              memory = var.memory_request
            }
            limits = {
              cpu    = var.cpu_limit
              memory = var.memory_limit
            }
          }

          # NestJS services run `prisma migrate deploy` before listening, so
          # allow up to ~3 minutes for the first successful health check.
          startup_probe {
            http_get {
              path = var.health_check_path
              port = "http"
            }
            period_seconds    = 5
            timeout_seconds   = 3
            failure_threshold = 36
          }

          readiness_probe {
            http_get {
              path = var.health_check_path
              port = "http"
            }
            period_seconds    = 10
            timeout_seconds   = 3
            failure_threshold = 3
          }

          liveness_probe {
            http_get {
              path = var.health_check_path
              port = "http"
            }
            period_seconds    = 20
            timeout_seconds   = 5
            failure_threshold = 3
          }

          security_context {
            allow_privilege_escalation = false
            run_as_non_root            = var.run_as_non_root

            dynamic "capabilities" {
              for_each = var.run_as_non_root ? [1] : []
              content {
                drop = ["ALL"]
              }
            }
          }
        }
      }
    }
  }

  timeouts {
    create = "10m"
    update = "10m"
    delete = "5m"
  }

  lifecycle {
    # The HPA owns the live replica count.
    ignore_changes = [spec[0].replicas]
  }
}

resource "kubernetes_service_v1" "this" {
  metadata {
    # Same name as the docker-compose service so in-cluster DNS
    # (e.g. http://identity-service:3001) keeps working unchanged.
    name        = var.service_name
    namespace   = var.namespace
    labels      = local.labels
    annotations = var.service_annotations
  }

  spec {
    type     = var.service_type
    selector = local.selector_labels

    port {
      name        = "http"
      port        = var.container_port
      target_port = "http"
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "this" {
  metadata {
    name      = var.service_name
    namespace = var.namespace
    labels    = local.labels
  }

  spec {
    min_replicas = var.min_replicas
    max_replicas = max(var.min_replicas, var.max_replicas)

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.this.metadata[0].name
    }

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = var.target_cpu_utilization
        }
      }
    }
  }
}

resource "kubernetes_pod_disruption_budget_v1" "this" {
  count = var.min_replicas > 1 ? 1 : 0

  metadata {
    name      = var.service_name
    namespace = var.namespace
    labels    = local.labels
  }

  spec {
    min_available = 1
    selector {
      match_labels = local.selector_labels
    }
  }
}
