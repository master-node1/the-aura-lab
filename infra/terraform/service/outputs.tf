output "image" {
  description = "Fully qualified image deployed."
  value       = local.image
}

output "deployment_name" {
  value = kubernetes_deployment_v1.this.metadata[0].name
}

output "service_dns" {
  description = "In-cluster DNS name of the service."
  value       = "${kubernetes_service_v1.this.metadata[0].name}.${var.namespace}.svc.cluster.local:${var.container_port}"
}
